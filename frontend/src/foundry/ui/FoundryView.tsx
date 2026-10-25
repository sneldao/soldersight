import { useState } from "react";
import { Button } from "../../components/ui";
import { DEMO_BEATS, GOLDEN_RUN, type DemoBeat } from "../intel";
import { EvolveView } from "./EvolveView";
import { HealView } from "./HealView";

export type FoundryMode = "evolve" | "heal" | "split";

export interface FoundryViewProps {
  initialMode?: FoundryMode;
  stepIntervalMs?: number;
}

export function FoundryView({
  initialMode = "evolve",
  stepIntervalMs,
}: FoundryViewProps) {
  const [mode, setMode] = useState<FoundryMode>(initialMode);
  const [activeBeatId, setActiveBeatId] = useState<DemoBeat["id"]>("evolve");
  const [showScript, setShowScript] = useState<boolean>(true);
  const [apiKey, setApiKey] = useState<string>("");

  const activeBeat =
    DEMO_BEATS.find((b) => b.id === activeBeatId) ?? DEMO_BEATS[0];

  function selectBeat(beat: DemoBeat) {
    setActiveBeatId(beat.id);
    if (beat.mode === "evolve") setMode("evolve");
    else if (beat.mode === "heal") setMode("heal");
    else setMode("split");
  }

  return (
    <div className="foundry-root stack-lg" data-testid="foundry-view">
      {/* Foundry Header & Mode Switcher */}
      <section className="panel foundry-header-panel">
        <div className="spread">
          <div className="stack" style={{ gap: 4 }}>
            <div className="hrow">
              <h2>SolderSight Foundry — Autonomous PCB Engine</h2>
              <span className="code-chip added mono micro">
                A* + DRC × Mubit ({GOLDEN_RUN.mubitModel}) × Banyan Sapling
              </span>
            </div>
            <p className="flush dim small">
              Deterministic A* geometry &amp; IPC-2221 DRC paired with Mubit creative
              direction and Banyan Sapling calibrated conformal gating.
            </p>
          </div>

          <div className="hrow" role="tablist" aria-label="Foundry modes">
            <Button
              variant={mode === "evolve" ? "primary" : "ghost"}
              role="tab"
              aria-selected={mode === "evolve"}
              onClick={() => setMode("evolve")}
            >
              Mode A · Evolve
            </Button>
            <Button
              variant={mode === "heal" ? "primary" : "ghost"}
              role="tab"
              aria-selected={mode === "heal"}
              onClick={() => setMode("heal")}
            >
              Mode B · Heal (00041004)
            </Button>
            <Button
              variant={mode === "split" ? "primary" : "ghost"}
              role="tab"
              aria-selected={mode === "split"}
              onClick={() => setMode("split")}
            >
              Split View (A + B)
            </Button>
          </div>
        </div>

        {/* 2-Minute Demo Beat Bar */}
        <div className="foundry-beat-bar">
          <div className="spread">
            <div className="hrow">
              <span className="mono micro dim">STAGE RUNBOOK (2:00):</span>
              {DEMO_BEATS.map((beat, idx) => (
                <button
                  key={beat.id}
                  type="button"
                  className={`code-chip${beat.id === activeBeatId ? " added" : ""}`}
                  onClick={() => selectBeat(beat)}
                >
                  <span className="mono xs">
                    Beat {idx + 1} ({beat.window})
                  </span>
                </button>
              ))}
            </div>

            <div className="hrow">
              <button
                type="button"
                className="code-chip mono micro"
                onClick={() => setShowScript((v) => !v)}
              >
                {showScript ? "Hide Cue Card" : "Show Cue Card"}
              </button>
            </div>
          </div>

          {showScript && (
            <div className="foundry-cue-card">
              <div className="spread">
                <span className="mono xs">
                  <strong>{activeBeat.title}</strong> ·{" "}
                  <span className="dim">{activeBeat.window}</span>
                </span>
                <span className="mono micro dim">Cue: {activeBeat.cue}</span>
              </div>
              <p className="flush small dim">{activeBeat.narration}</p>
            </div>
          )}

          <details className="gate-detail">
            <summary className="mono micro dim">
              Live API &amp; Provenance Settings (Sapling SHA256:{" "}
              {GOLDEN_RUN.saplingWeightsSha256.slice(0, 12)}…)
            </summary>
            <div className="hrow" style={{ marginTop: 8 }}>
              <label className="grow mini-label">
                <span>
                  Optional Mubit API Key for live browser calls (leave empty to use
                  recorded Golden Run / deterministic fallback)
                </span>
                <input
                  type="password"
                  className="field mono xs"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-mubit-..."
                />
              </label>
            </div>
          </details>
        </div>
      </section>

      {/* Active Mode Content */}
      {mode === "evolve" && (
        <EvolveView
          stepIntervalMs={stepIntervalMs}
          apiKey={apiKey || undefined}
        />
      )}

      {mode === "heal" && (
        <HealView
          stepIntervalMs={stepIntervalMs}
          apiKey={apiKey || undefined}
        />
      )}

      {mode === "split" && (
        <div className="foundry-split-grid">
          <EvolveView
            stepIntervalMs={stepIntervalMs}
            apiKey={apiKey || undefined}
          />
          <HealView
            stepIntervalMs={stepIntervalMs}
            apiKey={apiKey || undefined}
          />
        </div>
      )}
    </div>
  );
}
