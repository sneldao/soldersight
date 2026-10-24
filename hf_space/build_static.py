"""Generate the static HF Space payload from the demo cases.

Static Spaces are free for everyone and the Banyan Sapling endpoint allows browser
(CORS) calls — so the static page can verify LIVE client-side, falling back to the
real cached verdicts bundled here. This writes:

    ../static_space/cases.json      demo cases + real cached verdicts + endpoint
    ../static_space/images/*.jpg    board photos used by the cases

Run from hf_space/ with the venv active:  python build_static.py
(index.html and README.md are authored by hand, not generated.)
"""

import json
import shutil
from pathlib import Path

import demo_cases as dc
import sapling

OUT = Path(__file__).resolve().parent.parent / "static_space"
IMG_OUT = OUT / "images"


def verdict_for(policy: str, evidence: str, claim: str) -> dict:
    """Prefer the real cached verdict; fill any gap with a fresh live call."""
    cached = dc.load_cache().get(dc.cache_key(policy, evidence, claim))
    if cached:
        return cached
    gate = sapling.gate_decision(sapling.verify(policy, evidence, claim))
    return {
        "label": gate.get("label"),
        "action": gate.get("action"),
        "confidence": gate.get("confidence"),
        "probabilities": gate.get("probabilities"),
        "prediction_set": gate.get("prediction_set"),
        "reason": gate.get("reason"),
        "unsure": gate.get("unsure"),
    }


def copy_image(board_id: str) -> str | None:
    src = dc.IMAGES_DIR / f"{board_id}_test.jpg"
    if not src.exists():
        return None
    IMG_OUT.mkdir(parents=True, exist_ok=True)
    name = f"{board_id}_test.jpg"
    shutil.copy(src, IMG_OUT / name)
    return f"images/{name}"


def main() -> int:
    runs = dc.load_runs()
    OUT.mkdir(parents=True, exist_ok=True)

    policy_cases = []
    for bid in dc.POLICY_BOARDS:
        c = dc.policy_case(bid, runs)
        vis = dc.board_vision(bid, runs)
        truth = dc.board_ground_truth(bid, runs)
        policy_cases.append(
            {
                "id": bid,
                "title": f"Board {bid}" + (" — the catch" if bid == "00041004" else ""),
                "image": copy_image(bid),
                "vision": {
                    "disposition": vis.get("disposition"),
                    "reason": vis.get("reason"),
                    "confidence": vis.get("confidence"),
                },
                "truth": {
                    "disposition": truth.get("disposition"),
                    "worst": truth.get("worst"),
                },
                **c,
                "cached": verdict_for(c["policy"], c["evidence"], c["claim"]),
            }
        )
    for item in dc.ILLUSTRATIVE:
        c = dc.illustrative_case(item["types"])
        policy_cases.append(
            {
                "id": item["id"],
                "title": item["label"],
                "image": None,
                "vision": None,
                "truth": None,
                **c,
                "cached": verdict_for(c["policy"], c["evidence"], c["claim"]),
            }
        )

    trace_cases = []
    for bid in dc.TRACE_BOARDS:
        c = dc.trace_case(bid, runs)
        trace_cases.append(
            {
                "id": bid,
                "title": f"Board {bid}"
                + (" — wrote “visible short circuit”" if bid == "00041003" else ""),
                "image": copy_image(bid),
                **c,
                "cached": verdict_for(c["policy"], c["evidence"], c["claim"]),
            }
        )

    payload = {
        "endpoint": sapling.BANYAN_ENDPOINT,
        "ship_margin": sapling._MAX_SHIP_VIOLATION_RISK,
        "policy_cases": policy_cases,
        "trace_cases": trace_cases,
    }
    (OUT / "cases.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(
        f"Wrote {OUT/'cases.json'} — {len(policy_cases)} policy, {len(trace_cases)} trace cases"
    )
    print(
        f"Images in {IMG_OUT}: {len(list(IMG_OUT.glob('*.jpg'))) if IMG_OUT.exists() else 0}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
