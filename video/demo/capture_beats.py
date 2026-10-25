# ruff: noqa: F405
"""Capture all demo beats -> video/demo/clips/bN_*.mp4"""

import sys
import os
import json
import urllib.request
import urllib.parse

sys.path.insert(0, os.path.dirname(__file__))
from caplib import *  # noqa: F403

VIDEO = "/Users/udingethe/Dev/soldersight/video"
APP = "http://localhost:5173"
BOARD = "00041003"  # gate-BLOCK board (00041004 never BLOCKs)


def post_json(url, data):
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode(),
        headers={"Content-Type": "application/json"},
    )
    return json.load(urllib.request.urlopen(req, timeout=120))


def verify_current(pg, board):
    """Grab the Inspection result from the DOM is hard; instead POST the UI's
    last result? Simpler: read window state isn't exposed. We verify via the
    backend using the regions the UI holds — replicate by triage API? No:
    the UI POSTs its own regions. For BLOCK check we read the gate card text
    after clicking Verify."""
    pass


# ---------- plates ----------
def plates(p):
    b, ctx = new_browser(p)
    pg = ctx.new_page()
    for name, url, dur in [
        ("b1a_board2", f"file://{VIDEO}/board2.html?demo", 6.0),
        ("b1b_testimony", f"file://{VIDEO}/iso-scenes.html?demo", 5.5),
        ("b1c_audit", f"file://{VIDEO}/plates.html#p1", 4.5),
        ("b4b_stat", f"file://{VIDEO}/plates.html#p2", 6.0),
        ("b7_title", f"file://{VIDEO}/plates.html#p4", 12.0),
    ]:
        pg.goto(url, wait_until="networkidle")
        pg.evaluate(CURSOR_JS)
        rec = Recorder(pg, name)
        rec.start()
        # slow cinematic drift so plates emit frames throughout
        pg.evaluate(f"__demo.drift(960,540,1.0,1.07,{int(dur * 1000)})")
        pg.wait_for_timeout(int(dur * 1000))
        rec.stop()
        out, fps, d = rec.assemble(min_dur=dur)
        print(f"{name}: {len(rec.frames)}fr {fps:.0f}fps {d:.1f}s")
    b.close()


# ---------- beat 2: triage ----------
def beat2(p):
    b, ctx = new_browser(p)
    pg = ctx.new_page()
    setup(pg, APP)
    pg.wait_for_timeout(800)
    rec = Recorder(pg, "b2_triage")
    rec.start()
    pg.wait_for_timeout(3000)  # landing hold
    move_click(pg, f'.thumb:has-text("{BOARD}")')  # pick board
    pg.wait_for_timeout(1200)
    # drag compare slider left->right
    handle = pg.locator('[data-rcs="handle-item"], [class*="handle"]').first
    try:
        hb = handle.bounding_box()
        pg.mouse.move(hb["x"] + hb["width"] / 2, hb["y"] + hb["height"] / 2)
        pg.mouse.down()
        for i in range(10):
            pg.mouse.move(hb["x"] - 200 + i * 40, hb["y"] + hb["height"] / 2)
            pg.wait_for_timeout(60)
        pg.mouse.up()
    except Exception as e:
        print("slider drag skip:", e)
    pg.wait_for_timeout(800)
    move_click(pg, 'button:has-text("Triage selected board")')
    pg.wait_for_timeout(700)  # brief skeletons
    pg.wait_for_selector(".region-grid", timeout=30000)
    pg.wait_for_timeout(1200)
    zoom(pg, ".region-grid .region-card:nth-child(2) .region-meta", 1.4)
    pg.wait_for_timeout(2200)  # mreq id on screen
    pg.evaluate("__demo.unzoom()")
    stat = pg.locator(".stat-grid").first
    stat.scroll_into_view_if_needed()
    zoom(pg, ".stat-grid", 1.5)
    pg.wait_for_timeout(1800)
    pg.evaluate("__demo.unzoom()")
    pg.wait_for_timeout(500)
    rec.stop()
    out, fps, d = rec.assemble()
    print(f"b2: {len(rec.frames)}fr {fps:.0f}fps {d:.1f}s -> {out}")
    return b, ctx, pg, rec  # keep page for beats 3/4 on same result


