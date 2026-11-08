"""Shared eval logic: taxonomy, prompt, DeepPCB ground truth, scoring.

Self-contained on purpose — the eval must run in a clean environment without the
SolderSight backend. The constants and prompt below are identical to the
production baseline lane (backend/main.py) so results measure the same task the
product ships.
"""

import json
import re

BASE_DEFECT_TYPES = ["open", "short", "mousebite", "spur", "copper", "pinhole", "none"]
SEVERITIES = {"cosmetic", "minor", "major", "critical"}
DISPOSITIONS = {"pass", "rework", "scrap"}

INSTRUCTIONS_TEMPLATE = """You are a PCB quality inspector. Look at this close-up of a board and classify it:
- defect_type: one of [{types}]
- severity: one of [cosmetic, minor, major, critical]
- disposition: one of [pass, rework, scrap]
- confidence: 0.0-1.0
- reason: one sentence
Disposition policy: defect_type "open" or "short" requires disposition "scrap"; "mousebite", "spur", "copper" or "pinhole" requires "rework"; "none" requires "pass".
Reply as JSON only: {{"defect_type":..., "severity":..., "disposition":..., "confidence":..., "reason":...}}"""


def instructions() -> str:
    return INSTRUCTIONS_TEMPLATE.format(types=", ".join(BASE_DEFECT_TYPES))


# Prompt variants for the "wide" suite. `production` is the exact prompt above
# (the one the product ships). The others each change one thing so that a
# result can be attributed: the worst-defect rule that the production prompt
# leaves implicit, a base-rate statement, a binary question with no taxonomy,
# and a golden reference image.
WORST_RULE = (
    "\nA board may show several defects. Report the single worst one "
    "(open and short are worse than mousebite and copper, which are worse than "
    "spur and pinhole); defect_type and disposition must describe that defect. "
    'If you can see no defect, answer defect_type "none" and disposition "pass".'
)
BASE_RATE = (
    "\nAbout half of the boards you are shown have no defect at all. Flag a "
    "defect only when you can point to it; a needless flag sends a good board "
    "to re-inspection."
)
PAIRED_NOTE = (
    "\nYou get two images of the same board region: first the golden reference "
    "(known defect-free), then the board under test. Compare them; report only "
    "differences that are real defects on the board under test."
)
BINARY_PROMPT = (
    "You are a PCB quality inspector. Decide only whether this board image "
    "shows any manufacturing defect (open, short, mousebite, spur, spurious "
    "copper or pin hole).\n"
    "- confidence: 0.0-1.0, your confidence in your yes/no answer\n"
    "- reason: one sentence\n"
    'Reply as JSON only: {"defective": true or false, "confidence":..., "reason":...}'
)
VARIANTS = ("production", "worst", "prior", "binary", "paired")


def wide_task_files(tasks_dir) -> list:
    """The wide suite is stored one file per prompt variant (each under the
    repository's 500 KB file cap); this returns them in a stable order."""
    from pathlib import Path

    return sorted(Path(tasks_dir).glob("tasks_wide_*.jsonl"))


def prompt_for(variant: str) -> str:
    base = instructions()
    if variant == "production":
        return base
    if variant == "worst":
        return base + WORST_RULE
    if variant == "prior":
        return base + WORST_RULE + BASE_RATE
    if variant == "paired":
        return base + WORST_RULE + PAIRED_NOTE
    if variant == "binary":
        return BINARY_PROMPT
    raise ValueError(f"unknown prompt variant: {variant}")


def is_flagged(row: dict) -> bool | None:
    """Whether the model called the input defective; None if no usable answer."""
    if "error" in row:
        return None
    if "defective" in row:
        return bool(row["defective"])
    if row.get("defect_type") is None or row.get("disposition") is None:
        return None
    return row["defect_type"] != "none"


# The disposition the taxonomy implies for each defect type. Boards are scored
# against this, so a wrong disposition shows up in the accuracy numbers.
DISPOSITION_BY_TYPE = {
    "open": "scrap",
    "short": "scrap",
    "mousebite": "rework",
    "spur": "rework",
    "copper": "rework",
    "pinhole": "rework",
    "none": "pass",
}

# Higher rank = worse, so a board with several defects is judged on its worst one.
SEVERITY_RANK = {
    "none": 0,
    "spur": 1,
    "pinhole": 1,
    "copper": 2,
    "mousebite": 2,
    "short": 3,
    "open": 3,
}

