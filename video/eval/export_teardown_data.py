#!/usr/bin/env python3
"""Export the eval results into the compact JSON the teardown page binds to.

Everything the page displays comes from here, computed from the committed
prediction files. Nothing is hardcoded in the HTML.

Usage: python3 video/eval/export_teardown_data.py
Writes: video/eval/scenes/teardown_data.js  (window.TD = {...})
"""

import glob
import json
import os
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
EVAL = os.path.join(HERE, "..", "..", "eval")
OUT = os.path.join(HERE, "scenes", "teardown_data.js")


def load():
    rows = []
    for f in sorted(glob.glob(os.path.join(EVAL, "results", "predictions_*.jsonl"))):
        for line in open(f):
            r = json.loads(line)
            if "error" in r or not r.get("disposition"):
                continue
            gt = r["ground_truth"]
            r["ok"] = r["disposition"] == gt["disposition"]
            r["conf"] = r.get("confidence")
            rows.append(r)
    return rows


def auc(pos, neg):
    """Mann-Whitney AUC: P(conf_correct > conf_wrong)."""
    vals = defaultdict(lambda: [0, 0])
    for c in pos:
        vals[c][1] += 1
    for c in neg:
        vals[c][0] += 1
    cum_neg = 0
    num = 0.0
    for c in sorted(vals):
        n, p = vals[c][0], vals[c][1]
        num += p * (cum_neg + n / 2)
        cum_neg += n
    return num / (len(pos) * len(neg)) if pos and neg else None


def calibration(rows, edges=None):
    """Accuracy per confidence bucket, for the calibration curve."""
    edges = edges or [0.0, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.01]
    out = []
    for lo, hi in zip(edges, edges[1:]):
        sel = [r for r in rows if r["conf"] is not None and lo <= r["conf"] < hi]
        if not sel:
            continue
        out.append(
            {
                "lo": round(lo, 2),
                "hi": round(min(hi, 1.0), 2),
                "n": len(sel),
                "acc": round(sum(r["ok"] for r in sel) / len(sel), 3),
            }
        )
    return out


