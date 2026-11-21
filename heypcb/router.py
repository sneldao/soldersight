#!/usr/bin/env python3
"""Offline route planner for the heypcb board 5e24315cfb29.

Parses the exported .kicad_pcb, builds a 2-layer occupancy grid on the
editor's 0.635 mm (25 mil) snap grid, A*-routes the three open connections,
and verifies the resulting polylines with exact geometry.
"""

import re
import math
import heapq

import os

KICAD = os.environ.get(
    "HEYPCB_PCB",
    "/Users/udingethe/Dev/soldersight/heypcb/export_t2/esp32-s3-pcb-inspection-camera.kicad_pcb",
)

CLR = 0.127  # board clearance rule
MARG = 0.02  # safety margin (tight; exact verifier + live DRC are the backstop)
PITCH = 0.635  # editor snap grid (used only as fallback)
FINE = 0.05  # fine planning grid
VIA_SIZE, VIA_DRILL = 0.45, 0.3
BOARD = (60.0, 40.0)

# ---------------- parsing ----------------


def parse():
    src = open(KICAD).read()
    segs, vias, pads, keepouts = [], [], {}, []
    for m in re.finditer(
        r'\(segment\s*\(start\s+([-\d.]+)\s+([-\d.]+)\)\s*\(end\s+([-\d.]+)\s+([-\d.]+)\)\s*\(width\s+([-\d.]+)\)\s*\(layer\s+"([^"]+)"\)\s*\(net\s+"([^"]+)"\)',
        src,
    ):
        segs.append(
            (
                float(m.group(1)),
                float(m.group(2)),
                float(m.group(3)),
                float(m.group(4)),
                float(m.group(5)),
                m.group(6),
                m.group(7),
            )
        )
    for m in re.finditer(
        r'\(via\s*\(at\s+([-\d.]+)\s+([-\d.]+)\)\s*\(size\s+([-\d.]+)\)\s*\(drill\s+([-\d.]+)\)\s*\(layers\s+"[^"]+"\s+"[^"]+"\)\s*\(net\s+"([^"]+)"\)',
        src,
    ):
        vias.append(
            (float(m.group(1)), float(m.group(2)), float(m.group(3)), m.group(5))
        )
    zs = [m.start() for m in re.finditer(r"\(zone\b", src)] + [len(src)]
    for i in range(len(zs) - 1):
        blk = src[zs[i] : zs[i + 1]]
        if "(keepout" not in blk or "not_allowed" not in blk:
            continue
        layer = re.search(r'\(layer\s+"([^"]+)"\)', blk).group(1)
        pidx = blk.find("(polygon")
        pts = [
            (float(a), float(b))
            for a, b in re.findall(
                r"\(xy\s+([-\d.]+)\s+([-\d.]+)\)", blk[pidx:] if pidx >= 0 else ""
            )
        ]
        keepouts.append((layer, pts))
    # footprints / pads
    fs = [m.start() for m in re.finditer(r"\(footprint\b", src)] + [len(src)]
    for i in range(len(fs) - 1):
        blk = src[fs[i] : fs[i + 1]]
        mref = re.search(r'\(property\s+"Reference"\s+"([^"]+)"', blk)
        if not mref:
            continue
        ref = mref.group(1)
        fat = re.search(r"\(at\s+([-\d.]+)\s+([-\d.]+)(?:\s+([-\d.]+))?\)", blk)
        fx, fy = float(fat.group(1)), float(fat.group(2))
        rot = float(fat.group(3) or 0.0)
        flay = re.search(r'\(footprint\s+"[^"]+"\s*\)\s*\(layer\s+"([FB])\.Cu"\)', blk)
        side = flay.group(1) if flay else "F"
        for pm in re.finditer(
            r'\(pad\s+"?([^"\s]+)"?\s+(smd|thru_hole|np_thru_hole|connect)\s+\w+\s*\(at\s+([-\d.]+)\s+([-\d.]+)(?:\s+([-\d.]+))?\)\s*\(size\s+([-\d.]+)\s+([-\d.]+)\)\s*\(layers\s+([^)]*)\)',
            blk,
        ):
            num, typ, px, py, prot, sw, sh, lays = (
                pm.group(1),
                pm.group(2),
                float(pm.group(3)),
                float(pm.group(4)),
                float(pm.group(5) or 0),
                float(pm.group(6)),
                float(pm.group(7)),
                pm.group(8),
            )
            nm = re.search(r'\(net\s+"([^"]*)"\)', blk[pm.start() : pm.start() + 500])
            net = nm.group(1) if nm else ""
            ca, sa = math.cos(math.radians(rot)), math.sin(math.radians(rot))
            # empirically: this exporter maps pad-local coords straight out (no bottom mirror)
            ax, ay = fx + px * ca - py * sa, fy + px * sa + py * ca
            thru = typ in ("thru_hole", "np_thru_hole")
            layers = (
                "B"
                if ('"B.Cu"' in lays and '"F.Cu"' not in lays)
                else ("F" if '"F.Cu"' in lays else "F")
            )
            # rect pad shape rotates with footprint + pad-local angle; use rotated bbox
            ang = math.radians(rot + prot)
            ew = abs(sw * math.cos(ang)) + abs(sh * math.sin(ang))
            eh = abs(sw * math.sin(ang)) + abs(sh * math.cos(ang))
            pads[f"{ref}.{num}"] = dict(
                x=ax, y=ay, w=ew, h=eh, side=layers, net=net, thru=thru, rot=rot
            )
    return segs, vias, pads, keepouts


