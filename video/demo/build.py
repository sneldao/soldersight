#!/usr/bin/env python3
"""SolderSight demo assembly. Re-runnable: python3 build.py
Reads clips/*.mp4 + vo/*.mp3 + audio/*.mp3 -> out/soldersight-demo.mp4
EDL: video/demo/edl.md (frozen)."""

import json
import os
import subprocess
import sys
from PIL import Image, ImageDraw, ImageFont

D = os.path.dirname(os.path.abspath(__file__))
CL, VO, AU, OUT, WK = (
    os.path.join(D, x) for x in ("clips", "vo", "audio", "out", "work")
)
os.makedirs(OUT, exist_ok=True)
os.makedirs(WK, exist_ok=True)

# segment VO start offsets (s) — EDL. 06b = fallback board line (00041003 gate)
VO_OFF = {
    "01": 0.6,
    "02": 13.2,
    "03": 29.4,
    "04": 49.6,
    "05": 66.2,
    "06b": 82.4,
    "07": 94.5,
}
VO_FILE = {k: os.path.join(VO, f"{k}.mp3") for k in VO_OFF}

# ---- video cut list: (clip, in, out) or (clip, in, out, pad_seconds) ----
CUTS = [
    ("b1a_board2", 0.4, 5.4),  # 0.0–5.0
    ("b1b_testimony", 0.4, 4.9),  # 5.0–9.5
    ("b1c_audit", 0.4, 3.9),  # 9.5–13.0
    ("b2_triage", 0.7, 4.0),  # 13–16.3 landing
    ("b2_triage", 4.2, 8.4),  # 17–21 pick+drag+click
    ("b2_triage", 8.5, 14.3),  # 20.5–26.3 results
    (
        "b2_triage",
        17.2,
        19.9,
    ),  # 26.3–29.0 PUNCH: still @17.2, eased 1.6x on mreq/cost + Mubit stat row (stage.py)
    ("b3_correct", 0.6, 4.0),  # 29–32.4 baseline card
    ("b3_correct", 4.2, 10.2),  # 33–39 reason typed
    ("b3_correct", 10.2, 13.4),  # 39–42 rules
    ("b3_correct", 13.4, 18.4),  # 42–47 compare+open·scrap
    (
        "b3_correct",
        19.97,
        22.87,
    ),  # 46.6–49.5 PUNCH: still @19.97 + eased 1.6x on 83% row (stage.py)
    ("b4_gate", 0.0, 6.03, 4.47),  # 49.5–60 gate+hold (BLOCK up ~51)
    ("b4b_stat", 0.4, 6.4),  # 60–66 14/14
    ("b5_evolve", 1.0, 17.2),  # 66–82.2 evolve -> SURVIVE
    ("b6_heal", 0.0, 8.53, 3.57),  # 82.2–94.3 heal -> SHIP hold
    ("b7_title", 0.4, 12.1),  # 94.3–106 title
]

SFX = [  # (file, at_seconds)
    (
        "stamp.mp3",
        11.9,
    ),  # BLOCK lands just after "ship" (new vo01: ship@11.14-11.44+0.6)
    ("whoosh.mp3", 13.0),
    ("ship.mp3", 76.2),  # SURVIVE lands in evolve (clip 11.2 @ seg start 66.0)
    ("stamp.mp3", 59.62),  # "Blocked" (04 @49.6 + 10.02)
    ("ship.mp3", 91.72),  # "Cleared" (06b @82.4 + 9.32)
]

# caption windows (abs s) where captions sit at the top (83% punch-in)
CAP_TOP = [(45.3, 49.6)]

INK, PAPER, ORANGE = (22, 24, 26), (246, 246, 245), (232, 98, 44)
FONT = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
if not os.path.exists(FONT):
    FONT = "/System/Library/Fonts/Helvetica.ttc"


def words_of(seg):
    d = json.load(open(os.path.join(VO, f"{seg}.stt.json")))
    arr = d.get("words") or (d if isinstance(d, list) else [])
    return [w for w in arr if w.get("type") == "word"]


