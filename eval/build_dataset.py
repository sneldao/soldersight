"""Build the eval dataset from the committed DeepPCB subset.

Two suites, same taxonomy and prompt:

- ``board`` — the whole 640px board photo. Tests whether a vision model can see
  30-55px defects at native resolution. One task per board.
- ``crop``   — the changed cells a template diff isolates, upscaled to 480px.
  Tests whether the model can classify a defect once it can actually see it.
  Up to MAX_REGIONS crops per board, exactly as production triage derives them.

Run from the repo root:  python eval/build_dataset.py
"""

import importlib.util
import json
import shutil
import sys
from pathlib import Path

EVAL_DIR = Path(__file__).resolve().parent
REPO_ROOT = EVAL_DIR.parent
DATA_DIR = REPO_ROOT / "data" / "deeppcb"
IMAGE_DIR = DATA_DIR / "images"
ANN_DIR = DATA_DIR / "annotations"
OUT_DIR = EVAL_DIR / "tasks"

sys.path.insert(0, str(EVAL_DIR / "src"))
from common import (  # noqa: E402
    ground_truth,
    instructions,
    parse_annotations,
    region_truth,
)


def load_inspection():
    spec = importlib.util.spec_from_file_location(
        "inspection", REPO_ROOT / "backend" / "inspection.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> None:
    inspection = load_inspection()
    boards_dir = OUT_DIR / "images" / "boards"
    crops_dir = OUT_DIR / "images" / "crops"
    boards_dir.mkdir(parents=True, exist_ok=True)
    crops_dir.mkdir(parents=True, exist_ok=True)

    prompt = instructions()
    tasks = []
    board_ids = sorted({p.name.rsplit("_", 1)[0] for p in IMAGE_DIR.glob("*_test.jpg")})

    for board_id in board_ids:
        test_path = IMAGE_DIR / f"{board_id}_test.jpg"
        template_path = IMAGE_DIR / f"{board_id}_temp.jpg"
        if not template_path.is_file():
            continue
        test = test_path.read_bytes()
        template = template_path.read_bytes()
        annotations = parse_annotations(
            (ANN_DIR / f"{board_id}.txt").read_text(encoding="utf-8")
        )
        truth = ground_truth(annotations)

        # Suite A: the whole board, as a camera/inspection station would see it.
        board_image = boards_dir / f"{board_id}.jpg"
        shutil.copyfile(test_path, board_image)
        tasks.append(
            {
                "task_id": f"board:{board_id}",
                "suite": "board",
                "board_id": board_id,
                "image": f"images/boards/{board_id}.jpg",
                "prompt": prompt,
                "ground_truth": truth,
            }
        )

        # The defect-free template is the golden sample: a clean board task so
        # board-level false alarms are measurable, not just crop-level ones.
        clean_image = boards_dir / f"{board_id}_clean.jpg"
        shutil.copyfile(template_path, clean_image)
        tasks.append(
            {
                "task_id": f"board:{board_id}:clean",
                "suite": "board",
                "board_id": board_id,
                "image": f"images/boards/{board_id}_clean.jpg",
                "prompt": prompt,
                "ground_truth": ground_truth([]),
            }
        )

        # Suite B: the diff-derived crops production actually sends to the model.
        regions = inspection.changed_regions(template, test) or inspection.grid_regions(
            test, grid=1
        )
        for index, region in enumerate(regions):
            crop_bytes = inspection.crop(test, region)
            name = f"{board_id}_{index}.jpg"
            (crops_dir / name).write_bytes(crop_bytes)
            tasks.append(
                {
                    "task_id": f"crop:{board_id}:{index}",
                    "suite": "crop",
                    "board_id": board_id,
                    "image": f"images/crops/{name}",
                    "prompt": prompt,
                    "region": {
                        "x1": region.x1,
                        "y1": region.y1,
                        "x2": region.x2,
                        "y2": region.y2,
                        "delta": region.delta,
                    },
                    "ground_truth": region_truth(annotations, vars(region)),
                }
            )

    tasks_path = OUT_DIR / "tasks.jsonl"
    with tasks_path.open("w", encoding="utf-8") as handle:
        for task in tasks:
            handle.write(json.dumps(task) + "\n")

    n_boards = sum(1 for t in tasks if t["suite"] == "board")
    n_crops = sum(1 for t in tasks if t["suite"] == "crop")
    defect_boards = sum(
        1
        for t in tasks
        if t["suite"] == "board" and t["ground_truth"]["worst"] != "none"
    )
    print(f"wrote {tasks_path} — {n_boards} board + {n_crops} crop tasks")
    print(f"boards with defects: {defect_boards}/{n_boards}")


if __name__ == "__main__":
    main()
