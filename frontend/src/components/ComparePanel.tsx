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
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Button onClick={run} disabled={!boardId || busy}>
          {busy ? "Calling Mubit on both lanes…" : `Compare lanes on ${boardId ?? "a board"}`}
        </Button>
        <span style={{ color: "var(--text-dim)", fontSize: 13 }}>
          The same crops go down both tasks. Only the instructions differ.
        </span>
      </div>
      {error && <ErrorPanel message={error} onDismiss={() => setError(null)} />}

      {board && (
        <div style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 16,
            }}
          >
            {LANES.map((lane) => (
              <div key={lane} style={{ display: "grid", gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 14 }}>{LANE_COPY[lane]}</h3>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <Badge type={board.verdicts[lane].defect_type} />
                  <strong>{board.verdicts[lane].disposition}</strong>
                  <span
                    style={{
                      color: board.verdicts[lane].correct ? "var(--accent)" : "var(--danger)",
                      fontSize: 13,
                    }}
                  >
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
