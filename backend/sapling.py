"""Banyan Sapling — the policy gate.

SolderSight's vision model only *proposes* a disposition. Before a board is
cleared to ship, that proposal is treated as a claim and independently verified
against (a) a written acceptance policy and (b) the defects an automated optical
inspection (AOI) pass actually found. Mubit's Banyan Sapling does the semantic
verification: it decides whether the claim is supported, violates the policy, or
can't be settled on the evidence given — with calibrated uncertainty.

This is the hard part. The vision model is cheap and fallible (the baseline lane
calls defective boards "pass"); Sapling is the safety check that catches it.

Request:  POST {endpoint}/  body {"inputs": {"policy","evidence","claim"}}
Response: {"raw_label", "probabilities", "prediction_set", "status", ...}
Labels:   supported | violation | insufficient_information | inconsistent_context
No auth is required for the research-preview endpoint.
"""

import os

import httpx

# The research-preview endpoint Mubit published for Night Shift. Overridable so a
# self-hosted Sapling (the weights are open) can be swapped in without code edits.
BANYAN_ENDPOINT = os.environ.get(
    "BANYAN_ENDPOINT", "https://6adbee0669a00298cd4774c9.endpoints.huggingface.cloud"
).rstrip("/")

LABELS = ["supported", "violation", "insufficient_information", "inconsistent_context"]

# The disposition each defect type demands, phrased as policy prose rather than a
# lookup table so Sapling verifies against the same spec a human QA lead would read.
# Mirrors DISPOSITION_BY_TYPE / SEVERITY_RANK in main.py.
DEFAULT_POLICY = (
    "PCB acceptance policy (IPC-style). "
    "A board FAILS and must be scrapped if any open-circuit or short-circuit defect is present; "
    "these are critical and cannot be reworked. "
    "A board with a mousebite, spur, spurious-copper, or pin-hole defect — and no open or short — "
    "must be sent for REWORK, not shipped as-is and not scrapped. "
    "A board with no detected defects PASSES and may ship. "
    "If the inspection evidence is missing, ambiguous, or low-confidence, the board must not be "
    "cleared automatically; route it to a human inspector."
)

_DEFECT_PHRASE = {
    "open": "open-circuit (broken trace)",
    "short": "short-circuit (bridged traces)",
    "mousebite": "mousebite (notched trace edge)",
    "spur": "spur (excess copper protrusion)",
    "copper": "spurious copper",
    "pinhole": "pin-hole",
}

# The gate verifies one thing: is the board safe to ship as-is? Sapling reads
# 'violation' as "the evidence shows a disqualifying defect" (it returns violation
# whether the claim says ship or scrap), so the honest question to put to it is the
# shippability claim — not the vision model's wording.
SHIP_CLAIM = (
    "This board passes quality assurance and is approved to ship to the customer as-is."
)


def default_policy() -> str:
    return DEFAULT_POLICY


def build_evidence(defect_types: list[str], confidence: float | None = None) -> str:
    """Natural-language account of what inspection found, as Sapling's evidence."""
    real = [t for t in defect_types if t and t != "none"]
    if not real:
        body = "Automated optical inspection found no defects on this board; it matches the reference template."
    else:
        counts: dict[str, int] = {}
        for t in real:
            counts[t] = counts.get(t, 0) + 1
        parts = []
        for t, n in counts.items():
            phrase = _DEFECT_PHRASE.get(t, t)
            parts.append(f"{n} {phrase}" + ("" if n == 1 else " defects"))
        body = "Automated optical inspection detected: " + "; ".join(parts) + "."
    if confidence is not None:
        body += f" The inspection model reported {round(confidence * 100)}% confidence in this reading."
    return body


def build_claim(disposition: str | None = None) -> str:
    """The claim the gate verifies: that the board is clear to ship as-is.

    Fixed regardless of the vision model's disposition — the gate asks whether it is
    safe to ship, and Sapling answers supported / violation / unsure against the
    evidence and policy. The disposition is kept only for the caller's context.
    """
    return SHIP_CLAIM


