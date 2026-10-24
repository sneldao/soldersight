import type { GateAction, SaplingLabel, VerifyResult } from "../types";

const ACTION_GLYPH: Record<GateAction, { glyph: string; title: string }> = {
  SHIP: { glyph: "✓", title: "Cleared to ship" },
  BLOCK: { glyph: "✕", title: "Ship blocked" },
  REVIEW: { glyph: "⚠", title: "Human review" },
};

const LABEL_TEXT: Record<SaplingLabel, string> = {
  supported: "Supported",
  violation: "Policy violation",
  insufficient_information: "Insufficient information",
  inconsistent_context: "Inconsistent context",
};

function ProbBar({ label, value, lead }: { label: SaplingLabel; value: number; lead: boolean }) {
  return (
    <div className="prob-row">
      <span className={`prob-name${lead ? " lead" : ""}`}>
        {LABEL_TEXT[label]}
      </span>
      <div className="prob-track">
        <div
          className={`prob-fill${lead ? " lead" : ""}`}
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <span className="prob-pct">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

export function PolicyGate({ result }: { result: VerifyResult }) {
  const { gate, claim, evidence, policy, ground_truth } = result;
  const glyph = ACTION_GLYPH[gate.action];
  const mode = gate.action.toLowerCase();

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
    <section className={`gate-panel ${mode}`}>
      <div className="spread">
        <h2>Policy gate</h2>
        <span className="mono micro dim">
          Banyan&nbsp;Sapling
        </span>
      </div>

      {/* The decision, front and centre. */}
      <div className="gate-row">
        <div className="gate-stamp">
          {glyph.glyph}
        </div>
        <div className="gate-copy">
          <div className="gate-title">
            {gate.action} — {glyph.title}
          </div>
          <div className="gate-sub">
            Verdict: {gate.label ? LABEL_TEXT[gate.label] : "unavailable"}
            {gate.confidence != null && ` · ${Math.round(gate.confidence * 100)}% calibrated`}
            {gate.unsure && " · uncertain"}
          </div>
        </div>
      </div>

      <p className="flush dim small">{gate.reason}</p>

      <div className="gate-evidence">
        evidence:{" "}
        {result.evidence_mode === "trace"
          ? "the model's own region notes — no answer key"
          : "AOI labels (oracle mode)"}
      </div>

      {caught && (
        <div className="gate-caught">
          Caught it. The vision model claimed <b>pass</b>, but the board truly needs{" "}
          <b>{ground_truth.disposition}</b> ({ground_truth.worst}). Sapling blocked the ship.
        </div>
      )}

      {order.length > 0 && probs && (
        <div className="prob-stack">
          {order.map((label) => (
            <ProbBar key={label} label={label} value={probs[label]} lead={label === gate.label} />
          ))}
          {gate.prediction_set && gate.prediction_set.length > 1 && (
            <p className="conformal">
              Conformal set keeps {gate.prediction_set.length} labels in play — calibrated uncertainty, not a guess.
            </p>
          )}
        </div>
      )}

      {/* What Sapling was actually given. The verification, in plain language. */}
      <details className="gate-detail">
        <summary>What the gate checked</summary>
        <div className="stack">
          <div>
            <b>Claim</b> (from the vision model): {claim}
          </div>
          <div>
            <b>Evidence</b> (from inspection): {evidence}
          </div>
          <div>
            <b>Policy</b>: {policy}
          </div>
        </div>
      </details>
    </section>
  );
}
