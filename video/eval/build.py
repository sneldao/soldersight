#!/usr/bin/env python3
"""Assemble the eval video: clips + VO + bed + SFX + captions -> out/the-scan.mp4
Usage: python3 video/eval/build.py"""

import json
import os
import subprocess

D = os.path.dirname(os.path.abspath(__file__))
CL, VO, AU, OUT, WK = (
    os.path.join(D, x) for x in ("clips", "vo", "audio", "out", "work")
)
DEMO_AU = os.path.join(D, "..", "demo", "audio")
os.makedirs(OUT, exist_ok=True)
os.makedirs(WK, exist_ok=True)

# scene -> (clip, vo_seg, lead_in). Scenes play end-to-end; each VO starts
# `lead_in` seconds after its own scene begins. Deriving the start from the
# real clip length (instead of hardcoding absolute offsets) keeps narration
# locked to picture when a scene is re-cut.
SCENES = [
    ("s1_xray", "01", 0.7),
    ("s2_task", "02", 0.4),
    ("s3_grader", "03", 0.4),
    ("s4_metrics", "04", 0.4),
    ("s5_exhibits", "05", 0.4),
    ("s6_reference", "06r", 0.4),
    ("teardown", "06", 0.4),
    ("s7_endcard", "07", 0.4),
]
CLIP_NAMES = [s[0] for s in SCENES]


def clip_dur(name):
    """Measured duration of a captured clip, in seconds."""
    out = subprocess.run(
        [
            os.environ.get("FFPROBE") or "ffprobe",
            "-v",
            "quiet",
            "-show_entries",
            "format=duration",
            "-of",
            "csv=p=0",
            os.path.join(CL, name + ".mp4"),
        ],
        capture_output=True,
        text=True,
    ).stdout.strip()
    return float(out)


def build_seg():
    """[(clip, vo_seg, absolute_vo_start)] from real clip lengths."""
    seg, t = [], 0.0
    for name, vo, lead in SCENES:
        seg.append((name, vo, t + lead))
        t += clip_dur(name)
    return seg, t


SEG, TOTAL = build_seg()
FADE_OUT_AT = (
    TOTAL - 1.0
)  # fade to black over the final second, after the last line lands


def scene_starts():
    """Absolute start of each scene, from real clip lengths."""
    t, out = 0.0, {}
    for name, _, _ in SCENES:
        out[name] = t
        t += clip_dur(name)
    return out


STARTS = scene_starts()

# SFX: (file, at_seconds, gain). Every cue is anchored to its scene start so it
# follows the clip lengths when a scene is re-cut.
SFX = [
    ("stamp.mp3", STARTS["s1_xray"] + 8.0, 0.7),  # GROUND TRUTH: SCRAP
    ("stamp.mp3", STARTS["s1_xray"] + 17.6, 0.6),  # 21 / 21 WRONG
    ("stamp.mp3", STARTS["s4_metrics"] + 28.5, 0.7),  # HALLUCINATION
    ("whoosh.mp3", STARTS["s5_exhibits"] + 0.4, 0.5),  # exhibits land
    ("stamp.mp3", STARTS["s5_exhibits"] + 26.4, 0.6),  # THEY DON'T KNOW
    ("whoosh.mp3", STARTS["s6_reference"] + 21.6, 0.5),  # golden reference swaps in
    ("stamp.mp3", STARTS["teardown"] + 55.6, 0.6),  # CALIBRATE PER MODEL
    ("ship.mp3", STARTS["s7_endcard"] + 0.4, 0.5),  # endcard word lands
]

FONT = "/System/Library/Fonts/Menlo.ttc"


def find_ffmpeg():
    """Pick an ffmpeg build that has the libass `subtitles` filter.

    The Homebrew ffmpeg on this machine is built without libass, so the
    default `ffmpeg` silently drops the caption burn-in. Probe the candidates
    and use the first one that can actually render ASS.
    """
    import shutil

    candidates = [
        os.path.expanduser("~/.local/bin/ffmpeg"),
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
        shutil.which("ffmpeg"),
    ]
    for c in candidates:
        if not c or not os.path.exists(c):
            continue
        try:
            out = subprocess.run(
                [c, "-hide_banner", "-filters"], capture_output=True, text=True
            ).stdout
        except OSError:
            continue
        if " subtitles " in out or " ass " in out:
            return c
    raise SystemExit(
        "no ffmpeg with libass found; captions cannot be burned in.\n"
        "install one (e.g. `brew install ffmpeg` with libass) or set FFMPEG=..."
    )


FFMPEG = os.environ.get("FFMPEG") or find_ffmpeg()


