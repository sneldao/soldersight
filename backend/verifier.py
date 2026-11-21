"""Verifier ladder — the policy gate's redundancy layer, shared by every surface.

Banyan Sapling is the preferred semantic verifier, but it's a research preview
with no SLA (paused Nov 21, 2026). This module owns the rungs below it so the
gate always answers — and every verdict carries `source`, so nothing pretends
to be Sapling:

    llm   — an independent OpenAI-compatible verifier (different model,
            different service). Candidates in order: Mubit /openai/v1, Mubit
            /compat/groq/v1 (registered free-tier key), evomap, ambient
            OPENAI_* gateways. Returns None when no provider answers.
    rules — the acceptance policy as code over the evidence regions. Always
            on, zero network. Honest about the narrower question it answers:
            "did the recorded evidence forbid shipping as-is?"

Consumers:
- glasses.gate_for — live → recorded snapshot → llm → rules (payloads can run
  fully offline on snapshot + rules).
- main.verify_bundle — live Sapling → llm → rules for /verify/board and
  /verify/trace, so the HTTP gate has the same resilience as the demo path.
"""

import json
import os
import re

import sapling

_SCRAP_TYPES = {"open", "short"}  # policy: scrap-grade, cannot ship as-is
_REWORK_TYPES = {"mousebite", "spur", "copper", "pinhole"}  # policy: must rework

_HEDGE_RE = re.compile(
    r"possibly|potential|suspect|may be|might|unclear|cannot confirm|unsure|"
    r"appear|seem|likely|probable|faint|hazy|minor cosmetic|cosmetic",
    re.I,
)


def hedged_regions(regions: list[dict]) -> list[dict]:
    """Clean notes that aren't quite clean: hedged language or confidence under
    0.8. These are the queue a re-inspection pass (magnified second look) would
    take — the gate leaves them alone, but 'appears clean' is not 'is clean'.
    Defects and errors are already handled by the gate."""
    return [
        r
        for r in regions
        if not r.get("error")
        and r.get("defect_type") in (None, "none")
        and (
            (r.get("confidence") or 1.0) < 0.8
            or _HEDGE_RE.search(r.get("reason") or "")
        )
    ]


def rule_gate(regions: list[dict], subject: str = "the model's own notes") -> dict:
    """The deterministic verifier: the same written policy as code.

    Not a stand-in for Sapling's calibrated semantics — it answers the narrower
    question the gate exists for: does the recorded evidence include anything
    the acceptance policy forbids shipping as-is? Always available, zero
    network, and honest about being a rule check rather than a learned verdict.
    Confidence = the strength of the strongest defect note it blocks on.
    `subject` names what produced the regions ("the model's own notes" for
    trace mode, "the AOI evidence" for oracle mode) so the reason stays true.
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
            "reason": f"Policy check: {subject} record '{worst['defect_type']}' (scrap-grade) — this board cannot ship as-is.",
            "confidence": worst.get("confidence"),
            "source": "rules",
            "errored_regions": errored or None,
        }
    if rework:
        worst = max(rework, key=lambda r: r.get("confidence") or 0)
        return {
            "action": "BLOCK",
            "label": "violation",
            "reason": f"Policy check: {subject} record '{worst['defect_type']}' (rework-grade) — must rework, cannot ship as-is.",
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
        "reason": f"Policy check: no defect recorded in {subject} — cleared to ship.",
        "confidence": None,
        "source": "rules",
    }


def llm_gate(regions: list[dict], evidence: str | None = None) -> dict | None:
    """A second opinion from a different service: the claim vs the recorded
    evidence, put to an OpenAI-compatible LLM. Returns None when no provider
    answers so callers can fall through to `rule_gate`.

    `evidence` lets the caller supply the exact prose it gave Sapling (e.g.
    oracle-mode AOI evidence); when omitted it's rebuilt from `regions` as the
    model's own notes — the same honesty contract as the trace audit.
    Imported lazily so the stdlib replay server stays dependency-free.
    """
    try:
        from openai import OpenAI
    except ImportError:
        return None
    evidence = evidence or sapling.build_trace_evidence(regions)
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
    # stack: /openai/v1 if a real OpenAI key is added, /compat/groq/v1 via the
    # registered free-tier Groq key), then evomap (free, verified), then whatever
    # ambient gateway/key is configured.
    candidates = []
    if os.environ.get("MUBIT_API_KEY"):
        candidates.append(
            (
                "mubit",
                os.environ.get("MUBIT_BASE_URL", "https://api.mubit.ai/openai/v1"),
                os.environ["MUBIT_API_KEY"],
                os.environ.get("MUBIT_MODEL", "gpt-4o-mini"),
                {},
            )
        )
        candidates.append(
            (
                "mubit+groq",
                "https://api.mubit.ai/compat/groq/v1",
                os.environ["MUBIT_API_KEY"],
                os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b"),
                # gpt-oss is a reasoning model; low effort keeps the gate fast
                # and leaves room for reasoning + the JSON verdict.
                {"reasoning_effort": "low", "max_tokens": 1500},
            )
        )
    if os.environ.get("EVOMAP_API_KEY"):
        candidates.append(
            (
                "evomap",
                os.environ.get("EVOMAP_BASE_URL", "https://api.evomap.ai/v1"),
                os.environ["EVOMAP_API_KEY"],
                os.environ.get("EVOMAP_MODEL", "evomap-glm-5.1"),
                {},
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
                {},
            )
        )
    for name, base, key, model, extra in candidates:
        try:
            client = OpenAI(base_url=base, api_key=key, timeout=15.0)
            resp = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                **extra,
            )
            content = (resp.choices[0].message.content or "").strip()
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


def fallback_gate(
    regions: list[dict],
    evidence: str | None = None,
    subject: str = "the model's own notes",
    use_llm: bool = True,
) -> dict | None:
    """The rungs below Sapling, in order: independent LLM, then policy-as-code.
    Returns the first verdict produced, or None if `regions` is empty and rules
    can't read the evidence either."""
    if use_llm:
        verdict = llm_gate(regions, evidence=evidence)
        if verdict is not None:
            return verdict
    if not regions:
        return None
    return rule_gate(regions, subject=subject)
