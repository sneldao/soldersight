"""Overlay payloads for the worn (MicroLumin M6) demo — the §5 contract.

The glasses are a display + mic client; everything they render comes from one
small JSON payload per board. `payload_for` maps a recorded (or live) triage
run onto the contract in docs/worn-m6-plan.md §5:

    { cell, bbox, verdict, defect_type, confidence, note }   per region
    { disposition, gate }                                    per board

Gate verdicts are a *snapshot* (`glasses/gate_verdicts.json`, produced by
`python -m glasses snapshot`) so the worn demo is venue-proof: the laptop can
replay real Mubit + Sapling results with zero network.
"""

import collections
import json
from pathlib import Path

import sapling

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "deeppcb"
RUNS_PATH = DATA_DIR / "runs.jsonl"
GLASSES_DIR = Path(__file__).resolve().parent.parent / "glasses"
GATE_SNAPSHOT = GLASSES_DIR / "gate_verdicts.json"

BOARD_PX = 640  # committed DeepPCB subset is 640x640
GRID = 8  # matches inspection.GRID — an 8x8 diff grid, 80px cells
NOTE_LIMIT = 60  # waveguide line width (plan §5)


def read_runs() -> list[dict]:
    if not RUNS_PATH.is_file():
        return []
    return [json.loads(ln) for ln in RUNS_PATH.read_text().splitlines() if ln.strip()]


def latest_run(
    board_id: str, lane: str, run_id: str | None = None
) -> list[dict] | None:
    """A run_id batch's region rows for (board, lane) — the latest by default,
    or a pinned batch when the demo needs a specific recorded run (same
    boundary rule /verify uses)."""
    rows = read_runs()
    if run_id:
        batch = [r for r in rows if r.get("run_id") == run_id and "region" in r]
        return batch or None
    for row in reversed(rows):
        if (
            row.get("board_id") == board_id
            and row.get("lane") == lane
            and row.get("run_id")
        ):
            batch = [
                r for r in rows if r.get("run_id") == row["run_id"] and "region" in r
            ]
            return batch or None
    return None


# Batches the worn demo pins to, picked for the notes the model actually wrote —
# e.g. baseline:00041003's "a visible connection bridging two conductors,
# indicating a short circuit" is the sentence the documented 0.84-violation
# BLOCK was calibrated on.
PINNED_RUNS = {
    "baseline:00041003": "33e8c71f33c9",
}


def run_for(board_id: str, lane: str) -> list[dict] | None:
    batch = latest_run(board_id, lane, run_id=PINNED_RUNS.get(f"{lane}:{board_id}"))
    if batch:
        return batch
    # Ledger rows from before run_id existed: the diff is deterministic, so every
    # run hit the same cells — dedupe by region box, newest note wins.
    seen: dict[tuple, dict] = {}
    for r in read_runs():
        reg = r.get("region")
        if (
            r.get("board_id") == board_id
            and r.get("lane") == lane
            and reg
            and not r.get("run_id")
        ):
            seen[(reg.get("x1"), reg.get("y1"), reg.get("x2"), reg.get("y2"))] = r
    return list(seen.values()) or None


def groups() -> dict[tuple[str, str], list[dict]]:
    """Every (lane, board) that can serve a payload: run_id batches, plus
    pre-run_id boards reconstructed by region box."""
    grouped: dict[tuple[str, str], list[dict]] = collections.defaultdict(list)
    for r in read_runs():
        if r.get("board_id") and "region" in r:
            grouped[(r.get("lane", "baseline"), r["board_id"])].append(r)
    return grouped


def cell_of(region: dict) -> int:
    """Region px box -> grid cell index (row-major, 0..GRID*GRID-1)."""
    cell = BOARD_PX // GRID
    col = int(region.get("x1", 0)) // cell
    row = int(region.get("y1", 0)) // cell
    return row * GRID + col


def note_of(reason: str | None) -> str:
    """The model's own words, trimmed to the waveguide line at a word boundary."""
    note = " ".join((reason or "").split())
    if len(note) <= NOTE_LIMIT:
        return note
    return note[:NOTE_LIMIT].rsplit(" ", 1)[0].rstrip(",;:") + "…"


