import type { RegionResult } from "../types";
import { Badge } from "./ui";

// One card per crop the lane was asked about, with the exact image the model saw.
export function RegionCards({
  boardId,
  regions,
  onPick,
  picked,
}: {
  boardId: string;
  regions: RegionResult[];
  onPick?: (region: RegionResult) => void;
  picked?: RegionResult | null;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
        gap: 12,
      }}
    >
      {regions.map((region, index) => {
        const hit = picked === region;
        return (
          <button
            key={index}
            type="button"
            onClick={onPick && (() => onPick(region))}
            style={{
              textAlign: "left",
              background: "var(--bg)",
              border: `1px solid ${hit ? "var(--accent)" : "var(--panel-border)"}`,
              borderRadius: "var(--radius)",
              padding: 10,
              display: "grid",
              gap: 6,
              cursor: onPick ? "pointer" : "default",
              color: "var(--text)",
            }}
          >
            <img
              src={`/crop/${boardId}/${index}`}
              alt={`region ${index}`}
              style={{ width: "100%", borderRadius: 6 }}
            />
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <Badge type={region.defect_type} />
              <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                {region.disposition} · {Math.round(region.confidence * 100)}%
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{region.reason}</div>
            {region.ground_truth && (
              <div style={{ fontSize: 12 }}>
                <span style={{ color: "var(--text-dim)" }}>labels: </span>
                {region.ground_truth.worst}
                {" → "}
                <span style={{ color: region.score?.type_correct ? "var(--accent)" : "var(--danger)" }}>
                  {region.score?.type_correct ? "correct type" : "wrong type"}
                </span>
              </div>
            )}
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>
              {region.region.x1},{region.region.y1}–{region.region.x2},{region.region.y2} · Δ
              {region.region.delta} · {region.metrics.latency_ms}ms · $
              {region.metrics.cost_usd}
              <br />
              {region.metrics.mubit_request_id}
            </div>
          </button>
        );
      })}
    </div>
  );
}
