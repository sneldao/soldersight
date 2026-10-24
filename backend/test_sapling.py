"""Policy-gate tests. The verdict mapping is pure; the endpoint is tested with
Sapling stubbed, so nothing here touches the network."""

from fastapi.testclient import TestClient

import main
import sapling


def resp(
    probs: dict, label: str, status: str = "unsure", pset: list | None = None
) -> dict:
    return {
        "probabilities": probs,
        "raw_label": label,
        "status": status,
        "prediction_set": pset or list(probs),
    }


def test_violation_blocks_the_ship():
    gate = sapling.gate_decision(
        resp(
            {
                "supported": 0.02,
                "violation": 0.95,
                "insufficient_information": 0.02,
                "inconsistent_context": 0.01,
            },
            "violation",
        )
    )
    assert gate["action"] == "BLOCK"
    assert gate["label"] == "violation"


def test_supported_with_low_violation_risk_ships():
    gate = sapling.gate_decision(
        resp(
            {
                "supported": 0.46,
                "violation": 0.08,
                "insufficient_information": 0.44,
                "inconsistent_context": 0.02,
            },
            "supported",
        )
    )
    assert gate["action"] == "SHIP"


def test_supported_but_real_violation_risk_goes_to_review():
    gate = sapling.gate_decision(
        resp(
            {
                "supported": 0.45,
                "violation": 0.30,
                "insufficient_information": 0.22,
                "inconsistent_context": 0.03,
            },
            "supported",
        )
    )
    assert gate["action"] == "REVIEW"


def test_insufficient_information_goes_to_review():
    gate = sapling.gate_decision(
        resp(
            {
                "supported": 0.30,
                "violation": 0.10,
                "insufficient_information": 0.58,
                "inconsistent_context": 0.02,
            },
            "insufficient_information",
        )
    )
    assert gate["action"] == "REVIEW"


def test_verifier_error_fails_safe_to_review():
    gate = sapling.gate_decision({"error": "sapling unreachable", "detail": "boom"})
    assert gate["action"] == "REVIEW"
    assert gate["label"] is None


def test_evidence_describes_what_inspection_found():
    assert "no defects" in sapling.build_evidence(["none"]).lower()
    text = sapling.build_evidence(["open", "spur"])
    assert "open-circuit" in text and "spur" in text


def test_claim_is_the_fixed_shippability_question():
    # The gate always verifies the same thing regardless of the proposed disposition.
    assert (
        sapling.build_claim("pass")
        == sapling.build_claim("scrap")
        == sapling.SHIP_CLAIM
    )


def test_verify_board_bundles_gate_evidence_and_truth(monkeypatch):
    # Stub the model so the test is deterministic and offline.
    monkeypatch.setattr(
        main,
        "annotations_for",
        lambda _b: [{"x1": 0, "y1": 0, "x2": 1, "y2": 1, "code": 1, "type": "open"}],
    )
    monkeypatch.setattr(
        sapling,
        "verify",
        lambda *_a, **_k: resp(
            {
                "supported": 0.02,
                "violation": 0.96,
                "insufficient_information": 0.01,
                "inconsistent_context": 0.01,
            },
            "violation",
        ),
    )

    body = (
        TestClient(main.app)
        .post(
            "/verify/board/00041000", json={"disposition": "pass", "confidence": 0.85}
        )
        .json()
    )

    assert body["gate"]["action"] == "BLOCK"
    assert body["claimed_disposition"] == "pass"
    assert body["ground_truth"]["disposition"] == "scrap"
    assert "open-circuit" in body["evidence"]


def test_verify_board_unknown_board_404():
    assert (
        TestClient(main.app)
        .post("/verify/board/nope", json={"disposition": "pass"})
        .status_code
        == 404
    )