# ---------- beat 3: corrections+compare ----------
def beat3(pg):
    rec = Recorder(pg, "b3_correct")
    rec.start()
    # baseline card visible
    pg.locator(".region-grid").scroll_into_view_if_needed()
    pg.wait_for_timeout(2500)
    # correction form: pick open/critical/scrap + type reason (no save)
    move_click(pg, 'select:near(:text("Defect type"))') if False else None
    form = pg.locator("text=Correct the model").locator("..")
    form.scroll_into_view_if_needed()
    pg.wait_for_timeout(400)
    # defect type is a datalist input; severity/disposition are selects
    pg.locator("input[list], .field").first.fill("open")
    sels = pg.locator("select")
    sels.nth(0).select_option("critical")
    sels.nth(1).select_option("scrap")
    reason = pg.locator("textarea").last
    reason.click()
    pg.wait_for_timeout(300)
    for ch in "a bright gap is a broken trace, not clean copper":
        reason.type(ch, delay=45)
    pg.wait_for_timeout(1200)
    # rules panel
    pg.locator("text=What this line has taught").scroll_into_view_if_needed()
    pg.wait_for_timeout(2000)
    # compare lanes
    pg.locator('button:has-text("Compare lanes")').scroll_into_view_if_needed()
    move_click(pg, 'button:has-text("Compare lanes")')
    pg.wait_for_timeout(1000)
    pg.wait_for_selector("text=Adapted task", timeout=40000)
    pg.wait_for_timeout(800)
    # punch in on adapted "open · scrap · matches the labels"
    try:
        zoom(pg, "text=matches the labels", 1.5)
    except Exception:
        zoom(pg, ".compare-panel, [class*=compare]", 1.35)
    pg.wait_for_timeout(2500)
    pg.evaluate("__demo.unzoom()")
    # benchmark table row "Board disposition right 0% -> 83%"
    pg.locator("text=Board disposition right").first.scroll_into_view_if_needed()
    pg.wait_for_timeout(600)
    zoom(pg, 'tr:has-text("Board disposition right")', 1.55)
    pg.wait_for_timeout(2500)
    pg.evaluate("__demo.unzoom()")
    rec.stop()
    out, fps, d = rec.assemble()
    print(f"b3: {len(rec.frames)}fr {fps:.0f}fps {d:.1f}s -> {out}")


# ---------- beat 4: gate ----------
def beat4(pg):
    """Click verify; require BLOCK on screen. Caller retries beat2+3 if not."""
    rec = Recorder(pg, "b4_gate")
    rec.start()
    pg.locator('button:has-text("Verify against policy")').scroll_into_view_if_needed()
    move_click(pg, 'button:has-text("Verify against policy")')
    pg.wait_for_selector(".gate-panel", timeout=20000)
    pg.wait_for_timeout(900)
    action = pg.locator(".gate-panel").inner_text()
    pg.locator(".gate-panel").scroll_into_view_if_needed()
    pg.wait_for_timeout(600)
    zoom(pg, ".gate-panel", 1.35)
    pg.wait_for_timeout(3500)
    rec.stop()
    out, fps, d = rec.assemble()
    blocked = "BLOCK" in action
    print(
        f"b4: gate={'BLOCK' if blocked else action.splitlines()[1] if action else '?'} "
        f"{len(rec.frames)}fr {fps:.0f}fps {d:.1f}s"
    )
    return blocked, out


# ---------- beat 5/6: foundry ----------
def foundry(p):
    b, ctx = new_browser(p)
    pg = ctx.new_page()
    setup(pg, APP)
    pg.wait_for_timeout(800)
    pg.locator('[role=tab]:has-text("Foundry")').click()
    pg.wait_for_timeout(800)
    pg.locator('button:has-text("Hide Cue Card")').click()
    pg.wait_for_timeout(500)
    rec = Recorder(pg, "b5_evolve")
    rec.start()
    pg.wait_for_timeout(1500)
    move_click(pg, 'button:has-text("Run Evolve")')
    pg.wait_for_timeout(5500)
    # mid-run zoom on sparkline
    try:
        zoom(pg, "text=FITNESS", 1.4, 700)
    except Exception:
        pass
    pg.wait_for_timeout(7500)
    pg.evaluate("__demo.unzoom()")
    try:
        zoom(pg, ".sapling-card, [class*=sapling], text=SURVIVE", 1.4)
    except Exception:
        pass
    pg.wait_for_timeout(3000)
    rec.stop()
    out, fps, d = rec.assemble()
    print(f"b5: {len(rec.frames)}fr {fps:.0f}fps {d:.1f}s")

    pg.locator('[role=tab]:has-text("Heal")').click()
    pg.wait_for_timeout(1200)
    rec = Recorder(pg, "b6_heal")
    rec.start()
    pg.wait_for_timeout(2000)  # 0/3 defective hold
    move_click(pg, 'button:has-text("Heal Board")')
    pg.wait_for_timeout(3500)  # red->green
    pg.wait_for_selector("text=SHIP", timeout=20000)
    pg.wait_for_timeout(1000)
    try:
        zoom(pg, "text=POST-REPAIR POLICY GATE, .gate-panel, [class*=gate]", 1.4)
    except Exception:
        pass
    pg.wait_for_timeout(3000)
    pg.evaluate("__demo.unzoom()")
    rec.stop()
    out, fps, d = rec.assemble()
    print(f"b6: {len(rec.frames)}fr {fps:.0f}fps {d:.1f}s")
    b.close()


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    with sync_playwright() as p:
        if which in ("plates", "all"):
            plates(p)
        if which in ("app", "all"):
            for attempt in range(1, 6):
                b, ctx, pg, _ = beat2(p)
                beat3(pg)
                blocked, _ = beat4(pg)
                if blocked:
                    print("GATE BLOCK captured on 00041003, attempt", attempt)
                    b.close()
                    break
                print("no BLOCK, retrying", attempt)
                b.close()
        if which in ("foundry", "all"):
            foundry(p)