def ass_time(t):
    h = int(t // 3600)
    m = int(t % 3600 // 60)
    s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def build_captions():
    """Word-timestamped ASS captions from ElevenLabs alignment, offset by VO start."""
    lines = [
        "[Script Info]",
        "ScriptType: v4.00+",
        "PlayResX: 1920",
        "PlayResY: 1080",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
        "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, "
        "ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, "
        "MarginL, MarginR, MarginV, Encoding",
        "Style: Cap,Menlo,44,&H00EAF8EF,&H000000FF,&H00070A04,&H96070A04,"
        "1,0,0,0,100,100,0.5,0,1,2.2,1.2,2,90,90,110,1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    for _, seg, start in SEG:
        path = os.path.join(VO, f"{seg}.align.json")
        a = json.load(open(path))
        chars = a["characters"]
        starts = a["character_start_times_seconds"]
        ends = a["character_end_times_seconds"]
        # group chars into words, then chunks of ~4 words
        words = []
        cur, w0 = "", None
        for c, cs, ce in zip(chars, starts, ends):
            if c in " \n\t":
                if cur:
                    words.append((w0, ce, cur))
                    cur, w0 = "", None
            else:
                if w0 is None:
                    w0 = cs
                cur += c
        if cur:
            words.append((w0, ends[len(chars) - 1], cur))
        # Group into ~4-word chunks, but never leave a 1-word orphan on its own
        # line ("The boards are still" / "waiting.") — fold it into the previous.
        chunks, i = [], 0
        while i < len(words):
            n = 4 if len(words) - i != 5 else 5
            chunks.append(words[i : i + n])
            i += n
        for chunk in chunks:
            t0 = start + chunk[0][0]
            t1 = start + chunk[-1][1] + 0.12
            txt = " ".join(w[2] for w in chunk).replace("\\N", " ")
            lines.append(f"Dialogue: 0,{ass_time(t0)},{ass_time(t1)},Cap,,0,0,0,,{txt}")
    open(os.path.join(WK, "captions.ass"), "w").write("\n".join(lines))


def main():
    build_captions()

    # 1) concat clips
    lst = os.path.join(WK, "concat.txt")
    with open(lst, "w") as f:
        for n in CLIP_NAMES:
            f.write(f"file '{os.path.join(CL, n)}.mp4'\n")
    silent = os.path.join(WK, "picture.mp4")
    subprocess.run(
        [FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", silent],
        check=True,
        capture_output=True,
    )

    # 2) VO track: each mp3 delayed to its start, amixed
    vo_inputs = []
    for _, seg, _ in SEG:
        vo_inputs += ["-i", os.path.join(VO, f"{seg}.mp3")]
    sfx_inputs = []
    for fn, _, _ in SFX:
        p = os.path.join(DEMO_AU, fn)
        if not os.path.exists(p):
            p = os.path.join(AU, fn)
        sfx_inputs += ["-i", p]
    bed = os.path.join(DEMO_AU, "bed.mp3")

    filt = []
    for i, (_, seg, t) in enumerate(SEG):
        filt.append(f"[{1 + i}:a]adelay={int(t * 1000)}|{int(t * 1000)}[v{i}]")
    # bed looped, ducked
    ni = 1 + len(SEG) + len(SFX)
    filt.append(
        f"[{ni}:a]aloop=loop=1:size=2e9,atrim=0:{TOTAL:.1f},volume=0.14,"
        f"afade=t=in:st=0:d=1.5,afade=t=out:st={TOTAL-6:.1f}:d=5[bed]"
    )
    for j, (fn, t, g) in enumerate(SFX):
        idx = 1 + len(SEG) + j
        filt.append(f"[{idx}:a]adelay={int(t * 1000)}|{int(t * 1000)},volume={g}[s{j}]")
    mix_in = (
        "".join(f"[v{i}]" for i in range(len(SEG)))
        + "[bed]"
        + "".join(f"[s{j}]" for j in range(len(SFX)))
    )
    filt.append(
        f"{mix_in}amix=inputs={len(SEG) + 1 + len(SFX)}:normalize=0,"
        "alimiter=limit=0.9[aout]"
    )

    capt = os.path.join(WK, "captions.ass")
    out = os.path.join(OUT, "the-scan.mp4")
    cmd = (
        [FFMPEG, "-y", "-i", silent]
        + vo_inputs
        + sfx_inputs
        + [
            "-stream_loop",
            "1",
            "-i",
            bed,
            "-filter_complex",
            ";".join(filt),
            "-vf",
            f"subtitles='{capt}',format=yuv420p," f"fade=t=out:st={FADE_OUT_AT}:d=1.0",
            "-map",
            "0:v",
            "-map",
            "[aout]",
            "-t",
            f"{TOTAL:.3f}",
            "-c:v",
            "libx264",
            "-crf",
            "18",
            "-preset",
            "slow",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            out,
        ]
    )
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        print(r.stderr[-3000:])
        raise SystemExit(1)

    # loudness normalize in a second pass
    norm = os.path.join(OUT, "soldersight-eval-the-scan.mp4")
    subprocess.run(
        [
            FFMPEG,
            "-y",
            "-i",
            out,
            "-af",
            "loudnorm=I=-14:TP=-1:LRA=11",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            norm,
        ],
        check=True,
        capture_output=True,
    )
    dur = subprocess.run(
        [
            os.environ.get("FFPROBE") or "ffprobe",
            "-v",
            "quiet",
            "-show_entries",
            "format=duration",
            "-of",
            "csv=p=0",
            norm,
        ],
        capture_output=True,
        text=True,
    )
    print("wrote", norm, dur.stdout.strip(), "s")


if __name__ == "__main__":
    main()
