import type { LaneSummary } from "./types";

export const LANES = ["baseline", "adapted"] as const;

export const LANE_COPY: Record<string, string> = {
  baseline: "Baseline task — the provider's prompt",
  adapted: "Adapted task — the inspector's rules in the prompt",
};

export function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

// The lane metrics worth a line on screen, with how each one is read.
export const ROWS: [keyof LaneSummary, string, (value: number | null) => string][] = [
  ["type_accuracy", "Defect crops, right type", pct],
  ["missed_defect_rate", "Defects missed", pct],
  ["false_alarm_rate", "Clean crops flagged", pct],
  ["board_disposition_accuracy", "Board disposition right", pct],
  ["avg_latency_ms", "Latency / crop", (v) => (v === null ? "—" : `${v}ms`)],
  ["avg_cost_usd", "Cost / crop", (v) => (v === null ? "—" : `$${v}`)],
];

export function LaneTable({ lanes }: { lanes: Record<string, LaneSummary> }) {
  return (
    <table className="metrics">
      <thead>
        <tr>
          <th />
          {LANES.map((lane) => (
            <th key={lane}>{lane}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ROWS.map(([key, label, format]) => (
          <tr key={key} className="bordered">
            <td>{label}</td>
            {LANES.map((lane) => (
              <td key={lane} className="mono">
                {format((lanes[lane]?.[key] ?? null) as number | null)}
              </td>
            ))}
          </tr>
        ))}
        <tr className="bordered">
          <td>Crops scored / defect crops</td>
          {LANES.map((lane) => (
            <td key={lane} className="mono">
              {lanes[lane]?.scored ?? "—"} / {lanes[lane]?.defect_regions ?? "—"}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}
