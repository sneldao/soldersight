import base64
import json
import os
import time
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from openai import OpenAI
from pydantic import BaseModel

import sapling
from inspection import Region, changed_regions, crop, grid_regions

MUBIT_BASE_URL = "https://api.mubit.ai/openai/v1"
MODEL = "gpt-4o-mini"

BASE_DEFECT_TYPES = ["open", "short", "mousebite", "spur", "copper", "pinhole", "none"]
SEVERITIES = {"cosmetic", "minor", "major", "critical"}
DISPOSITIONS = {"pass", "rework", "scrap"}

INSTRUCTIONS_TEMPLATE = """You are a PCB quality inspector. Look at this close-up of a board and classify it:
- defect_type: one of [{types}]
- severity: one of [cosmetic, minor, major, critical]
- disposition: one of [pass, rework, scrap]
- confidence: 0.0-1.0
- reason: one sentence
{rules}
Reply as JSON only: {{"defect_type":..., "severity":..., "disposition":..., "confidence":..., "reason":...}}"""

app = FastAPI(title="SolderSight")

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "deeppcb"
RUNS_PATH = DATA_DIR / "runs.jsonl"
CORRECTIONS_PATH = DATA_DIR / "corrections.jsonl"

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

DISPOSITION_RANK = {"pass": 0, "rework": 1, "scrap": 2}


class Correction(BaseModel):
    board_id: str
    original: dict
    corrected: dict
    reason: str = ""


class Comparison(BaseModel):
    board_ids: list[str]
    lanes: list[str] = ["baseline", "adapted"]


class Verify(BaseModel):
    """Verify the vision model's proposed disposition against evidence + policy.

    evidence_types is what inspection *found* (defaults to the board's AOI labels);
    disposition is what the vision model *claimed*. Sapling checks one against the
    other under the acceptance policy.
    """

    disposition: str
    evidence_types: list[str] | None = None
    confidence: float | None = None
    policy: str | None = None


def get_client() -> OpenAI:
    return OpenAI(base_url=MUBIT_BASE_URL, api_key=os.environ.get("MUBIT_API_KEY", ""))


def read_corrections() -> list[dict]:
    if not CORRECTIONS_PATH.is_file():
        return []
    out = []
    for line in CORRECTIONS_PATH.read_text(encoding="utf-8").splitlines():
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out


def allowed_types() -> list[str]:
    """A correction can name a defect the taxonomy didn't carry, e.g. tombstoning."""
    types = list(BASE_DEFECT_TYPES)
    for row in read_corrections():
        added = row.get("corrected", {}).get("defect_type")
        if added and added not in types:
            types.append(added)
    return types


def learned_rules() -> list[str]:
    """One rule line per distinct correction; the inspector's latest wording wins."""
    rules: dict[tuple, str] = {}
    for row in read_corrections():
        before, after = row.get("original", {}), row.get("corrected", {})
        if not after.get("defect_type"):
            continue
        key = (
            before.get("defect_type"),
            after["defect_type"],
            after.get("disposition"),
        )
        line = (
            f"What reads as {key[0] or 'a defect'} is really {after['defect_type']}, "
            f"{after.get('severity', 'minor')}, disposition {after.get('disposition')}"
        )
        if row.get("reason"):
            line += f": {row['reason']}"
        rules[key] = line
    return list(rules.values())


def instructions_for(lane: str) -> str:
    """Mubit forms a task from matching model + instructions + output format, so the
    adapted lane is its own task: the corrected rules travel inside its instructions."""
    rules = learned_rules() if lane == "adapted" else []
    block = (
        "\nRules this line's inspectors taught, taking precedence over the taxonomy:\n"
        + "\n".join(f"- {rule}" for rule in rules)
        if rules
        else ""
    )
    return INSTRUCTIONS_TEMPLATE.format(types=", ".join(allowed_types()), rules=block)


