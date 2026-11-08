"""Prompt-sensitivity and group-robustness analysis for the wide suite.

    python eval/wide_analysis.py [--out eval/results/wide_analysis.json]

For each model and prompt variant: Youden J (TPR - FPR) overall, without the
largest DeepPCB group (so one board design cannot carry the result), and the
change in false-alarm / missed-defect rate against the production prompt.
Reads eval/results/wide_*.jsonl; needs nothing but the standard library.
"""

import argparse
import collections
import glob
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
VARIANTS = ("production", "worst", "prior", "binary", "paired")


def flagged(row):
    if "defective" in row:
        return bool(row["defective"])
    if row.get("defect_type") is None or row.get("disposition") is None:
        return None
    return row["defect_type"] != "none"


def rates(rows):
    pos = [flagged(r) for r in rows if r["ground_truth"]["worst"] != "none"]
    neg = [flagged(r) for r in rows if r["ground_truth"]["worst"] == "none"]
    pos, neg = [x for x in pos if x is not None], [x for x in neg if x is not None]
    if not pos or not neg:
        return None
    tpr, fpr = sum(pos) / len(pos), sum(neg) / len(neg)
    return {"tpr": tpr, "fpr": fpr, "j": tpr - fpr}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", default=os.path.join(HERE, "results"))
    ap.add_argument("--tasks", default=os.path.join(HERE, "tasks"))
    ap.add_argument(
        "--out", default=os.path.join(HERE, "results", "wide_analysis.json")
    )
    args = ap.parse_args()

    group_of = {}
    for task_file in sorted(glob.glob(os.path.join(args.tasks, "tasks_wide_*.jsonl"))):
        with open(task_file) as f:
            for line in f:
                t = json.loads(line)
                group_of[t["task_id"]] = t["group"]
    sizes = collections.Counter(
        g
        for tid, g in group_of.items()
        if tid.endswith("@production") and ":clean" not in tid
    )
    biggest = sizes.most_common(1)[0][0]

    report = {"largest_group": biggest, "boards_per_group": dict(sorted(sizes.items()))}
    by_model = collections.defaultdict(list)
    for path in sorted(glob.glob(os.path.join(args.results, "wide_*.jsonl"))):
        with open(path) as f:
            for line in f:
                row = json.loads(line)
                by_model[row["model"]].append(row)
    for model, rows in sorted(by_model.items()):
        by_variant = collections.defaultdict(list)
        for r in rows:
            by_variant[r.get("variant", "production")].append(r)
        entry = {}
        for v in VARIANTS:
            vr = by_variant.get(v)
            if not vr:
                continue
            allr = rates(vr)
            rest = rates([r for r in vr if group_of[r["task_id"]] != biggest])
            only = rates([r for r in vr if group_of[r["task_id"]] == biggest])
            entry[v] = {
                "all": allr,
                f"without_{biggest}": rest,
                biggest: only,
            }
        base = entry["production"]["all"]
        for v, e in entry.items():
            e["delta_vs_production"] = {
                "fpr": round(e["all"]["fpr"] - base["fpr"], 3),
                "missed_defect_rate": round(
                    (1 - e["all"]["tpr"]) - (1 - base["tpr"]), 3
                ),
                "j": round(e["all"]["j"] - base["j"], 3),
            }
        report[model] = entry

    with open(args.out, "w") as f:
        json.dump(report, f, indent=2)
        f.write("\n")

    print(
        f"largest group: {biggest} ({sizes[biggest]} of {sum(sizes.values())} boards)"
    )
    for model, entry in report.items():
        if not isinstance(entry, dict) or "production" not in entry:
            continue
        print(model)
        for v, e in entry.items():
            rest = e[f"without_{biggest}"]
            print(
                f"  {v:10s} J {e['all']['j']:+.2f} (FPR {e['all']['fpr']:.2f}, miss {1 - e['all']['tpr']:.2f})"
                f"  | without {biggest}: J {rest['j']:+.2f}"
            )
    print("wrote", args.out)


if __name__ == "__main__":
    main()
