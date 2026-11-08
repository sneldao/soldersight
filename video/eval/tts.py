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
most capable vision models, three times each. Twenty-one verdicts. Every one
said: rework.""",
    "02": """Every board that ships — phone, car, implant — passed through an
inspector exactly like this. The task is a diagnosis: name the lesion, then
rule on disposition — pass, rework, scrap. The rules are in the prompt; the
ground truth is expert-labelled DeepPCB. Eleven hundred and twenty-seven tasks
in three suites: whole boards, magnified crops, and a wide set of ninety-two
fresh boards, each with a clean twin.""",
    "03": """Grading is code, not judgment. The expert label is law — a trial
passes only when the disposition matches exactly. Missed defects and false
alarms are counted separately, with intervals that resample whole boards.
Reference answers prove every task solvable. A null model scores zero. The
clean twins are certified by a pixel-diff detector. No language-model judge
anywhere in the loop.""",
    "04": """Here is what the seven diagnosticians did with the full-board
scan. Disposition accuracy: forty-four percent at best. Twenty-six at worst.
Scrap boards were ruled scrap in barely a third of trials. They almost never
call a defective board clean — they under-rule it. And they raise the alarm on
almost everything: on golden boards with nothing wrong, one model condemns
eighty-nine percent.""",
    "05": """Exhibit A. A short circuit. Ground truth: scrap. GPT-five-five
writes — an isolated speck of excess copper, not forming a short. Rework.
Confident. Wrong. Exhibit B. A pristine golden board. Grok describes — a
clear gap, creating an open circuit. It scraps a perfect board. They do not
know what they do not know.""",
    "06r": """A fair objection: maybe it is the prompt. So we ran ninety-two
fresh boards, each with a clean twin, under five different prompts. State the
worst-defect rule: nothing changes. Tell the model half the boards are clean:
false alarms fall, but real defects start slipping through. Now do what a real
inspection line does — hand it a golden reference. Three of four models stop
crying wolf; discrimination jumps to point nine. But the verdict does not
follow: scrap boards are ruled scrap only two times in three, at best. A
reference fixes noticing. It does not fix judging.""",
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
    "07": """Everything here reproduces. Eleven hundred and twenty-seven tasks,
a deterministic grader, eight thousand transcripts — in a six-point-seven
megabyte zip. One command re-runs any model through any OpenAI-compatible
endpoint. The eval is SolderSight. The boards are still waiting.""",
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
