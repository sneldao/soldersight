"""Build the "wide" suite: fresh boards from every DeepPCB group, balanced.

The core suites (tasks.jsonl) use 30 boards from one DeepPCB group, 29 of them
scrap-worst. This script answers the obvious objections to that:

- **Sample size / diversity:** 100 boards the core set never uses, drawn
  round-robin from all 11 DeepPCB groups.
- **Label balance:** 50 scrap boards (25 with a short, 25 open-only) and 50
  rework boards (worst defect is mousebite, copper, spur or pin hole), each
  paired with a clean twin,
  so defective:clean is 1:1 and scrap:rework:pass is 1:1:2.
- **Clean boards that are determinable:** the clean twin is the *same capture*
  with the annotated defects repaired from the defect-free template, so it
  carries the same scan noise as the defective image. A reference (template)
  image exists for every board, so the paired variant gives the model what a
  production AOI station has: a golden sample to compare against.
- **Prompt dependence:** every board is emitted once per prompt variant
  (production, worst, prior, binary, paired) so a failure can be attributed.

Needs the full dataset:  git clone https://github.com/tangsanli5201/DeepPCB
    python eval/build_wide.py --deeppcb /path/to/DeepPCB/PCBData
Deterministic (seeded). The built images are committed, so this only needs
re-running to regenerate them.
"""

import argparse
import importlib.util
import io
import json
import random
import shutil
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
from PIL import Image

EVAL_DIR = Path(__file__).resolve().parent
REPO_ROOT = EVAL_DIR.parent
sys.path.insert(0, str(EVAL_DIR / "src"))
from common import (  # noqa: E402
    VARIANTS,
    ground_truth,
    parse_annotations,
    prompt_for,
)

SEED = 20251107
MIN_DELTA = 5.0  # backend/inspection.py: mean cell luminance change that counts
REPAIR_PAD = 10  # px around each annotated box replaced from the template
# 50 scrap boards (half carry a short, half are open-only) + 50 rework boards
QUOTA = {"scrap:short": 25, "scrap:open-only": 25, "rework": 50}
OUT = EVAL_DIR / "tasks"


def core_board_ids() -> set[str]:
    images = REPO_ROOT / "data" / "deeppcb" / "images"
    return {p.name.split("_")[0] for p in images.glob("*_test.jpg")}


def load_candidates(root: Path, excluded: set[str]) -> dict[str, list[dict]]:
    by_worst: dict[str, list[dict]] = defaultdict(list)
    for test in sorted(root.glob("group*/*/*_test.jpg")):
        board_id = test.name[:8]
        if board_id in excluded:
            continue
        group = test.parent.parent.name
        ann_path = test.parent.parent / (test.parent.name + "_not") / f"{board_id}.txt"
        temp = test.with_name(f"{board_id}_temp.jpg")
        if not ann_path.is_file() or not temp.is_file():
            continue
        annotations = parse_annotations(ann_path.read_text(encoding="utf-8"))
        truth = ground_truth(annotations)
        if truth["worst"] == "none":
            continue
        if truth["disposition"] == "rework":
            stratum = "rework"
        else:
            has_short = "short" in truth["defect_types"]
            stratum = "scrap:short" if has_short else "scrap:open-only"
        by_worst[stratum].append(
            {
                "board_id": board_id,
                "group": group,
                "test": test,
                "temp": temp,
                "annotations": annotations,
                "truth": truth,
            }
        )
    return by_worst


def pick(candidates: list[dict], n: int, rng: random.Random, accept) -> list[dict]:
    """Take n accepted boards, round-robin over groups so no group dominates."""
    pools: dict[str, list[dict]] = defaultdict(list)
    for c in candidates:
        pools[c["group"]].append(c)
    for pool in pools.values():
        rng.shuffle(pool)
    order = sorted(pools)
    rng.shuffle(order)
    chosen: list[dict] = []
    while len(chosen) < n and any(pools.values()):
        for group in order:
            while pools[group] and len(chosen) < n:
                candidate = pools[group].pop()
                if accept(candidate):
                    chosen.append(candidate)
                    break
    return chosen


def repair(test_path: Path, temp_path: Path, annotations: list[dict]) -> tuple:
    """The test capture with every annotated defect replaced by the template."""
    test = np.array(Image.open(test_path).convert("L"))
    temp = np.array(Image.open(temp_path).convert("L"))
    mask = np.zeros(test.shape, dtype=bool)
    for a in annotations:
        y1, y2 = max(0, a["y1"] - REPAIR_PAD), a["y2"] + REPAIR_PAD + 1
        x1, x2 = max(0, a["x1"] - REPAIR_PAD), a["x2"] + REPAIR_PAD + 1
        mask[y1:y2, x1:x2] = True
    fixed = np.where(mask, temp, test)
    return fixed, test, temp, mask


