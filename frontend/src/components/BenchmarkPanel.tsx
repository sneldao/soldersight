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
      {error && <p className="flush bad">{error}</p>}
      {!data && !error && <p className="flush dim">Loading…</p>}
      {data && (
        <div className="stack">
          <p className="flush dim small">
            {data.model} · {data.boards.length} boards · {data.corrections} inspector
            corrections · captured {data.generated_utc}
          </p>
          <LaneTable lanes={data.lanes} />
          <table className="metrics sm">
            <thead>
              <tr>
                <th>Board</th>
                <th>Labels</th>
                {LANES.map((lane) => (
                  <th key={lane}>{lane} verdict</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.boards.map((board) => (
                <tr key={board.id} className="bordered">
                  <td className="mono">{board.id}</td>
                  <td>{board.ground_truth.disposition}</td>
                  {LANES.map((lane) => {
                    const verdict = board.verdicts[lane];
                    return (
                      <td key={lane} className={`mono ${verdict?.correct ? "good" : "bad"}`}>
                        {verdict ? `${verdict.defect_type} / ${verdict.disposition}` : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="flush dim xs">
            Defect crops and clean crops are scored apart, so an untouched board cannot
            inflate the accuracy. Corrections and scoring share these boards: this is the
            loop working, not a held-out benchmark.
          </p>
        </div>
      )}
    </Panel>
  );
}
