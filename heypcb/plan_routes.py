#!/usr/bin/env python3
"""Plan the three open routes for board 5e24315cfb29."""

import math
from router import SEGS, VIAS, PADS, Router, verify, FINE


# ---------- copper connectivity per net (union-find) ----------
def components(net):
    items = []  # ('seg', idx) etc -> geometry
    segs = [s for s in SEGS if s[6] == net]
    vias = [v for v in VIAS if v[3] == net]
    pads = [(k, p) for k, p in PADS.items() if p["net"] == net]
    n = len(segs) + len(vias) + len(pads)
    parent = list(range(n))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    def sidx(i):
        return i

    def vidx(i):
        return len(segs) + i

    def pidx(i):
        return len(segs) + len(vias) + i

    EPS = 0.03
    # seg-seg
    for a in range(len(segs)):
        for b in range(a + 1, len(segs)):
            (x1, y1, x2, y2, w1, l1, _) = segs[a]
            (x3, y3, x4, y4, w2, l2, _) = segs[b]
            if l1 != l2:
                continue
            from router import seg_seg

            if seg_seg((x1, y1), (x2, y2), (x3, y3), (x4, y4)) <= w1 / 2 + w2 / 2 + EPS:
                union(a, b)
    # seg-via
    from router import pt_seg

    for a in range(len(segs)):
        (x1, y1, x2, y2, w1, l1, _) = segs[a]
        for b in range(len(vias)):
            (vx, vy, s, _) = vias[b]
            if pt_seg(vx, vy, x1, y1, x2, y2) <= w1 / 2 + s / 2 + EPS:
                union(a, vidx(b))
    # seg-pad / via-pad
    from router import seg_rect, pt_rect

    for a in range(len(segs)):
        (x1, y1, x2, y2, w1, l1, _) = segs[a]
        for b, (k, p) in enumerate(pads):
            lay = "F.Cu" if p["side"] == "F" else "B.Cu"
            if p["thru"] or lay == l1:
                if (
                    seg_rect((x1, y1), (x2, y2), p["x"], p["y"], p["w"], p["h"])
                    <= w1 / 2 + EPS
                ):
                    union(a, pidx(b))
    for b in range(len(vias)):
        (vx, vy, s, _) = vias[b]
        for c, (k, p) in enumerate(pads):
            if (
                pt_rect(vx, vy, p["x"], p["y"], p["w"], p["h"])
                <= s / 2 + max(p["w"], p["h"]) / 2 + EPS
                or math.hypot(vx - p["x"], vy - p["y"])
                <= s / 2 + min(p["w"], p["h"]) / 2 + EPS
            ):
                union(vidx(b), pidx(c))
    comps = {}
    for i in range(n):
        comps.setdefault(find(i), []).append(i)
    out = []
    for root, mem in comps.items():
        out.append(
            dict(
                segs=[segs[i] for i in mem if i < len(segs)],
                vias=[
                    vias[i - len(segs)]
                    for i in mem
                    if len(segs) <= i < len(segs) + len(vias)
                ],
                pads=[
                    pads[i - len(segs) - len(vias)]
                    for i in mem
                    if i >= len(segs) + len(vias)
                ],
            )
        )
    out.sort(key=len, reverse=True)
    return out


def island_anchors(net, roi, ref_pad):
    """anchors (x,y,layer) of copper in the component that contains ref_pad"""
    comps = components(net)
    big = None
    for c in comps:
        if any(k == ref_pad for k, p in c["pads"]):
            big = c
            break
    if big is None:
        big = comps[0]
    x0, y0, x1, y1 = roi
    anchors = []
    for s in big["segs"]:
        for px, py in ((s[0], s[1]), (s[2], s[3])):
            if x0 - 2 <= px <= x1 + 2 and y0 - 2 <= py <= y1 + 2:
                anchors.append((px, py, "F" if s[5] == "F.Cu" else "B"))
    for v in big["vias"]:
        if x0 - 2 <= v[0] <= x1 + 2 and y0 - 2 <= v[1] <= y1 + 2:
            anchors.append((v[0], v[1], "F"))
    for k, p in big["pads"]:
        if x0 - 2 <= p["x"] <= x1 + 2 and y0 - 2 <= p["y"] <= y1 + 2:
            anchors.append((p["x"], p["y"], p["side"]))
    return anchors, len(big["segs"]), len(big["vias"]), [k for k, p in big["pads"]]


def run(name, net, half, roi, targets, start, start_layer, pitch=FINE):
    print(f"===== {name} =====")
    r = Router(net, half, roi, targets, start, start_layer, pitch=pitch)
    path, g = r.astar()
    if path is None:
        print(f"  A* FAILED: {g}")
        return None
    wps = r.waypoints(path)
    print(f"  cost {g:.1f} mm, {len(wps)} waypoints:")
    for w in wps:
        print(
            f"    ({w['x']}, {w['y']}) layer {w['layer']}{'  <- VIA here' if w['via'] else ''}"
        )
    # verify final leg against the anchor nearest the last waypoint
    last = (wps[-1]["x"], wps[-1]["y"])
    tgt = min(targets, key=lambda t: math.hypot(t[0] - last[0], t[1] - last[1]))[:2]
    issues = verify(net, half, wps, start, tgt)
    if issues:
        print(f"  VERIFY: {len(issues)} issue(s):")
        for it in issues[:20]:
            print("   ", it)
    else:
        print("  VERIFY: clean (>=0.127 clearance everywhere)")
    return wps


if __name__ == "__main__":
    # ----- GND: J1.15 -> main island -----
    roi = (22.0, 22.0, 44.0, 39.9)
    anchors, ns, nv, pads_ = island_anchors("GND", roi, "C10.2")
    print(f"GND main island: {ns} segs {nv} vias pads={pads_}")
    print("anchors near J1.15:", [a for a in anchors])
    run("GND (0.3mm, B.Cu->island)", "GND", 0.15, roi, anchors, (31.75, 35.85), "B")

    # ----- CAM_Y9: U1.25 -> J1.12 -----
    run(
        "CAM_Y9 (0.2mm)",
        "CAM_Y9",
        0.10,
        (24.0, 18.0, 40.0, 39.9),
        [(30.25, 35.85, "B")],
        (35.715, 23.75),
        "F",
    )

    # ----- CAM_AVDD_2V8: J1.4 -> existing stub near U6 -----
    roi = (20.0, 0.0, 59.9, 39.9)
    anchors, ns, nv, pads_ = island_anchors("CAM_AVDD_2V8", roi, "U6.2")
    print(f"CAM_AVDD stub island: {ns} segs {nv} vias pads={pads_}")
    run("CAM_AVDD (0.3mm PWR)", "CAM_AVDD_2V8", 0.15, roi, anchors, (26.25, 35.85), "B")
