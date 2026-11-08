"""Generate reference and deliberately-wrong prediction fixtures.

Every task needs a reference solution that passes its grader — proof the task
is solvable and the grader accepts a correct answer. For a classification eval
the reference is the expert label rendered as a prediction. The `null` fixture
(a model that always says "clean, ship it") is the deliberately-wrong control:
it must fail on every defective task.

    python eval/make_reference.py
"""

import json
import sys
from pathlib import Path

EVAL_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(EVAL_DIR / "src"))
from common import wide_task_files  # noqa: E402


def fixtures(tasks: list[dict]) -> tuple[list[dict], list[dict]]:
    reference, null = [], []
    for task in tasks:
        base = {
            "task_id": task["task_id"],
            "trial": 0,
            "suite": task["suite"],
            "board_id": task["board_id"],
            "ground_truth": task["ground_truth"],
            "latency_ms": 0.0,
            **({"variant": task["variant"]} if task.get("variant") else {}),
        }
        truth = task["ground_truth"]
        binary = task.get("variant") == "binary"
        reference.append(
            {
                **base,
                "model": "reference",
                **(
                    {"defective": truth["worst"] != "none"}
                    if binary
                    else {
                        "defect_type": truth["worst"],
                        "severity": "major" if truth["worst"] != "none" else "cosmetic",
                        "disposition": truth["disposition"],
                    }
                ),
                "confidence": 0.99,
                "reason": "reference solution: expert label",
                "raw": "reference",
            }
        )
        null.append(
            {
                **base,
                "model": "null-baseline",
                **(
                    {"defective": False}
                    if binary
                    else {
                        "defect_type": "none",
                        "severity": "cosmetic",
                        "disposition": "pass",
                    }
                ),
                "confidence": 0.9,
                "reason": "deliberately wrong control: always clean",
                "raw": "null",
            }
        )
    return reference, null


def load(path: Path) -> list[dict]:
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def write(out_dir: Path, suffix: str, reference: list[dict], null: list[dict]) -> None:
    for name, rows in (
        (f"reference_predictions{suffix}.jsonl", reference),
        (f"wrong_predictions{suffix}.jsonl", null),
    ):
        path = out_dir / name
        with path.open("w", encoding="utf-8") as handle:
            for row in rows:
                handle.write(json.dumps(row) + "\n")
        print(f"wrote {path} ({len(rows)} rows)")


def main() -> None:
    out_dir = EVAL_DIR / "reference"
    out_dir.mkdir(exist_ok=True)
    write(out_dir, "", *fixtures(load(EVAL_DIR / "tasks" / "tasks.jsonl")))
    wide = [t for p in wide_task_files(EVAL_DIR / "tasks") for t in load(p)]
    if wide:
        write(out_dir, "_wide", *fixtures(wide))


if __name__ == "__main__":
    main()
