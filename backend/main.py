import base64
import json
import os
import time
from pathlib import Path
from typing import Annotated

import mubit
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from openai import OpenAI
from pydantic import BaseModel

MUBIT_BASE_URL = "https://api.mubit.ai/openai/v1"
MODEL = "gpt-4o-mini"

INSTRUCTIONS = """You are a PCB quality inspector. Given a PCB image, classify it:
- defect_type: one of [open, short, mousebite, spur, copper, pinhole, none]
- severity: one of [cosmetic, minor, major, critical]
- disposition: one of [pass, rework, scrap]
- confidence: 0.0-1.0
- reason: one sentence

Reply as JSON only: {"defect_type":..., "severity":..., "disposition":..., "confidence":..., "reason":...}"""

DEFECT_TYPES = {"open", "short", "mousebite", "spur", "copper", "pinhole", "none"}
SEVERITIES = {"cosmetic", "minor", "major", "critical"}
DISPOSITIONS = {"pass", "rework", "scrap"}

app = FastAPI(title="SolderSight")

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "deeppcb"
RUNS_PATH = DATA_DIR / "runs.jsonl"

# gpt-4o-mini list price in USD per 1M tokens.
PRICE_PER_MTOKEN = {"input": 0.15, "output": 0.60}

# The disposition the taxonomy implies for each defect type. Boards are scored
# against this, so a wrong disposition shows up in the accuracy numbers.
DISPOSITION_BY_TYPE = {
    "open": "scrap",
    "short": "scrap",
    "mousebite": "rework",
    "spur": "rework",
    "copper": "rework",
    "pinhole": "rework",
    "none": "pass",
}

# Higher rank = worse, so a board with several defects is judged on its worst one.
SEVERITY_RANK = {
    "none": 0,
    "spur": 1,
    "pinhole": 1,
    "copper": 2,
    "mousebite": 2,
    "short": 3,
    "open": 3,
}


class Correction(BaseModel):
    board_id: str
    original: dict
    corrected: dict
    reason: str = ""


MUBIT_MEMORY_ENDPOINT = "https://api.mubit.ai"


def get_memory() -> mubit.Client:
    return mubit.Client(
        MUBIT_MEMORY_ENDPOINT, api_key=os.environ.get("MUBIT_API_KEY", "")
    )


def get_client() -> OpenAI:
    return OpenAI(base_url=MUBIT_BASE_URL, api_key=os.environ.get("MUBIT_API_KEY", ""))


def parse_classification(raw: str) -> dict:
    data = json.loads(raw)
    if data.get("defect_type") not in DEFECT_TYPES:
        raise ValueError(f"invalid defect_type: {data.get('defect_type')}")
    if data.get("severity") not in SEVERITIES:
        raise ValueError(f"invalid severity: {data.get('severity')}")
    if data.get("disposition") not in DISPOSITIONS:
        raise ValueError(f"invalid disposition: {data.get('disposition')}")
    return data


CODE_TO_TYPE = {
    1: "open",
    2: "short",
    3: "mousebite",
    4: "spur",
    5: "copper",
    6: "pinhole",
}


def parse_annotations(text: str) -> list[dict]:
    # DeepPCB annotation lines: "x1 y1 x2 y2 code" (commas or spaces accepted).
    out = []
    for line in text.splitlines():
        parts = line.replace(",", " ").split()
        if len(parts) != 5:
            continue
        x1, y1, x2, y2, code = (int(p) for p in parts)
        out.append(
            {
                "x1": x1,
                "y1": y1,
                "x2": x2,
                "y2": y2,
                "code": code,
                "type": CODE_TO_TYPE.get(code, "none"),
            }
        )
    return out


def board_ids() -> list[str]:
    images = DATA_DIR / "images"
    if not images.is_dir():
        return []
    return sorted({p.name.rsplit("_", 1)[0] for p in images.glob("*_test.jpg")})


def annotations_for(board_id: str) -> list[dict]:
    ann_path = DATA_DIR / "annotations" / f"{board_id}.txt"
    return parse_annotations(ann_path.read_text()) if ann_path.exists() else []


def ground_truth(annotations: list[dict]) -> dict:
    """The expected verdict for a board, from its DeepPCB annotations."""
    types = sorted(
        {a["type"] for a in annotations if a["type"] != "none"},
        key=lambda t: -SEVERITY_RANK.get(t, 0),
    )
    worst = types[0] if types else "none"
    return {
        "defect_types": types or ["none"],
        "disposition": DISPOSITION_BY_TYPE[worst],
        "worst": worst,
    }


def score(prediction: dict, truth: dict) -> dict:
    return {
        "type_correct": prediction["defect_type"] in truth["defect_types"],
        "disposition_correct": prediction["disposition"] == truth["disposition"],
    }