def parse_classification(raw: str) -> dict:
    data = json.loads(raw)
    if data.get("defect_type") not in allowed_types():
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
        "disposition": DISPOSITION_BY_TYPE.get(worst, "rework"),
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
    """Per-lane numbers. Defect crops are scored separately from clean ones: a model
    that answers "none" on an untouched crop is not being clever, and a QA floor cares
    about missed defects far more than false alarms."""
    scored = [r for r in rows if r.get("score")]
    defects = [r for r in scored if r["ground_truth"]["worst"] != "none"]
    clean = [r for r in scored if r["ground_truth"]["worst"] == "none"]

    def rate(group, key):
        if not group:
            return None
        return round(sum(1 for r in group if r["score"][key]) / len(group), 3)

    boards = {}
    for row in rows:
        if row.get("board_id"):
            boards.setdefault(row["board_id"], []).append(row)
    board_hits = 0
    for board_id, board_rows in boards.items():
        truth = ground_truth(annotations_for(board_id))
        if verdict_of(board_rows)["disposition"] == truth["disposition"]:
            board_hits += 1

    return {
        "calls": len(rows),
        "boards": len(boards),
        "scored": len(scored),
        "defect_regions": len(defects),
        "type_accuracy": rate(defects, "type_correct"),
        "disposition_accuracy": rate(defects, "disposition_correct"),
        "missed_defect_rate": (
            round(
                sum(1 for r in defects if r["defect_type"] == "none") / len(defects), 3
            )
            if defects
            else None
        ),
        "false_alarm_rate": (
            round(sum(1 for r in clean if r["defect_type"] != "none") / len(clean), 3)
            if clean
            else None
        ),
        "board_disposition_accuracy": round(board_hits / len(boards), 3)
        if boards
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
    """An inspector's corrected label.

    The rules are folded into the instructions the adapted lane sends: Mubit forms one
    task per matching model + instructions + output format, so corrected rules make a
    task of their own rather than editing the provider's answers.
    """
    row = {"ts": int(time.time()), **body.model_dump()}
    CORRECTIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CORRECTIONS_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row) + "\n")
    return {
        "stored": True,
        "rules": learned_rules(),
        "defect_types": allowed_types(),
        "adapted_instructions": instructions_for("adapted"),
    }


def classify_image(data: bytes, lane: str) -> tuple[dict, dict]:
    """One Mubit call over a crop. Returns the verdict and what the call cost."""
    encoded = base64.b64encode(data).decode("ascii")
    data_url = f"data:image/jpeg;base64,{encoded}"

    started = time.perf_counter()
    raw = get_client().chat.completions.with_raw_response.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": instructions_for(lane)},
            {
                "role": "user",
                "content": [{"type": "image_url", "image_url": {"url": data_url}}],
            },
        ],
        response_format={"type": "json_object"},
    )
    latency_ms = round((time.perf_counter() - started) * 1000, 1)
    request_id = raw.headers.get("x-middleware-request-id")
    response = raw.parse()

    try:
        classification = parse_classification(response.choices[0].message.content or "")
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
        "mubit_request_id": str(request_id) if request_id else None,
    }
    return classification, metrics


def overlaps(annotation: dict, region: Region) -> bool:
    return not (
        annotation["x2"] < region.x1
        or annotation["x1"] > region.x2
        or annotation["y2"] < region.y1
        or annotation["y1"] > region.y2
    )


def region_truth(annotations: list[dict], region: Region) -> dict:
    """What the DeepPCB labels say is inside this crop."""
    return ground_truth([a for a in annotations if overlaps(a, region)])


def verdict_of(results: list[dict]) -> dict:
    """The board inherits its disposition from its worst region."""
    return max(
        results,
        key=lambda r: DISPOSITION_RANK.get(r["disposition"], 0),
    )


def inspect_regions(
    image: bytes,
    regions: list[Region],
    annotations: list[dict] | None,
    lane: str,
    board_id: str | None,
) -> dict:
    results = []
    for region in regions:
        classification, metrics = classify_image(crop(image, region), lane)
        row = {**classification, "region": vars(region), "metrics": metrics}
        if annotations is not None:
            truth = region_truth(annotations, region)
            row["ground_truth"] = truth
            row["score"] = score(classification, truth)
        results.append(row)
        record_run(
            {
                "ts": int(time.time()),
                "model": MODEL,
                "board_id": board_id,
                "lane": lane,
                **row,
            }
        )

    verdict = verdict_of(results)
    return {
        "board_id": board_id,
        "lane": lane,
        **{
            k: v
            for k, v in verdict.items()
            if k not in ("region", "metrics", "score", "ground_truth")
        },
        "regions": results,
        "metrics": {
            "calls": len(results),
            "latency_ms": round(sum(r["metrics"]["latency_ms"] for r in results), 1),
            "total_tokens": sum(r["metrics"]["total_tokens"] for r in results),
            "cost_usd": round(sum(r["metrics"]["cost_usd"] for r in results), 6),
            "mubit_request_ids": [r["metrics"]["mubit_request_id"] for r in results],
        },
    }


@app.post("/triage")
async def triage(
    image: Annotated[UploadFile, File()],
    lane: Annotated[str, Form()] = "baseline",
) -> dict:
    """A photo with no template to diff against: inspect it as quadrants."""
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="upload must be an image")
    data = await image.read()
    return inspect_regions(data, grid_regions(data, grid=2), None, lane, None)


