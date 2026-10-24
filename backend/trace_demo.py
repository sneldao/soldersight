"""Trace audit — the model's own words vs the decision to ship. No answer key.

A vision model inspects a board crop by crop and writes a note for each. Separately,
a shipping decision gets made ("this board can ship as-is"). Banyan Sapling audits
that decision against the model's *own* notes — never against the dataset labels —
and flags it when the model already said, in its own words, that it saw a short or an
open circuit.

This is the honest test: no ground truth enters the loop. The catch is the model
contradicting itself. Run from backend/ with the venv active:

    python trace_demo.py
"""

import collections
import json
from pathlib import Path

import sapling

RUNS = Path(__file__).resolve().parent.parent / "data" / "deeppcb" / "runs.jsonl"


def traces() -> dict:
    """Group recorded per-crop observations by (lane, board) — the model's own notes."""
    rows = [json.loads(ln) for ln in RUNS.read_text().splitlines() if ln.strip()]
    grouped: dict = collections.defaultdict(list)
    for r in rows:
        if r.get("board_id") and "reason" in r:
            grouped[(r.get("lane", "baseline"), r["board_id"])].append(r)
    return grouped


def main() -> int:
    grouped = traces()
    # Audit the boards where the model itself noted at least one defect — those are the
    # ones where a decision to ship would contradict its own words.
    targets = {
        key: regs
        for key, regs in grouped.items()
        if any(r.get("defect_type") not in (None, "none") for r in regs)
    }
    if not targets:
        print("No per-crop observations recorded yet. Run a triage pass first.")
        return 1

    print(
        'Auditing the claim "this board can ship as-is" against the inspection '
        "model's OWN notes.\nNo dataset labels are used — the catch is the model "
        "contradicting itself.\n"
    )
    header = f"{'lane':9} {'board':10} {'crops':5} {'model noted':22} {'sapling':14} {'gate':6}"
    print(header)
    print("-" * len(header))

    blocked = 0
    for (lane, board_id), regions in sorted(targets.items()):
        evidence = sapling.build_trace_evidence(regions)
        resp = sapling.verify(sapling.default_policy(), evidence, sapling.build_claim())
        gate = sapling.gate_decision(resp)
        noted = sorted(
            {
                r["defect_type"]
                for r in regions
                if r.get("defect_type") not in (None, "none")
            }
        )
        if gate["action"] != "SHIP":
            blocked += 1
        conf = f"{gate['confidence']:.0%}" if gate["confidence"] is not None else "   -"
        print(
            f"{lane:9} {board_id:10} {len(regions):5} {','.join(noted)[:22]:22} "
            f"{str(gate['label']):14} {gate['action']:6} {conf}"
        )

    print("-" * len(header))
    print(
        f"\n{blocked}/{len(targets)} shipping claims were blocked or sent to review — "
        f"each one a board the model's own notes said it should not ship.\n"
        "No ground truth was consulted."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
