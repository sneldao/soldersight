#!/usr/bin/env python3
"""Staged render (avoids the 30-input single-graph stall):
A) each CUT -> work/seg/sNN.mp4 (lossless-ish intermediate)
B) concat -> work/video_cat.mp4
C) audio mix -> work/mix.wav (two-pass loudnorm to -14 LUFS / -1 dBTP)
D) final: video_cat + caption PNG seq + fade + mix -> out/soldersight-demo.mp4"""

import os
import sys
import json
import subprocess
import importlib.util

D = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("b", os.path.join(D, "build.py"))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
FF = "/usr/local/bin/ffmpeg" if os.path.exists("/usr/local/bin/ffmpeg") else "ffmpeg"
SEG = os.path.join(m.WK, "seg")
os.makedirs(SEG, exist_ok=True)
TOTAL = 106.0


def run(cmd):
    print("$", " ".join(cmd)[:300], flush=True)
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        print(r.stderr[-3000:])
        sys.exit(1)
    return r.stderr


# eased camera punch-ins rendered from a still frame (key = (clip, in_point) in build.CUTS)
PUNCHES = {
    ("b3_correct", 19.97): dict(
        src_t=19.97,
        c=(830.0, 742.5),
        z=1.6,  # "Board disposition right 0% -> 83%"
        boxes=[((292, 906, 1372, 942), 0.9)],
    ),
    ("b2_triage", 17.2): dict(
        src_t=17.2,
        c=(650.0, 480.0),
        z=1.6,  # mreq id + $cost + Mubit calls/latency/tokens/cost
        boxes=[((92, 392, 505, 472), 0.8), ((78, 500, 1222, 574), 1.3)],
    ),
}


