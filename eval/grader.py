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
import random
import sys
from collections import Counter, defaultdict
from pathlib import Path

EVAL_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(EVAL_DIR / "src"))
from common import (  # noqa: E402
    DISPOSITION_BY_TYPE,
    MIN_VERDICT_CONFIDENCE,
    is_flagged,
    score,
    verdict_of,
    wide_task_files,
)

BOOTSTRAP_RESAMPLES = 1000


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


def _percentile_ci(values: list[float]) -> list[float] | None:
    if not values:
        return None
    values = sorted(values)
    lo = values[int(0.025 * (len(values) - 1))]
    hi = values[int(round(0.975 * (len(values) - 1)))]
    return [round(lo, 3), round(hi, 3)]


def accuracy_ci(rows: list[dict], key: str) -> list[float] | None:
    """95% CI for a per-row rate, bootstrapping whole boards (a board's rows are
    correlated: same image, repeated trials, clean twin)."""
    per_board: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for r in rows:
        per_board[r["board_id"]][0] += 1 if r.get(key) else 0
        per_board[r["board_id"]][1] += 1
    boards = sorted(per_board)
    if len(boards) < 2:
        return None
    rng = random.Random(0)
    draws = []
    for _ in range(BOOTSTRAP_RESAMPLES):
        hit = n = 0
        for b in (rng.choice(boards) for _ in boards):
            hit += per_board[b][0]
            n += per_board[b][1]
        draws.append(hit / n)
    return _percentile_ci(draws)


def detection_metrics(rows: list[dict]) -> dict:
    """Can the model tell a defective input from a clean one at all?

    Independent of defect naming and of the disposition rule: an answer counts
    as 'flagged' when the model reports any defect. Youden's J = TPR - FPR is 0
    for a model that flags at random and for one that always (or never) flags,
    whatever its base rate, so unlike accuracy it needs no class-balance caveat.
    """
    per_board: dict[str, list[int]] = defaultdict(lambda: [0, 0, 0, 0])
    for r in rows:
        flagged = is_flagged(r)
        if flagged is None:
            continue
        cell = per_board[r["board_id"]]
        if r["ground_truth"]["worst"] != "none":
            cell[0] += int(flagged)
            cell[1] += 1
        else:
            cell[2] += int(flagged)
            cell[3] += 1

    def stats(cells):
        tp = sum(c[0] for c in cells)
        pos = sum(c[1] for c in cells)
        fp = sum(c[2] for c in cells)
        neg = sum(c[3] for c in cells)
        if not pos or not neg:
            return None
        tpr, fpr = tp / pos, fp / neg
        return tpr, fpr, tpr - fpr, (tpr + 1 - fpr) / 2, pos, neg

    point = stats(list(per_board.values()))
    if point is None:
        return {}
    boards = sorted(per_board)
    rng = random.Random(0)
    js, bas = [], []
    for _ in range(BOOTSTRAP_RESAMPLES):
        drawn = stats([per_board[rng.choice(boards)] for _ in boards])
        if drawn:
            js.append(drawn[2])
            bas.append(drawn[3])
    tpr, fpr, j, ba, pos, neg = point
    return {
        "n_defective": pos,
        "n_clean": neg,
        "tpr": round(tpr, 3),
        "fpr": round(fpr, 3),
        "youden_j": round(j, 3),
        "youden_j_ci95": _percentile_ci(js),
        "balanced_accuracy": round(ba, 3),
        "balanced_accuracy_ci95": _percentile_ci(bas),
    }


def binary_metrics(rows: list[dict]) -> dict:
    usable = [r for r in rows if is_flagged(r) is not None]
    out = {
        "tasks": len(rows),
        "scored": len(usable),
        "invalid_output_rate": round(1 - len(usable) / len(rows), 3) if rows else None,
        "detection": detection_metrics(rows),
    }
    det = out["detection"]
    if det:
        out["missed_defect_rate"] = round(1 - det["tpr"], 3)
        out["false_alarm_rate"] = det["fpr"]
    return out


