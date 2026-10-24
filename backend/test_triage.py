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


def test_triage_returns_classification(monkeypatch):
    client = fake_client(json.dumps(VALID))
    monkeypatch.setattr(main, "get_client", lambda: client)

    res = TestClient(main.app).post(
        "/triage", files={"image": ("board.png", b"fakepng", "image/png")}
    )

    assert res.status_code == 200
    assert res.json() == VALID
    kwargs = client.chat.completions.create.call_args.kwargs
    assert kwargs["model"] == "gpt-4o-mini"
    image_part = kwargs["messages"][1]["content"][0]
    assert image_part["image_url"]["url"].startswith("data:image/png;base64,")


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
