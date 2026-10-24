import io
import json
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from PIL import Image

import main

VALID = {
    "defect_type": "mousebite",
    "severity": "minor",
    "disposition": "rework",
    "confidence": 0.82,
    "reason": "Small notch visible on the trace.",
}

USAGE = SimpleNamespace(prompt_tokens=1000, completion_tokens=20, total_tokens=1020)


def fake_client(content: str) -> MagicMock:
    parsed = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=content))], usage=USAGE
    )
    raw = SimpleNamespace(
        headers={"x-middleware-request-id": "mreq_abc123"}, parse=lambda: parsed
    )
    client = MagicMock()
    client.chat.completions.with_raw_response.create = MagicMock(return_value=raw)
    return client


def jpeg(size: int = 64) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (size, size), (120, 120, 120)).save(buffer, format="JPEG")
    return buffer.getvalue()


def triage_upload(client: TestClient, **data):
    return client.post(
        "/triage", files={"image": ("board.jpg", jpeg(), "image/jpeg")}, data=data
    )


def test_triage_classifies_each_quadrant(monkeypatch, tmp_path):
    client = fake_client(json.dumps(VALID))
    monkeypatch.setattr(main, "get_client", lambda: client)
    monkeypatch.setattr(main, "RUNS_PATH", tmp_path / "runs.jsonl")

    body = triage_upload(TestClient(main.app), lane="baseline").json()

    assert {key: body[key] for key in VALID} == VALID
    assert len(body["regions"]) == 4
    assert body["metrics"]["calls"] == 4
    kwargs = client.chat.completions.with_raw_response.create.call_args.kwargs
    assert kwargs["model"] == "gpt-4o-mini"
    image_part = kwargs["messages"][1]["content"][0]
    assert image_part["image_url"]["url"].startswith("data:image/jpeg;base64,")


def test_triage_records_cost_and_mubit_request_id(monkeypatch, tmp_path):
    runs = tmp_path / "runs.jsonl"
    monkeypatch.setattr(main, "RUNS_PATH", runs)
    monkeypatch.setattr(main, "get_client", lambda: fake_client(json.dumps(VALID)))

    triage_upload(TestClient(main.app), lane="baseline")

    rows = [json.loads(line) for line in runs.read_text().splitlines()]
    assert len(rows) == 4
    assert rows[0]["lane"] == "baseline"
    assert rows[0]["metrics"]["mubit_request_id"] == "mreq_abc123"
    # 1000 tokens in at $0.15/M, 20 out at $0.60/M.
    assert rows[0]["metrics"]["cost_usd"] == pytest.approx(0.000162)


def test_triage_board_scores_each_region_against_annotations(monkeypatch, tmp_path):
    monkeypatch.setattr(main, "RUNS_PATH", tmp_path / "runs.jsonl")
    monkeypatch.setattr(main, "get_client", lambda: fake_client(json.dumps(VALID)))
    monkeypatch.setattr(
        main, "changed_regions", lambda *_a: [main.Region(0, 0, 64, 64, 11.4)]
    )
    monkeypatch.setattr(
        main,
        "annotations_for",
        lambda _b: [
            {"x1": 10, "y1": 10, "x2": 20, "y2": 20, "code": 3, "type": "mousebite"}
        ],
    )

    body = TestClient(main.app).post("/triage/board/00041000").json()

    assert body["board_id"] == "00041000"
    region = body["regions"][0]
    assert region["ground_truth"] == {
        "defect_types": ["mousebite"],
        "disposition": "rework",
        "worst": "mousebite",
    }
    assert region["score"] == {"type_correct": True, "disposition_correct": True}
    assert region["region"]["delta"] == 11.4


def test_triage_board_verdict_follows_the_worst_region(monkeypatch, tmp_path):
    monkeypatch.setattr(main, "RUNS_PATH", tmp_path / "runs.jsonl")
    answers = [
        (
            dict(VALID, defect_type="spur", disposition="rework"),
            {
                "latency_ms": 10.0,
                "prompt_tokens": 10,
                "completion_tokens": 5,
                "total_tokens": 15,
                "cost_usd": 0.001,
                "mubit_request_id": "mreq_a",
            },
        ),
        (
            dict(VALID, defect_type="short", disposition="scrap"),
            {
                "latency_ms": 20.0,
                "prompt_tokens": 10,
                "completion_tokens": 5,
                "total_tokens": 15,
                "cost_usd": 0.001,
                "mubit_request_id": "mreq_b",
            },
        ),
    ]
    calls = iter(answers)
    monkeypatch.setattr(main, "classify_image", lambda *_a, **_k: next(calls))
    monkeypatch.setattr(
        main,
        "changed_regions",
        lambda *_a: [main.Region(0, 0, 10, 10, 9.0), main.Region(20, 20, 30, 30, 7.0)],
    )
    monkeypatch.setattr(main, "annotations_for", lambda _b: [])

    body = TestClient(main.app).post("/triage/board/00041000").json()

    assert body["disposition"] == "scrap"
    assert body["defect_type"] == "short"
    assert body["metrics"]["latency_ms"] == 30.0


