import { DEFECT_TYPES } from "../types";
import type { Rules } from "../types";
import { Panel } from "./ui";

// The Mubit mechanism, on screen: one task per matching model + instructions + output
// format, so what an inspector teaches shows up as a second prompt, not a hidden weight.
export function RulesPanel({ rules }: { rules: Rules | null }) {
  const added: string[] = (rules?.defect_types ?? []).filter(
    (type) => !(DEFECT_TYPES as readonly string[]).includes(type),
  );
  return (
    <Panel title="What this line has taught">
      {!rules || rules.rules.length === 0 ? (
        <p style={{ margin: 0, color: "var(--text-dim)" }}>
          No corrections yet, so both lanes send the same instructions.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
            {rules.rules.map((rule) => (
              <li key={rule} style={{ fontSize: 13 }}>
                {rule}
              </li>
            ))}
          </ul>
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
                    color: added.includes(type) ? "var(--accent)" : undefined,
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
