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

import json
import os
import urllib.error
import urllib.request

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

# What the AOI evidence implies the honest disposition should be — used only to
# phrase the claim the vision model is effectively making ("passes", "needs rework").
_CLAIM_PHRASE = {
    "pass": "This board passes quality assurance and is approved to ship as-is.",
    "rework": "This board does not need to be scrapped; it only needs rework.",
    "scrap": "This board fails quality assurance and must be scrapped.",
}


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


def build_claim(disposition: str) -> str:
    """The disposition the vision model proposed, phrased as the claim to verify."""
    return _CLAIM_PHRASE.get(
        disposition, f"This board's disposition is '{disposition}'."
    )


def verify(policy: str, evidence: str, claim: str, timeout: float = 30.0) -> dict:
    """Call Banyan Sapling. Returns the raw response, or an {error} dict on failure."""
    payload = json.dumps(
        {"inputs": {"policy": policy, "evidence": evidence, "claim": claim}}
    ).encode("utf-8")
    req = urllib.request.Request(
        BANYAN_ENDPOINT + "/",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        return {
            "error": f"sapling HTTP {exc.code}",
            "detail": exc.read().decode("utf-8", "ignore")[:500],
        }
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        return {"error": "sapling unreachable", "detail": str(exc)}


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

# Below this top-probability margin we don't trust an automatic SHIP, even if
# 'supported' won the argmax: a near-tie is exactly when a human should look.
_SHIP_MARGIN = 0.15


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
    # A paper-thin win for 'supported' is not a clearance; make the human decide.
    if action == "SHIP" and margin < _SHIP_MARGIN:
        action = "REVIEW"
        reason = f"'Supported' led by only {margin:.0%} — too close to clear automatically; route to a human inspector."

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