SEGS, VIAS, PADS, KEEPOUTS = parse()

# ---------------- geometry helpers ----------------


def pt_seg(px, py, x1, y1, x2, y2):
    dx, dy = x2 - x1, y2 - y1
    L2 = dx * dx + dy * dy
    if L2 == 0:
        return math.hypot(px - x1, py - y1)
    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / L2))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))


def seg_seg(a, b, c, d):
    # exact segment-segment distance
    ex, ey = d[0] - c[0], d[1] - c[1]
    r = [b[0] - a[0], b[1] - a[1]]
    denom = r[0] * ey - r[1] * ex
    if abs(denom) > 1e-12:
        t = ((c[0] - a[0]) * ey - (c[1] - a[1]) * ex) / denom
        u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / denom
        if 0 <= t <= 1 and 0 <= u <= 1:
            return 0.0
    return min(
        pt_seg(*a, *c, *d), pt_seg(*b, *c, *d), pt_seg(*c, *a, *b), pt_seg(*d, *a, *b)
    )


def pt_rect(px, py, cx, cy, w, h):
    dx = max(abs(px - cx) - w / 2, 0.0)
    dy = max(abs(py - cy) - h / 2, 0.0)
    return math.hypot(dx, dy)


def seg_rect(p1, p2, cx, cy, w, h):
    # segment vs axis-aligned rect
    if pt_seg(cx, cy, *p1, *p2) <= 0 and pt_rect(cx, cy, p1[0], p1[1], 0, 0) == 0:
        pass
    # inside test: either endpoint inside
    for p in (p1, p2):
        if abs(p[0] - cx) <= w / 2 and abs(p[1] - cy) <= h / 2:
            return 0.0
    corners = [
        (cx - w / 2, cy - h / 2),
        (cx + w / 2, cy - h / 2),
        (cx + w / 2, cy + h / 2),
        (cx - w / 2, cy + h / 2),
    ]
    return min(seg_seg(p1, p2, corners[i], corners[(i + 1) % 4]) for i in range(4))


def pt_rect_exp(px, py, cx, cy, w, h, r):
    """distance from point to rect expanded by r (manhattan-ish box expansion)"""
    dx = max(abs(px - cx) - w / 2 - r, 0.0)
    dy = max(abs(py - cy) - h / 2 - r, 0.0)
    return math.hypot(dx, dy)


# ---------------- router ----------------


