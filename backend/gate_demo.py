"""Banyan Sapling as a policy gate — the catch, on real boards.

The vision model (gpt-4o-mini, routed through Mubit) is cheap and fallible: on the
baseline lane it clears defective boards as "pass". This script replays each board's
recorded vision verdict as a *claim*, hands Sapling the defects inspection actually
found (the DeepPCB / AOI labels) as *evidence*, and lets Sapling decide whether the
claim is allowed under the acceptance policy.

Every board the vision model would have shipped, but that truly needs rework or
scrap, is a defect Sapling has to catch. Run from backend/ with the venv active:

    python gate_demo.py            # all boards with a recorded vision verdict
    python gate_demo.py 00041000 00041007
"""

import sys

import sapling
from main import annotations_for, board_ids, ground_truth, read_runs, verdict_of


def claimed_dispositions() -> dict[str, str]:
    """The vision model's board-level verdict, from recorded runs (worst region wins)."""
    by_board: dict[str, list[dict]] = {}
    for row in read_runs():
        if row.get("board_id") and row.get("disposition"):
            by_board.setdefault(row["board_id"], []).append(row)
    return {b: verdict_of(rows)["disposition"] for b, rows in by_board.items()}


ACTION_MARK = {"SHIP": "ship ", "BLOCK": "BLOCK", "REVIEW": "review"}


def main(argv: list[str]) -> int:
    claims = claimed_dispositions()
    boards = argv or [b for b in board_ids() if b in claims]
    if not boards:
        print(
            "No recorded vision verdicts found. Run a triage pass first (POST /triage/board/...)."
        )
        return 1

    print(
        f"Verifying {len(boards)} boards against the acceptance policy via Banyan Sapling.\n"
    )
    header = f"{'board':10} {'truth':7} {'worst':10} {'vision':7} -> {'sapling':26} {'gate':6} {'':4}"
    print(header)
    print("-" * len(header))

    caught = would_ship_bad = gate_errors = 0
    for board_id in boards:
        truth = ground_truth(annotations_for(board_id))
        claim_disp = claims.get(board_id, "pass")

        evidence = sapling.build_evidence(truth["defect_types"])
        claim = sapling.build_claim(claim_disp)
        resp = sapling.verify(sapling.default_policy(), evidence, claim)
        gate = sapling.gate_decision(resp)
        if "error" in resp:
            gate_errors += 1

        # A board the cheap model would have shipped, but that is not actually a pass.
        bad_ship = claim_disp == "pass" and truth["disposition"] != "pass"
        would_ship_bad += bad_ship
        is_caught = bad_ship and gate["action"] != "SHIP"
        caught += is_caught

        label = gate["label"] or "unavailable"
        conf = f"{gate['confidence']:.0%}" if gate["confidence"] is not None else "   -"
        flag = "  <-- caught" if is_caught else ("  !! MISSED" if bad_ship else "")
        print(
            f"{board_id:10} {truth['disposition']:7} {truth['worst']:10} "
            f"{claim_disp:7} -> {label:18} {conf:>6} {ACTION_MARK[gate['action']]:6}{flag}"
        )

    print("-" * len(header))
    print(
        f"\nVision model would have shipped {would_ship_bad} defective boards.\n"
        f"Policy gate stopped {caught}/{would_ship_bad} of them "
        f"(blocked or sent to human review)."
        + (
            f"\nSapling unreachable on {gate_errors} boards (failed safe to review)."
            if gate_errors
            else ""
        )
    )

    # The full gate range on illustrative evidence, so all three actions are visible.
    print("\nGate range on illustrative evidence:")
    for name, types in [
        ("clean board", ["none"]),
        ("spur only", ["spur"]),
        ("open circuit", ["open"]),
    ]:
        resp = sapling.verify(
            sapling.default_policy(),
            sapling.build_evidence(types),
            sapling.build_claim(),
        )
        gate = sapling.gate_decision(resp)
        print(f"  {name:14} -> {str(gate['label']):26} {gate['action']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
