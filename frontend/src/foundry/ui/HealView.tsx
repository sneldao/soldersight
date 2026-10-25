import { useEffect, useRef, useState } from "react";
import { Button, GateChip, Panel, Stat } from "../../components/ui";
import { heal } from "../core";
import type { BoardState, HealOpts, RepairStep, Violation } from "../core/types";
import {
  GOLDEN_HEAL,
  buildDeterministicRepairNote,
  judgeBoard,
  replayGoldenHeal,
  selectCachedSaplingResponse,
  evaluateSaplingResponse,
  buildBoardEvidence,
  FOUNDRY_DRC_POLICY,
  FOUNDRY_LAYOUT_CLAIM,
  withRepairCommentary,
  type SaplingJudgeVerdict,
} from "../intel";
import { BoardCanvas } from "./BoardCanvas";
import { SaplingGateCard } from "./SaplingGateCard";
import { Sparkline } from "./Sparkline";

export interface RecordedRepairEntry {
  stepIndex: number; // 1-based index of repair step
  step: RepairStep;
  verdict: SaplingJudgeVerdict;
}

export interface HealViewProps {
  /** Cadence between streamed repair steps in ms (default: 1800ms; tests pass 0). */
  stepIntervalMs?: number;
  /** Optional custom stream factory (for testing or custom engine injection). */
  streamFactory?: (board: BoardState, opts: HealOpts) => AsyncIterable<RepairStep>;
  /** Optional Mubit API key for live browser calls. */
  apiKey?: string;
  /** Default execution mode: "golden" or "live". */
  defaultSource?: "golden" | "live";
}

function computeSyncVerdict(board: BoardState): SaplingJudgeVerdict {
  const evidence = buildBoardEvidence(board, { boardId: GOLDEN_HEAL.boardId });
  const raw = selectCachedSaplingResponse(board);
  return evaluateSaplingResponse(
    raw,
    { policy: FOUNDRY_DRC_POLICY, evidence, claim: FOUNDRY_LAYOUT_CLAIM },
    "cached",
  );
}

