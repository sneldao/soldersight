"""Grade prediction files against the tasks' ground truth.

    python eval/grader.py \
        --tasks eval/tasks/tasks.jsonl \
        --predictions eval/results/predictions_gpt-4o_board.jsonl \
                     eval/results/predictions_gpt-4o_crop.jsonl \
        --report eval/results/report.md

Writes a JSON summary next to the report. Metrics per model x suite:

- disposition_accuracy / type_accuracy — exact-match against DeepPCB labels
- missed_defect_rate — defect tasks answered "none" (the dangerous failure)
- false_alarm_rate — clean tasks flagged as defective
- inconsistent_rate — defect_type and disposition disagree with the taxonomy
  (e.g. defect_type=short but disposition=pass): the model contradicting itself
- board_disposition_accuracy — crop predictions aggregated per board with the
  same worst-confident-region rule production uses
- self_contradictions — boards shipped ("pass") while a confident region noted
  a defect
- invalid_output_rate — responses that weren't the required JSON
- pass@k / pass^k — per-task success over multiple trials. A trial passes when
  the predicted disposition matches the expert label; errors count as fails.
"""

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

EVAL_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(EVAL_DIR / "src"))
from common import (  # noqa: E402
    DISPOSITION_BY_TYPE,
    MIN_VERDICT_CONFIDENCE,
    score,
    verdict_of,
)


def load_jsonl(path: Path) -> list[dict]:
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def rate(rows: list[dict], key: str) -> float | None:
    if not rows:
        return None
    return round(sum(1 for r in rows if r.get(key)) / len(rows), 3)


def suite_metrics(rows: list[dict]) -> dict:
    scored = [r for r in rows if "error" not in r and r.get("disposition")]
    defects = [r for r in scored if r["ground_truth"]["worst"] != "none"]
    clean = [r for r in scored if r["ground_truth"]["worst"] == "none"]
    invalid = [r for r in rows if "error" in r or not r.get("disposition")]

    missed = sum(1 for r in defects if r.get("defect_type") == "none")
    false_alarms = sum(1 for r in clean if r.get("defect_type") not in (None, "none"))

    def score_rows(group):
        out = []
        for r in group:
            s = score(r, r["ground_truth"])
            r["_type_correct"] = s["type_correct"]
            r["_disp_correct"] = s["disposition_correct"]
            out.append(r)
        return out

    scored = score_rows(scored)

    # Per-class recall: disposition accuracy grouped by the expert worst-type.
    # The suites are class-imbalanced, so the aggregate can hide a model that
    # only handles the majority class — this exposes it.
    recall_by_worst: dict[str, dict] = {}
    for worst in sorted({r["ground_truth"]["worst"] for r in scored}):
        group = [r for r in scored if r["ground_truth"]["worst"] == worst]
        recall_by_worst[worst] = {
            "n": len(group),
            "disposition_accuracy": rate(group, "_disp_correct"),
        }

    # Internal consistency: the taxonomy implies a disposition per defect type,
    # so defect_type=short + disposition=pass is the model contradicting itself.
    consistent = [
        r
        for r in scored
        if DISPOSITION_BY_TYPE.get(r.get("defect_type")) == r.get("disposition")
    ]
    inconsistent_rate = round(1 - len(consistent) / len(scored), 3) if scored else None

    # pass@k / pass^k over trials: a trial passes when the disposition matches
    # the expert label. Errors and unparseable output count as failures.
    by_task: dict[str, list[bool]] = defaultdict(list)
    for r in rows:
        passed = (
            "error" not in r
            and r.get("disposition") is not None
            and r.get("disposition") == r["ground_truth"]["disposition"]
        )
        by_task[r["task_id"]].append(passed)
    trial_counts = {len(v) for v in by_task.values()}
    k = max(trial_counts) if trial_counts else 0
    pass_at_k = (
        round(sum(1 for v in by_task.values() if any(v)) / len(by_task), 3)
        if by_task and k > 1
        else None
    )
    pass_hat_k = (
        round(sum(1 for v in by_task.values() if all(v)) / len(by_task), 3)
        if by_task and k > 1
        else None
    )

    return {
        "tasks": len(rows),
        "scored": len(scored),
        "invalid_output_rate": round(len(invalid) / len(rows), 3) if rows else None,
        "disposition_accuracy": rate(scored, "_disp_correct"),
        "type_accuracy": rate(scored, "_type_correct"),
        "inconsistent_rate": inconsistent_rate,
        "missed_defect_rate": round(missed / len(defects), 3) if defects else None,
        "false_alarm_rate": round(false_alarms / len(clean), 3) if clean else None,
        "recall_by_worst": recall_by_worst,
        "trials_per_task": k or None,
        "pass@k": pass_at_k,
        "pass^k": pass_hat_k,
        "avg_latency_ms": round(
            sum(r.get("latency_ms", 0) for r in rows) / len(rows), 1
        )
        if rows
        else None,
        "total_tokens": sum(r.get("usage", {}).get("total_tokens", 0) for r in rows),
        "total_cost_usd": round(sum(r.get("cost_usd") or 0 for r in rows), 4),
    }