@app.post("/triage/board/{board_id}")
def triage_board(
    board_id: str,
    lane: Annotated[str, Form()] = "baseline",
) -> dict:
    """Inspect the cells that differ from the board's known-good template."""
    images = DATA_DIR / "images"
    test_path = images / f"{board_id}_test.jpg"
    template_path = images / f"{board_id}_temp.jpg"
    if not test_path.is_file():
        raise HTTPException(status_code=404, detail="unknown board")
    test = test_path.read_bytes()
    template = template_path.read_bytes()
    regions = changed_regions(template, test) or grid_regions(test, grid=1)
    return inspect_regions(test, regions, annotations_for(board_id), lane, board_id)


@app.get("/metrics")
def metrics() -> dict:
    """Aggregate accuracy / cost / latency per model lane, from recorded runs."""
    by_lane: dict[str, list[dict]] = {}
    for row in read_runs():
        by_lane.setdefault(row.get("lane", "baseline"), []).append(row)
    return {"lanes": {lane: summarize(rows) for lane, rows in by_lane.items()}}


@app.get("/rules")
def rules() -> dict:
    """What the inspector has taught so far, and the two task prompts that result."""
    return {
        "corrections": read_corrections(),
        "rules": learned_rules(),
        "defect_types": allowed_types(),
        "lanes": {
            "baseline": instructions_for("baseline"),
            "adapted": instructions_for("adapted"),
        },
    }


def lane_rows(payload: dict) -> list[dict]:
    return [
        {**region, "board_id": payload["board_id"], "lane": payload["lane"]}
        for region in payload["regions"]
    ]


@app.post("/compare")
def compare(body: Comparison) -> dict:
    """The same crops down two lanes: the provider's task, and the corrected one."""
    boards = []
    per_lane: dict[str, list[dict]] = {lane: [] for lane in body.lanes}
    for board_id in body.board_ids:
        test_path = DATA_DIR / "images" / f"{board_id}_test.jpg"
        template_path = DATA_DIR / "images" / f"{board_id}_temp.jpg"
        if not test_path.is_file():
            raise HTTPException(status_code=404, detail=f"unknown board {board_id}")
        test, template = test_path.read_bytes(), template_path.read_bytes()
        regions = changed_regions(template, test) or grid_regions(test, grid=1)
        annotations = annotations_for(board_id)
        truth = ground_truth(annotations)
        verdicts = {}
        for lane in body.lanes:
            payload = inspect_regions(test, regions, annotations, lane, board_id)
            per_lane[lane].extend(lane_rows(payload))
            verdicts[lane] = {
                "defect_type": payload["defect_type"],
                "disposition": payload["disposition"],
                "cost_usd": payload["metrics"]["cost_usd"],
                "latency_ms": payload["metrics"]["latency_ms"],
                "correct": payload["disposition"] == truth["disposition"],
            }
        boards.append({"id": board_id, "ground_truth": truth, "verdicts": verdicts})

    return {
        "boards": boards,
        "lanes": {lane: summarize(rows) for lane, rows in per_lane.items()},
    }


def verify_bundle(policy: str, evidence: str, claim: str) -> dict:
    """Run Banyan Sapling and attach the line decision it implies."""
    response = sapling.verify(policy, evidence, claim)
    return {
        "policy": policy,
        "evidence": evidence,
        "claim": claim,
        "sapling": response,
        "gate": sapling.gate_decision(response),
    }


@app.post("/verify/board/{board_id}")
def verify_board(board_id: str, body: Verify) -> dict:
    """The policy gate: is the vision model's disposition claim actually allowed?

    Evidence is what inspection found (the board's AOI labels unless the caller
    overrides); the claim is the disposition the vision model proposed. Sapling
    decides whether that claim is supported, violates policy, or needs a human —
    the step that catches a cheap model confidently clearing a defective board.
    """
    if not (DATA_DIR / "images" / f"{board_id}_test.jpg").is_file():
        raise HTTPException(status_code=404, detail="unknown board")

    truth = ground_truth(annotations_for(board_id))
    evidence_types = body.evidence_types
    if evidence_types is None:
        evidence_types = truth["defect_types"]

    policy = body.policy or sapling.default_policy()
    evidence = sapling.build_evidence(evidence_types, body.confidence)
    claim = sapling.build_claim(body.disposition)

    bundle = verify_bundle(policy, evidence, claim)
    # So the demo can show "vision said pass, gate caught it" against the truth.
    bundle["board_id"] = board_id
    bundle["claimed_disposition"] = body.disposition
    bundle["ground_truth"] = truth
    return bundle
