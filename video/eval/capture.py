#!/usr/bin/env python3
"""Capture eval-video scenes -> video/eval/clips/sN_*.mp4
Each scene is a self-contained HTML file driven by its own seq() timeline.
Usage: python3 video/eval/capture.py [scene ...]   (default: all)
"""

import os
import sys

VIDEO = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(VIDEO, "..", "demo"))
from caplib import Recorder, new_browser  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

SCENES = [
    ("s1_xray", "s1_xray.html", 19.5),
    ("s2_task", "s2_task.html", 43.5),
    ("s3_grader", "s3_grader.html", 29.0),
    ("s4_metrics", "s4_metrics.html", 41.5),
    ("s5_exhibits", "s5_exhibits.html", 52.5),
    ("s6_ablation", "s6_ablation.html", 38.5),
    ("s7_endcard", "s7_endcard.html", 24.0),
    ("teardown", "teardown.html", 59.8),
]


def main(only=None):
    with sync_playwright() as p:
        for name, fname, dur in SCENES:
            if only and name not in only:
                continue
            b, ctx = new_browser(p)
            pg = ctx.new_page()
            pg.goto(f"file://{VIDEO}/scenes/{fname}", wait_until="networkidle")
            rec = Recorder(pg, name)
            rec.dir = os.path.join(VIDEO, "work", name)
            os.makedirs(rec.dir, exist_ok=True)
            rec.start()
            pg.wait_for_timeout(int(dur * 1000))
            rec.stop()
            out = os.path.join(VIDEO, "clips", f"{name}.mp4")
            os.makedirs(os.path.dirname(out), exist_ok=True)
            out, fps, d = rec.assemble(min_dur=dur, out=out)
            print(f"{name}: {len(rec.frames)}fr {fps:.0f}fps {d:.1f}s -> {out}")
            b.close()


if __name__ == "__main__":
    main(set(sys.argv[1:]) or None)
