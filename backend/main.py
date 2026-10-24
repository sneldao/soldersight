import base64
import json
import os
from pathlib import Path
from typing import Annotated

import mubit
from fastapi import FastAPI, File, HTTPException, UploadFile
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


@app.get("/boards")
def boards() -> list[dict]:
    result = []
    for board_id in board_ids():
        ann_path = DATA_DIR / "annotations" / f"{board_id}.txt"
        annotations = (
            parse_annotations(ann_path.read_text()) if ann_path.exists() else []
        )
        result.append(
            {
                "id": board_id,
                "templateUrl": f"/assets/{board_id}_temp.jpg",
                "testUrl": f"/assets/{board_id}_test.jpg",
                "annotations": annotations,
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
async def triage(image: Annotated[UploadFile, File()]) -> dict:
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="upload must be an image")
    encoded = base64.b64encode(await image.read()).decode("ascii")
    data_url = f"data:{image.content_type};base64,{encoded}"

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
    raw = response.choices[0].message.content or ""
    try:
        return parse_classification(raw)
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=502, detail=f"model returned invalid output: {exc}"
        )
