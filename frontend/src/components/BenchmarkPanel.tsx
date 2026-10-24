import { useEffect, useState } from "react";
import { fetchBenchmark } from "../api";
import type { Benchmark } from "../types";
import { LANES, LaneTable } from "../laneTable";
import { Panel } from "./ui";

// The measured run, kept on screen: what the corrections bought, and what they cost.
export function BenchmarkPanel() {
  const [data, setData] = useState<Benchmark | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBenchmark()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <Panel title="Recorded comparison">
      {error && <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p>}
      {!data && !error && (
        <p style={{ margin: 0, color: "var(--text-dim)" }}>Loading…</p>
      )}
      {data && (
        <div style={{ display: "grid", gap: 12 }}>
          <p style={{ margin: 0, color: "var(--text-dim)", fontSize: 13 }}>
            {data.model} · {data.boards.length} boards · {data.corrections} inspector
            corrections · captured {data.generated_utc}
          </p>
          <LaneTable lanes={data.lanes} />
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--text-dim)" }}>
                <th>Board</th>
                <th>Labels</th>
                {LANES.map((lane) => (
                  <th key={lane}>{lane} verdict</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.boards.map((board) => (
                <tr key={board.id} style={{ borderTop: "1px solid var(--panel-border)" }}>
                  <td style={{ fontFamily: "var(--mono)" }}>{board.id}</td>
                  <td>{board.ground_truth.disposition}</td>
                  {LANES.map((lane) => {
                    const verdict = board.verdicts[lane];
                    return (
                      <td
                        key={lane}
                        style={{
                          color: verdict?.correct ? "var(--accent)" : "var(--danger)",
                          fontFamily: "var(--mono)",
                        }}
                      >
                        {verdict ? `${verdict.defect_type} / ${verdict.disposition}` : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ margin: 0, color: "var(--text-dim)", fontSize: 12 }}>
            Defect crops and clean crops are scored apart, so an untouched board cannot
            inflate the accuracy. Corrections and scoring share these boards: this is the
            loop working, not a held-out benchmark.
          </p>
        </div>
      )}
    </Panel>
  );
}
