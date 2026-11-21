"""Gate eval — measure the verifier rungs against oracle truth.

The vision benchmark measured what the models see; this measures what the gate
*catches*. For every recorded (lane, board) group:

1. feed the model's own region notes to each rung of the verifier ladder,
2. score the gate action two ways:
   - conviction: on boards whose notes recorded a defect, does the gate block?
   - oracle safety: against the DeepPCB labels, does the *pipeline* (notes +
     gate) still ship a board truth says to scrap or rework?

The second number is the honest one — a gate can only convict what the model
wrote down, so a clean-note miss on a truly defective board is a vision miss,
not a gate miss. The report keeps the two apart on purpose.

    python -m gate_eval            # rules + recorded snapshots (offline)
    python -m gate_eval --llm      # + the LLM rung (needs network + keys)
    python -m gate_eval --live     # + live Sapling (needs the endpoint up)
"""

import collections
import sys

import glasses
import sapling
import verifier
from main import annotations_for, ground_truth


def expected_action(disposition: str) -> str:
    """What the policy demands for an oracle disposition."""
    return "SHIP" if disposition == "pass" else "BLOCK"


def rungs_for(regions: list[dict], key: str, live: bool, use_llm: bool) -> dict:
    """One verdict per available rung."""
    verdicts = {}
    if live:
        evidence = sapling.build_trace_evidence(regions)
        resp = sapling.verify(sapling.default_policy(), evidence, sapling.build_claim())
        if "error" not in resp:
            verdicts["live"] = {
                **sapling.gate_decision(resp),
                "source": "live",
            }
    snap = glasses.gate_snapshot().get(key)
    if snap:
        verdicts["recorded"] = {**snap, "source": "recorded"}
    if use_llm:
        llm = verifier.llm_gate(regions)
        if llm:
            verdicts["llm"] = llm
    verdicts["rules"] = verifier.rule_gate(regions)
    return verdicts


def evaluate(live: bool = False, use_llm: bool = False) -> None:
    groups = glasses.groups()
    stats = collections.defaultdict(
        lambda: collections.Counter()
    )  # rung -> outcome counts
    rows = []
    for (lane, board_id), _ in sorted(groups.items()):
        regions = glasses.run_for(board_id, lane)
        if not regions:
            continue
        truth = ground_truth(annotations_for(board_id))
        noted = {
            r.get("defect_type")
            for r in regions
            if r.get("defect_type") not in (None, "none") and not r.get("error")
        }
        expected = expected_action(truth["disposition"])
        key = f"{lane}:{board_id}"
        verdicts = rungs_for(regions, key, live, use_llm)
        for rung, g in verdicts.items():
            action = g["action"]
            s = stats[rung]
            s["n"] += 1
            s[f"action_{action}"] += 1
            if action == expected:
                s["policy_correct"] += 1
            # The two failure modes that matter on a real line:
            if expected == "BLOCK" and action == "SHIP":
                s["shipped_defective"] += 1
            if expected == "SHIP" and action == "BLOCK":
                s["false_block"] += 1
            # Conviction: the notes said a defect, did the rung block?
            if noted and action != "BLOCK":
                s["unconvicted_notes"] += 1
            elif noted and action == "BLOCK":
                s["convicted_notes"] += 1
        rows.append(
            (
                key,
                truth["disposition"],
                ",".join(sorted(noted)) or "-",
                {rung: g["action"] for rung, g in verdicts.items()},
            )
        )

    rung_order = [r for r in ("live", "recorded", "llm", "rules") if stats.get(r)]
    name_w = max(len(k) for k, *_ in rows)
    print(
        f"\n{'board':<{name_w}}  truth   noted           "
        + "  ".join(f"{r:<9}" for r in rung_order)
    )
    print("-" * (name_w + 30 + 12 * len(rung_order)))
    for key, disp, noted_str, actions in rows:
        print(
            f"{key:<{name_w}}  {disp:<7} {noted_str:<15} "
            + "  ".join(f"{actions.get(r, '-'):<9}" for r in rung_order)
        )
    print()
    for rung in rung_order:
        s = stats[rung]
        n = s["n"] or 1
        print(
            f"{rung:<9} n={s['n']:<3} policy-correct {s['policy_correct']}/{n}"
            f" ({s['policy_correct'] / n:.0%})"
            f"  shipped-defective {s['shipped_defective']}"
            f"  false-block {s['false_block']}"
            f"  notes-convicted {s['convicted_notes']}/{s['convicted_notes'] + s['unconvicted_notes']}"
        )
    print(
        "\nCaveat: 'shipped-defective' counts vision misses the gate had no "
        "evidence for (clean notes on a truly defective board) as well as real "
        "gate misses — read it with 'noted' column, not alone."
    )


if __name__ == "__main__":
    evaluate(live="--live" in sys.argv, use_llm="--llm" in sys.argv)