DISPOSITION_RANK = {"pass": 0, "rework": 1, "scrap": 2}

# A defect claim below this confidence can't condemn a board on its own.
MIN_VERDICT_CONFIDENCE = 0.5

CODE_TO_TYPE = {
    1: "open",
    2: "short",
    3: "mousebite",
    4: "spur",
    5: "copper",
    6: "pinhole",
}


def parse_annotations(text: str) -> list[dict]:
    """DeepPCB annotation lines: "x1 y1 x2 y2 code" (commas or spaces accepted)."""
    out = []
    for line in text.splitlines():
        parts = line.replace(",", " ").split()
        if len(parts) != 5:
            continue
        x1, y1, x2, y2, code = (int(p) for p in parts)
        out.append(
            {
                "x1": x1,
                "y1": y1,
                "x2": x2,
                "y2": y2,
                "code": code,
                "type": CODE_TO_TYPE.get(code, "none"),
            }
        )
    return out


def ground_truth(annotations: list[dict]) -> dict:
    """The expected verdict for a board (or region), from DeepPCB labels."""
    types = sorted(
        {a["type"] for a in annotations if a["type"] != "none"},
        key=lambda t: (-SEVERITY_RANK.get(t, 0), t),
    )
    worst = types[0] if types else "none"
    return {
        "defect_types": types or ["none"],
        "disposition": DISPOSITION_BY_TYPE.get(worst, "rework"),
        "worst": worst,
    }


def overlaps(annotation: dict, region: dict) -> bool:
    return not (
        annotation["x2"] < region["x1"]
        or annotation["x1"] > region["x2"]
        or annotation["y2"] < region["y1"]
        or annotation["y1"] > region["y2"]
    )


def region_truth(annotations: list[dict], region: dict) -> dict:
    return ground_truth([a for a in annotations if overlaps(a, region)])


def score(prediction: dict, truth: dict) -> dict:
    return {
        "type_correct": prediction.get("defect_type") in truth["defect_types"],
        "disposition_correct": prediction.get("disposition") == truth["disposition"],
    }


def parse_classification(raw: str) -> dict:
    """Tolerant JSON extraction: strips code fences and leading prose."""
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("no JSON object in response")
    data = json.loads(text[start : end + 1])
    for key in ("defect_type", "severity", "disposition"):
        if key not in data:
            raise ValueError(f"missing field: {key}")
    return data


def parse_binary(raw: str) -> dict:
    """Parse the binary-variant answer; accepts true/false or yes/no strings."""
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("no JSON object in response")
    data = json.loads(text[start : end + 1])
    value = data.get("defective")
    if isinstance(value, str):
        value = {"true": True, "yes": True, "false": False, "no": False}.get(
            value.strip().lower()
        )
    if not isinstance(value, bool):
        raise ValueError("missing or non-boolean field: defective")
    data["defective"] = value
    return data


def verdict_of(results: list[dict]) -> dict:
    """The board inherits its disposition from its worst confident region.

    Mirrors backend/main.py: error rows can't set the verdict, and a
    low-confidence scrap/rework claim becomes a caveat instead of a verdict.
    """
    valid = [r for r in results if "error" not in r and r.get("defect_type")]
    if not valid:
        return {
            "defect_type": "none",
            "severity": "cosmetic",
            "disposition": "rework",
            "confidence": 0.0,
            "reason": "inspection incomplete — route to human review",
        }
    worst = max(valid, key=lambda r: DISPOSITION_RANK.get(r["disposition"], 0))
    confidence = worst.get("confidence", 1.0)
    if worst["disposition"] == "pass" or confidence >= MIN_VERDICT_CONFIDENCE:
        return dict(worst)
    confident = [r for r in valid if r.get("confidence", 1.0) >= MIN_VERDICT_CONFIDENCE]
    if not confident:
        verdict = dict(worst)
        verdict["caveat"] = (
            "verdict rests on low-confidence regions — route to human review"
        )
        return verdict
    fallback = max(confident, key=lambda r: DISPOSITION_RANK.get(r["disposition"], 0))
    verdict = dict(fallback)
    verdict["caveat"] = (
        f"a {worst['disposition']}-grade region ({worst['defect_type']}) was reported "
        f"at only {confidence:.0%} confidence — flagged, not decisive"
    )
    return verdict
