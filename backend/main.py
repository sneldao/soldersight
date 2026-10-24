import base64
import json
import os
from typing import Annotated

from fastapi import FastAPI, File, HTTPException, UploadFile
from openai import OpenAI

MUBIT_BASE_URL = "https://api.mubit.ai/openai/v1"
MODEL = "gpt-4o"

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
