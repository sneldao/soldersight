import type { GateAction, SaplingLabel, VerifyResult } from "../types";

const ACTION_STYLE: Record<GateAction, { color: string; glyph: string; title: string }> = {
  SHIP: { color: "#34d399", glyph: "✓", title: "Cleared to ship" },
  BLOCK: { color: "#f87171", glyph: "✕", title: "Ship blocked" },
  REVIEW: { color: "#fbbf24", glyph: "⚠", title: "Human review" },
};

const LABEL_TEXT: Record<SaplingLabel, string> = {
  supported: "Supported",
  violation: "Policy violation",
  insufficient_information: "Insufficient information",
  inconsistent_context: "Inconsistent context",
};

function ProbBar({ label, value, lead }: { label: SaplingLabel; value: number; lead: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 44px", gap: 8, alignItems: "center" }}>
      <span style={{ fontSize: 12, color: lead ? "var(--text)" : "var(--text-dim)" }}>
        {LABEL_TEXT[label]}
      </span>
      <div style={{ height: 8, background: "var(--panel-border)", borderRadius: 999, overflow: "hidden" }}>
        <div
          style={{
            width: `${Math.round(value * 100)}%`,
            height: "100%",
            background: lead ? "var(--accent)" : "var(--text-dim)",
            borderRadius: 999,
          }}
        />
      </div>
      <span style={{ fontFamily: "var(--mono)", fontSize: 12, textAlign: "right", color: "var(--text-dim)" }}>
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

export function PolicyGate({ result }: { result: VerifyResult }) {
  const { gate, claim, evidence, policy, ground_truth } = result;
  const style = ACTION_STYLE[gate.action];

  // The baseline model's failure mode: claims "pass" on a board truth says to scrap.
  // Surface whether the gate agreed with the honest verdict so the catch is visible.
  const honestlyFails = ground_truth.disposition !== "pass";
  const claimedPass = result.claimed_disposition === "pass";
  const caught = claimedPass && honestlyFails && gate.action !== "SHIP";

  const probs = gate.probabilities;
  const order: SaplingLabel[] = probs
    ? (Object.keys(probs) as SaplingLabel[]).sort((a, b) => probs[b] - probs[a])
    : [];

  return (
    <section
      style={{
        background: "var(--panel)",
        border: `1px solid ${style.color}55`,
        borderRadius: "var(--radius)",
        padding: "var(--gap)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ margin: 0 }}>Policy gate</h2>
        <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--mono)" }}>
          Banyan&nbsp;Sapling
        </span>
      </div>

      {/* The decision, front and centre. */}
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 12,
            display: "grid",
            placeItems: "center",
            fontSize: 26,
            color: style.color,
            background: `${style.color}1f`,
            border: `1px solid ${style.color}`,
          }}
        >
          {style.glyph}
        </div>
        <div style={{ display: "grid", gap: 2 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: style.color }}>
            {gate.action} — {style.title}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
            Verdict: {gate.label ? LABEL_TEXT[gate.label] : "unavailable"}
            {gate.confidence != null && ` · ${Math.round(gate.confidence * 100)}% calibrated`}
            {gate.unsure && " · uncertain"}
          </div>
        </div>
      </div>

      <p style={{ margin: 0, color: "var(--text-dim)", fontSize: 13 }}>{gate.reason}</p>

      {caught && (
        <div
          style={{
            fontSize: 12,
            padding: "8px 10px",
            borderRadius: 8,
            color: "#f87171",
            background: "#f871711f",
            border: "1px solid #f8717155",
          }}
        >
          Caught it. The vision model claimed <b>pass</b>, but the board truly needs{" "}
          <b>{ground_truth.disposition}</b> ({ground_truth.worst}). Sapling blocked the ship.
        </div>
      )}

      {order.length > 0 && probs && (
        <div style={{ display: "grid", gap: 6 }}>
          {order.map((label) => (
            <ProbBar key={label} label={label} value={probs[label]} lead={label === gate.label} />
          ))}
          {gate.prediction_set && gate.prediction_set.length > 1 && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-dim)" }}>
              Conformal set keeps {gate.prediction_set.length} labels in play — calibrated uncertainty, not a guess.
            </p>
          )}
        </div>
      )}

      {/* What Sapling was actually given. The verification, in plain language. */}
      <details style={{ fontSize: 12, color: "var(--text-dim)" }}>
        <summary style={{ cursor: "pointer" }}>What the gate checked</summary>
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          <div>
            <b style={{ color: "var(--text)" }}>Claim</b> (from the vision model): {claim}
          </div>
          <div>
            <b style={{ color: "var(--text)" }}>Evidence</b> (from inspection): {evidence}
          </div>
          <div>
            <b style={{ color: "var(--text)" }}>Policy</b>: {policy}
          </div>
        </div>
      </details>
    </section>
  );
}
