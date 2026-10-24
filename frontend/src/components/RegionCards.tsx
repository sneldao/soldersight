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
    <div className="region-grid">
      {regions.map((region, index) => {
        const hit = picked === region;
        const failed = region.error != null;
        const inert = !onPick || failed;
        return (
          <button
            key={index}
            type="button"
            aria-label={
              failed
                ? `region ${index}: call failed`
                : `region ${index}: ${region.defect_type}, ${region.disposition}`
            }
            onClick={inert ? undefined : () => onPick(region)}
            className={`region-card${hit ? " picked" : ""}${inert ? " static" : ""}${failed ? " failed" : ""}`}
          >
            <img src={`/crop/${boardId}/${index}`} alt={`region ${index}`} />
            {failed ? (
              <div className="region-fail">call failed — {region.error}</div>
            ) : (
              <>
                <div className="hrow">
                  <Badge type={region.defect_type} />
                  <span className="mono xs">
                    {region.disposition} · {Math.round(region.confidence * 100)}%
                  </span>
                </div>
                <div className="xs dim">{region.reason}</div>
                {region.ground_truth && (
                  <div className="xs">
                    <span className="dim">labels: </span>
                    {region.ground_truth.worst}
                    {" → "}
                    <span className={region.score?.type_correct ? "good" : "bad"}>
                      {region.score?.type_correct ? "correct type" : "wrong type"}
                    </span>
                  </div>
                )}
              </>
            )}
            <div className="region-meta">
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
