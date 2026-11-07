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


def main() -> None:
    tasks_path = EVAL_DIR / "tasks" / "tasks.jsonl"
    tasks = [
        json.loads(line)
        for line in tasks_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    out_dir = EVAL_DIR / "reference"
    out_dir.mkdir(exist_ok=True)

    reference, null = [], []
    for task in tasks:
        base = {
            "task_id": task["task_id"],
            "trial": 0,
            "suite": task["suite"],
            "board_id": task["board_id"],
            "ground_truth": task["ground_truth"],
            "latency_ms": 0.0,
        }
        truth = task["ground_truth"]
        reference.append(
            {
                **base,
                "model": "reference",
                "defect_type": truth["worst"],
                "severity": "major" if truth["worst"] != "none" else "cosmetic",
                "disposition": truth["disposition"],
                "confidence": 0.99,
                "reason": "reference solution: expert label",
                "raw": "reference",
            }
        )
        null.append(
            {
                **base,
                "model": "null-baseline",
                "defect_type": "none",
                "severity": "cosmetic",
                "disposition": "pass",
                "confidence": 0.9,
                "reason": "deliberately wrong control: always clean",
                "raw": "null",
            }
        )

    for name, rows in (
        ("reference_predictions.jsonl", reference),
        ("wrong_predictions.jsonl", null),
    ):
        path = out_dir / name
        with path.open("w", encoding="utf-8") as handle:
            for row in rows:
                handle.write(json.dumps(row) + "\n")
        print(f"wrote {path} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
