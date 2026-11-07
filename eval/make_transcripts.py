"""Extract representative transcripts from prediction files.

The guide asks for representative transcripts — including at least one failure
per reported model — so judges can see exactly what went wrong. Each prediction
row already stores the raw model response; this script pulls a few interesting
cases per model x suite into transcripts/*.md:

- missed defects (defective input answered "none")
- false alarms (clean input flagged defective)
- internal contradictions (defect_type and disposition disagree)
- one correct answer for contrast

    python eval/make_transcripts.py eval/results/predictions_*.jsonl
"""

import json
import sys
from pathlib import Path

EVAL_DIR = Path(__file__).resolve().parent


def load_jsonl(path: Path) -> list[dict]:
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def interesting(row: dict) -> str | None:
    if "error" in row:
        return None
    gt = row["ground_truth"]
    defect = gt["worst"] != "none"
    pred_defect = row.get("defect_type") not in (None, "none")
    if defect and not pred_defect:
        return "MISSED DEFECT"
    if not defect and pred_defect:
        return "FALSE ALARM"
    implied = {
        "open": "scrap",
        "short": "scrap",
        "mousebite": "rework",
        "spur": "rework",
        "copper": "rework",
        "pinhole": "rework",
        "none": "pass",
    }
    if implied.get(row.get("defect_type")) not in (None, row.get("disposition")):
        return "INCONSISTENT"
    return None


def main() -> None:
    out_dir = EVAL_DIR / "transcripts"
    out_dir.mkdir(exist_ok=True)

    groups: dict[tuple[str, str], list[dict]] = {}
    for arg in sys.argv[1:]:
        for row in load_jsonl(Path(arg)):
            groups.setdefault(
                (row.get("model", "?"), row.get("suite", "?")), []
            ).append(row)

    for (model, suite), rows in sorted(groups.items()):
        by_kind: dict[str, list[dict]] = {}
        for row in rows:
            kind = interesting(row) or "CORRECT"
            by_kind.setdefault(kind, []).append(row)

        safe = f"{model.replace('/', '_')}_{suite}"
        lines = [
            f"# Transcripts — {model} / {suite}",
            "",
            f"{len(rows)} trials across {len({r['task_id'] for r in rows})} tasks.",
            "",
        ]
        for kind in ("MISSED DEFECT", "FALSE ALARM", "INCONSISTENT", "CORRECT"):
            picks = by_kind.get(kind, [])[:3]
            if not picks:
                continue
            lines.append(
                f"## {kind} ({len(by_kind.get(kind, []))} total, showing {len(picks)})"
            )
            lines.append("")
            for row in picks:
                lines += [
                    f"### {row['task_id']} (trial {row.get('trial', 0)})",
                    "",
                    f"- image: `tasks/images/...` (see task `{row['task_id']}` in tasks.jsonl)",
                    f"- expert label: `{json.dumps(row['ground_truth'])}`",
                    f"- model output: `{json.dumps({k: row.get(k) for k in ('defect_type','severity','disposition','confidence','reason')})}`",
                    "",
                    "```json",
                    row.get("raw", "")[:1500],
                    "```",
                    "",
                ]
        path = out_dir / f"{safe}.md"
        path.write_text("\n".join(lines), encoding="utf-8")
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
