"""Precompute real Banyan Sapling verdicts for the demo cases.

Run once (needs network) to produce data/sapling_cache.json. The app calls Sapling
live first; if the research-preview endpoint is cold or unreachable it falls back to
these cached *real* outputs — labelled as cached, never fabricated.

    python build_cache.py
"""

import json

import demo_cases as dc
import sapling


def main() -> int:
    runs = dc.load_runs()
    cases: list[dict] = []

    for bid in dc.POLICY_BOARDS:
        cases.append({"kind": "policy", "board": bid, **dc.policy_case(bid, runs)})
    for item in dc.ILLUSTRATIVE:
        cases.append(
            {
                "kind": "illustrative",
                "board": item["id"],
                **dc.illustrative_case(item["types"]),
            }
        )
    for bid in dc.TRACE_BOARDS:
        cases.append({"kind": "trace", "board": bid, **dc.trace_case(bid, runs)})

    cache: dict = {}
    for c in cases:
        resp = sapling.verify(c["policy"], c["evidence"], c["claim"])
        gate = sapling.gate_decision(resp)
        if "error" in resp:
            print(
                f"  !! {c['kind']} {c['board']}: {resp['error']} — skipped (will retry at runtime)"
            )
            continue
        key = dc.cache_key(c["policy"], c["evidence"], c["claim"])
        cache[key] = {
            "label": gate["label"],
            "action": gate["action"],
            "confidence": gate["confidence"],
            "probabilities": gate.get("probabilities"),
            "prediction_set": gate.get("prediction_set"),
            "reason": gate["reason"],
            "unsure": gate.get("unsure"),
        }
        print(
            f"  {c['kind']:12} {c['board']:10} -> {gate['label']:24} {gate['action']} {gate['confidence']:.0%}"
        )

    dc.CACHE_PATH.write_text(json.dumps(cache, indent=2), encoding="utf-8")
    print(f"\nWrote {len(cache)} real Sapling verdicts to {dc.CACHE_PATH.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
