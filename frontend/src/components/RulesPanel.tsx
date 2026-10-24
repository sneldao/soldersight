import { useState } from "react";
import { disableCorrection } from "../api";
import { DEFECT_TYPES } from "../types";
import type { Rules } from "../types";
import { Button, Panel } from "./ui";

// What the adapted lane is buying vs costing, in delta points from the baseline.
function Delta({ label, value, invert }: { label: string; value: number | null; invert?: boolean }) {
  if (value === null) return null;
  const points = Math.round(value * 100);
  if (points === 0) return null;
  // For "missed defects" and "false alarms" a negative delta is the good one;
  // for accuracies positive is good — invert flips which sign paints green.
  const good = invert ? points < 0 : points > 0;
  return (
    <span style={{ fontSize: 12, color: good ? "var(--ok)" : "var(--danger)", fontFamily: "var(--mono)" }}>
      {label} {points > 0 ? "+" : ""}
      {points}pt
    </span>
  );
}

// The Mubit mechanism, on screen: one task per matching model + instructions + output
// format, so what an inspector teaches shows up as a second prompt, not a hidden weight.
export function RulesPanel({
  rules,
  onChanged,
}: {
  rules: Rules | null;
  onChanged?: (rules: Rules) => void;
}) {
  const [busy, setBusy] = useState(false);
  const added: string[] = (rules?.defect_types ?? []).filter(
    (type) => !(DEFECT_TYPES as readonly string[]).includes(type),
  );

  async function disable(index: number) {
    if (!onChanged) return;
    setBusy(true);
    try {
      onChanged(await disableCorrection(index));
    } finally {
      setBusy(false);
    }
  }

  const activeCorrections = (rules?.corrections ?? []).filter((c) => c.enabled);

  return (
    <Panel title="What this line has taught">
      {!rules || rules.rules.length === 0 ? (
        <p style={{ margin: 0, color: "var(--text-dim)" }}>
          No active corrections, so both lanes send the same instructions.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
            {rules.rules.map((rule) => (
              <li key={rule} style={{ fontSize: 13 }}>
                {rule}
              </li>
            ))}
          </ul>
          {onChanged && activeCorrections.length > 0 && (
            <div style={{ display: "grid", gap: 6 }}>
              {activeCorrections.map((c) => (
                <div
                  key={c.index}
                  style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "var(--text-dim)" }}
                >
                  <code>
                    {c.original.defect_type ?? "?"}→{c.corrected.defect_type}
                  </code>
                  <span style={{ flex: 1 }}>from board {c.board_id}</span>
                  <Button variant="ghost" disabled={busy} onClick={() => disable(c.index)}>
                    disable
                  </Button>
                </div>
              ))}
            </div>
          )}
          {rules.lane_health && (
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                borderTop: "1px solid var(--panel-border)",
                paddingTop: 10,
              }}
            >
              <span style={{ fontSize: 12, color: "var(--text-dim)" }}>adapted vs baseline:</span>
              <Delta label="missed" value={rules.lane_health.missed_defect_rate} invert />
              <Delta label="false alarms" value={rules.lane_health.false_alarm_rate} invert />
              <Delta label="type acc" value={rules.lane_health.type_accuracy} />
              <Delta label="board acc" value={rules.lane_health.board_disposition_accuracy} />
            </div>
          )}
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ color: "var(--text-dim)", fontSize: 12 }}>
              Defect types this task accepts ·{" "}
              {added.length > 0
                ? `${added.join(", ")} added by inspectors`
                : "the dataset taxonomy"}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {rules.defect_types.map((type) => (
                <code
                  key={type}
                  style={{
                    fontSize: 12,
                    padding: "2px 8px",
                    borderRadius: 999,
                    // Amber text on paper is 2.95:1, so a taught type is marked with a
                    // wash + border and keeps full-contrast ink.
                    color: "var(--text)",
                    background: added.includes(type) ? "var(--accent-dim)" : undefined,
                    border: `1px solid ${added.includes(type) ? "var(--accent)" : "var(--panel-border)"}`,
                  }}
                >
                  {type}
                </code>
              ))}
            </div>
          </div>
          <details>
            <summary style={{ cursor: "pointer", color: "var(--text-dim)", fontSize: 13 }}>
              The two system prompts Mubit forms tasks from
            </summary>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginTop: 10,
              }}
            >
              {Object.entries(rules.lanes).map(([lane, prompt]) => (
                <pre
                  key={lane}
                  style={{
                    margin: 0,
                    fontSize: 11,
                    whiteSpace: "pre-wrap",
                    background: "var(--bg)",
                    border: "1px solid var(--panel-border)",
                    borderRadius: "var(--radius)",
                    padding: 10,
                  }}
                >
                  {`// ${lane}\n${prompt}`}
                </pre>
              ))}
            </div>
          </details>
        </div>
      )}
    </Panel>
  );
}
