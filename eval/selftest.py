"""Prove the grader accepts correct answers and rejects wrong ones.

Grades the reference fixture (must score perfectly) and the null fixture
(must fail every defective task) through the same grade() path used for real
model results. Writes eval/results/selftest.json and exits non-zero on failure.

    python eval/selftest.py
"""

import json
import sys
from pathlib import Path

EVAL_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(EVAL_DIR))
sys.path.insert(0, str(EVAL_DIR / "src"))
from grader import grade  # noqa: E402
from common import wide_task_files  # noqa: E402


def main() -> None:
    tasks = EVAL_DIR / "tasks" / "tasks.jsonl"
    ref = EVAL_DIR / "reference" / "reference_predictions.jsonl"
    wrong = EVAL_DIR / "reference" / "wrong_predictions.jsonl"

    wide_tasks = wide_task_files(EVAL_DIR / "tasks")
    wide_ref = EVAL_DIR / "reference" / "reference_predictions_wide.jsonl"
    wide_wrong = EVAL_DIR / "reference" / "wrong_predictions_wide.jsonl"

    report = grade(tasks, [ref, wrong])
    checks = []

    for suite in ("board", "crop"):
        ref_m = report["reference"][suite]
        checks.append(
            (
                f"reference/{suite} disposition_accuracy == 1.0",
                ref_m["disposition_accuracy"] == 1.0,
                ref_m["disposition_accuracy"],
            )
        )
        checks.append(
            (
                f"reference/{suite} type_accuracy == 1.0",
                ref_m["type_accuracy"] == 1.0,
                ref_m["type_accuracy"],
            )
        )
        checks.append(
            (
                f"reference/{suite} missed_defect_rate == 0.0",
                ref_m["missed_defect_rate"] == 0.0,
                ref_m["missed_defect_rate"],
            )
        )

    for suite in ("board", "crop"):
        null_m = report["null-baseline"][suite]
        # The null model passes only clean tasks; on defective tasks it must
        # miss everything.
        if null_m["missed_defect_rate"] is not None:
            checks.append(
                (
                    f"null/{suite} missed_defect_rate == 1.0",
                    null_m["missed_defect_rate"] == 1.0,
                    null_m["missed_defect_rate"],
                )
            )

    if wide_tasks:
        wide = grade(wide_tasks, [wide_ref, wide_wrong])
        report["wide"] = wide
        for suite in sorted(wide["reference"]):
            ref_m, null_m = wide["reference"][suite], wide["null-baseline"][suite]
            checks.append(
                (
                    f"reference/{suite} detection balanced_accuracy == 1.0",
                    ref_m["detection"]["balanced_accuracy"] == 1.0,
                    ref_m["detection"]["balanced_accuracy"],
                )
            )
            checks.append(
                (
                    f"null/{suite} detects nothing (TPR == 0.0, FPR == 0.0)",
                    (null_m["detection"]["tpr"], null_m["detection"]["fpr"])
                    == (0.0, 0.0),
                    (null_m["detection"]["tpr"], null_m["detection"]["fpr"]),
                )
            )
            if not suite.endswith("/binary"):
                checks.append(
                    (
                        f"reference/{suite} disposition_accuracy == 1.0",
                        ref_m["disposition_accuracy"] == 1.0,
                        ref_m["disposition_accuracy"],
                    )
                )

    out = EVAL_DIR / "results" / "selftest.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps({"checks": checks, "report": report}, indent=2) + "\n")

    failed = [c for c in checks if not c[1]]
    for name, ok, value in checks:
        print(f"{'PASS' if ok else 'FAIL'}  {name}  (got {value})")
    print(f"\nwrote {out}")
    if failed:
        sys.exit(f"{len(failed)} self-test check(s) failed")
    print("all grader self-tests passed")


if __name__ == "__main__":
    main()
