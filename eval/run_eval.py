"""Run the eval against any OpenAI-compatible chat-completions endpoint.

Works with OpenAI, Anthropic-via-gateway, OpenRouter, Together, vLLM, Neon AI
Gateway — anything that speaks POST /chat/completions with image_url content.

    export EVAL_API_KEY=...            # or OPENAI_API_KEY
    export OPENAI_BASE_URL=https://api.openai.com/v1   # optional
    python eval/run_eval.py --model gpt-4o --suite board --trials 3 \
        --out eval/results/predictions_gpt-4o_board.jsonl

Every (task, trial) produces one JSONL row: the parsed classification, the raw
response, token usage, latency, cost where a price is known, and the settings
used. Re-running with the same --out file skips (task_id, trial) pairs already
present, so a flaky or rate-limited run can be resumed.
"""

import argparse
import base64
import hashlib
import json
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from openai import APIConnectionError, APIStatusError, OpenAI

EVAL_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(EVAL_DIR / "src"))
from common import parse_classification  # noqa: E402

# USD per 1M tokens (input, output). Unknown models record tokens, cost = null.
PRICES = {
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4.1": (2.00, 8.00),
    "gpt-4.1-mini": (0.40, 1.60),
    "gpt-5": (1.25, 10.00),
    "gpt-5-mini": (0.25, 2.00),
    "o4-mini": (1.10, 4.40),
    "claude-sonnet-4": (3.00, 15.00),
    "claude-opus-4": (15.00, 75.00),
    "gemini-2.5-pro": (1.25, 10.00),
    "gemini-2.5-flash": (0.30, 2.50),
}


def cost_usd(model: str, usage: dict | None) -> float | None:
    if not usage:
        return None
    price = PRICES.get(model)
    if not price:
        return None
    pin, pout = price
    return round(
        usage.get("prompt_tokens", 0) / 1e6 * pin
        + usage.get("completion_tokens", 0) / 1e6 * pout,
        6,
    )


def data_url(image_path: Path) -> str:
    encoded = base64.b64encode(image_path.read_bytes()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


_pace_lock = threading.Lock()
_next_slot = 0.0


def pace(interval: float) -> None:
    """Space out request starts across worker threads (aggregators count
    attempts, so pacing must happen before the HTTP call, not after)."""
    global _next_slot
    if interval <= 0:
        return
    with _pace_lock:
        now = time.monotonic()
        slot = max(now, _next_slot)
        _next_slot = slot + interval
        wait = slot - now
    if wait > 0:
        time.sleep(wait)


def create_completion(
    client: OpenAI,
    model: str,
    task: dict,
    dataset: Path,
    interval: float,
    temperature: float | None,
):
    """One chat call with patient retries: aggregator gateways rate-limit hard
    (e.g. 5 req/min), and a 429 is a pacing signal, not a model failure."""
    messages = [
        {"role": "system", "content": task["prompt"]},
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {"url": data_url(dataset / task["image"])},
                }
            ],
        },
    ]
    kwargs = {}
    if temperature is not None:
        kwargs["temperature"] = temperature
    use_json_format = True
    for attempt in range(8):
        pace(interval)
        try:
            call_kwargs = dict(kwargs)
            if use_json_format:
                call_kwargs["response_format"] = {"type": "json_object"}
            return client.chat.completions.create(
                model=model,
                messages=messages,
                **call_kwargs,
            )
        except APIStatusError as exc:
            # Some gateways translate json_object into forced tool use, which
            # newer models reject; others demand the word "json" in the prompt.
            # Drop the format and rely on the tolerant parser instead.
            if (
                use_json_format
                and exc.status_code == 400
                and (
                    "structured output" in str(exc).lower()
                    or "json_object" in str(exc).lower()
                    or '"json"' in str(exc).lower()
                )
            ):
                use_json_format = False
                continue
            if exc.status_code == 429 or exc.status_code >= 500:
                time.sleep(min(70, 10 * (attempt + 1)))
                continue
            raise
        except APIConnectionError:
            time.sleep(min(30, 5 * (attempt + 1)))
    raise RuntimeError("retries exhausted")