def cost_usd(usage: dict) -> float:
    return (
        usage.get("prompt_tokens", 0) / 1e6 * PRICE_PER_MTOKEN["input"]
        + usage.get("completion_tokens", 0) / 1e6 * PRICE_PER_MTOKEN["output"]
    )


def record_run(row: dict) -> None:
    RUNS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with RUNS_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row) + "\n")


def read_runs() -> list[dict]:
    if not RUNS_PATH.is_file():
        return []
    rows = []
    for line in RUNS_PATH.read_text(encoding="utf-8").splitlines():
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


def summarize(rows: list[dict]) -> dict:
    scored = [r for r in rows if r.get("score")]
    return {
        "calls": len(rows),
        "scored": len(scored),
        "type_accuracy": round(
            sum(1 for r in scored if r["score"]["type_correct"]) / len(scored), 3
        )
        if scored
        else None,
        "disposition_accuracy": round(
            sum(1 for r in scored if r["score"]["disposition_correct"]) / len(scored)
        )
        if scored
        else None,
        "avg_latency_ms": round(
            sum(r["metrics"]["latency_ms"] for r in rows) / len(rows), 1
        )
        if rows
        else None,
        "total_tokens": sum(r["metrics"]["total_tokens"] for r in rows),
        "total_cost_usd": round(sum(r["metrics"]["cost_usd"] for r in rows), 6),
        "avg_cost_usd": round(
            sum(r["metrics"]["cost_usd"] for r in rows) / len(rows), 6
        )
        if rows
        else None,
    }


@app.get("/boards")
def boards() -> list[dict]:
    result = []
    for board_id in board_ids():
        result.append(
            {
                "id": board_id,
                "templateUrl": f"/assets/{board_id}_temp.jpg",
                "testUrl": f"/assets/{board_id}_test.jpg",
                "annotations": annotations_for(board_id),
            }
        )
    return result


@app.get("/assets/{name}")
def asset(name: str) -> FileResponse:
    if "/" in name or "\\" in name or not name.endswith(".jpg"):
        raise HTTPException(status_code=404)
    path = DATA_DIR / "images" / name
    if not path.is_file():
        raise HTTPException(status_code=404)
    return FileResponse(path, media_type="image/jpeg")


@app.post("/corrections")
def correction(body: Correction) -> dict:
    # Stores the human's corrected label as a Mubit lesson so future triage recalls it.
    text = (
        f"Board {body.board_id}: model said {json.dumps(body.original)}; "
        f"inspector corrected to {json.dumps(body.corrected)}."
        + (f" Reason: {body.reason}" if body.reason else "")
    )
    try:
        get_memory().remember(
            content=text,
            session_id=f"correction-{body.board_id}",
            lesson_type="correction",
            share="global",
        )
    except Exception as exc:  # network or auth failure from Mubit
        raise HTTPException(status_code=502, detail=f"mubit write failed: {exc}")
    return {"stored": True}


@app.post("/triage")
async def triage(
    image: Annotated[UploadFile, File()],
    board_id: Annotated[str | None, Form()] = None,
    lane: Annotated[str, Form()] = "baseline",
) -> dict:
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="upload must be an image")
    encoded = base64.b64encode(await image.read()).decode("ascii")
    data_url = f"data:{image.content_type};base64,{encoded}"

    started = time.perf_counter()
    response = get_client().chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": INSTRUCTIONS},
            {
                "role": "user",
                "content": [{"type": "image_url", "image_url": {"url": data_url}}],
            },
        ],
        response_format={"type": "json_object"},
    )
    latency_ms = round((time.perf_counter() - started) * 1000, 1)
    raw = response.choices[0].message.content or ""
    try:
        classification = parse_classification(raw)
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=502, detail=f"model returned invalid output: {exc}"
        )

    usage = getattr(response, "usage", None)
    tokens = {
        "prompt_tokens": getattr(usage, "prompt_tokens", 0) or 0,
        "completion_tokens": getattr(usage, "completion_tokens", 0) or 0,
        "total_tokens": getattr(usage, "total_tokens", 0) or 0,
    }
    metrics = {
        "latency_ms": latency_ms,
        **tokens,
        "cost_usd": round(cost_usd(tokens), 6),
    }
    truth = ground_truth(annotations_for(board_id)) if board_id else None
    result = {**classification, "board_id": board_id, "lane": lane, "metrics": metrics}
    if truth:
        result["ground_truth"] = truth
        result["score"] = score(classification, truth)

    record_run({"ts": int(time.time()), "model": MODEL, **result})
    return result


@app.get("/metrics")
def metrics() -> dict:
    """Aggregate accuracy / cost / latency per model lane, from recorded runs."""
    by_lane: dict[str, list[dict]] = {}
    for row in read_runs():
        by_lane.setdefault(row.get("lane", "baseline"), []).append(row)
    return {"lanes": {lane: summarize(rows) for lane, rows in by_lane.items()}}
