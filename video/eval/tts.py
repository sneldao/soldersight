#!/usr/bin/env python3
"""Generate narration VO via ElevenLabs -> video/eval/vo/NN.mp3"""

import base64
import json
import os
import re
import sys
import requests

KEY = os.environ["ELEVENLABS_API_KEY"]
VOICE = "uLfPT2jUO3X81OwnftBP"  # Keith - Warm East African Narrator
MODEL = "eleven_v3"  # falls back to multilingual_v2 if rejected
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vo")

SEGS = {
    "01": """This is a scan of a dead board. Somewhere in it — a forty pixel
lesion. An open circuit. Fatal. We showed this scan to seven of the world's
most capable vision models. Each one is a diagnostician. And every single
one of them got the diagnosis wrong.""",
    "02": """Every board that ships — phone, car, implant — passed through an
inspector exactly like this. The task is a diagnosis: name the lesion —
open, short, mousebite, spur, stray copper, pinhole — then rule on
disposition: pass, rework, scrap. The rules are in the prompt; the ground
truth is expert-labelled DeepPCB. Two hundred and seven tasks in two
suites: the whole board as the camera sees it, and the magnified crop a
real pipeline sends.""",
    "03": """Grading is code, not judgment. The expert label is law — a trial
passes only when the disposition matches exactly. Missed defects and false
alarms are counted separately, across three independent trials per task.
Reference answers prove every task solvable. A null model scores zero.
No language-model judge anywhere in the loop.""",
    "04": """Here is what the seven diagnosticians did with the full-board
scan. Disposition accuracy: forty-four percent — at best. Twenty-six percent
at worst. Coin-flip territory, on boards that are scrap. And the failure
runs in both directions. On defective boards, they miss the fatal lesion —
they name a benign pinhole and recommend rework. On golden samples — boards
with nothing wrong — they invent pathology anyway. One model condemns
eighty-nine percent of clean boards as faulty.""",
    "05": """Exhibit A. A short circuit. Ground truth: scrap. GPT-five-five
writes — an isolated speck of excess copper, not forming a short. Rework.
Confident. Wrong. Exhibit B. A pristine golden board. Grok describes — a
clear gap, creating an open circuit. It scraps a perfect board. Exhibit C.
Magnified, and now inventing defects: on a clean region, GPT-five-five reports
jagged protrusions and calls for rework. It is not an isolated slip — it flags
ninety-nine point five percent of clean crops as defective. They do not know
what they do not know.""",
    "06": """So we opened the machine. Every call is on the record — the image
it saw, the claim it made, the expert label, and the verdict. Here is Kimi,
confident on most boards it sees. Open its most confident calls: same stated
confidence, and right and wrong sit side by side. Now pool all seven models,
four thousand three hundred and forty-five trials, and ask whether one
confidence cut-off could be trusted. One thousand and twenty-seven calls were
stated at ninety percent or higher. Three hundred and eighty-six of them were
wrong. Look at who made them. Gemini and Kimi account for three hundred and
seventy-three. The Claude models almost never say ninety. Inside most models,
confidence does rank their own answers, roughly nought point seven to nought
point eight on the AUC. Across models, it does not transfer. Confidence is
not a portable safety net. Calibrate it per model, or do not lean on it.""",
    "07": """Everything here reproduces. Two hundred and seven tasks, a
deterministic grader, four thousand three hundred and forty-five trials of
raw transcripts — in a three-point-six megabyte zip. One command re-runs any
model through any OpenAI-compatible endpoint. The eval is SolderSight.
The boards are still waiting.""",
}


def tts(text: str, model: str) -> bytes:
    r = requests.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}/with-timestamps",
        json={
            "text": text,
            "model_id": model,
            "voice_settings": {
                "stability": 0.55,
                "similarity_boost": 0.75,
                "style": 0.25,
                "speed": 0.95,
            },
        },
        headers={"xi-api-key": KEY},
        timeout=120,
    )
    r.raise_for_status()
    return r.json()


def main():
    only = set(sys.argv[1:])
    for seg, text in SEGS.items():
        if only and seg not in only:
            continue
        dest = os.path.join(OUT, f"{seg}.mp3")
        try:
            resp = tts(re.sub(r"\s+", " ", text), MODEL)
        except requests.HTTPError as e:
            print(seg, MODEL, "rejected:", e.response.text[:200])
            resp = tts(re.sub(r"\s+", " ", text), "eleven_multilingual_v2")
        open(dest, "wb").write(base64.b64decode(resp["audio_base64"]))
        json.dump(
            resp.get("normalized_alignment") or resp.get("alignment"),
            open(os.path.join(OUT, f"{seg}.align.json"), "w"),
        )
        print(seg, len(resp["audio_base64"]) // 1400, "KB ->", dest)


if __name__ == "__main__":
    main()