def run_task(
    client: OpenAI,
    model: str,
    task: dict,
    dataset: Path,
    interval: float,
    trial: int,
    temperature: float | None,
) -> dict:
    row = {
        "task_id": task["task_id"],
        "trial": trial,
        "suite": task["suite"],
        "board_id": task["board_id"],
        "model": model,
        "settings": {
            "temperature": temperature,
            "prompt_sha256": hashlib.sha256(task["prompt"].encode()).hexdigest()[:12],
        },
        "ground_truth": task["ground_truth"],
    }
    started = time.perf_counter()
    try:
        response = create_completion(
            client, model, task, dataset, interval, temperature
        )
        row["latency_ms"] = round((time.perf_counter() - started) * 1000, 1)
        message = response.choices[0].message
        content = message.content
        if isinstance(content, list):
            # Gateways proxying Anthropic-style responses return content blocks.
            raw = "".join(
                part.get("text", "") if isinstance(part, dict) else str(part)
                for part in content
            )
        else:
            raw = content or ""
        row["raw"] = raw
        try:
            row.update(parse_classification(raw))
        except (ValueError, json.JSONDecodeError) as exc:
            row["error"] = f"unparseable output: {exc}"
        usage = getattr(response, "usage", None)
        if usage:
            row["usage"] = {
                "prompt_tokens": getattr(usage, "prompt_tokens", 0) or 0,
                "completion_tokens": getattr(usage, "completion_tokens", 0) or 0,
                "total_tokens": getattr(usage, "total_tokens", 0) or 0,
            }
            row["cost_usd"] = cost_usd(model, row["usage"])
    except Exception as exc:  # noqa: BLE001 — a failed call is a data point, not a crash
        row["latency_ms"] = round((time.perf_counter() - started) * 1000, 1)
        row["error"] = f"{type(exc).__name__}: {exc}"
    return row


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tasks", default=str(EVAL_DIR / "tasks" / "tasks.jsonl"))
    parser.add_argument("--suite", choices=["board", "crop", "all"], default="all")
    parser.add_argument("--model", required=True)
    parser.add_argument("--trials", type=int, default=1, help="attempts per task")
    parser.add_argument("--out", required=True)
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument(
        "--min-interval",
        type=float,
        default=0.0,
        help="minimum seconds between request starts (e.g. 12 for a 5 req/min gateway)",
    )
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument(
        "--temperature",
        type=float,
        default=None,
        help="sampling temperature; omit to use the endpoint default",
    )
    parser.add_argument("--base-url", default=os.environ.get("OPENAI_BASE_URL"))
    parser.add_argument(
        "--api-key",
        default=os.environ.get("EVAL_API_KEY") or os.environ.get("OPENAI_API_KEY"),
    )
    args = parser.parse_args()

    if not args.api_key:
        sys.exit("set EVAL_API_KEY or OPENAI_API_KEY")

    tasks_path = Path(args.tasks)
    dataset = tasks_path.parent
    tasks = [
        json.loads(line)
        for line in tasks_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    if args.suite != "all":
        tasks = [t for t in tasks if t["suite"] == args.suite]
    if args.limit:
        tasks = tasks[: args.limit]

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    done = set()
    if out_path.is_file():
        for line in out_path.read_text(encoding="utf-8").splitlines():
            try:
                row = json.loads(line)
                done.add((row["task_id"], row.get("trial", 0)))
            except (json.JSONDecodeError, KeyError):
                continue
    todo = [
        (task, trial)
        for task in tasks
        for trial in range(args.trials)
        if (task["task_id"], trial) not in done
    ]
    print(
        f"{len(tasks)} tasks x {args.trials} trials, {len(done)} done, running {len(todo)}"
    )
    if not todo:
        return

    # max_retries=0: retry policy lives in create_completion; SDK retries would
    # stack under it and burn rate-limit budget twice as fast.
    client = OpenAI(base_url=args.base_url, api_key=args.api_key, max_retries=0)
    with (
        out_path.open("a", encoding="utf-8") as handle,
        ThreadPoolExecutor(max_workers=args.concurrency) as pool,
    ):
        futures = {
            pool.submit(
                run_task,
                client,
                args.model,
                task,
                dataset,
                args.min_interval,
                trial,
                args.temperature,
            ): (task, trial)
            for task, trial in todo
        }
        for i, future in enumerate(as_completed(futures), 1):
            row = future.result()
            handle.write(json.dumps(row) + "\n")
            handle.flush()
            status = row.get("error") or row.get("disposition", "?")
            print(f"[{i}/{len(todo)}] {row['task_id']}#{row['trial']}: {status}")


if __name__ == "__main__":
    main()
