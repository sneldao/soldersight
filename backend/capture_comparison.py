"""Run one live Mubit call set per lane and save the numbers for the deck.

    MUBIT_API_KEY=... python capture_comparison.py 00041000 00041029

Writes data/deeppcb/comparison.json: the same crops scored down the baseline lane and
the lane carrying the inspector corrections, so the two columns differ only by the
instructions the task was formed from.
"""

import json
import time
from collections import defaultdict

from fastapi.testclient import TestClient

import main

LANES = ["baseline", "adapted"]
BOARDS = ["00041000", "00041002", "00041005", "00041009", "00041015", "00041029"]


def call(client: TestClient, board_id: str, attempts: int = 3) -> dict:
    """One board down both lanes, retrying a lane that Mubit refused."""
    for attempt in range(attempts):
        res = client.post("/compare", json={"board_ids": [board_id], "lanes": LANES})
        if res.status_code == 200:
            return res.json()["boards"][0]
        print(f"  {board_id} attempt {attempt + 1}: {res.status_code} {res.text[:120]}")
        time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"board {board_id} never compared")


def main_run(boards: list[str]) -> None:
    started = int(time.time())
    client = TestClient(main.app)
    rows = []
    for board_id in boards:
        print(f"comparing {board_id} ...")
        rows.append(call(client, board_id))

    # Aggregate from the runs this capture recorded, through the same summarizer the
    # API uses, instead of re-deriving it from the response.
    by_lane: dict[str, list[dict]] = defaultdict(list)
    for row in main.read_runs():
        if row.get("ts", 0) >= started and row.get("lane") in LANES:
            by_lane[row["lane"]].append(row)

    snapshot = {
        "generated_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "model": main.MODEL,
        "corrections": len(main.read_corrections()),
        "boards": rows,
        "lanes": {lane: main.summarize(by_lane[lane]) for lane in LANES},
    }
    out = main.DATA_DIR / "comparison.json"
    out.write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")

    print(f"\nwrote {out}")
    for lane in LANES:
        print(f"\n{lane}: {json.dumps(snapshot['lanes'][lane], indent=2)}")


if __name__ == "__main__":
    import sys

    main_run(sys.argv[1:] or BOARDS)
