#!/usr/bin/env python3
"""Confidence calibration and trivial-baseline analysis over committed predictions.

    python eval/calibration.py [--results eval/results] [--out eval/results/calibration.json]

Reports, per model and pooled:
  * AUC of stated confidence -> disposition correctness (Mann-Whitney; 0.5 = no signal)
  * how often the model states >= 0.90 confidence and how often that is wrong
and the accuracy of constant-answer baselines on each suite.

Pooled AUC mixes between-model differences in how confident models sound with
within-model signal, so the per-model numbers are the ones to read.
"""

import argparse
import collections
import glob
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def auc(pos, neg):
    """P(conf_correct > conf_wrong), ties count half."""
    if not pos or not neg:
        return None
    wins = sum((p > n) + 0.5 * (p == n) for p in pos for n in neg)
    return wins / (len(pos) * len(neg))


def load(results_dir):
    rows = collections.defaultdict(list)
    for path in sorted(glob.glob(os.path.join(results_dir, "predictions_*.jsonl"))):
        with open(path) as f:
            for line in f:
                r = json.loads(line)
                if r.get("confidence") is None or r.get("disposition") is None:
                    continue
                rows[r["model"]].append(
                    (
                        float(r["confidence"]),
                        r["disposition"] == r["ground_truth"]["disposition"],
                    )
                )
    return rows


def summarize(rs):
    pos = [c for c, ok in rs if ok]
    neg = [c for c, ok in rs if not ok]
    hi = [(c, ok) for c, ok in rs if c >= 0.90]
    a = auc(pos, neg)
    return {
        "trials": len(rs),
        "accuracy": round(len(pos) / len(rs), 3),
        "mean_confidence": round(sum(c for c, _ in rs) / len(rs), 3),
        "auc": None if a is None else round(a, 3),
        "trials_conf_ge_0.90": len(hi),
        "wrong_among_conf_ge_0.90": sum(1 for _, ok in hi if not ok),
    }


def baselines(tasks_path):
    out = {}
    with open(tasks_path) as f:
        tasks = [json.loads(line) for line in f]
    for suite in sorted({t["suite"] for t in tasks}):
        counts = collections.Counter(
            t["ground_truth"]["disposition"] for t in tasks if t["suite"] == suite
        )
        n = sum(counts.values())
        out[suite] = {
            "tasks": n,
            "label_counts": dict(counts),
            "always_answer_accuracy": {k: round(v / n, 3) for k, v in counts.items()},
        }
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", default=os.path.join(HERE, "results"))
    ap.add_argument("--tasks", default=os.path.join(HERE, "tasks", "tasks.jsonl"))
    ap.add_argument("--out", default=os.path.join(HERE, "results", "calibration.json"))
    args = ap.parse_args()

    rows = load(args.results)
    per_model = {m: summarize(rs) for m, rs in sorted(rows.items())}
    pooled = summarize([x for rs in rows.values() for x in rs])
    total = sum(v["trials"] for v in per_model.values())
    within = (
        sum(v["auc"] * v["trials"] for v in per_model.values() if v["auc"] is not None)
        / total
    )
    report = {
        "per_model": per_model,
        "pooled": pooled,
        "within_model_weighted_mean_auc": round(within, 3),
        "constant_answer_baselines": baselines(args.tasks),
    }
    with open(args.out, "w") as f:
        json.dump(report, f, indent=2)
        f.write("\n")

    print(
        f"{'model':22s} {'trials':>6s} {'acc':>6s} {'mean conf':>9s} {'AUC':>6s} {'>=0.90':>7s} {'wrong':>6s}"
    )
    for m, v in per_model.items():
        print(
            f"{m:22s} {v['trials']:6d} {v['accuracy']:6.3f} {v['mean_confidence']:9.3f} "
            f"{v['auc']:6.3f} {v['trials_conf_ge_0.90']:7d} {v['wrong_among_conf_ge_0.90']:6d}"
        )
    print(
        f"{'pooled (all models)':22s} {pooled['trials']:6d} {pooled['accuracy']:6.3f} "
        f"{pooled['mean_confidence']:9.3f} {pooled['auc']:6.3f} "
        f"{pooled['trials_conf_ge_0.90']:7d} {pooled['wrong_among_conf_ge_0.90']:6d}"
    )
    print(f"within-model weighted mean AUC: {report['within_model_weighted_mean_auc']}")
    for suite, b in report["constant_answer_baselines"].items():
        print(f"{suite}: constant-answer accuracy {b['always_answer_accuracy']}")
    print("wrote", args.out)


if __name__ == "__main__":
    main()
