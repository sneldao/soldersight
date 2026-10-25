"""SolderSight demo capture: Playwright + CDP screencast at 1920x1080.

Frames are saved as jpeg with their screencast timestamps; assemble() rebuilds
a constant-30fps mp4 via ffmpeg concat demuxer.
"""

import base64
import os
import subprocess
import time

W, H = 1920, 1080
CLIPS = os.path.join(os.path.dirname(__file__), "clips")
WORK = os.path.join(os.path.dirname(__file__), "work")

CURSOR_JS = r"""
window.__demo = (() => {
  const cur = document.createElement('div');
  cur.id = '__cursor';
  cur.style.cssText = 'position:fixed;left:-50px;top:-50px;z-index:2147483647;pointer-events:none;' +
    'filter:drop-shadow(0 3px 5px rgba(0,0,0,.45));will-change:transform;';
  cur.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24">' +
    '<path d="M4 2 L20 12.5 L12.6 13.4 L16.4 21 L13.2 22.3 L9.6 14.6 L4 18 Z" fill="#111" stroke="#fff" stroke-width="1.4"/></svg>';
  document.documentElement.appendChild(cur);
  const ease = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
  function to(x, y, ms=500) {
    return new Promise(res => {
      const m = cur.style.transform.match(/translate\((-?\d+\.?\d*)px,\s*(-?\d+\.?\d*)px\)/);
      const x0 = m ? +m[1] : -50, y0 = m ? +m[2] : -50;
      const t0 = performance.now();
      (function step(t) {
        const k = Math.min(1, (t - t0) / ms), e = ease(k);
        cur.style.transform = `translate(${x0+(x-x0)*e}px,${y0+(y-y0)*e}px)`;
        k < 1 ? requestAnimationFrame(step) : res(true);
      })(t0);
    });
  }
  function ripple(x, y) {
    const r = document.createElement('div');
    r.style.cssText = `position:fixed;left:${x-14}px;top:${y-14}px;width:28px;height:28px;border-radius:50%;` +
      'border:3px solid #e8622c;z-index:2147483646;pointer-events:none;opacity:.9;';
    document.documentElement.appendChild(r);
    r.animate([{transform:'scale(.4)',opacity:.9},{transform:'scale(2.2)',opacity:0}],{duration:450,easing:'ease-out'})
      .onfinish = () => r.remove();
  }
  function zoomTo(cx, cy, scale, ms=900) {
    const b = document.body;
    b.style.transition = `transform ${ms}ms cubic-bezier(.4,0,.2,1)`;
    b.style.transformOrigin = `${cx}px ${cy + window.scrollY}px`;
    b.style.transform = `scale(${scale})`;
    return new Promise(r => setTimeout(r, ms + 60));
  }
  function unzoom(ms=700) {
    const b = document.body;
    b.style.transition = `transform ${ms}ms cubic-bezier(.4,0,.2,1)`;
    b.style.transform = 'scale(1)';
    return new Promise(r => setTimeout(r, ms + 60));
  }
  function drift(cx, cy, s1, s2, ms) {
    // slow eased zoom between two scales — guarantees compositor motion
    const b = document.body;
    b.style.transition = 'none';
    b.style.transformOrigin = `${cx}px ${cy}px`;
    return new Promise(res => {
      const t0 = performance.now();
      (function step(t) {
        const k = Math.min(1, (t - t0) / ms);
        const e = .5 - .5 * Math.cos(Math.PI * k);
        b.style.transform = `scale(${s1 + (s2 - s1) * e})`;
        k < 1 ? requestAnimationFrame(step) : res(true);
      })(t0);
    });
  }
  return {to, ripple, zoomTo, unzoom, drift};
})();
"""


class Recorder:
    def __init__(self, pg, name):
        self.pg, self.name = pg, name
        self.dir = os.path.join(WORK, name)
        os.makedirs(self.dir, exist_ok=True)
        for f in os.listdir(self.dir):
            os.remove(os.path.join(self.dir, f))
        self.frames = []  # (path, ts)
        self.n = 0
        self.client = pg.context.new_cdp_session(pg)
        self.client.on("Page.screencastFrame", self._on_frame)
        self.t0 = None

    def _on_frame(self, ev):
        data = ev.get("data")
        sid = ev.get("sessionId")
        ts = (ev.get("metadata") or {}).get("timestamp")
        if self.t0 is None:
            self.t0 = ts
        self.n += 1
        path = os.path.join(self.dir, f"f_{self.n:05d}.jpg")
        with open(path, "wb") as f:
            f.write(base64.b64decode(data))
        self.frames.append((path, ts))
        try:
            self.client.send("Page.screencastFrameAck", {"sessionId": sid})
        except Exception:
            pass

    def start(self):
        self.client.send(
            "Page.startScreencast",
            {
                "format": "jpeg",
                "quality": 92,
                "maxWidth": W,
                "maxHeight": H,
                "everyNthFrame": 1,
            },
        )

    def stop(self):
        self.client.send("Page.stopScreencast")
        time.sleep(0.4)

    def assemble(self, min_dur=None, out=None):
        """Rebuild CFR mp4. min_dur pads last frame to reach duration."""
        if len(self.frames) < 1:
            raise RuntimeError(f"no frames for {self.name}")
        out = out or os.path.join(CLIPS, self.name + ".mp4")
        lst = os.path.join(self.dir, "list.txt")
        ts = [t for _, t in self.frames]
        total = ts[-1] - self.t0
        if min_dur and total < min_dur:
            total = min_dur
        with open(lst, "w") as f:
            for i, (p, t) in enumerate(self.frames):
                d = (ts[i + 1] - t) if i + 1 < len(ts) else (total - (t - self.t0))
                f.write(f"file '{p}'\nduration {max(d, 0.02):.4f}\n")
            f.write(f"file '{self.frames[-1][0]}'\n")
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                lst,
                "-vf",
                "fps=30,scale=1920:1080",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-crf",
                "18",
                out,
            ],
            check=True,
            capture_output=True,
        )
        fps_meas = len(self.frames) / (ts[-1] - self.t0) if ts[-1] > self.t0 else 0
        return out, fps_meas, total


def new_browser(p):
    b = p.chromium.launch(
        headless=True,
        channel="chrome",
        args=["--window-size=1920,1080", "--hide-scrollbars"],
    )
    ctx = b.new_context(viewport={"width": W, "height": H}, device_scale_factor=1)
    return b, ctx


def setup(pg, url):
    pg.goto(url, wait_until="networkidle")
    pg.evaluate(CURSOR_JS)


def center(pg, sel_or_el):
    el = pg.locator(sel_or_el) if isinstance(sel_or_el, str) else sel_or_el
    box = el.bounding_box()
    return box["x"] + box["width"] / 2, box["y"] + box["height"] / 2


def move_click(pg, sel, settle=350):
    """Glide cursor to element centre, ripple, click."""
    el = pg.locator(sel).first
    el.scroll_into_view_if_needed()
    pg.wait_for_timeout(200)
    x, y = center(pg, el)
    pg.evaluate(f"__demo.to({x},{y},450)")
    pg.wait_for_timeout(settle)
    pg.evaluate(f"__demo.ripple({x},{y})")
    pg.wait_for_timeout(160)
    el.click()


def zoom(pg, sel, scale=1.4, ms=900):
    el = pg.locator(sel).first
    box = el.bounding_box()
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    pg.evaluate(f"__demo.zoomTo({cx},{cy},{scale},{ms})")
    return cx, cy