def test_triage_board_unknown_board(monkeypatch, tmp_path):
    monkeypatch.setattr(main, "RUNS_PATH", tmp_path / "runs.jsonl")
    res = TestClient(main.app).post("/triage/board/nope")
    assert res.status_code == 404


def test_changed_regions_ignores_unchanged_cells():
    # A board photo identical to its template has nothing to inspect.
    from inspection import changed_regions, grid_regions

    image = jpeg(128)
    assert changed_regions(image, image) == []
    assert len(grid_regions(image, grid=2)) == 4


def test_metrics_aggregates_per_lane(monkeypatch, tmp_path):
    runs = tmp_path / "runs.jsonl"
    monkeypatch.setattr(main, "RUNS_PATH", runs)
    monkeypatch.setattr(
        main,
        "annotations_for",
        lambda _b: [{"x1": 0, "y1": 0, "x2": 1, "y2": 1, "code": 1, "type": "open"}],
    )

    def row(board, worst, defect, disposition, latency, cost, type_ok, disp_ok):
        return {
            "board_id": board,
            "lane": "baseline",
            "defect_type": defect,
            "disposition": disposition,
            "ground_truth": {
                "worst": worst,
                "disposition": "scrap",
                "defect_types": ["open"],
            },
            "score": {"type_correct": type_ok, "disposition_correct": disp_ok},
            "metrics": {"latency_ms": latency, "total_tokens": 10, "cost_usd": cost},
        }

    rows = [
        # A real defect the model saw, and one it walked straight past.
        row("b1", "open", "open", "scrap", 100.0, 0.001, True, True),
        row("b1", "open", "none", "pass", 300.0, 0.003, False, False),
        # A clean crop: correct here is easy, a defect answer would be a false alarm.
        row("b2", "none", "none", "pass", 200.0, 0.002, True, True),
        row("b2", "none", "spur", "rework", 200.0, 0.002, False, False),
    ]
    runs.write_text("\n".join(json.dumps(r) for r in rows))

    lane = TestClient(main.app).get("/metrics").json()["lanes"]["baseline"]

    assert lane["calls"] == 4
    assert lane["boards"] == 2
    assert lane["defect_regions"] == 2
    assert lane["type_accuracy"] == 0.5
    assert lane["missed_defect_rate"] == 0.5
    assert lane["false_alarm_rate"] == 0.5
    assert lane["avg_latency_ms"] == 200.0
    assert lane["total_cost_usd"] == 0.008
    # b1's worst region says scrap (right), b2's says rework against a scrap truth (wrong).
    assert lane["board_disposition_accuracy"] == 0.5


def test_triage_rejects_invalid_model_output(monkeypatch, tmp_path):
    monkeypatch.setattr(main, "RUNS_PATH", tmp_path / "runs.jsonl")
    bad = dict(VALID, defect_type="cracked")
    monkeypatch.setattr(main, "get_client", lambda: fake_client(json.dumps(bad)))

    res = triage_upload(TestClient(main.app))

    assert res.status_code == 502


def test_triage_rejects_non_image_upload(monkeypatch):
    monkeypatch.setattr(main, "get_client", lambda: fake_client("{}"))

    res = TestClient(main.app).post(
        "/triage", files={"image": ("notes.txt", b"hello", "text/plain")}
    )

    assert res.status_code == 400


def test_boards_lists_pairs_with_annotations():
    res = TestClient(main.app).get("/boards")
    assert res.status_code == 200
    boards = res.json()
    assert len(boards) > 0
    first = boards[0]
    assert first["testUrl"] == f"/assets/{first['id']}_test.jpg"
    assert all(a["type"] in main.CODE_TO_TYPE.values() for a in first["annotations"])


def test_asset_serves_image_and_blocks_traversal():
    client = TestClient(main.app)
    boards = client.get("/boards").json()
    name = f"{boards[0]['id']}_test.jpg"
    assert client.get(f"/assets/{name}").status_code == 200
    assert client.get("/assets/..%2Fmain.py").status_code == 404


def test_parse_annotations_accepts_spaces_and_commas():
    parsed = main.parse_annotations("466 441 493 470 3\n1,2,3,4,6\nbad line")
    assert parsed[0]["type"] == "mousebite"
    assert parsed[1]["type"] == "pinhole"
    assert len(parsed) == 2


CALL_METRICS = {
    "latency_ms": 100.0,
    "prompt_tokens": 10,
    "completion_tokens": 5,
    "total_tokens": 15,
    "cost_usd": 0.001,
    "mubit_request_id": "mreq_a",
}


