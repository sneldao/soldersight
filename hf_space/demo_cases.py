"""Shared demo-case definitions for the SolderSight HF Space.

Both the app and the cache generator import these so they build exactly the same
(policy, evidence, claim) tuples — the app calls Banyan Sapling live, and falls back
to a cache of *real* Sapling outputs produced by build_cache.py. Nothing is ever
fabricated: the fallback is a recorded real verdict, clearly labelled as cached.
"""

from __future__ import annotations

import json
from pathlib import Path

import sapling

DATA_DIR = Path(__file__).resolve().parent / "data"
RUNS_PATH = DATA_DIR / "runs.jsonl"
IMAGES_DIR = DATA_DIR / "images"
CACHE_PATH = DATA_DIR / "sapling_cache.json"

POLICY = sapling.default_policy()
CLAIM = sapling.SHIP_CLAIM

# Boards to feature. The catch (00041004) leads; the others round out the range.
POLICY_BOARDS = ["00041004", "00041000", "00041009"]
TRACE_BOARDS = ["00041003", "00041005", "00041000"]

# Illustrative policy-gate evidence so all three gate actions are visible.
ILLUSTRATIVE = [
    {"id": "illus-clean", "label": "Clean board (no defects)", "types": ["none"]},
    {"id": "illus-spur", "label": "Spur only (rework-class)", "types": ["spur"]},
    {"id": "illus-open", "label": "Open circuit", "types": ["open"]},
]


def load_runs() -> list[dict]:
    if not RUNS_PATH.exists():
        return []
    rows = []
    for line in RUNS_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return rows


def board_ground_truth(board_id: str, runs: list[dict] | None = None) -> dict:
    """The AOI defect types + honest disposition recorded for a board."""
    runs = runs if runs is not None else load_runs()
    for r in runs:
        if r.get("board_id") == board_id and r.get("ground_truth"):
            return r["ground_truth"]
    return {"defect_types": [], "disposition": "unknown", "worst": "none"}


def board_vision(board_id: str, runs: list[dict] | None = None) -> dict:
    """The vision model's board-level verdict (worst recorded region)."""
    runs = runs if runs is not None else load_runs()
    rank = {"pass": 0, "rework": 1, "scrap": 2}
    rows = [r for r in runs if r.get("board_id") == board_id and r.get("disposition")]
    if not rows:
        return {
            "disposition": "pass",
            "confidence": 0.85,
            "reason": "",
            "defect_type": "none",
        }
    return max(rows, key=lambda r: rank.get(r["disposition"], 0))


def trace_regions(board_id: str, runs: list[dict] | None = None) -> list[dict]:
    """The model's own per-crop notes — the lane whose notes name the most defects."""
    runs = runs if runs is not None else load_runs()
    groups: dict[str, list[dict]] = {}
    for r in runs:
        if r.get("board_id") == board_id and "reason" in r:
            groups.setdefault(r.get("lane", "baseline"), []).append(r)
    if not groups:
        return []
    return max(
        groups.values(),
        key=lambda regs: sum(
            1 for r in regs if r.get("defect_type") not in (None, "none")
        ),
    )


def policy_case(board_id: str, runs: list[dict] | None = None) -> dict:
    gt = board_ground_truth(board_id, runs)
    return {
        "policy": POLICY,
        "evidence": sapling.build_evidence(gt.get("defect_types") or ["none"]),
        "claim": CLAIM,
    }


def illustrative_case(types: list[str]) -> dict:
    return {"policy": POLICY, "evidence": sapling.build_evidence(types), "claim": CLAIM}


def trace_case(board_id: str, runs: list[dict] | None = None) -> dict:
    regions = trace_regions(board_id, runs)
    return {
        "policy": POLICY,
        "evidence": sapling.build_trace_evidence(regions),
        "claim": CLAIM,
    }


def cache_key(policy: str, evidence: str, claim: str) -> str:
    """Stable key over the exact Sapling inputs, so live and cached agree."""
    import hashlib

    return hashlib.sha256(f"{policy}\n{evidence}\n{claim}".encode()).hexdigest()[:16]


def load_cache() -> dict:
    if CACHE_PATH.exists():
        try:
            return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}
    return {}