def board_metrics(crop_rows: list[dict], board_truth: dict[str, dict]) -> dict:
    """Aggregate a model's crop predictions into per-board verdicts."""
    by_board: dict[str, list[dict]] = defaultdict(list)
    for r in crop_rows:
        by_board[r["board_id"]].append(r)

    hits = 0
    boards = 0
    contradictions = 0
    for board_id, rows in by_board.items():
        truth = board_truth.get(board_id)
        if truth is None:
            continue
        boards += 1
        verdict = verdict_of(rows)
        if verdict.get("disposition") == truth["disposition"]:
            hits += 1
        confident_defects = [
            r
            for r in rows
            if "error" not in r
            and r.get("defect_type") not in (None, "none")
            and (r.get("confidence") or 0) >= MIN_VERDICT_CONFIDENCE
        ]
        if verdict.get("disposition") == "pass" and confident_defects:
            contradictions += 1
    return {
        "boards": boards,
        "board_disposition_accuracy": round(hits / boards, 3) if boards else None,
        "self_contradictions": contradictions,
    }


def board_suite_contradictions(rows: list[dict]) -> int:
    """Single-call boards: 'pass' while naming a defect type is self-contradictory."""
    return sum(
        1
        for r in rows
        if "error" not in r
        and r.get("disposition") == "pass"
        and r.get("defect_type") not in (None, "none")
    )


def grade(tasks_path: Path, prediction_paths: list[Path]) -> dict:
    tasks = {t["task_id"]: t for t in load_jsonl(tasks_path)}
    # Clean-board tasks share a board_id with their defective twin; only the
    # defective entry may define the board's truth for crop aggregation.
    board_truth = {
        t["board_id"]: t["ground_truth"]
        for t in tasks.values()
        if t["suite"] == "board" and t["ground_truth"]["worst"] != "none"
    }

    # Join predictions to tasks for region metadata and to drop unknown ids.
    predictions = []
    for path in prediction_paths:
        for row in load_jsonl(path):
            task = tasks.get(row["task_id"])
            if task:
                row["region"] = task.get("region")
                predictions.append(row)

    by_model_suite: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for row in predictions:
        by_model_suite[(row.get("model", "?"), row.get("suite", "?"))].append(row)

    report = {}
    for (model, suite), rows in sorted(by_model_suite.items()):
        entry = suite_metrics(rows)
        if suite == "crop":
            entry.update(board_metrics(rows, board_truth))
        elif suite == "board":
            entry["self_contradictions"] = board_suite_contradictions(rows)
        report.setdefault(model, {})[suite] = entry
    return report


def fmt(value) -> str:
    return "—" if value is None else str(value)


def write_report(report: dict, out_md: Path) -> None:
    lines = [
        "# SolderSight PCB eval — results",
        "",
        "| model | suite | tasks | trials | disp. acc | pass@k | pass^k | type acc | missed | false alarm | inconsistent | board acc |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for model, suites in report.items():
        for suite, m in suites.items():
            lines.append(
                "| {model} | {suite} | {tasks} | {trials} | {da} | {pk} | {phk} | {ta} | {md} | {fa} | {ic} | {ba} |".format(
                    model=model,
                    suite=suite,
                    tasks=m["tasks"],
                    trials=m.get("trials_per_task") or "—",
                    da=fmt(m["disposition_accuracy"]),
                    pk=fmt(m.get("pass@k")),
                    phk=fmt(m.get("pass^k")),
                    ta=fmt(m["type_accuracy"]),
                    md=fmt(m["missed_defect_rate"]),
                    fa=fmt(m["false_alarm_rate"]),
                    ic=fmt(m.get("inconsistent_rate")),
                    ba=fmt(m.get("board_disposition_accuracy")),
                )
            )
    lines += [
        "",
        "`missed_defect_rate` is the headline number: the fraction of defective",
        "crops/boards the model called clean (`none`). In PCB QA a missed defect",
        "ships a dead board; a false alarm costs a re-inspection.",
        "",
    ]
    out_md.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tasks", default=str(EVAL_DIR / "tasks" / "tasks.jsonl"))
    parser.add_argument("--predictions", nargs="+", required=True)
    parser.add_argument("--report", default=str(EVAL_DIR / "results" / "report.md"))
    args = parser.parse_args()

    report = grade(Path(args.tasks), [Path(p) for p in args.predictions])
    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    write_report(report, report_path)
    json_path = report_path.with_suffix(".json")
    json_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    print(f"\nwrote {report_path} and {json_path}")


if __name__ == "__main__":
    main()