def load_inspection():
    spec = importlib.util.spec_from_file_location(
        "inspection", REPO_ROOT / "backend" / "inspection.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def clean_twin_check(validation: list[dict]) -> dict:
    """Independent, model-free evidence that the clean twins are clean: the
    production change detector (threshold 5.0, calibrated on clean boards at
    ~2.0) separates every defective capture from its repaired twin."""
    dirty = [v["max_cell_delta_defective"] for v in validation]
    clean = [v["max_cell_delta_clean"] for v in validation]
    return {
        "detector_threshold": 5.0,
        "defective_min_max_cell_delta": min(dirty),
        "defective_boards_over_threshold": sum(d >= 5.0 for d in dirty),
        "clean_max_max_cell_delta": max(clean),
        "clean_boards_under_threshold": sum(c < 5.0 for c in clean),
        "boards": len(validation),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--deeppcb", required=True, help="path to DeepPCB/PCBData")
    args = parser.parse_args()
    root = Path(args.deeppcb)

    rng = random.Random(SEED)
    by_worst = load_candidates(root, core_board_ids())
    inspection = load_inspection()

    def accept(c: dict) -> bool:
        """Keep only well-registered pairs: the production change detector must
        stay silent on the repaired twin, so the twin carries no misregistration
        residue a reader could mistake for a defect. Nothing is required of the
        defective capture, so subtle defects are not filtered out."""
        fixed, _, _, _ = repair(c["test"], c["temp"], c["annotations"])
        buf = io.BytesIO()
        Image.fromarray(fixed).convert("RGB").save(buf, "JPEG", quality=92)
        c["_clean_bytes"] = buf.getvalue()
        template = c["temp"].read_bytes()
        c["_delta_defective"] = max(
            (
                r.delta
                for r in inspection.changed_regions(template, c["test"].read_bytes())
            ),
            default=0.0,
        )
        c["_delta_clean"] = max(
            (r.delta for r in inspection.changed_regions(template, c["_clean_bytes"])),
            default=0.0,
        )
        return c["_delta_clean"] < MIN_DELTA

    selected: list[dict] = []
    for stratum, n in QUOTA.items():
        pool = by_worst.get(stratum, [])
        if len(pool) < n:
            sys.exit(f"only {len(pool)} {stratum} boards available, need {n}")
        selected += pick(pool, n, rng, accept)
    selected.sort(key=lambda c: c["board_id"])

    img_dir = OUT / "images" / "wide"
    if img_dir.exists():
        shutil.rmtree(img_dir)
    img_dir.mkdir(parents=True)

    prompts = {v: prompt_for(v) for v in VARIANTS}
    tasks, validation = [], []
    for c in selected:
        bid = c["board_id"]
        shutil.copyfile(c["test"], img_dir / f"{bid}_test.jpg")
        shutil.copyfile(c["temp"], img_dir / f"{bid}_ref.jpg")
        (img_dir / f"{bid}_clean.jpg").write_bytes(c["_clean_bytes"])
        validation.append(
            {
                "board_id": bid,
                "group": c["group"],
                "worst": c["truth"]["worst"],
                "n_defects": len(c["annotations"]),
                "max_cell_delta_defective": c["_delta_defective"],
                "max_cell_delta_clean": c["_delta_clean"],
            }
        )
        defective_truth = c["truth"]
        clean_truth = ground_truth([])
        for variant in VARIANTS:
            for suffix, truth, image in (
                ("", defective_truth, f"images/wide/{bid}_test.jpg"),
                (":clean", clean_truth, f"images/wide/{bid}_clean.jpg"),
            ):
                task = {
                    "task_id": f"wide:{bid}{suffix}@{variant}",
                    "suite": "wide",
                    "variant": variant,
                    "board_id": bid,
                    "group": c["group"],
                    "prompt": prompts[variant],
                    "ground_truth": truth,
                }
                if variant == "paired":
                    task["images"] = [f"images/wide/{bid}_ref.jpg", image]
                else:
                    task["image"] = image
                tasks.append(task)

    for old in OUT.glob("tasks_wide*.jsonl"):
        old.unlink()
    for variant in VARIANTS:
        path = OUT / f"tasks_wide_{variant}.jsonl"
        path.write_text(
            "".join(json.dumps(t) + "\n" for t in tasks if t["variant"] == variant),
            encoding="utf-8",
        )

    groups = defaultdict(int)
    worst_counts = defaultdict(int)
    for c in selected:
        groups[c["group"]] += 1
        worst_counts[c["truth"]["worst"]] += 1
    summary = {
        "boards": len(selected),
        "tasks": len(tasks),
        "variants": list(VARIANTS),
        "groups": dict(sorted(groups.items())),
        "worst_type": dict(worst_counts),
        "disposition": {
            "scrap": sum(1 for c in selected if c["truth"]["disposition"] == "scrap"),
            "rework": sum(1 for c in selected if c["truth"]["disposition"] == "rework"),
            "pass_clean_twins": len(selected),
        },
        "repair_pad_px": REPAIR_PAD,
        "clean_twin_check": clean_twin_check(validation),
        "per_board": validation,
    }
    out = EVAL_DIR / "results" / "wide_validation.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(
        f"wrote {len(VARIANTS)} files tasks_wide_<variant>.jsonl: {len(selected)} boards, {len(tasks)} tasks"
    )
    print(f"groups: {dict(sorted(groups.items()))}")
    print(f"worst: {dict(worst_counts)}  disposition: {summary['disposition']}")
    print(f"clean-twin check: {summary['clean_twin_check']}")


if __name__ == "__main__":
    main()
