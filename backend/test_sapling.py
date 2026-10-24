"""Policy-gate tests. The verdict mapping is pure; the endpoint is tested with
Sapling stubbed, so nothing here touches the network."""

import json

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


def test_verify_board_oracle_mode_bundles_gate_evidence_and_truth(monkeypatch):
    # Oracle mode: the caller explicitly hands the gate the AOI labels.
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
            "/verify/board/00041000",
            json={
                "disposition": "pass",
                "confidence": 0.85,
                "evidence_types": ["open"],
            },
        )
        .json()
    )

    assert body["gate"]["action"] == "BLOCK"
    assert body["claimed_disposition"] == "pass"
    assert body["evidence_mode"] == "oracle"
    assert body["ground_truth"]["disposition"] == "scrap"
    assert "open-circuit" in body["evidence"]


def test_verify_board_defaults_to_trace_evidence(monkeypatch):
    # Pass the triage regions and the gate audits the model's own notes — no labels.
    monkeypatch.setattr(
        sapling,
        "verify",
        lambda *_a, **_k: resp(
            {
                "supported": 0.04,
                "violation": 0.84,
                "insufficient_information": 0.08,
                "inconsistent_context": 0.04,
            },
            "violation",
        ),
    )
    regions = [
        {
            "region": {"x1": 320, "y1": 0},
            "defect_type": "short",
            "severity": "major",
            "confidence": 0.85,
            "reason": "There is a visible short circuit.",
        }
    ]

    body = (
        TestClient(main.app)
        .post(
            "/verify/board/00041000",
            json={"disposition": "pass", "regions": regions},
        )
        .json()
    )

    assert body["evidence_mode"] == "trace"
    assert body["gate"]["action"] == "BLOCK"
    assert "visible short circuit" in body["evidence"]
    assert "Automated optical inspection detected" not in body["evidence"]


def test_verify_board_falls_back_to_recorded_regions(monkeypatch, tmp_path):
    # No regions in the body: use the board's latest recorded run, still no labels.
    # Batches carry a shared run_id, so /compare's two lanes (side by side in the
    # ledger under one board_id) can't bleed into the batch.
    runs = tmp_path / "runs.jsonl"
    rows = [
        {
            "board_id": "00041000",
            "run_id": "old",
            "defect_type": "open",
            "severity": "critical",
            "confidence": 0.9,
            "reason": "a break in the trace",
            "region": {"x1": 0, "y1": 0},
        },
        # A different board's run must not bleed into the batch.
        {
            "board_id": "00041099",
            "run_id": "other",
            "defect_type": "none",
            "region": {"x1": 0, "y1": 0},
        },
        # Older recorded run for the same board, under a different run_id.
        {
            "board_id": "00041000",
            "run_id": "old",
            "defect_type": "open",
            "severity": "critical",
            "confidence": 0.9,
            "reason": "a break in the trace",
            "region": {"x1": 0, "y1": 0},
        },
        # The compare run: baseline lane, then adapted lane, same board.
        {
            "board_id": "00041000",
            "run_id": "base",
            "defect_type": "open",
            "severity": "critical",
            "confidence": 0.9,
            "reason": "latest batch",
            "region": {"x1": 5, "y1": 5},
        },
        {
            "board_id": "00041000",
            "run_id": "adap",
            "defect_type": "open",
            "severity": "critical",
            "confidence": 0.9,
            "reason": "adapted double-count",
            "region": {"x1": 5, "y1": 5},
        },
        # A failed crop inside the latest run: not collectable, but must not end
        # the batch either.
        {
            "board_id": "00041000",
            "run_id": "base",
            "error": "502",
            "region": {"x1": 8, "y1": 0},
        },
        {
            "board_id": "00041000",
            "run_id": "base",
            "defect_type": "none",
            "severity": "cosmetic",
            "confidence": 0.9,
            "reason": "still in the same batch",
            "region": {"x1": 9, "y1": 9},
        },
    ]
    runs.write_text("\n".join(json.dumps(r) for r in rows))
    monkeypatch.setattr(main, "RUNS_PATH", runs)
    monkeypatch.setattr(
        sapling,
        "verify",
        lambda *_a, **_k: resp({"supported": 0.9, "violation": 0.02}, "supported"),
    )

    body = (
        TestClient(main.app)
        .post("/verify/board/00041000", json={"disposition": "pass"})
        .json()
    )

    assert body["evidence_mode"] == "trace"
    assert "latest batch" in body["evidence"]
    assert "still in the same batch" in body["evidence"]
    # Failed crops report as failures, not as clean observations.
    assert "the call failed" in body["evidence"]
    # Batch isolation: the earlier run, the other board, and the compare lane
    # that shares the board stay out of the evidence.
    assert "a break in the trace" not in body["evidence"]
    assert "adapted double-count" not in body["evidence"]


def test_verify_board_with_no_evidence_inputs_fails_closed(monkeypatch, tmp_path):
    # A board never triaged, no regions, no evidence_types: the answer key may
    # not slide in as a "last resort" — the gate asks for evidence instead.
    monkeypatch.setattr(main, "RUNS_PATH", tmp_path / "runs.jsonl")

    res = TestClient(main.app).post(
        "/verify/board/00041000", json={"disposition": "pass"}
    )

    assert res.status_code == 422
    assert "evidence_types" in res.json()["detail"]


def test_verify_board_unknown_board_404():
    assert (
        TestClient(main.app)
        .post("/verify/board/nope", json={"disposition": "pass"})
        .status_code
        == 404
    )


def test_trace_evidence_quotes_the_models_own_notes():
    regions = [
        {
            "region": {"x1": 320, "y1": 0},
            "defect_type": "short",
            "severity": "major",
            "confidence": 0.85,
            "reason": "There is a visible short circuit.",
        },
        {
            "region": {"x1": 0, "y1": 0},
            "defect_type": "none",
            "severity": "cosmetic",
            "confidence": 0.9,
            "reason": "No visible defects.",
        },
    ]
    text = sapling.build_trace_evidence(regions)
    # The model's own words, not the dataset labels, are the evidence.
    assert "visible short circuit" in text
    assert "short" in text and "(320,0)" in text


def test_verify_trace_blocks_a_self_contradicting_ship(monkeypatch):
    # The model noted a short in one crop; auditing the ship claim must not need labels.
    monkeypatch.setattr(
        sapling,
        "verify",
        lambda *_a, **_k: resp(
            {
                "supported": 0.04,
                "violation": 0.84,
                "insufficient_information": 0.08,
                "inconsistent_context": 0.04,
            },
            "violation",
        ),
    )
    regions = [
        {
            "region": {"x1": 320, "y1": 0},
            "defect_type": "short",
            "severity": "major",
            "confidence": 0.85,
            "reason": "There is a visible short circuit.",
        },
        {
            "region": {"x1": 0, "y1": 0},
            "defect_type": "none",
            "severity": "cosmetic",
            "confidence": 0.9,
            "reason": "No visible defects.",
        },
    ]

    body = TestClient(main.app).post("/verify/trace", json={"regions": regions}).json()

    assert body["gate"]["action"] == "BLOCK"
    assert body["regions_examined"] == 2
    assert body["defects_the_model_noted"] == ["short"]
    assert "ground_truth" not in body  # no answer key in the trace audit
