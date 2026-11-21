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


# Synthetic ambiguous-evidence cases: notes a human inspector would route to
# REVIEW, phrased so the *text* says "look again" while the structured fields
# say "none". rule_gate reads only defect_type — the gap between its answer and
# the expected action is exactly the semantic load Sapling/LLM can carry.
def _region(dtype, reason, conf=None, error=None):
    r = {
        "defect_type": dtype,
        "severity": "unspecified",
        "reason": reason,
        "region": {"x1": 0, "y1": 0, "x2": 80, "y2": 80},
    }
    if conf is not None:
        r["confidence"] = conf
    if error:
        r["error"] = error
    return r


AMBIGUOUS_CASES = [
    (
        "hedged crack",
        [
            _region(
                "none",
                "possible hairline crack near via 4 — cannot confirm from this angle",
                0.72,
            )
        ],
        "REVIEW",
    ),
    (
        "hedged bridge",
        [
            _region(
                "none",
                "suspected bridging between adjacent traces, image is hazy",
                0.65,
            )
        ],
        "REVIEW",
    ),
    (
        "glare occludes",
        [_region("none", "cannot fully confirm — glare obscures the pad", 0.6)],
        "REVIEW",
    ),
    ("low-conf clean", [_region("none", "no visible defects", 0.5)], "REVIEW"),
    (
        "tombstoning?",
        [_region("none", "potential tombstoning of component C12, edge is faint", 0.7)],
        "REVIEW",
    ),
    (
        "oxidation?",
        [_region("none", "copper discoloration, possibly oxidation", 0.75)],
        "REVIEW",
    ),
    (
        "contradiction",
        [
            _region("short", "clear bridge across traces", 0.9),
            _region("none", "clean", 0.9),
        ],
        "BLOCK",
    ),
    (
        "error+clean",
        [_region("none", "clean", 0.95), _region("none", None, error="crop timeout")],
        "REVIEW",
    ),
    ("error only", [_region("none", None, error="model unavailable")], "REVIEW"),
    (
        "cosmetic",
        [_region("none", "minor cosmetic scratch, no functional impact", 0.9)],
        "SHIP",
    ),
    ("confident clean", [_region("none", "no visible defects", 0.95)], "SHIP"),
    ("real spur", [_region("spur", "copper spur protruding from trace", 0.8)], "BLOCK"),
]


def evaluate_ambiguous(use_llm: bool) -> None:
    print(f"\n{'case':<15}  expected  rules     " + ("llm        " if use_llm else ""))
    print("-" * 60)
    score = {"rules": [0, 0], "llm": [0, 0]}
    for name, regions, expected in AMBIGUOUS_CASES:
        g = verifier.rule_gate(regions)
        line = f"{name:<15}  {expected:<8}  {g['action']:<9}"
        score["rules"][g["action"] == expected] += 1
        if use_llm:
            lg = verifier.llm_gate(regions)
            line += f"  {(lg or {}).get('action', 'ERR'):<9}"
            if lg:
                score["llm"][lg["action"] == expected] += 1
        print(line)
    n = len(AMBIGUOUS_CASES)
    print(f"\nrules: {score['rules'][1]}/{n} expected actions on ambiguous evidence")
    if use_llm:
        print(f"llm:   {score['llm'][1]}/{n} expected actions on ambiguous evidence")


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
                len(verifier.hedged_regions(regions)) or "-",
                {rung: g["action"] for rung, g in verdicts.items()},
            )
        )

    rung_order = [r for r in ("live", "recorded", "llm", "rules") if stats.get(r)]
    name_w = max(len(k) for k, *_ in rows)
    print(
        f"\n{'board':<{name_w}}  truth   noted           hedged  "
        + "  ".join(f"{r:<9}" for r in rung_order)
    )
    print("-" * (name_w + 38 + 12 * len(rung_order)))
    for key, disp, noted_str, hedged_n, actions in rows:
        print(
            f"{key:<{name_w}}  {disp:<7} {noted_str:<15} {hedged_n!s:<7} "
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
    if "--ambiguous" in sys.argv:
        evaluate_ambiguous(use_llm="--llm" in sys.argv)
    else:
        evaluate(live="--live" in sys.argv, use_llm="--llm" in sys.argv)
