"""Turn a board photo into the regions worth inspecting, and crops the model can see.

A whole 640px DeepPCB board is too small for a vision model to judge: defects run
30-60px and the model answers "no visible defects". Region proposals come from the
difference between the board's known-good template and the photo under test, so the
model only ever sees zoomed-in copper.
"""

import io
from dataclasses import dataclass

import numpy as np
from PIL import Image

# A board is split into GRID x GRID cells; the changed ones become inspection regions.
GRID = 8
# Mean absolute luminance difference before a cell counts as changed. Clean boards sit
# near 2.0 (JPEG noise), real defects push a cell past 6.
MIN_DELTA = 5.0
MAX_REGIONS = 5
# Crops are upscaled to this edge so a 30px notch survives the model's image tiling.
CROP_EDGE = 480


@dataclass(frozen=True)
class Region:
    x1: int
    y1: int
    x2: int
    y2: int
    delta: float


def _gray(data: bytes) -> np.ndarray:
    return np.asarray(Image.open(io.BytesIO(data)).convert("L"), dtype=np.int16)


def _cells(deltas: np.ndarray, grid: int) -> list[tuple[float, int, int]]:
    height, width = deltas.shape
    cell_h, cell_w = height // grid, width // grid
    scored = []
    for row in range(grid):
        for col in range(grid):
            block = deltas[
                row * cell_h : (row + 1) * cell_h, col * cell_w : (col + 1) * cell_w
            ]
            scored.append((float(block.mean()), row, col))
    return scored


def changed_regions(template: bytes, test: bytes, grid: int = GRID) -> list[Region]:
    """Cells that differ from the known-good template, worst first."""
    base, shot = _gray(template), _gray(test)
    if base.shape != shot.shape:
        shot = np.asarray(
            Image.open(io.BytesIO(test)).convert("L").resize(base.shape[::-1]),
            dtype=np.int16,
        )
    height, width = base.shape
    cell_h, cell_w = height // grid, width // grid
    regions = []
    for delta, row, col in sorted(_cells(np.abs(base - shot), grid), reverse=True):
        if delta < MIN_DELTA or len(regions) >= MAX_REGIONS:
            continue
        regions.append(
            Region(
                col * cell_w,
                row * cell_h,
                (col + 1) * cell_w,
                (row + 1) * cell_h,
                round(delta, 2),
            )
        )
    return regions


def grid_regions(test: bytes, grid: int = 2) -> list[Region]:
    """Quadrants, for a photo with no template to compare against (e.g. a camera frame)."""
    shot = _gray(test)
    height, width = shot.shape
    cell_h, cell_w = height // grid, width // grid
    return [
        Region(col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h, 0.0)
        for row in range(grid)
        for col in range(grid)
    ]


def crop(test: bytes, region: Region, pad: int = 12) -> bytes:
    """The region, padded and enlarged, as JPEG bytes ready for the vision model."""
    image = Image.open(io.BytesIO(test))
    width, height = image.size
    box = (
        max(0, region.x1 - pad),
        max(0, region.y1 - pad),
        min(width, region.x2 + pad),
        min(height, region.y2 + pad),
    )
    patch = image.crop(box).resize((CROP_EDGE, CROP_EDGE), Image.LANCZOS)
    buffer = io.BytesIO()
    patch.convert("RGB").save(buffer, format="JPEG", quality=92)
    return buffer.getvalue()