def punch(out, clip, spec, dur):
    """Still frame + eased 1.0->z camera onto the subject, with accent outlines fading in
    (drawn in page space so they scale with the zoom)."""
    from PIL import Image, ImageDraw

    pd = os.path.join(m.WK, "punch")
    os.makedirs(pd, exist_ok=True)
    for f_ in os.listdir(pd):
        os.remove(os.path.join(pd, f_))
    still = os.path.join(pd, "still.png")
    run(
        [
            FF,
            "-y",
            "-ss",
            f"{spec['src_t']}",
            "-i",
            os.path.join(m.CL, f"{clip}.mp4"),
            "-frames:v",
            "1",
            still,
        ]
    )
    base = Image.open(still).convert("RGB")
    (cx, cy), ZMAX = spec["c"], spec["z"]

    def ease(u):
        return 4 * u**3 if u < 0.5 else 1 - (-2 * u + 2) ** 3 / 2

    for k in range(int(round(dur * 30))):
        tt = k / 30.0
        u = min(max((tt - 0.2) / 0.9, 0), 1)
        e = ease(u)
        z = 1 + (ZMAX - 1) * e + 0.03 * max(tt - 1.1, 0) / max(dur - 1.1, 1e-3)
        im = base.convert("RGBA")
        ov = Image.new("RGBA", im.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(ov)
        for box, t_on in spec["boxes"]:
            a = min(max((tt - t_on) / 0.3, 0), 1)
            if a > 0:
                d.rounded_rectangle(
                    box,
                    8,
                    outline=m.ORANGE + (int(255 * a),),
                    width=4,
                    fill=m.ORANGE + (int(28 * a),),
                )
        im = Image.alpha_composite(im, ov).convert("RGB")
        w, h = 1920 / z, 1080 / z
        x_c = 960 + (cx - 960) * e
        y_c = 540 + (cy - 540) * e
        x0 = min(max(x_c - w / 2, 0), 1920 - w)
        y0 = min(max(y_c - h / 2, 0), 1080 - h)
        im.resize((1920, 1080), Image.LANCZOS, box=(x0, y0, x0 + w, y0 + h)).save(
            os.path.join(pd, f"p_{k:04d}.png")
        )
    run(
        [
            FF,
            "-y",
            "-framerate",
            "30",
            "-i",
            os.path.join(pd, "p_%04d.png"),
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "12",
            "-pix_fmt",
            "yuv420p",
            "-color_range",
            "tv",
            "-r",
            "30",
            out,
        ]
    )


CAP_TOP = [
    (45.3, 49.6)
]  # captions go to the top while the 83% punch-in owns the bottom


def captions(capdir):
    """Own caption PNG sequence (one hardlinked PNG per 30fps frame) - uses build.py's
    chunking + pill renderer but nothing that encodes."""
    from PIL import Image

    capd = os.path.join(m.WK, "caps_stage")
    for d_ in (capd, capdir):
        os.makedirs(d_, exist_ok=True)
        for f_ in os.listdir(d_):
            os.remove(os.path.join(d_, f_))
    blank = os.path.join(capd, "blank.png")
    Image.new("RGBA", (1920, 1080), (0, 0, 0, 0)).save(blank)
    frames, n = [], 0
    for seg, off in m.VO_OFF.items():
        for ch in m.chunks(seg):
            fixed = [
                (
                    "SolderSight" + w["text"].rstrip()[len("soldersite") :]
                    if w["text"].lower().startswith("soldersite")
                    else w["text"]
                )
                for w in ch
            ]
            for i, w in enumerate(ch):
                img = m.caption_png(fixed, i)
                s0 = off + w["start"]
                y = (
                    70
                    if any(a <= s0 < b for a, b in CAP_TOP)
                    else 1080 - 150 - img.height
                )
                cv = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
                cv.paste(img, ((1920 - img.width) // 2, y), img)
                fp = os.path.join(capd, f"c_{n:04d}.png")
                cv.save(fp)
                n += 1
                frames.append((s0, off + w["end"], fp))
    frames.sort()
    for i in range(int(TOTAL * 30) + 30):
        t = i / 30.0
        # latest word whose start <= t, held 0.25s past its end so captions don't flicker between words
        src = blank
        for s0, e0, fp in frames:
            if s0 <= t < e0 + 0.25:
                src = fp
        os.link(src, os.path.join(capdir, f"cap_{i + 1:05d}.png"))
    return n


def segments():
    lst = os.path.join(m.WK, "seg_list.txt")
    with open(lst, "w") as f:
        for i, (c, a, b, *pad) in enumerate(m.CUTS):
            out = os.path.join(SEG, f"s{i:02d}.mp4")
            vf = f"trim=start={a}:end={b},setpts=PTS-STARTPTS"
            if pad and pad[0] > 0:
                vf += f",tpad=stop_duration={pad[0]}:stop_mode=clone"
            if (c, a) in PUNCHES:
                punch(out, c, PUNCHES[(c, a)], b - a)
                f.write(f"file '{out}'\n")
                continue
            vf += ",fps=30,scale=in_range=pc:out_range=tv,format=yuv420p"
            run(
                [
                    FF,
                    "-y",
                    "-i",
                    os.path.join(m.CL, f"{c}.mp4"),
                    "-vf",
                    vf,
                    "-an",
                    "-c:v",
                    "libx264",
                    "-preset",
                    "veryfast",
                    "-crf",
                    "12",
                    "-color_range",
                    "tv",
                    out,
                ]
            )
            f.write(f"file '{out}'\n")
    cat = os.path.join(m.WK, "video_cat.mp4")
    run([FF, "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", cat])
    return cat


def audio():
    inputs, fg, vol = [], [], []
    n = 0
    for k, f in m.VO_FILE.items():
        inputs += ["-i", f]
        d = int(m.VO_OFF[k] * 1000)
        fg.append(
            f"[{n}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={d}|{d},apad[vo{k}]"
        )
        vol.append(f"[vo{k}]")
        n += 1
    fg.append(
        "".join(vol)
        + f"amix=inputs={len(vol)}:normalize=0:duration=longest,atrim=0:{TOTAL}[vomix]"
    )
    fg.append("[vomix]asplit=2[vo_a][vo_key]")
    inputs += ["-i", os.path.join(m.AU, "bed.mp3")]
    fg.append(
        f"[{n}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:{TOTAL},afade=t=in:st=0:d=1,afade=t=out:st={TOTAL - 2}:d=2,volume=0.5[bed]"
    )
    n += 1
    fg.append(
        "[bed][vo_key]sidechaincompress=threshold=0.02:ratio=10:attack=30:release=700:makeup=1[bedd]"
    )
    sl = []
    for j, (name, at) in enumerate(m.SFX):
        inputs += ["-i", os.path.join(m.AU, name)]
        d = int(at * 1000)
        fg.append(
            f"[{n}:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.45,adelay={d}|{d},apad[s{j}]"
        )
        sl.append(f"[s{j}]")
        n += 1
    fg.append(
        "[vo_a][bedd]"
        + "".join(sl)
        + f"amix=inputs={2 + len(sl)}:normalize=0:duration=first,atrim=0:{TOTAL}[pre]"
    )
    raw = os.path.join(m.WK, "mix_raw.wav")
    run(
        [FF, "-y"]
        + inputs
        + [
            "-filter_complex",
            ";".join(fg),
            "-map",
            "[pre]",
            "-t",
            str(TOTAL),
            "-c:a",
            "pcm_s24le",
            raw,
        ]
    )
    err = run(
        [
            FF,
            "-i",
            raw,
            "-af",
            "loudnorm=I=-14:TP=-2.0:LRA=11:print_format=json",
            "-f",
            "null",
            "-",
        ]
    )
    js = json.loads(err[err.rindex("{") : err.rindex("}") + 1])
    af = (
        "loudnorm=I=-14:TP=-2.0:LRA=11:measured_I={input_i}:measured_TP={input_tp}:"
        "measured_LRA={input_lra}:measured_thresh={input_thresh}:offset={target_offset}:linear=true,"
        "aresample=48000"
    ).format(**js)
    mix = os.path.join(m.WK, "mix.wav")
    run([FF, "-y", "-i", raw, "-af", af, "-c:a", "pcm_s24le", mix])
    return mix


def final(cat, mix, capdir, out):
    run(
        [
            FF,
            "-y",
            "-i",
            cat,
            "-framerate",
            "30",
            "-i",
            os.path.join(capdir, "cap_%05d.png"),
            "-i",
            mix,
            "-filter_complex",
            f"[0:v]fade=t=out:st={TOTAL - 1.1}:d=1.0[fv];[fv][1:v]overlay=0:0:eof_action=pass:format=auto,format=yuv420p[video]",
            "-map",
            "[video]",
            "-map",
            "2:a",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-color_range",
            "tv",
            "-r",
            "30",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-ar",
            "48000",
            "-movflags",
            "+faststart",
            "-t",
            str(TOTAL),
            out,
        ]
    )


if __name__ == "__main__":
    skip_caps = "--nocaps" in sys.argv
    capdir = os.path.join(m.WK, "capseq_stage")
    if not skip_caps:
        ev = captions(capdir)
        print(ev, "caption states")
    if "--final-only" in sys.argv:
        cat, mix = os.path.join(m.WK, "video_cat.mp4"), os.path.join(m.WK, "mix.wav")
    else:
        cat = segments()
        mix = audio()
    out = os.path.join(m.OUT, "soldersight-demo.mp4")
    tmp = os.path.join(m.WK, "render_tmp.mp4")
    final(cat, mix, capdir, tmp)
    if "--no-publish" in sys.argv:
        print("BUILT", tmp)
        sys.exit(0)
    os.replace(tmp, out)
    print("BUILT", out)