def overlay_rows(regions: list[dict]) -> list[dict]:
    """Map ledger region rows onto the glasses contract."""
    out = []
    for r in regions:
        reg = r.get("region") or {}
        x1, y1 = reg.get("x1", 0), reg.get("y1", 0)
        w, h = reg.get("x2", 0) - x1, reg.get("y2", 0) - y1
        out.append(
            {
                "cell": cell_of(reg),
                "bbox": [
                    round(x1 / BOARD_PX, 4),
                    round(y1 / BOARD_PX, 4),
                    round(w / BOARD_PX, 4),
                    round(h / BOARD_PX, 4),
                ],
                "bbox_px": [x1, y1, w, h],
                "verdict": r.get("disposition"),
                "defect_type": r.get("defect_type"),
                "confidence": r.get("confidence"),
                "note": note_of(r.get("reason")),
                "mreq": (r.get("metrics") or {}).get("mubit_request_id"),
                "error": r.get("error"),
            }
        )
    return out


_DISPOSITION_RANK = {"pass": 0, "rework": 1, "scrap": 2}


def board_verdict(regions: list[dict]) -> dict:
    """The board inherits the worst confident region's verdict — mirrors
    main.verdict_of without importing the app (this module must also run under
    the stdlib replay server). Takes ledger-shaped rows (disposition)."""
    valid = [r for r in regions if not r.get("error") and r.get("disposition")]
    if not valid:
        return {
            "disposition": "rework",
            "defect_type": "none",
            "confidence": 0.0,
            "reason": "inspection incomplete — route to human review",
        }
    worst = max(valid, key=lambda r: _DISPOSITION_RANK.get(r["disposition"], 0))
    return {
        "disposition": worst["disposition"],
        "defect_type": worst.get("defect_type"),
        "confidence": worst.get("confidence"),
        "reason": note_of(worst.get("reason")),
    }


def gate_snapshot() -> dict:
    if GATE_SNAPSHOT.is_file():
        return json.loads(GATE_SNAPSHOT.read_text())
    return {}


_SCRAP_TYPES = {"open", "short"}  # policy: scrap-grade, cannot ship as-is
_REWORK_TYPES = {"mousebite", "spur", "copper", "pinhole"}  # policy: must rework


def rule_gate(regions: list[dict]) -> dict:
    """The deterministic verifier: the same written policy as code.

    Not a stand-in for Sapling's calibrated semantics — it answers the narrower
    question the gate exists for: do the model's own notes record anything the
    acceptance policy forbids shipping as-is? Always available, zero network,
    and honest about being a rule check rather than a learned verdict.
    Confidence = the strength of the strongest defect note it blocks on.
    """
    notes = [
        r
        for r in regions
        if r.get("defect_type") not in (None, "none") and not r.get("error")
    ]
    errored = sum(1 for r in regions if r.get("error"))
    scrap = [r for r in notes if r["defect_type"] in _SCRAP_TYPES]
    rework = [r for r in notes if r["defect_type"] in _REWORK_TYPES]
    if scrap:
        worst = max(scrap, key=lambda r: r.get("confidence") or 0)
        return {
            "action": "BLOCK",
            "label": "violation",
            "reason": f"Policy check: the model's own notes record '{worst['defect_type']}' (scrap-grade) — this board cannot ship as-is.",
            "confidence": worst.get("confidence"),
            "source": "rules",
            "errored_regions": errored or None,
        }
    if rework:
        worst = max(rework, key=lambda r: r.get("confidence") or 0)
        return {
            "action": "BLOCK",
            "label": "violation",
            "reason": f"Policy check: the model's own notes record '{worst['defect_type']}' (rework-grade) — must rework, cannot ship as-is.",
            "confidence": worst.get("confidence"),
            "source": "rules",
            "errored_regions": errored or None,
        }
    if errored:
        return {
            "action": "REVIEW",
            "label": "insufficient_information",
            "reason": f"Policy check: {errored} crop(s) failed inspection — incomplete evidence, route to a human inspector.",
            "confidence": None,
            "source": "rules",
            "errored_regions": errored,
        }
    return {
        "action": "SHIP",
        "label": "supported",
        "reason": "Policy check: no defect recorded in the model's own observations — cleared to ship.",
        "confidence": None,
        "source": "rules",
    }