class Router:
    def __init__(self, net, half, roi, targets, start, start_layer, pitch=PITCH):
        """targets: list of (x, y, layer) own-net copper anchor points.
        start: (x, y) pad center; start_layer 'F'/'B'."""
        self.net, self.half, self.roi = net, half, roi
        self.targets, self.start, self.start_layer = targets, start, start_layer
        self.P = pitch
        x0, y0, x1, y1 = roi
        self.nx = int(round((x1 - x0) / pitch)) + 1
        self.ny = int(round((y1 - y0) / pitch)) + 1
        self.x0, self.y0 = x0, y0
        self.exp = half + CLR + MARG
        self.build_free()

    def gx(self, i):
        return self.x0 + i * self.P

    def gy(self, j):
        return self.y0 + j * self.P

    def build_free(self):
        nx, ny = self.nx, self.ny
        self.free = [
            bytearray(nx * ny) for _ in range(2)
        ]  # 0=free? start all 0=blocked? use 1=free
        self.viaok = bytearray(nx * ny)
        # start all free
        for l in range(2):
            self.free[l] = bytearray(b"\x01") * (nx * ny)
        exp = self.exp
        # segments
        for sx1, sy1, sx2, sy2, w, layer, net in SEGS:
            if net == self.net:
                continue
            li = 0 if layer == "F.Cu" else 1
            self._block_disc(sx1, sy1, sx2, sy2, w / 2 + exp, li)
        # vias block both layers
        for vx, vy, s, net in VIAS:
            if net == self.net:
                continue
            r = s / 2 + exp
            self._block_disc(vx, vy, vx, vy, r, 0)
            self._block_disc(vx, vy, vx, vy, r, 1)
        # pads
        for key, p in PADS.items():
            if p["net"] == self.net:
                continue
            r = exp
            rr = max(p["w"], p["h"]) / 2 + exp
            if p["thru"]:
                self._block_disc(p["x"], p["y"], p["x"], p["y"], rr, 0)
                self._block_disc(p["x"], p["y"], p["x"], p["y"], rr, 1)
            else:
                li = 0 if p["side"] == "F" else 1
                self._block_box(p["x"], p["y"], p["w"], p["h"], r, li)
        # keepouts: block both layers (rect expansion)
        for layer, pts in KEEPOUTS:
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            cx0, cx1, cy0, cy1 = min(xs), max(xs), min(ys), max(ys)
            self._block_box(
                (cx0 + cx1) / 2,
                (cy0 + cy1) / 2,
                cx1 - cx0,
                cy1 - cy0,
                self.half + MARG,
                0,
                only_interior=True,
            )
            self._block_box(
                (cx0 + cx1) / 2,
                (cy0 + cy1) / 2,
                cx1 - cx0,
                cy1 - cy0,
                self.half + MARG,
                1,
                only_interior=True,
            )
        # board edge
        inset = self.half + 0.3 + MARG
        for l in range(2):
            for j in range(ny):
                yy = self.gy(j)
                for i in range(nx):
                    xx = self.gx(i)
                    if (
                        xx < inset
                        or xx > BOARD[0] - inset
                        or yy < inset
                        or yy > BOARD[1] - inset
                    ):
                        self.free[l][j * nx + i] = 0
        # via ok: clear of other-net copper on both layers at via radius
        vexp = VIA_SIZE / 2 + CLR + MARG
        self.viaok = bytearray(b"\x01") * (nx * ny)
        for sx1, sy1, sx2, sy2, w, layer, net in SEGS:
            if net == self.net:
                continue
            li = 0 if layer == "F.Cu" else 1
            self._block_disc(sx1, sy1, sx2, sy2, w / 2 + vexp, li, mask=self.viaok)
        for vx, vy, s, net in VIAS:
            if net == self.net:
                continue
            self._block_disc(vx, vy, vx, vy, s / 2 + vexp, 0, mask=self.viaok)
            self._block_disc(vx, vy, vx, vy, s / 2 + vexp, 1, mask=self.viaok)
        for key, p in PADS.items():
            if p["net"] == self.net:
                continue
            rr = max(p["w"], p["h"]) / 2 + vexp
            if p["thru"]:
                self._block_disc(p["x"], p["y"], p["x"], p["y"], rr, 0, mask=self.viaok)
                self._block_disc(p["x"], p["y"], p["x"], p["y"], rr, 1, mask=self.viaok)
            else:
                li = 0 if p["side"] == "F" else 1
                self._block_box(
                    p["x"], p["y"], p["w"], p["h"], vexp, li, mask=self.viaok
                )
        inset = VIA_SIZE / 2 + 0.3 + MARG
        for j in range(ny):
            yy = self.gy(j)
            for i in range(nx):
                xx = self.gx(i)
                if (
                    xx < inset
                    or xx > BOARD[0] - inset
                    or yy < inset
                    or yy > BOARD[1] - inset
                ):
                    self.viaok[j * nx + i] = 0

    def _mark(self, cx, cy, r, li, mask=None, val=0, only_interior=False):
        nx, ny = self.nx, self.ny
        i0 = max(0, int((cx - r - self.x0) / self.P) - 1)
        i1 = min(nx - 1, int((cx + r - self.x0) / self.P) + 1)
        j0 = max(0, int((cy - r - self.y0) / self.P) - 1)
        j1 = min(ny - 1, int((cy + r - self.y0) / self.P) + 1)
        m = self.free[li] if mask is None else mask
        for j in range(j0, j1 + 1):
            yy = self.gy(j)
            row = j * nx
            for i in range(i0, i1 + 1):
                xx = self.gx(i)
                d = math.hypot(xx - cx, yy - cy)
                if d <= r and not (only_interior and d > r - 1e-9):
                    if (cx, cy) != (xx, yy) or True:
                        if d <= r:
                            m[row + i] = val

    def _block_disc(self, x1, y1, x2, y2, r, li, mask=None):
        # block cells within r of segment
        length = math.hypot(x2 - x1, y2 - y1)
        steps = max(1, int(length / (self.P / 3)) + 1)
        for s in range(steps + 1):
            t = s / steps
            cx, cy = x1 + (x2 - x1) * t, y1 + (y2 - y1) * t
            self._mark(cx, cy, r, li, mask=mask)

    def _block_box(self, cx, cy, w, h, r, li, mask=None, only_interior=False):
        nx, ny = self.nx, self.ny
        i0 = max(0, int((cx - w / 2 - r - self.x0) / self.P) - 1)
        i1 = min(nx - 1, int((cx + w / 2 + r - self.x0) / self.P) + 1)
        j0 = max(0, int((cy - h / 2 - r - self.y0) / self.P) - 1)
        j1 = min(ny - 1, int((cy + h / 2 + r - self.y0) / self.P) + 1)
        m = self.free[li] if mask is None else mask
        for j in range(j0, j1 + 1):
            yy = self.gy(j)
            row = j * nx
            for i in range(i0, i1 + 1):
                xx = self.gx(i)
                dx = max(abs(xx - cx) - w / 2 - r, 0.0)
                dy = max(abs(yy - cy) - h / 2 - r, 0.0)
                if only_interior:
                    if dx == 0 and dy == 0:
                        m[row + i] = 0
                elif dx == 0 and dy == 0:
                    m[row + i] = 0

    def node(self, x, y):
        return max(0, min(self.nx - 1, int(round((x - self.x0) / self.P)))), max(
            0, min(self.ny - 1, int(round((y - self.y0) / self.P)))
        )

    def target_cells(self):
        cells = {0: set(), 1: set()}
        for tx, ty, tl in self.targets:
            r = getattr(
                self, "target_r", self.half + 0.30
            )  # final leg from node to copper
            i0, i1, j0, j1 = self._win(tx, ty, r)
            li = 0 if tl == "F" else 1
            for j in range(j0, j1 + 1):
                for i in range(i0, i1 + 1):
                    if self.free[li][j * self.nx + i]:
                        cells[li].add((i, j))
        return cells

    def _win(self, cx, cy, r):
        i0 = max(0, int((cx - r - self.x0) / self.P))
        i1 = min(self.nx - 1, int((cx + r - self.x0) / self.P) + 1)
        j0 = max(0, int((cy - r - self.y0) / self.P))
        j1 = min(self.ny - 1, int((cy + r - self.y0) / self.P) + 1)
        return i0, i1, j0, j1

    def astar(self, via_cost=1.0):
        nx, ny = self.nx, self.ny
        # subsample anchors for a cheap heuristic
        anch = list({(round(tx, 2), round(ty, 2)) for (tx, ty, _t) in self.targets})
        step = max(1, len(anch) // 50)
        self.hanchors = anch[::step]
        tcells = self.target_cells()
        si, sj = self.node(*self.start)
        sl = 0 if self.start_layer == "F" else 1
        tlist = [(tl, i, j) for tl in (0, 1) for (i, j) in tcells[tl]]
        if not tlist:
            return None, "no target cells"

        def h(l, i, j):
            x, y = self.gx(i), self.gy(j)
            return min(math.hypot(x - tx, y - ty) for (tx, ty) in self.hanchors)

        # if start cell is itself a target (shouldn't happen)
        dist = {}
        pq = []
        heapq.heappush(pq, (h(sl, si, sj), 0.0, sl, si, sj))
        dist[(sl, si, sj)] = 0.0
        prev = {}
        DIRS = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
        while pq:
            f, g, l, i, j = heapq.heappop(pq)
            if (i, j) in tcells[l]:
                # reconstruct
                path = [(l, i, j)]
                while (l, i, j) in prev:
                    l, i, j = prev[(l, i, j)]
                    path.append((l, i, j))
                path.reverse()
                return path, g
            if g > dist.get((l, i, j), 1e18) + 1e-12:
                continue
            x, y = self.gx(i), self.gy(j)
            for di, dj in DIRS:
                ni, nj = i + di, j + dj
                if not (0 <= ni < nx and 0 <= nj < ny):
                    continue
                if not self.free[l][nj * nx + ni]:
                    continue
                if di and dj:  # no corner cutting
                    if not (self.free[l][j * nx + ni] and self.free[l][nj * nx + i]):
                        continue
                ng = g + self.P * (math.sqrt(2) if (di and dj) else 1.0)
                key = (l, ni, nj)
                if ng < dist.get(key, 1e18):
                    dist[key] = ng
                    prev[key] = (l, i, j)
                    heapq.heappush(pq, (ng + h(l, ni, nj), ng, l, ni, nj))
            # via
            ol = 1 - l
            if self.viaok[j * nx + i] and self.free[ol][j * nx + i]:
                ng = g + via_cost
                key = (ol, i, j)
                if ng < dist.get(key, 1e18):
                    dist[key] = ng
                    prev[key] = (l, i, j)
                    heapq.heappush(pq, (ng + h(ol, i, j), ng, ol, i, j))
        return None, "unreachable"

    def waypoints(self, path):
        """compress to corner list with layer annotations; via markers emitted at node"""
        out = []
        # remove duplicate consecutive nodes on different layers (via at same node)
        pts = []
        for l, i, j in path:
            x, y = self.gx(i), self.gy(j)
            if pts and abs(pts[-1][0] - x) < 1e-9 and abs(pts[-1][1] - y) < 1e-9:
                pts[-1] = (x, y, pts[-1][2], l)  # layer change at same node -> via here
                continue
            if (
                pts
                and len(pts[-1]) == 4
                and pts[-1][3] == l
                and pts[-1][0] == x
                and pts[-1][1] == y
            ):
                continue
            pts.append((x, y, l, l))
        # pts entries: (x, y, from_layer, to_layer) — from!=to means via at this point
        wps = []
        for k, (x, y, lf, lt) in enumerate(pts):
            entry = dict(
                x=round(x, 4),
                y=round(y, 4),
                layer="F" if lt == 0 else "B",
                via=(lf != lt),
            )
            wps.append(entry)

        # compress collinear
        def collinear(a, b, c):
            return (
                abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]))
                < 1e-9
            )

        comp = []
        for w in wps:
            if (
                len(comp) >= 2
                and not w["via"]
                and not comp[-1]["via"]
                and collinear(
                    (comp[-2]["x"], comp[-2]["y"]),
                    (comp[-1]["x"], comp[-1]["y"]),
                    (w["x"], w["y"]),
                )
            ):
                comp[-1] = w
            else:
                comp.append(w)
        return comp