def chunks(seg):
    """2–5-word caption chunks; split on sentence punctuation."""
    ws, out, cur = words_of(seg), [], []
    for w in ws:
        cur.append(w)
        if len(cur) >= 4 or w["text"].rstrip().endswith((".", "!", "?", "—")):
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


def caption_png(text_words, hot_idx):
    font = ImageFont.truetype(FONT, 54)
    pad_x, pad_y, gap, rad = 34, 18, 14, 28
    tmp = Image.new("RGBA", (10, 10))
    dr = ImageDraw.Draw(tmp)
    widths = [dr.textlength(w, font=font) for w in text_words]
    tw = int(sum(widths) + gap * (len(text_words) - 1))
    asc, desc = font.getmetrics()
    W_, H_ = tw + pad_x * 2, asc + desc + pad_y * 2
    img = Image.new("RGBA", (W_, H_), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)
    dr.rounded_rectangle([0, 0, W_ - 1, H_ - 1], rad, fill=PAPER + (235,))
    x = pad_x
    for i, (w, ww) in enumerate(zip(text_words, widths)):
        col = ORANGE + (255,) if i == hot_idx else INK + (255,)
        dr.text((x, pad_y), w, font=font, fill=col)
        x += ww + gap
    return img


def build_captions(capd=None, capdir=None):
    """PNG per word-state -> concat -> captions.mov (alpha)."""
    capd = capd or os.path.join(WK, "caps")
    os.makedirs(capd, exist_ok=True)
    blank = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
    blank_p = os.path.join(capd, "blank.png")
    blank.save(blank_p)
    events = []  # (abs_start, abs_end, path, w, h)
    n = 0
    for seg, off in VO_OFF.items():
        if seg == "07":  # end card already spells these words
            continue
        for ch in chunks(seg):
            fixed = [
                (
                    "SolderSight"
                    if w["text"].rstrip(".,\"'").lower().startswith("soldersite")
                    else w["text"]
                )
                for w in ch
            ]
            for i, w in enumerate(ch):
                img = caption_png(fixed, i)
                p = os.path.join(capd, f"c_{n:04d}.png")
                img.save(p)
                events.append(
                    (off + w["start"], off + w["end"], p, img.width, img.height)
                )
                n += 1
    # center each png horizontally at bottom (y = 1080-160) via per-event
    # canvas paste onto 1920x1080 transparent frame
    frames = []
    for s, e, p, w, h in events:
        canvas = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
        top = any(a <= s < b for a, b in CAP_TOP)  # keep punch-in subject clear
        y = 70 if top else 1080 - 150 - h
        canvas.paste(Image.open(p), ((1920 - w) // 2, y), Image.open(p))
        fp = p.replace(".png", "_f.png")
        canvas.save(fp)
        frames.append((s, e, fp))
    lst = os.path.join(capd, "list.txt")
    with open(lst, "w") as f:
        prev_end = 0.0
        for s, e, fp in sorted(frames):
            if s - prev_end > 0.001:
                f.write(f"file '{blank_p}'\nduration {s - prev_end:.3f}\n")
            f.write(f"file '{fp}'\nduration {max(e - s, 0.05):.3f}\n")
            prev_end = e
        f.write(f"file '{blank_p}'\n")
    capdir = capdir or os.path.join(WK, "capseq")
    os.makedirs(capdir, exist_ok=True)
    for f_ in os.listdir(capdir):
        os.remove(os.path.join(capdir, f_))
    # one file per 30fps output frame (hardlinks — no demuxer timing games)
    total_frames = 107 * 30
    ev_i = 0
    sframes = sorted(frames)
    for i in range(total_frames):
        t = i / 30.0
        while ev_i < len(sframes) and sframes[ev_i][1] <= t:
            ev_i += 1
        src = (
            sframes[ev_i][2]
            if ev_i < len(sframes) and sframes[ev_i][0] <= t
            else blank_p
        )
        dst = os.path.join(capdir, f"cap_{i + 1:05d}.png")
        try:
            os.link(src, dst)
        except FileExistsError:
            pass
    capmov = os.path.join(WK, "captions.mov")
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-framerate",
            "30",
            "-i",
            os.path.join(capdir, "cap_%05d.png"),
            "-c:v",
            "qtrle",
            "-pix_fmt",
            "rgba",
            capmov,
        ],
        check=True,
        capture_output=True,
    )
    return capmov, events