def llm_gate(regions: list[dict]) -> dict | None:
    """A second opinion from a different service: the claim vs the model's own
    notes, put to the Mubit-routed LLM. Needs MUBIT_API_KEY + network — a live
    fallback when Sapling is down but connectivity isn't. Imported lazily so
    the stdlib replay server stays dependency-free."""
    import os

    try:
        from openai import OpenAI
    except ImportError:
        return None
    evidence = sapling.build_trace_evidence(regions)
    prompt = (
        "You are an independent quality gate on a PCB line. Given the acceptance "
        "policy, the inspection model's own per-region observations, and the claim, "
        "decide if the claim holds. Reply as JSON only: "
        '{"label": "supported"|"violation"|"insufficient_information", '
        '"confidence": 0.0-1.0, "reason": "one sentence"}'
        f"\n\nPOLICY:\n{sapling.default_policy()}"
        f"\n\nEVIDENCE:\n{evidence}"
        f"\n\nCLAIM:\n{sapling.build_claim()}"
    )
    # OpenAI-compatible endpoints in priority order — Mubit first (it's the demo's
    # stack), then evomap (free tier, verified working), then whatever ambient
    # gateway/key is configured.
    candidates = []
    if os.environ.get("MUBIT_API_KEY"):
        candidates.append(
            (
                "mubit",
                os.environ.get("MUBIT_BASE_URL", "https://api.mubit.ai/openai/v1"),
                os.environ["MUBIT_API_KEY"],
                os.environ.get("MUBIT_MODEL", "gpt-4o-mini"),
            )
        )
    if os.environ.get("EVOMAP_API_KEY"):
        candidates.append(
            (
                "evomap",
                os.environ.get("EVOMAP_BASE_URL", "https://api.evomap.ai/v1"),
                os.environ["EVOMAP_API_KEY"],
                os.environ.get("EVOMAP_MODEL", "evomap-glm-5.1"),
            )
        )
    if os.environ.get("OPENAI_API_KEY"):
        base = (
            os.environ.get("OPENAI_BASE_URL")
            or os.environ.get("OPENAI_API_BASE")
            or "https://api.openai.com/v1"
        )
        candidates.append(
            (
                "openai",
                base,
                os.environ["OPENAI_API_KEY"],
                os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
            )
        )
    for name, base, key, model in candidates:
        try:
            client = OpenAI(base_url=base, api_key=key, timeout=15.0)
            resp = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
            )
            content = resp.choices[0].message.content.strip()
            # Some models wrap the object in ```json fences despite instructions.
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            out = json.loads(content)
        except Exception:
            continue  # that provider is down -> try the next one
        label = out.get("label")
        action = {"supported": "SHIP", "violation": "BLOCK"}.get(label, "REVIEW")
        return {
            "action": action,
            "label": label,
            "reason": f"LLM verifier ({name}): {out.get('reason', '')}",
            "confidence": out.get("confidence"),
            "source": "llm",
            "provider": name,
        }
    return None


def gate_for(
    board_id: str,
    lane: str,
    regions: list[dict],
    live: bool = False,
    use_llm: bool = False,
) -> dict:
    """The gate, with redundancy: live Sapling -> recorded snapshot -> LLM
    verifier (opt-in, needs key+network) -> deterministic policy check.

    Every rung labels its `source` so nothing pretends to be Sapling.
    """
    key = f"{lane}:{board_id}"
    if live:
        evidence = sapling.build_trace_evidence(regions)
        resp = sapling.verify(sapling.default_policy(), evidence, sapling.build_claim())
        decision = sapling.gate_decision(resp)
        if decision.get("label") or decision.get("action") == "SHIP":
            return {**decision, "source": "live"}
    snap = gate_snapshot().get(key)
    if snap:
        return {**snap, "source": "recorded"}
    if use_llm:
        llm = llm_gate(regions)
        if llm:
            return llm
    return rule_gate(regions)