# ---------------- exact verification ----------------


def verify(net, half, wps, start_xy, target_xy):
    """Build exact polyline (pad centers + waypoints on their layers), check
    clearance against every other-net item and keepouts. Returns list of issues."""
    issues = []
    # polyline pieces: list of (p1, p2, layer)
    pieces = []
    cur = None
    pts_seq = [start_xy] + [(w["x"], w["y"]) for w in wps] + [target_xy]
    lays = []
    for w in wps:
        lays.append(w["layer"])
    # segment layer = the layer it is drawn on = layer of its END waypoint (after any via)
    for k in range(len(pts_seq) - 1):
        layer = lays[k] if k < len(lays) else lays[-1]
        pieces.append((pts_seq[k], pts_seq[k + 1], layer))
    via_pts = [(w["x"], w["y"]) for w in wps if w["via"]]
    others_segs = [s for s in SEGS if s[6] != net]
    others_vias = [v for v in VIAS if v[3] != net]
    others_pads = [(k, p) for k, p in PADS.items() if p["net"] != net]
    for p1, p2, layer in pieces:
        li = 0 if layer == "F" else 1
        # same-layer other-net segments
        for sx1, sy1, sx2, sy2, w, sl, sn in others_segs:
            if ("F.Cu" if li == 0 else "B.Cu") != sl:
                continue
            d = seg_seg(p1, p2, (sx1, sy1), (sx2, sy2))
            margin = d - w / 2 - half
            if margin < CLR:
                issues.append(
                    ("seg", sn, round(margin, 4), (sx1, sy1, sx2, sy2), layer)
                )
        for vx, vy, s, vn in others_vias:
            d = pt_seg(vx, vy, *p1, *p2)
            margin = d - s / 2 - half
            if margin < CLR:
                issues.append(("via", vn, round(margin, 4), (vx, vy), layer))
        for k, p in others_pads:
            if p["thru"] or p["side"] == ("F" if li == 0 else "B"):
                d = seg_rect(p1, p2, p["x"], p["y"], p["w"], p["h"])
                margin = d - half
                if margin < CLR:
                    issues.append(
                        (
                            "pad",
                            f"{k}({p['net']})",
                            round(margin, 4),
                            (p["x"], p["y"]),
                            layer,
                        )
                    )
        # keepouts
        for klay, pts in KEEPOUTS:
            xs = [q[0] for q in pts]
            ys = [q[1] for q in pts]
            cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
            w, h = max(xs) - min(xs), max(ys) - min(ys)
            d = seg_rect(p1, p2, cx, cy, w, h)
            if d < half:
                issues.append(("keepout", klay, round(d - half, 4), (cx, cy), layer))
    for vx, vy in via_pts:
        for sx1, sy1, sx2, sy2, w, sl, sn in others_segs:
            d = pt_seg(vx, vy, sx1, sy1, sx2, sy2)
            margin = d - w / 2 - VIA_SIZE / 2
            if margin < CLR:
                issues.append(("via-vs-seg", sn, round(margin, 4), (vx, vy), sl))
        for ox, oy, s, vn in others_vias:
            d = math.hypot(vx - ox, vy - oy)
            margin = d - s / 2 - VIA_SIZE / 2
            if margin < CLR:
                issues.append(("via-vs-via", vn, round(margin, 4), (vx, vy), "-"))
        for k, p in others_pads:
            d = pt_rect(vx, vy, p["x"], p["y"], p["w"], p["h"])
            margin = d - VIA_SIZE / 2
            if margin < CLR:
                issues.append(
                    (
                        "via-vs-pad",
                        f"{k}({p['net']})",
                        round(margin, 4),
                        (vx, vy),
                        p["side"],
                    )
                )
        for klay, pts in KEEPOUTS:
            xs = [q[0] for q in pts]
            ys = [q[1] for q in pts]
            if (
                min(xs) - VIA_SIZE / 2 <= vx <= max(xs) + VIA_SIZE / 2
                and min(ys) - VIA_SIZE / 2 <= vy <= max(ys) + VIA_SIZE / 2
            ):
                margin = min(
                    vx - (max(xs) + VIA_SIZE / 2),
                    (min(xs) - VIA_SIZE / 2) - vx,
                    vy - (max(ys) + VIA_SIZE / 2),
                    (min(ys) - VIA_SIZE / 2) - vy,
                )
                issues.append(
                    ("via-vs-keepout", klay, round(margin, 4), (vx, vy), klay)
                )
    return issues


# ---------------- main ----------------


def report_net(net):
    ps = [
        (
            f'{k} ({p["net"]})',
            round(p["x"], 3),
            round(p["y"], 3),
            p["side"],
            "thru" if p["thru"] else "smd",
        )
        for k, p in PADS.items()
        if p["net"] == net
    ]
    print(f"--- net {net}: {len(ps)} pads")
    for t in ps:
        print("   ", t)
    ss = [s for s in SEGS if s[6] == net]
    vs = [v for v in VIAS if v[3] == net]
    print(f"    {len(ss)} segs, {len(vs)} vias existing")
    for s in ss:
        print(f"    seg ({s[0]},{s[1]})->({s[2]},{s[3]}) w={s[4]} {s[5]}")


if __name__ == "__main__":
    print(
        f"parsed: {len(SEGS)} segs, {len(VIAS)} vias, {len(PADS)} pads, {len(KEEPOUTS)} keepouts"
    )
    # rotations check
    rots = {round(p["rot"], 2) for p in PADS.values()}
    print("footprint rotations seen:", rots)
    report_net("GND")
    report_net("CAM_Y9")
    report_net("CAM_AVDD_2V8")