def build(capdir):
    vids = [os.path.join(CL, f"{c}.mp4") for c, *_ in CUTS]
    inputs = []
    for v in vids:
        inputs += ["-i", v]
    inputs += ["-i", capdir]
    cap_i = len(vids)
    vo_i = {}
    nxt = len(vids) + 1
    for k, f in VO_FILE.items():
        inputs += ["-i", f]
        vo_i[k] = nxt
        nxt += 1
    bed_i = nxt
    nxt += 1
    inputs += ["-i", os.path.join(AU, "bed.mp3")]
    sfx_i = []
    for name, _ in SFX:
        inputs += ["-i", os.path.join(AU, name)]
        sfx_i.append(nxt)
        nxt += 1

    fg = []
    labels = []
    for i, (c, a, b_, *pad) in enumerate(CUTS):
        v = f"[{i}:v]trim=start={a}:end={b_},setpts=PTS-STARTPTS"
        if pad and pad[0] > 0:
            v += f",tpad=stop_duration={pad[0]}:stop_mode=clone"
        v += f"[v{i}]"
        fg.append(v)
        labels.append(f"[v{i}]")
    n = len(CUTS)
    fg.append("".join(labels) + f"concat=n={n}:v=1:a=0[cat]")
    fg.append("[cat]fade=t=out:st=104.9:d=1.0[fv]")
    fg.append(f"[fv][{cap_i}:v]overlay=0:0:eof_action=pass:format=auto[video]")

    # audio
    volabels = []
    for k, idx in vo_i.items():
        d = int(VO_OFF[k] * 1000)
        fg.append(f"[{idx}:a]aresample=48000,adelay={d}|{d}[vo{k}]")
        volabels.append(f"[vo{k}]")
    fg.append("".join(volabels) + f"amix=inputs={len(volabels)}:normalize=0[vomix]")
    fg.append("[vomix]asplit=2[vo_a][vo_key]")
    fg.append(
        f"[{bed_i}:a]aresample=48000,atrim=0:106,"
        "afade=t=in:st=0:d=1,afade=t=out:st=104:d=2,volume=0.5[bed]"
    )
    fg.append(
        "[bed][vo_key]sidechaincompress=threshold=0.02:ratio=10:"
        "attack=30:release=700:makeup=1[bedd]"
    )
    sl = []
    for j, ((name, at), idx) in enumerate(zip(SFX, sfx_i)):
        fg.append(
            f"[{idx}:a]aresample=48000,volume=0.45,"
            f"adelay={int(at * 1000)}|{int(at * 1000)}[s{j}]"
        )
        sl.append(f"[s{j}]")
    fg.append(
        "[vo_a][bedd]" + "".join(sl) + f"amix=inputs={2 + len(sl)}:normalize=0,"
        "loudnorm=I=-14:TP=-1:LRA=11,aresample=48000[audio]"
    )

    cmd = (
        ["ffmpeg", "-y"]
        + inputs
        + [
            "-filter_complex",
            ";".join(fg),
            "-map",
            "[video]",
            "-map",
            "[audio]",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-crf",
            "18",
            "-r",
            "30",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            "-t",
            "106",
            os.path.join(OUT, "soldersight-demo.mp4"),
        ]
    )
    print(" ".join(cmd)[:400], "...")
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        print(r.stderr[-3000:])
        sys.exit(1)
    print("built", os.path.join(OUT, "soldersight-demo.mp4"))


if __name__ == "__main__":
    capdir, events = build_captions()
    print(f"{len(events)} caption word-states -> {capdir}")
    build(capdir)
