import { GateChip } from "../../components/ui";
import type { SaplingJudgeVerdict, SaplingLabel } from "../intel";

const LABEL_NAMES: Record<SaplingLabel, string> = {
  supported: "Supported",
  violation: "Policy violation",
  insufficient_information: "Insufficient info",
  inconsistent_context: "Inconsistent context",
};

const JUDGE_BADGE_COPY: Record<
  SaplingJudgeVerdict["action"],
  { glyph: string; title: string; toneClass: string }
> = {
  SURVIVE: {
    glyph: "✓",
    title: "SURVIVE — Certified Clean",
    toneClass: "ship",
  },
  PRUNE: {
    glyph: "✕",
    title: "PRUNE — Critical Violation",
    toneClass: "block",
  },
  MUTATE: {
    glyph: "↻",
    title: "MUTATE — Continue Evolving",
    toneClass: "review",
  },
};

export interface SaplingGateCardProps {
  verdict: SaplingJudgeVerdict;
  mode?: "evolve" | "heal";
}

export function SaplingGateCard({ verdict, mode = "evolve" }: SaplingGateCardProps) {
  const badge = JUDGE_BADGE_COPY[verdict.action];
  const probs = verdict.probabilities;
  const orderedLabels: SaplingLabel[] = probs
    ? (Object.keys(probs) as SaplingLabel[]).sort((a, b) => probs[b] - probs[a])
    : [];

  const violationRiskPct =
    probs?.violation != null ? (probs.violation * 100).toFixed(1) : null;

  return (
    <section
      className={`gate-panel ${badge.toneClass}`}
      aria-label="Banyan Sapling validity gate"
    >
      <div className="spread">
        <h2>{mode === "heal" ? "Post-Repair Policy Gate" : "Sapling Taste & Validity Gate"}</h2>
        <div className="hrow">
          <GateChip action={verdict.gateAction} />
          <span className="mono micro dim">
            Banyan&nbsp;Sapling ({verdict.source})
          </span>
        </div>
      </div>

      <div className="gate-row">
        <div className="gate-stamp" aria-hidden="true">
          {badge.glyph}
        </div>
        <div className="gate-copy">
          <div className="gate-title">
            {mode === "heal"
              ? `${verdict.gateAction} — ${verdict.gateAction === "SHIP" ? "Cleared to ship" : "Blocked from ship"}`
              : badge.title}
          </div>
          <div className="gate-sub">
            Verdict: {verdict.label ? LABEL_NAMES[verdict.label] : "unavailable"}
            {verdict.confidence != null &&
              ` · ${(verdict.confidence * 100).toFixed(1)}% calibrated`}
            {violationRiskPct != null && ` · ${violationRiskPct}% violation risk`}
          </div>
        </div>
      </div>

      <p className="flush dim small">{verdict.reason}</p>

      {orderedLabels.length > 0 && probs && (
        <div className="prob-stack">
          {orderedLabels.map((label) => {
            const val = probs[label] ?? 0;
            const lead = label === verdict.label;
            return (
              <div key={label} className="prob-row">
                <span className={`prob-name${lead ? " lead" : ""}`}>
                  {LABEL_NAMES[label]}
                </span>
                <div className="prob-track">
                  <div
                    className={`prob-fill${lead ? " lead" : ""}`}
                    style={{ width: `${Math.round(val * 100)}%` }}
                  />
                </div>
                <span className="prob-pct">{(val * 100).toFixed(1)}%</span>
              </div>
            );
          })}
          {verdict.predictionSet.length > 1 && (
            <p className="conformal">
              Conformal prediction set keeps {verdict.predictionSet.length} labels in play —
              survival requires &lt;15% calibrated violation risk.
            </p>
          )}
        </div>
      )}

      <details className="gate-detail">
        <summary>What Banyan Sapling verified</summary>
        <div className="stack">
          <div>
            <b>Claim</b>: {verdict.claim}
          </div>
          <div>
            <b>DRC Evidence</b>: {verdict.evidence}
          </div>
          <div>
            <b>Policy</b>: {verdict.policy}
          </div>
        </div>
      </details>
    </section>
  );
}
