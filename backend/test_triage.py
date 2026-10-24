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
    assert kwargs["model"] == "gpt-4o"
    image_part = kwargs["messages"][1]["content"][0]
    assert image_part["image_url"]["url"].startswith("data:image/png;base64,")


def test_triage_rejects_invalid_model_output(monkeypatch):
    bad = dict(VALID, defect_type="cracked")
    monkeypatch.setattr(main, "get_client", lambda: fake_client(json.dumps(bad)))

    res = TestClient(main.app).post(
        "/triage", files={"image": ("board.png", b"fakepng", "image/png")}
    )

    assert res.status_code == 502


def test_triage_rejects_non_image_upload(monkeypatch):
    monkeypatch.setattr(main, "get_client", lambda: fake_client("{}"))

    res = TestClient(main.app).post(
        "/triage", files={"image": ("notes.txt", b"hello", "text/plain")}
    )

    assert res.status_code == 400
