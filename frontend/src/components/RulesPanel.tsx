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
    <span className={`delta ${good ? "good" : "bad"}`}>
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
        <p className="flush dim">
          No active corrections, so both lanes send the same instructions.
        </p>
      ) : (
        <div className="stack">
          <ul className="rule-list">
            {rules.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          {onChanged && activeCorrections.length > 0 && (
            <div className="stack">
              {activeCorrections.map((c) => (
                <div key={c.index} className="correction-row">
                  <code>
                    {c.original.defect_type ?? "?"}→{c.corrected.defect_type}
                  </code>
                  <span className="grow">from board {c.board_id}</span>
                  <Button variant="ghost" disabled={busy} onClick={() => disable(c.index)}>
                    disable
                  </Button>
                </div>
              ))}
            </div>
          )}
          {rules.lane_health && (
            <div className="lane-health">
              <span className="health-label">adapted vs baseline:</span>
              <Delta label="missed" value={rules.lane_health.missed_defect_rate} invert />
              <Delta label="false alarms" value={rules.lane_health.false_alarm_rate} invert />
              <Delta label="type acc" value={rules.lane_health.type_accuracy} />
              <Delta label="board acc" value={rules.lane_health.board_disposition_accuracy} />
            </div>
          )}
          <div className="stack">
            <div className="health-label">
              Defect types this task accepts ·{" "}
              {added.length > 0
                ? `${added.join(", ")} added by inspectors`
                : "the dataset taxonomy"}
            </div>
            <div className="hrow">
              {rules.defect_types.map((type) => (
                <code key={type} className={`code-chip${added.includes(type) ? " added" : ""}`}>
                  {type}
                </code>
              ))}
            </div>
          </div>
          <details>
            <summary className="dim small">The two system prompts Mubit forms tasks from</summary>
            <div className="prompt-cols">
              {Object.entries(rules.lanes).map(([lane, prompt]) => (
                <pre key={lane} className="prompt-pre">
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
