import { useState } from "react";
import { compare } from "../api";
import type { Comparison } from "../types";
import { LANES, LANE_COPY, LaneTable } from "../laneTable";
import { RegionCards } from "./RegionCards";
import { Badge, Button, ErrorPanel, Panel } from "./ui";

export function ComparePanel({ boardId }: { boardId: string | null }) {
  const [data, setData] = useState<Comparison | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!boardId) return;
    setBusy(true);
    setError(null);
    try {
      setData(await compare([boardId]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "compare failed");
    } finally {
      setBusy(false);
    }
  }

  const board = data?.boards[0] ?? null;

  return (
    <Panel title="Two tasks, one board">
      <div className="hrow">
        <Button onClick={run} disabled={!boardId || busy}>
          {busy ? "Calling Mubit on both lanes…" : `Compare lanes on ${boardId ?? "a board"}`}
        </Button>
        <span className="dim small">
          The same crops go down both tasks. Only the instructions differ.
        </span>
      </div>
      {error && <ErrorPanel message={error} onDismiss={() => setError(null)} />}

      {board && (
        <div className="stack-lg">
          <div className="lane-cols">
            {LANES.map((lane) => (
              <div key={lane} className="lane-block">
                <h3 className="lane-head">{LANE_COPY[lane]}</h3>
                <div className="hrow">
                  <Badge type={board.verdicts[lane].defect_type} />
                  <strong>{board.verdicts[lane].disposition}</strong>
                  <span className={`small ${board.verdicts[lane].correct ? "good" : "bad"}`}>
                    {board.verdicts[lane].correct
                      ? "matches the labels"
                      : `labels say ${board.ground_truth.disposition}`}
                  </span>
                </div>
                <RegionCards boardId={board.id} regions={board.regions[lane]} />
              </div>
            ))}
          </div>
          <LaneTable lanes={data?.lanes ?? {}} />
        </div>
      )}
    </Panel>
  );
}