export function HealView({
  stepIntervalMs = 1800,
  streamFactory,
  apiKey,
  defaultSource = "golden",
}: HealViewProps) {
  const initialBoard = GOLDEN_HEAL.initialBoard;
  const totalDefectsCount = Math.max(
    GOLDEN_HEAL.steps.length,
    initialBoard.violations.length,
    initialBoard.defects?.length ?? 0,
  );

  const [sourceMode, setSourceMode] = useState<"golden" | "live">(defaultSource);
  const [cadenceMs, setCadenceMs] = useState<number>(stepIntervalMs);
  const [healing, setHealing] = useState<boolean>(false);
  const [steps, setSteps] = useState<RecordedRepairEntry[]>([]);
  /** 0 = initial broken board; 1..N = after repair step k */
  const [selectedStep, setSelectedStep] = useState<number>(0);
  const [inspectPhase, setInspectPhase] = useState<"after" | "before">("after");
  const [showPhotoUnderlay, setShowPhotoUnderlay] = useState<boolean>(true);
  const [initialVerdict] = useState<SaplingJudgeVerdict>(() =>
    computeSyncVerdict(initialBoard),
  );

  const runTokenRef = useRef<number>(0);

  useEffect(() => {
    setCadenceMs(stepIntervalMs);
  }, [stepIntervalMs]);

  useEffect(() => {
    return () => {
      runTokenRef.current += 1;
    };
  }, []);

  const activeRepairEntry =
    selectedStep > 0
      ? (steps.find((s) => s.stepIndex === selectedStep) ?? steps[steps.length - 1] ?? null)
      : null;

  const displayedBoard: BoardState = activeRepairEntry
    ? inspectPhase === "before"
      ? activeRepairEntry.step.before
      : activeRepairEntry.step.after
    : initialBoard;

  const previousBoard: BoardState | null = activeRepairEntry
    ? activeRepairEntry.step.before
    : null;

  const displayedVerdict: SaplingJudgeVerdict = activeRepairEntry
    ? inspectPhase === "before"
      ? computeSyncVerdict(activeRepairEntry.step.before)
      : activeRepairEntry.verdict
    : initialVerdict;

  // Defects healed up to and including the currently viewed step
  const healedDefects: Violation[] =
    selectedStep > 0 && inspectPhase === "after"
      ? steps
          .filter((s) => s.stepIndex <= selectedStep && s.step.verified !== false)
          .map((s) => s.step.defect)
      : selectedStep > 1 && inspectPhase === "before"
        ? steps
            .filter((s) => s.stepIndex < selectedStep && s.step.verified !== false)
            .map((s) => s.step.defect)
        : [];

  const healedCount = steps.filter((s) => s.step.verified !== false).length;
  const viewedHealedCount = healedDefects.length;

  async function startHeal(overrideSource?: "golden" | "live", overrideInterval?: number) {
    const modeToUse = overrideSource ?? sourceMode;
    const interval = overrideInterval ?? cadenceMs;
    const myToken = ++runTokenRef.current;

    setHealing(true);
    setSteps([]);
    setSelectedStep(0);
    setInspectPhase("after");

    try {
      let stream: AsyncIterable<RepairStep>;
      if (streamFactory) {
        stream = streamFactory(initialBoard, { stepIntervalMs: interval });
      } else if (modeToUse === "golden") {
        stream = replayGoldenHeal(initialBoard, { stepIntervalMs: interval });
      } else {
        const rawHeal = heal(initialBoard, {
          stepIntervalMs: interval,
          seed: 0xbea7,
        });
        stream = withRepairCommentary(rawHeal, {
          apiKey,
          offline: !apiKey,
        });
      }

      let idx = 0;
      for await (const rawStep of stream) {
        if (runTokenRef.current !== myToken) return;
        idx += 1;
        const note =
          rawStep.note && rawStep.note !== "stub repair"
            ? rawStep.note
            : buildDeterministicRepairNote(rawStep);
        const enrichedStep: RepairStep = {
          ...rawStep,
          note,
          verified: rawStep.verified ?? true,
        };
        const instantVerdict = computeSyncVerdict(enrichedStep.after);

        const entry: RecordedRepairEntry = {
          stepIndex: idx,
          step: enrichedStep,
          verdict: instantVerdict,
        };
        setSteps((prev) => [...prev.filter((p) => p.stepIndex !== idx), entry]);
        setSelectedStep(idx);

        if (modeToUse === "live") {
          const stepNumber = idx;
          void judgeBoard(
            enrichedStep.after,
            { offline: false, timeoutMs: 4000 },
            { boardId: GOLDEN_HEAL.boardId },
          ).then((liveVerdict) => {
            if (runTokenRef.current !== myToken) return;
            setSteps((prev) =>
              prev.map((p) =>
                p.stepIndex === stepNumber ? { ...p, verdict: liveVerdict } : p,
              ),
            );
          });
        }
      }
    } finally {
      if (runTokenRef.current === myToken) {
        setHealing(false);
      }
    }
  }

  function resetToBroken() {
    runTokenRef.current += 1;
    setHealing(false);
    setSteps([]);
    setSelectedStep(0);
    setInspectPhase("after");
  }

  const sparkPoints = [
    {
      index: 0,
      score: initialBoard.score,
      action: initialVerdict.action,
    },
    ...steps.map((s) => ({
      index: s.stepIndex,
      score: s.step.after.score,
      action: s.verdict.action,
    })),
  ];

  return (
    <div className="foundry-mode-shell" data-testid="heal-view">
      {/* Top Controls Bar */}
      <Panel title={`Mode B — Heal: ${GOLDEN_HEAL.title}`}>
        <div className="stack">
          <div className="spread foundry-control-bar">
            <div className="stack" style={{ gap: 4 }}>
              <div className="hrow">
                <span className="code-chip added mono xs">
                  DeepPCB Board {GOLDEN_HEAL.boardId}
                </span>
                <span className="dim small">
                  Triage flagged critical short + open defects — autonomous A* repair turns red → green.
                </span>
              </div>
            </div>

            <div className="hrow">
              <Button
                variant="primary"
                onClick={() => startHeal(sourceMode)}
                disabled={healing}
              >
                {healing ? "Healing Defects…" : "Heal Board"}
              </Button>
              {!healing && (
                <Button
                  variant="ghost"
                  onClick={() => startHeal("golden", 0)}
                  title="Apply all golden repair steps immediately"
                >
                  Instant Heal
                </Button>
              )}
              {(steps.length > 0 || healing) && (
                <Button variant="ghost" onClick={resetToBroken}>
                  Reset to Defective
                </Button>
              )}
            </div>
          </div>

          <div className="spread foundry-meta-bar">
            <div className="hrow">
              <span className="mono micro dim">REPAIR ENGINE:</span>
              <button
                type="button"
                className={`code-chip${sourceMode === "golden" ? " added" : ""}`}
                onClick={() => setSourceMode("golden")}
              >
                Golden Replay (Offline)
              </button>
              <button
                type="button"
                className={`code-chip${sourceMode === "live" ? " added" : ""}`}
                onClick={() => setSourceMode("live")}
              >
                Run Live Engine (A* + Mubit)
              </button>

              <label className="mini-pick small" style={{ marginLeft: 8 }}>
                <input
                  type="checkbox"
                  checked={showPhotoUnderlay}
                  onChange={(e) => setShowPhotoUnderlay(e.target.checked)}
                />
                Show DeepPCB {GOLDEN_HEAL.boardId} AOI photo underlay
              </label>
            </div>

            <div className="hrow">
              <span className="mono micro dim">CADENCE:</span>
              {[
                { label: "Stage (1.8s)", ms: 1800 },
                { label: "Fast (0.5s)", ms: 500 },
                { label: "Instant (0s)", ms: 0 },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  className={`code-chip${cadenceMs === opt.ms ? " added" : ""}`}
                  onClick={() => setCadenceMs(opt.ms)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      {/* Main 2-column workspace */}
      <div className="columns">
        <div className="main-col">
          <Panel
            title={
              selectedStep === 0
                ? `Board ${GOLDEN_HEAL.boardId} · Defective State (0 / ${totalDefectsCount} Healed)`
                : `Board ${GOLDEN_HEAL.boardId} · Repair Step #${selectedStep} (${viewedHealedCount} / ${totalDefectsCount} Healed)`
            }
          >
            {/* Hero KPI Strip with N / M Defects Healed Stamp */}
            <div className="foundry-kpi-strip">
              <div
                className={`foundry-stamp-card ${
                  viewedHealedCount >= totalDefectsCount ? "ok-stamp" : "highlight"
                }`}
              >
                <span className="stat-label">Defects Healed</span>
                <span className="stat-value" data-testid="heal-defect-counter">
                  {viewedHealedCount} / {totalDefectsCount} defects healed
                </span>
              </div>

              <Stat
                label="DRC Fitness"
                value={
                  <span className={displayedBoard.score >= 0.95 ? "good" : ""}>
                    {(displayedBoard.score * 100).toFixed(0)}% ({displayedBoard.score.toFixed(2)})
                  </span>
                }
              />

              <Stat
                label="Remaining Violations"
                value={
                  <span
                    className={displayedBoard.violations.length === 0 ? "good" : "bad"}
                  >
                    {displayedBoard.violations.length}
                  </span>
                }
              />

              <Stat
                label="Sapling Gate"
                value={<GateChip action={displayedVerdict.gateAction} />}
              />
            </div>

            {/* Active Repair Commentary / ECO Banner */}
            <div className="foundry-note-banner" role="status" aria-live="polite">
              <div className="spread">
                <span className="mono micro dim">
                  {activeRepairEntry
                    ? `MUBIT ECO #${activeRepairEntry.stepIndex} · ${activeRepairEntry.step.defect.kind.toUpperCase()} @ (${activeRepairEntry.step.defect.at[0]},${activeRepairEntry.step.defect.at[1]})`
                    : `INITIAL AOI TRIAGE · ${totalDefectsCount} CRITICAL DEFECTS DETECTED`}
                </span>
                {activeRepairEntry && (
                  <div className="hrow">
                    <button
                      type="button"
                      className={`code-chip${inspectPhase === "before" ? " added" : ""}`}
                      onClick={() => setInspectPhase("before")}
                    >
                      Before Step
                    </button>
                    <button
                      type="button"
                      className={`code-chip${inspectPhase === "after" ? " added" : ""}`}
                      onClick={() => setInspectPhase("after")}
                    >
                      After Fix (Green)
                    </button>
                  </div>
                )}
              </div>
              <p className="flush mono small" data-testid="heal-active-note">
                {activeRepairEntry
                  ? `“${activeRepairEntry.step.note}”`
                  : "“Board 00041004 entered from Triage with a bridged short at (7,4), an open clock line at (13,7), and a spacing violation at (5,9).”"}
              </p>
              {activeRepairEntry && (
                <div className="mono micro dim">
                  Engine op: <b>{activeRepairEntry.step.action}</b> · DRC{" "}
                  {(activeRepairEntry.step.before.score * 100).toFixed(0)}% →{" "}
                  <strong className="good">
                    {(activeRepairEntry.step.after.score * 100).toFixed(0)}%
                  </strong>
                </div>
              )}
            </div>

            {/* Board Canvas with Red -> Green Markers + Optional DeepPCB Photo */}
            <BoardCanvas
              board={displayedBoard}
              previousBoard={previousBoard}
              healedDefects={healedDefects}
              activeDefect={activeRepairEntry?.step.defect ?? null}
              backgroundImageUrl={GOLDEN_HEAL.image}
              showPhotoUnderlay={showPhotoUnderlay}
              stepKey={`heal-${selectedStep}-${inspectPhase}`}
              ariaLabel={`Heal board ${GOLDEN_HEAL.boardId} step ${selectedStep}`}
            />

            {/* Step Scrubber Bar */}
            <div className="foundry-scrubber" role="tablist" aria-label="Repair step timeline">
              <span className="mono micro dim">REPAIR STEPS:</span>
              <button
                type="button"
                role="tab"
                aria-selected={selectedStep === 0}
                className={`foundry-step-pill${selectedStep === 0 ? " active" : ""}`}
                onClick={() => {
                  setSelectedStep(0);
                  setInspectPhase("after");
                }}
              >
                <span className="mono xs">0: Defective</span>
                <span className="mono micro bad">0/{totalDefectsCount}</span>
              </button>
              {steps.map((s) => {
                const active = selectedStep === s.stepIndex;
                return (
                  <button
                    key={s.stepIndex}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`foundry-step-pill ok${active ? " active" : ""}`}
                    onClick={() => {
                      setSelectedStep(s.stepIndex);
                      setInspectPhase("after");
                    }}
                  >
                    <span className="mono xs">
                      #{s.stepIndex}: {s.step.defect.kind} ({s.step.defect.at[0]},
                      {s.step.defect.at[1]})
                    </span>
                    <span className="mono micro good">✓ Healed</span>
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>

        <div className="rail">
          {/* Repair Fitness Recovery Curve */}
          <Panel title="DRC Recovery Curve">
            <Sparkline
              title="Board 00041004 DRC Recovery"
              points={sparkPoints}
              selectedIndex={selectedStep}
              onSelectPoint={(idx) => {
                setSelectedStep(idx);
                setInspectPhase("after");
              }}
            />
          </Panel>

          {/* Banyan Sapling Policy Gate (BLOCK -> SHIP) */}
          <SaplingGateCard verdict={displayedVerdict} mode="heal" />

          {/* Engineering Change Order (ECO) Ledger */}
          <Panel
            title={`Engineering Change Orders (${healedCount} / ${totalDefectsCount} Healed)`}
          >
            {steps.length === 0 ? (
              <p className="flush dim small">
                Click <b>Heal Board</b> to stream autonomous A* copper repairs and flip each
                defect from red to green.
              </p>
            ) : (
              <div className="foundry-log-list" role="log" aria-label="Repair step log">
                {steps.map((entry) => {
                  const { stepIndex, step } = entry;
                  const active = selectedStep === stepIndex;
                  return (
                    <button
                      key={stepIndex}
                      type="button"
                      className={`foundry-log-item${active ? " selected" : ""}`}
                      onClick={() => {
                        setSelectedStep(stepIndex);
                        setInspectPhase("after");
                      }}
                    >
                      <div className="spread">
                        <span className="mono xs">
                          <strong>
                            Step #{stepIndex}: {step.defect.kind.toUpperCase()}
                          </strong>{" "}
                          @ ({step.defect.at[0]},{step.defect.at[1]})
                        </span>
                        <span className="mono micro foundry-action-tag ship">
                          {step.verified !== false ? "✓ HEALED" : "PARTIAL"}
                        </span>
                      </div>
                      <div className="mono micro dim">{step.action}</div>
                      <p className="flush small">{step.note}</p>
                      <div className="mono micro dim">
                        DRC fitness: {(step.before.score * 100).toFixed(0)}% →{" "}
                        <strong className="good">
                          {(step.after.score * 100).toFixed(0)}%
                        </strong>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