def payload_for(
    board_id: str,
    lane: str = "adapted",
    gate_live: bool = False,
    use_llm: bool = False,
) -> dict | None:
    """One board's glasses payload, from its recorded run (pinned for demo boards,
    latest otherwise)."""
    import os

    regions = run_for(board_id, lane)
    if regions is None:
        return None
    verdict = board_verdict(regions)
    return {
        "board_id": board_id,
        "lane": lane,
        "source": "recorded",
        "grid": {"rows": GRID, "cols": GRID, "width": BOARD_PX, "height": BOARD_PX},
        "image": f"images/{board_id}_test.jpg",
        "template": f"images/{board_id}_temp.jpg",
        "regions": overlay_rows(regions),
        "board": {
            **verdict,
            "gate": gate_for(
                board_id,
                lane,
                regions,
                live=gate_live,
                use_llm=use_llm or os.environ.get("GLASSES_LLM_GATE") == "1",
            ),
        },
    }


def payload_from_triage(result: dict, gate: dict | None = None) -> dict:
    """Map a live inspect_regions() result onto the same contract — rung 4."""
    rows = []
    for r in result.get("regions", []):
        row = dict(r)
        row["region"] = r.get("region") or {}
        rows.append(row)
    overlay = overlay_rows(rows)
    return {
        "board_id": result.get("board_id"),
        "lane": result.get("lane"),
        "source": "live",
        "grid": {"rows": GRID, "cols": GRID, "width": BOARD_PX, "height": BOARD_PX},
        "image": f"images/{result.get('board_id')}_test.jpg"
        if result.get("board_id")
        else None,
        "regions": overlay,
        "board": {**board_verdict(rows), "gate": gate},
    }


def snapshot_gates(path: Path = GATE_SNAPSHOT) -> dict:
    """Ask Sapling for the ship-claim verdict on the batch each (lane, board)
    would serve (pinned or latest) and write the snapshot the venue demo replays."""
    out: dict[str, dict] = {}
    for lane, board_id in sorted(groups()):
        regions = run_for(board_id, lane)
        evidence = sapling.build_trace_evidence(regions)
        resp = sapling.verify(sapling.default_policy(), evidence, sapling.build_claim())
        decision = sapling.gate_decision(resp)
        key = f"{lane}:{board_id}"
        out[key] = decision
        conf = (
            f"{decision['confidence']:.0%}"
            if decision.get("confidence") is not None
            else " -"
        )
        print(
            f"{key:20} {str(decision.get('label')):28} {decision.get('action'):6} {conf}"
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, indent=2, sort_keys=True) + "\n")
    print(f"\nwrote {path} ({len(out)} verdicts)")
    return out


def write_payloads(path: Path = GLASSES_DIR / "payloads.json") -> dict:
    """Bake the full replay corpus: one payload per recorded (lane, board).
    Emits payloads.json (for the server) and payloads.js (a script-tag embed —
    fetch() of sibling files fails on file://, <script> always works)."""
    out = {}
    for lane, board_id in sorted(groups()):
        p = payload_for(board_id, lane)
        if p:
            out[f"{lane}:{board_id}"] = p
    path.write_text(json.dumps(out, indent=2, sort_keys=True) + "\n")
    path.with_suffix(".js").write_text(
        "window.SOLDERSIGHT_PAYLOADS = "
        + json.dumps(out, separators=(",", ":"))
        + ";\n"
    )
    print(f"wrote {path} + .js ({len(out)} payloads)")
    return out


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "snapshot":
        snapshot_gates()
    elif len(sys.argv) > 1 and sys.argv[1] == "payloads":
        write_payloads()
    else:
        print("usage: python -m glasses [snapshot|payloads]")