def main():
    rows = load()
    models = sorted({r["model"] for r in rows})

    # ---- per-model summary ----------------------------------------------
    per_model = []
    for m in models:
        rs = [r for r in rows if r["model"] == m]
        board = [r for r in rs if r["suite"] == "board"]
        crop = [r for r in rs if r["suite"] == "crop"]
        hi = [r for r in rs if (r["conf"] or 0) >= 0.9]
        m_pos = [r["conf"] for r in rs if r["ok"] and r["conf"] is not None]
        m_neg = [r["conf"] for r in rs if not r["ok"] and r["conf"] is not None]
        per_model.append(
            {
                "model": m,
                "n": len(rs),
                "auc": round(auc(m_pos, m_neg), 3),
                "n_hi_wrong": len([r for r in hi if not r["ok"]]),
                "acc": round(sum(r["ok"] for r in rs) / len(rs), 3),
                "board_acc": round(sum(r["ok"] for r in board) / len(board), 3)
                if board
                else None,
                "crop_acc": round(sum(r["ok"] for r in crop) / len(crop), 3)
                if crop
                else None,
                "n_hi": len(hi),
                "acc_hi": round(sum(r["ok"] for r in hi) / len(hi), 3) if hi else None,
                "mean_conf": round(
                    sum(r["conf"] for r in rs if r["conf"] is not None)
                    / len([r for r in rs if r["conf"] is not None]),
                    3,
                ),
            }
        )
    per_model.sort(key=lambda d: -d["acc"])

    # ---- global calibration ---------------------------------------------
    pos = [r["conf"] for r in rows if r["ok"] and r["conf"] is not None]
    neg = [r["conf"] for r in rows if not r["ok"] and r["conf"] is not None]
    hi_all = [r for r in rows if (r["conf"] or 0) >= 0.9]

    glob_stats = {
        "n": len(rows),
        "n_correct": len(pos),
        "n_wrong": len(neg),
        "mean_conf_correct": round(sum(pos) / len(pos), 3),
        "mean_conf_wrong": round(sum(neg) / len(neg), 3),
        "auc": round(auc(pos, neg), 3),
        "n_hi": len(hi_all),
        "n_hi_wrong": len([r for r in hi_all if not r["ok"]]),
        "acc_hi": round(sum(r["ok"] for r in hi_all) / len(hi_all), 3),
        "calibration": calibration(rows),
    }

    # ---- exhibits: confident wrong calls on defective boards ------------
    def exhibit(r):
        return {
            "task_id": r["task_id"],
            "board_id": r["board_id"],
            "model": r["model"],
            "suite": r["suite"],
            "trial": r["trial"],
            "conf": r["conf"],
            "said_type": r["defect_type"],
            "said_disp": r["disposition"],
            "truth_disp": r["ground_truth"]["disposition"],
            "truth_worst": r["ground_truth"]["worst"],
            "truth_types": r["ground_truth"]["defect_types"],
            "reason": r["reason"],
            "raw": r.get("raw"),
            "latency_ms": r.get("latency_ms"),
            "image": image_for(r),
        }

    def image_for(r):
        """Relative path from scenes/ to the task image, if it exists.

        Clean boards are stored as <board>_clean.jpg; crops as <board>_<idx>.jpg.
        """
        tid = r["task_id"]
        base = os.path.join(EVAL, "tasks", "images")
        if r["suite"] == "board":
            suffix = "_clean" if tid.endswith(":clean") else ""
            p = os.path.join(base, "boards", f"{r['board_id']}{suffix}.jpg")
        else:
            # crop task ids look like crop:<board>:<idx>
            parts = tid.split(":")
            idx = parts[-1]
            p = os.path.join(base, "crops", f"{r['board_id']}_{idx}.jpg")
        if os.path.exists(p):
            return os.path.relpath(p, os.path.join(HERE, "scenes")).replace(os.sep, "/")
        return None

    confident_wrong = [
        r
        for r in rows
        if not r["ok"]
        and r["ground_truth"]["disposition"] == "scrap"
        and (r["conf"] or 0) >= 0.95
    ]
    confident_wrong.sort(key=lambda r: -r["conf"])
    # dedupe by (board, model) so the same board doesn't repeat
    seen, exhibits = set(), []
    for r in confident_wrong:
        k = (r["board_id"], r["model"])
        if k in seen:
            continue
        seen.add(k)
        exhibits.append(exhibit(r))
        if len(exhibits) >= 12:
            break

    # false alarms on clean boards
    fa = [
        r
        for r in rows
        if not r["ok"]
        and r["ground_truth"]["disposition"] == "pass"
        and (r["conf"] or 0) >= 0.8
    ]
    fa.sort(key=lambda r: -r["conf"])
    seen, false_alarms = set(), []
    for r in fa:
        k = (r["board_id"], r["model"])
        if k in seen:
            continue
        seen.add(k)
        false_alarms.append(exhibit(r))
        if len(false_alarms) >= 8:
            break

    # ---- a representative call per model for the fan-out -----------------
    # Prefer confident WRONG calls: the teardown's point is the failure, so a
    # model's fan-out leads with its most confident mistakes, then its confident
    # correct calls for contrast.
    # The strip must show the REAL interleaving: at the top of a model's
    # confidence range right and wrong calls sit side by side, and reordering
    # the list would fake a clean split that the data does not contain. Take
    # the top calls in true confidence order and let the colours fall where
    # they fall.
    by_model = {}
    for m in models:
        rs = [r for r in rows if r["model"] == m and r["suite"] == "board"]
        rs.sort(key=lambda r: -(r["conf"] or 0))
        by_model[m] = [exhibit(r) for r in rs[:8]]

    payload = {
        "generated_from": "eval/results/predictions_*.jsonl",
        "models": per_model,
        "global": glob_stats,
        "exhibits": exhibits,
        "false_alarms": false_alarms,
        "by_model": by_model,
    }

    with open(OUT, "w") as f:
        f.write("window.TD = ")
        json.dump(payload, f, indent=1)
        f.write(";\n")

    print(f"wrote {OUT}")
    print(f"  {len(rows)} trials · {len(models)} models")
    print(
        f"  AUC {glob_stats['auc']} · conf>=0.90: {glob_stats['n_hi']} "
        f"({glob_stats['n_hi_wrong']} wrong)"
    )
    print(
        f"  {len(exhibits)} confident-wrong exhibits, {len(false_alarms)} false alarms"
    )


if __name__ == "__main__":
    main()