def build_trace_evidence(regions: list[dict]) -> str:
    """The inspection model's OWN per-crop notes, verbatim — no ground truth.

    This is the honest evidence: what the model actually said while it looked, region
    by region. Auditing a shipping claim against this catches the model contradicting
    itself (a crop it called a 'short' under a board it would ship) without ever
    consulting an answer key — the labels never enter the loop.
    """
    if not regions:
        return "The inspection model recorded no observations for this board."
    lines = [
        "A vision inspection model examined this board region by region and reported, "
        "in its own words:"
    ]
    for r in regions:
        reg = r.get("region") or {}
        loc = f"({reg.get('x1', '?')},{reg.get('y1', '?')})"
        dtype = r.get("defect_type", "none")
        sev = r.get("severity", "unspecified")
        reason = (r.get("reason") or "").strip()
        conf = r.get("confidence")
        conf_txt = f" at {round(conf * 100)}% confidence" if conf is not None else ""
        lines.append(
            f'- Region {loc}: called it "{dtype}" ({sev}){conf_txt} — "{reason}"'
        )
    return "\n".join(lines)


def verify(policy: str, evidence: str, claim: str, timeout: float = 30.0) -> dict:
    """Call Banyan Sapling. Returns the raw response, or an {error} dict on failure.

    Uses httpx, which bundles certifi — so the HTTPS call trusts the right CA store
    even where the Python build can't see the system one.
    """
    payload = {"inputs": {"policy": policy, "evidence": evidence, "claim": claim}}
    try:
        resp = httpx.post(BANYAN_ENDPOINT + "/", json=payload, timeout=timeout)
    except httpx.HTTPError as exc:
        return {"error": "sapling unreachable", "detail": str(exc)}
    if resp.status_code != 200:
        return {"error": f"sapling HTTP {resp.status_code}", "detail": resp.text[:500]}
    try:
        return resp.json()
    except ValueError as exc:
        return {"error": "sapling bad response", "detail": str(exc)}


# How a Sapling label turns into an action on the manufacturing line.
_GATE_BY_LABEL = {
    "supported": ("SHIP", "Claim supported by evidence and policy — cleared to ship."),
    "violation": (
        "BLOCK",
        "Claim conflicts with the acceptance policy — ship blocked.",
    ),
    "insufficient_information": (
        "REVIEW",
        "Not enough evidence to clear automatically — route to a human inspector.",
    ),
    "inconsistent_context": (
        "REVIEW",
        "Evidence conflicts with itself — route to a human inspector.",
    ),
}

# Sapling's 'violation' probability is bimodal and separable — ~0.95 when a real
# defect is present, near zero when the board is clean — while 'supported' tops out
# modestly even on clean boards (it won't treat "no defect detected" as proof of a
# good board). So we clear a board to ship only when 'supported' leads AND the
# residual violation risk is below this bar; any real violation signal routes it to
# a human instead of auto-shipping.
_MAX_SHIP_VIOLATION_RISK = 0.15


def gate_decision(response: dict) -> dict:
    """Map a Sapling response to a line decision: SHIP / BLOCK / REVIEW."""
    if "error" in response or "probabilities" not in response:
        return {
            "action": "REVIEW",
            "label": None,
            "reason": "Verifier unavailable — defaulting to human review (fail safe).",
            "confidence": None,
            "margin": None,
            "unsure": True,
            "error": response.get("error"),
        }

    probs = response["probabilities"]
    label = response.get("raw_label") or max(probs, key=probs.get)
    ranked = sorted(probs.values(), reverse=True)
    top = ranked[0]
    margin = round(top - (ranked[1] if len(ranked) > 1 else 0.0), 3)
    conformal = response.get("prediction_set") or []
    # The research preview tends to emit wide conformal sets; treat >1 live label
    # (or an explicit 'unsure' status) as genuine uncertainty worth surfacing.
    unsure = response.get("status") == "unsure" or len(conformal) > 1

    action, reason = _GATE_BY_LABEL.get(
        label, ("REVIEW", "Unrecognised verdict — routed to human review.")
    )
    # 'Supported' clears a board only when little violation risk remains; otherwise a
    # human looks. (Sapling's violation signal is sharp, so this rarely blocks a truly
    # clean board but reliably stops a defective one from auto-shipping.)
    violation_risk = probs.get("violation", 0.0)
    if action == "SHIP" and violation_risk >= _MAX_SHIP_VIOLATION_RISK:
        action = "REVIEW"
        reason = f"Supported, but a {violation_risk:.0%} violation risk remains — route to a human inspector."

    return {
        "action": action,
        "label": label,
        "reason": reason,
        "confidence": round(top, 3),
        "margin": margin,
        "unsure": unsure,
        "probabilities": probs,
        "prediction_set": conformal,
    }
