import json
from types import SimpleNamespace
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

import main

VALID = {
    "defect_type": "mousebite",
    "severity": "minor",
    "disposition": "rework",
    "confidence": 0.82,
    "reason": "Small notch visible on the trace.",
}


def fake_client(content: str) -> MagicMock:
    client = MagicMock()
    client.chat.completions.create.return_value = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=content))]
    )
    return client


def test_triage_returns_classification(monkeypatch, tmp_path):
    client = fake_client(json.dumps(VALID))
    monkeypatch.setattr(main, "get_client", lambda: client)
    monkeypatch.setattr(main, "RUNS_PATH", tmp_path / "runs.jsonl")

    res = TestClient(main.app).post(
        "/triage", files={"image": ("board.png", b"fakepng", "image/png")}
    )

    assert res.status_code == 200
    body = res.json()
    assert {key: body[key] for key in VALID} == VALID
    kwargs = client.chat.completions.create.call_args.kwargs
    assert kwargs["model"] == "gpt-4o-mini"
    image_part = kwargs["messages"][1]["content"][0]
    assert image_part["image_url"]["url"].startswith("data:image/png;base64,")


def test_triage_records_metrics_and_scores_against_ground_truth(monkeypatch, tmp_path):
    runs = tmp_path / "runs.jsonl"
    monkeypatch.setattr(main, "RUNS_PATH", runs)
    monkeypatch.setattr(main, "get_client", lambda: fake_client(json.dumps(VALID)))

    board = "mousebite-board"
    monkeypatch.setattr(
        main,
        "annotations_for",
        lambda _board_id: [
            {"x1": 0, "y1": 0, "x2": 1, "y2": 1, "code": 3, "type": "mousebite"}
        ],
    )
    res = TestClient(main.app).post(
        "/triage",
        files={"image": ("board.png", b"fakepng", "image/png")},
        data={"board_id": board, "lane": "baseline"},
    )

    body = res.json()
    assert body["ground_truth"] == {
        "defect_types": ["mousebite"],
        "disposition": "rework",
        "worst": "mousebite",
    }
    assert body["score"] == {"type_correct": True, "disposition_correct": True}
    assert body["metrics"]["latency_ms"] >= 0

    recorded = json.loads(runs.read_text().strip())
    assert recorded["board_id"] == board
    assert recorded["lane"] == "baseline"
    assert recorded["score"]["type_correct"] is True


def test_metrics_aggregates_per_lane(monkeypatch, tmp_path):
    runs = tmp_path / "runs.jsonl"
    monkeypatch.setattr(main, "RUNS_PATH", runs)
    rows = [
        {
            "lane": "baseline",
            "metrics": {"latency_ms": 100.0, "total_tokens": 10, "cost_usd": 0.001},
            "score": {"type_correct": True, "disposition_correct": False},
        },
        {
            "lane": "baseline",
            "metrics": {"latency_ms": 300.0, "total_tokens": 20, "cost_usd": 0.002},
            "score": {"type_correct": False, "disposition_correct": False},
        },
        {
            "lane": "adapted",
            "metrics": {"latency_ms": 200.0, "total_tokens": 30, "cost_usd": 0.003},
            "score": {"type_correct": True, "disposition_correct": True},
        },
    ]
    runs.write_text("\n".join(json.dumps(row) for row in rows))

    lanes = TestClient(main.app).get("/metrics").json()["lanes"]

    assert lanes["baseline"]["calls"] == 2
    assert lanes["baseline"]["type_accuracy"] == 0.5
    assert lanes["baseline"]["disposition_accuracy"] == 0.0
    assert lanes["baseline"]["avg_latency_ms"] == 200.0
    assert lanes["baseline"]["total_cost_usd"] == 0.003
    assert lanes["adapted"]["type_accuracy"] == 1.0


def test_triage_rejects_invalid_model_output(monkeypatch):
    bad = dict(VALID, defect_type="cracked")
    monkeypatch.setattr(main, "get_client", lambda: fake_client(json.dumps(bad)))

    res = TestClient(main.app).post(
        "/triage", files={"image": ("board.png", b"fakepng", "image/png")}
    )

    assert res.status_code == 502


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


def test_correction_writes_lesson_to_mubit(monkeypatch):
    memory = MagicMock()
    monkeypatch.setattr(main, "get_memory", lambda: memory)
    body = {
        "board_id": "00041000",
        "original": {"defect_type": "open"},
        "corrected": {"defect_type": "spur"},
        "reason": "trace stub, not a break",
    }
    res = TestClient(main.app).post("/corrections", json=body)
    assert res.status_code == 200
    kwargs = memory.remember.call_args.kwargs
    assert kwargs["lesson_type"] == "correction"
    assert "00041000" in kwargs["content"]


def test_correction_reports_mubit_failure(monkeypatch):
    memory = MagicMock()
    memory.remember.side_effect = RuntimeError("down")
    monkeypatch.setattr(main, "get_memory", lambda: memory)
    body = {"board_id": "x", "original": {}, "corrected": {}}
    res = TestClient(main.app).post("/corrections", json=body)
    assert res.status_code == 502


def test_triage_rejects_non_image_upload(monkeypatch):
    monkeypatch.setattr(main, "get_client", lambda: fake_client("{}"))

    res = TestClient(main.app).post(
        "/triage", files={"image": ("notes.txt", b"hello", "text/plain")}
    )

    assert res.status_code == 400