def constant_baselines(tasks: dict[str, dict]) -> dict:
    """Accuracy of answering one fixed disposition for every task in a suite."""
    groups: dict[str, Counter] = defaultdict(Counter)
    for t in tasks.values():
        label = t["suite"] + (
            f"/{t['variant']}" if t.get("variant", "production") != "production" else ""
        )
        groups[label][t["ground_truth"]["disposition"]] += 1
    out = {}
    for label, counts in sorted(groups.items()):
        n = sum(counts.values())
        out[label] = {
            "tasks": n,
            **{
                f"always_{d}": round(counts.get(d, 0) / n, 3)
                for d in ("pass", "rework", "scrap")
            },
        }
    return out


def suite_label(row: dict) -> str:
    variant = row.get("variant")
    if variant and variant != "production":
        return f"{row.get('suite', '?')}/{variant}"
    return row.get("suite", "?")


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

    # Disposition accuracy by the expert disposition (scrap / rework / pass).
    recall_by_disposition = {}
    for disposition in ("scrap", "rework", "pass"):
        group = [r for r in scored if r["ground_truth"]["disposition"] == disposition]
        if group:
            recall_by_disposition[disposition] = {
                "n": len(group),
                "accuracy": rate(group, "_disp_correct"),
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

    # Among defective inputs where the model named a defect that really is
    # annotated, how often is the disposition still wrong? Those are cases where
    # the model saw something real but not the worst thing: the board verdict
    # depends on the unstated "report the worst defect" rule, not on perception.
    named_real = [
        r for r in defects if r.get("defect_type") in r["ground_truth"]["defect_types"]
    ]
    worst_rule_gap = (
        {
            "n": len(named_real),
            "disposition_wrong_rate": round(
                sum(1 for r in named_real if not r["_disp_correct"]) / len(named_real),
                3,
            ),
        }
        if named_real
        else None
    )

    return {
        "tasks": len(rows),
        "scored": len(scored),
        "invalid_output_rate": round(len(invalid) / len(rows), 3) if rows else None,
        "disposition_accuracy": rate(scored, "_disp_correct"),
        "disposition_accuracy_ci95": accuracy_ci(scored, "_disp_correct"),
        "detection": detection_metrics(rows),
        "named_real_type_wrong_disposition": worst_rule_gap,
        "type_accuracy": rate(scored, "_type_correct"),
        "inconsistent_rate": inconsistent_rate,
        "missed_defect_rate": round(missed / len(defects), 3) if defects else None,
        "false_alarm_rate": round(false_alarms / len(clean), 3) if clean else None,
        "recall_by_worst": recall_by_worst,
        "recall_by_disposition": recall_by_disposition,
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


def grade(tasks_path: Path | list[Path], prediction_paths: list[Path]) -> dict:
    paths = tasks_path if isinstance(tasks_path, list) else [tasks_path]
    tasks = {t["task_id"]: t for p in paths for t in load_jsonl(p)}
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
        by_model_suite[(row.get("model", "?"), suite_label(row))].append(row)

    report = {}
    for (model, suite), rows in sorted(by_model_suite.items()):
        if suite.endswith("/binary"):
            entry = binary_metrics(rows)
        else:
            entry = suite_metrics(rows)
            if suite == "crop":
                entry.update(board_metrics(rows, board_truth))
            else:
                entry["self_contradictions"] = board_suite_contradictions(rows)
        report.setdefault(model, {})[suite] = entry
    report["_constant_answer_accuracy"] = constant_baselines(tasks)
    return report


def fmt(value) -> str:
    return "—" if value is None else str(value)


def fmt_ci(value, ci) -> str:
    if value is None:
        return "—"
    return f"{value} [{ci[0]}, {ci[1]}]" if ci else str(value)


def write_report(report: dict, out_md: Path) -> None:
    models = {m: s for m, s in report.items() if not m.startswith("_")}
    lines = [
        "# SolderSight PCB eval — results",
        "",
        "| model | suite | tasks | trials | disp. acc [95% CI] | pass@k | pass^k | type acc | missed | false alarm | inconsistent | board acc |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for model, suites in models.items():
        for suite, m in suites.items():
            lines.append(
                "| {model} | {suite} | {tasks} | {trials} | {da} | {pk} | {phk} | {ta} | {md} | {fa} | {ic} | {ba} |".format(
                    model=model,
                    suite=suite,
                    tasks=m["tasks"],
                    trials=m.get("trials_per_task") or "—",
                    da=fmt_ci(
                        m.get("disposition_accuracy"),
                        m.get("disposition_accuracy_ci95"),
                    ),
                    pk=fmt(m.get("pass@k")),
                    phk=fmt(m.get("pass^k")),
                    ta=fmt(m.get("type_accuracy")),
                    md=fmt(m.get("missed_defect_rate")),
                    fa=fmt(m.get("false_alarm_rate")),
                    ic=fmt(m.get("inconsistent_rate")),
                    ba=fmt(m.get("board_disposition_accuracy")),
                )
            )
    lines += [
        "",
        "`missed_defect_rate` is the number QA cares about most: the fraction of",
        "defective crops/boards the model called clean (`none`). A false alarm costs",
        "a re-inspection.",
        "",
        "## Can the model tell defective from clean?",
        "",
        "Youden's J = TPR - FPR (0 = no discrimination, whatever the model's",
        "tendency to flag). Independent of defect naming and of the disposition",
        "rule. CIs resample whole boards.",
        "",
        "| model | suite | TPR | FPR | Youden J [95% CI] | balanced acc [95% CI] |",
        "|---|---|---|---|---|---|",
    ]
    for model, suites in models.items():
        for suite, m in suites.items():
            d = m.get("detection") or {}
            if not d:
                continue
            lines.append(
                f"| {model} | {suite} | {d['tpr']} | {d['fpr']} | "
                f"{fmt_ci(d['youden_j'], d['youden_j_ci95'])} | "
                f"{fmt_ci(d['balanced_accuracy'], d['balanced_accuracy_ci95'])} |"
            )
    variants = sorted(
        {
            s.split("/", 1)[1]
            for ss in models.values()
            for s in ss
            if s.startswith("wide/")
        }
        | ({"production"} if any("wide" in ss for ss in models.values()) else set())
    )
    if variants:
        order = [
            v
            for v in ("production", "worst", "prior", "binary", "paired")
            if v in variants
        ]
        lines += [
            "",
            "## Wide suite: does the failure survive a fairer prompt?",
            "",
            "Youden J (TPR - FPR) per prompt variant; same 92 defective + 92 clean boards",
            "every time. production = the shipped prompt; worst = states the",
            "report-the-worst-defect rule; prior = worst + a base-rate statement;",
            "binary = defective yes/no only; paired = worst + golden reference image.",
            "",
            "| model | " + " | ".join(order) + " |",
            "|---|" + "---|" * len(order),
        ]
        for model, suites in models.items():
            cells = []
            for v in order:
                m = suites.get("wide" if v == "production" else f"wide/{v}")
                d = (m or {}).get("detection") or {}
                cells.append(f"{d['youden_j']} (FPR {d['fpr']})" if d else "—")
            lines.append(f"| {model} | " + " | ".join(cells) + " |")
    lines += ["", "## Constant-answer accuracy (the floor)", ""]
    lines += [
        "| suite | tasks | always pass | always rework | always scrap |",
        "|---|---|---|---|---|",
    ]
    for suite, b in report.get("_constant_answer_accuracy", {}).items():
        lines.append(
            f"| {suite} | {b['tasks']} | {b['always_pass']} | {b['always_rework']} | {b['always_scrap']} |"
        )
    lines.append("")
    out_md.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--tasks",
        nargs="+",
        default=[
            str(p)
            for p in [EVAL_DIR / "tasks" / "tasks.jsonl"]
            + wide_task_files(EVAL_DIR / "tasks")
            if p.is_file()
        ],
    )
    parser.add_argument("--predictions", nargs="+", required=True)
    parser.add_argument("--report", default=str(EVAL_DIR / "results" / "report.md"))
    args = parser.parse_args()

    report = grade([Path(t) for t in args.tasks], [Path(p) for p in args.predictions])
    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    write_report(report, report_path)
    json_path = report_path.with_suffix(".json")
    json_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    print(f"\nwrote {report_path} and {json_path}")


if __name__ == "__main__":
    main()