def test_correction_becomes_a_rule_in_the_adapted_lane(monkeypatch, tmp_path):
    monkeypatch.setattr(main, "CORRECTIONS_PATH", tmp_path / "corrections.jsonl")
    body = {
        "board_id": "00041000",
        "original": {"defect_type": "open", "disposition": "scrap"},
        "corrected": {
            "defect_type": "spur",
            "severity": "minor",
            "disposition": "rework",
        },
        "reason": "copper stub beside the trace, not a break",
    }

    res = TestClient(main.app).post("/corrections", json=body)

    assert res.status_code == 200
    rules = res.json()["rules"]
    assert len(rules) == 1
    assert "spur" in rules[0] and "copper stub beside the trace" in rules[0]
    assert rules[0] in res.json()["adapted_instructions"]
    assert rules[0] not in main.instructions_for("baseline")


def test_correction_can_teach_a_brand_new_defect_type(monkeypatch, tmp_path):
    monkeypatch.setattr(main, "CORRECTIONS_PATH", tmp_path / "corrections.jsonl")
    res = TestClient(main.app).post(
        "/corrections",
        json={
            "board_id": "00041001",
            "original": {"defect_type": "spur", "disposition": "rework"},
            "corrected": {
                "defect_type": "tombstoning",
                "severity": "major",
                "disposition": "rework",
            },
            "reason": "component standing on one end",
        },
    )

    assert "tombstoning" in res.json()["defect_types"]
    assert "tombstoning" in main.instructions_for("adapted")
    payload = json.dumps(dict(VALID, defect_type="tombstoning"))
    assert main.parse_classification(payload)["defect_type"] == "tombstoning"


def test_rules_endpoint_shows_both_task_prompts(monkeypatch, tmp_path):
    monkeypatch.setattr(main, "CORRECTIONS_PATH", tmp_path / "corrections.jsonl")
    TestClient(main.app).post(
        "/corrections",
        json={
            "board_id": "00041000",
            "original": {"defect_type": "short"},
            "corrected": {
                "defect_type": "copper",
                "severity": "cosmetic",
                "disposition": "pass",
            },
            "reason": "solder spatter, conducting nothing",
        },
    )

    body = TestClient(main.app).get("/rules").json()

    assert len(body["corrections"]) == 1
    assert body["lanes"]["baseline"] != body["lanes"]["adapted"]
    assert body["rules"][0] in body["lanes"]["adapted"]


def test_compare_runs_the_same_crops_down_both_lanes(monkeypatch, tmp_path):
    monkeypatch.setattr(main, "RUNS_PATH", tmp_path / "runs.jsonl")
    monkeypatch.setattr(main, "CORRECTIONS_PATH", tmp_path / "corrections.jsonl")
    monkeypatch.setattr(
        main, "changed_regions", lambda *_a: [main.Region(0, 0, 320, 320, 9.0)]
    )
    monkeypatch.setattr(
        main,
        "annotations_for",
        lambda _b: [
            {"x1": 10, "y1": 10, "x2": 20, "y2": 20, "code": 1, "type": "open"}
        ],
    )

    def fake_classify(_data, lane):
        # The baseline walks past the break; the corrected rules call it an open.
        if lane == "adapted":
            return (
                dict(
                    VALID, defect_type="open", severity="critical", disposition="scrap"
                ),
                CALL_METRICS,
            )
        return (
            dict(VALID, defect_type="none", severity="cosmetic", disposition="pass"),
            CALL_METRICS,
        )

    monkeypatch.setattr(main, "classify_image", fake_classify)
    board = TestClient(main.app).get("/boards").json()[0]["id"]

    body = TestClient(main.app).post("/compare", json={"board_ids": [board]}).json()

    assert body["lanes"]["baseline"]["type_accuracy"] == 0.0
    assert body["lanes"]["adapted"]["type_accuracy"] == 1.0
    verdicts = body["boards"][0]["verdicts"]
    assert verdicts["baseline"]["correct"] is False
    assert verdicts["adapted"]["correct"] is True
    assert body["boards"][0]["ground_truth"]["disposition"] == "scrap"
    # Each lane carries its own region rows, so the UI can show the two verdicts over
    # the same crop without spending a third set of calls.
    regions = body["boards"][0]["regions"]
    assert {lane: len(rows) for lane, rows in regions.items()} == {
        "baseline": 1,
        "adapted": 1,
    }
    assert regions["adapted"][0]["score"]["type_correct"] is True


def test_crop_serves_the_region_the_model_saw():
    client = TestClient(main.app)
    board = client.get("/boards").json()[0]["id"]

    res = client.get(f"/crop/{board}/0")
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/jpeg"
    assert client.get(f"/crop/{board}/99").status_code == 404
    assert client.get("/crop/a.b/0").status_code == 404


def test_compare_rejects_unknown_board(monkeypatch, tmp_path):
    monkeypatch.setattr(main, "RUNS_PATH", tmp_path / "runs.jsonl")
    res = TestClient(main.app).post("/compare", json={"board_ids": ["nope"]})
    assert res.status_code == 404
