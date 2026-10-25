import { useEffect, useRef, useState } from "react";
import { Button, GateChip, Panel, Stat } from "../../components/ui";
import { evolve, totalTraceLength } from "../core";
import type { EvolveOpts, Generation, Netlist } from "../core/types";
import {
  CURATED_NETLISTS,
  FOUNDRY_DRC_POLICY,
  FOUNDRY_LAYOUT_CLAIM,
  GOLDEN_EVOLVE,
  buildBoardEvidence,
  buildDeterministicGenerationNote,
  evaluateSaplingResponse,
  generateNetlistWithMeta,
  judgeGeneration,
  matchCuratedNetlist,
  replayGoldenEvolve,
  selectCachedSaplingResponse,
  withGenerationCommentary,
  type SaplingJudgeVerdict,
} from "../intel";
import { BoardCanvas } from "./BoardCanvas";
import { SaplingGateCard } from "./SaplingGateCard";
import { Sparkline } from "./Sparkline";

export interface RecordedGenerationEntry {
  generation: Generation;
  verdict: SaplingJudgeVerdict;
}

export interface EvolveViewProps {
  /** Cadence between streamed generations in ms (default: 1600ms for demo showmanship; tests pass 0). */
  stepIntervalMs?: number;
  /** Optional custom stream factory (for testing or custom engine injection). */
  streamFactory?: (netlist: Netlist, opts: EvolveOpts) => AsyncIterable<Generation>;
  /** Optional Mubit API key for live browser calls. */
  apiKey?: string;
  /** Default execution mode: "golden" (recorded real run) or "live" (live A* + Mubit + Sapling). */
  defaultSource?: "golden" | "live";
}

function computeInstantVerdict(gen: Generation): SaplingJudgeVerdict {
  const evidence = buildBoardEvidence(gen.board, { generationIndex: gen.index });
  const cached = selectCachedSaplingResponse(gen.board);
  return evaluateSaplingResponse(
    cached,
    { policy: FOUNDRY_DRC_POLICY, evidence, claim: FOUNDRY_LAYOUT_CLAIM },
    "cached",
  );
}

function buildInitialEntry(): RecordedGenerationEntry {
  const gen0 = GOLDEN_EVOLVE.generations[0];
  return {
    generation: gen0,
    verdict: computeInstantVerdict(gen0),
  };
}

export function EvolveView({
  stepIntervalMs = 1600,
  streamFactory,
  apiKey,
  defaultSource = "golden",
}: EvolveViewProps) {
  const [brief, setBrief] = useState<string>(GOLDEN_EVOLVE.brief);
  const [presetId, setPresetId] = useState<string>(GOLDEN_EVOLVE.presetId);
  const [sourceMode, setSourceMode] = useState<"golden" | "live">(defaultSource);
  const [cadenceMs, setCadenceMs] = useState<number>(stepIntervalMs);
  const [running, setRunning] = useState<boolean>(false);
  const [entries, setEntries] = useState<RecordedGenerationEntry[]>(() => [
    buildInitialEntry(),
  ]);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [specSource, setSpecSource] = useState<"golden" | "curated" | "mubit">("golden");

  const runTokenRef = useRef<number>(0);

  useEffect(() => {
    setCadenceMs(stepIntervalMs);
  }, [stepIntervalMs]);

  useEffect(() => {
    return () => {
      runTokenRef.current += 1;
    };
  }, []);

  const activeEntry =
    entries.find((e) => e.generation.index === selectedIdx) ??
    entries[entries.length - 1] ??
    buildInitialEntry();

  const prevEntry =
    entries.find((e) => e.generation.index === activeEntry.generation.index - 1) ?? null;

  const bestScore = entries.reduce(
    (best, item) => Math.max(best, item.generation.score),
    0,
  );

  function selectPreset(id: string) {
    const found = CURATED_NETLISTS.find((p) => p.id === id);
    if (!found) return;
    runTokenRef.current += 1;
    setRunning(false);
    setPresetId(found.id);
    setBrief(found.brief);
    if (found.id === GOLDEN_EVOLVE.presetId) {
      const init = buildInitialEntry();
      setEntries([init]);
      setSelectedIdx(init.generation.index);
      setSpecSource("golden");
    }
  }

  async function startEvolution(overrideSource?: "golden" | "live", overrideInterval?: number) {
    const modeToUse = overrideSource ?? sourceMode;
    const interval = overrideInterval ?? cadenceMs;
    const myToken = ++runTokenRef.current;

    setRunning(true);
    setEntries([]);
    setSelectedIdx(0);

    try {
      let netlist: Netlist = GOLDEN_EVOLVE.netlist;
      const matchedPreset = matchCuratedNetlist(brief);

      if (streamFactory) {
        setSpecSource("curated");
        netlist = matchedPreset.netlist;
      } else if (modeToUse === "live") {
        const specRes = await generateNetlistWithMeta(brief, {
          apiKey,
          offline: !apiKey,
        });
        if (runTokenRef.current !== myToken) return;
        netlist = specRes.netlist;
        setSpecSource(specRes.source);
      } else {
        netlist = matchedPreset.netlist;
        setSpecSource(
          matchedPreset.id === GOLDEN_EVOLVE.presetId ? "golden" : "curated",
        );
      }

      let stream: AsyncIterable<Generation>;
      if (streamFactory) {
        stream = streamFactory(netlist, { stepIntervalMs: interval });
      } else if (
        modeToUse === "golden" &&
        matchedPreset.id === GOLDEN_EVOLVE.presetId
      ) {
        stream = replayGoldenEvolve(netlist, { stepIntervalMs: interval });
      } else {
        const rawStream = evolve(netlist, {
          stepIntervalMs: interval,
          seed: 0xc01d,
          maxGenerations: 12,
        });
        stream = withGenerationCommentary(rawStream, {
          apiKey,
          offline: modeToUse !== "live" || !apiKey,
        });
      }

      let prevGen: Generation | undefined;
      for await (const gen of stream) {
        if (runTokenRef.current !== myToken) return;
        const note =
          gen.note && gen.note !== "stub generation"
            ? gen.note
            : buildDeterministicGenerationNote(gen, prevGen);
        const enrichedGen: Generation = { ...gen, note };
        const initialVerdict = computeInstantVerdict(enrichedGen);

        setEntries((prev) => {
          const filtered = prev.filter((item) => item.generation.index !== enrichedGen.index);
          return [...filtered, { generation: enrichedGen, verdict: initialVerdict }];
        });
        setSelectedIdx(enrichedGen.index);
        prevGen = enrichedGen;

        if (modeToUse === "live") {
          void judgeGeneration(enrichedGen, { offline: false, timeoutMs: 4000 }).then(
            (liveVerdict) => {
              if (runTokenRef.current !== myToken) return;
              setEntries((prev) =>
                prev.map((item) =>
                  item.generation.index === enrichedGen.index
                    ? { ...item, verdict: liveVerdict }
                    : item,
                ),
              );
            },
          );
        }
      }
    } finally {
      if (runTokenRef.current === myToken) {
        setRunning(false);
      }
    }
  }

  function stopEvolution() {
    runTokenRef.current += 1;
    setRunning(false);
  }

  const curGen = activeEntry.generation;
  const curVerdict = activeEntry.verdict;
  const wireCells = totalTraceLength(curGen.board);
  const activeViolationsCount = curGen.board.violations.length;

  return (
    <div className="foundry-mode-shell" data-testid="evolve-view">
      {/* Top Brief & Controls Bar */}
      <Panel title="Mode A — Evolve: Autonomous PCB Layout & Routing">
        <div className="stack">
          <div className="foundry-preset-row" role="group" aria-label="Curated circuit briefs">
            <span className="mono micro dim">PRESET BRIEFS:</span>
            {CURATED_NETLISTS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`code-chip foundry-preset-chip${preset.id === presetId ? " added" : ""}`}
                onClick={() => selectPreset(preset.id)}
              >
                {preset.title}
              </button>
            ))}
          </div>

          <div className="foundry-control-bar">
            <label className="grow foundry-brief-field">
              <span className="mono micro dim">MUBIT CIRCUIT BRIEF (ONE-LINE SPEC)</span>
              <input
                type="text"
                className="field mono small"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                aria-label="Circuit brief"
                placeholder="e.g. 3-stage RC power filter, 6 pads"
              />
            </label>

            <div className="hrow">
              <Button
                variant="primary"
                onClick={() => startEvolution(sourceMode)}
                disabled={running}
              >
                {running ? "Evolving Layout…" : "Run Evolve"}
              </Button>
              {running ? (
                <Button variant="ghost" onClick={stopEvolution}>
                  Stop
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => startEvolution("golden", 0)}
                  title="Load all golden generations immediately"
                >
                  Instant Replay
                </Button>
              )}
            </div>
          </div>

          <div className="spread foundry-meta-bar">
            <div className="hrow">
              <span className="mono micro dim">STREAM SOURCE:</span>
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
              <span className="mono micro dim">
                Netlist: <b>{specSource}</b> ({curGen.board.pads.length} pads,{" "}
                {curGen.board.traces.length} nets)
              </span>
            </div>

            <div className="hrow">
              <span className="mono micro dim">CADENCE:</span>
              {[
                { label: "Stage (1.6s)", ms: 1600 },
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
          <Panel title={`Evolutionary Substrate · Generation #${curGen.index}`}>
            {/* Hero KPI Strip */}
            <div className="foundry-kpi-strip">
              <div className="foundry-stamp-card">
                <span className="stat-label">Generation</span>
                <span className="stat-value" data-testid="evolve-gen-counter">
                  #{curGen.index} / {Math.max(curGen.index, entries.length - 1)}
                </span>
              </div>
              <div className="foundry-stamp-card highlight">
                <span className="stat-label">Best DRC Score</span>
                <span className="stat-value" data-testid="evolve-best-score">
                  {(bestScore * 100).toFixed(0)}%{" "}
                  <span className="mono xs dim">({bestScore.toFixed(2)})</span>
                </span>
              </div>
              <Stat
                label="Current Fitness"
                value={
                  <span>
                    {curGen.score.toFixed(2)}{" "}
                    <span className={curGen.delta >= 0 ? "good xs" : "bad xs"}>
                      ({curGen.delta >= 0 ? "+" : ""}
                      {curGen.delta.toFixed(2)})
                    </span>
                  </span>
                }
              />
              <Stat
                label="DRC Violations"
                value={
                  <span className={activeViolationsCount === 0 ? "good" : "bad"}>
                    {activeViolationsCount}
                  </span>
                }
              />
              <Stat label="Copper Cells" value={wireCells} />
            </div>

            {/* Live Mubit Designer Note Banner */}
            <div className="foundry-note-banner" role="status" aria-live="polite">
              <div className="spread">
                <span className="mono micro dim">
                  MUBIT DESIGNER COMMENTARY · GEN #{curGen.index}
                </span>
                <div className="hrow">
                  <span className="mono xs">
                    Sapling: <strong>{curVerdict.action}</strong>
                  </span>
                  <GateChip action={curVerdict.gateAction} />
                </div>
              </div>
              <p className="flush mono small" data-testid="evolve-active-note">
                “{curGen.note ?? "Routing generation…"}”
              </p>
            </div>

            {/* SVG Board Canvas */}
            <BoardCanvas
              board={curGen.board}
              previousBoard={prevEntry?.generation.board ?? null}
              stepKey={`evolve-${curGen.index}`}
              ariaLabel={`Evolve generation ${curGen.index} PCB layout`}
            />

            {/* Generation Scrubber Pills */}
            <div className="foundry-scrubber" role="tablist" aria-label="Generation history">
              <span className="mono micro dim">TIMELINE:</span>
              {entries.map((item) => {
                const g = item.generation;
                const active = g.index === curGen.index;
                return (
                  <button
                    key={g.index}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`foundry-step-pill${active ? " active" : ""}${
                      item.verdict.action === "SURVIVE" ? " ok" : ""
                    }`}
                    onClick={() => setSelectedIdx(g.index)}
                  >
                    <span className="mono xs">G{g.index}</span>
                    <span className="mono micro dim">{(g.score * 100).toFixed(0)}%</span>
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>

        <div className="rail">
          {/* Climbing Fitness Sparkline */}
          <Panel title="Fitness Climb">
            <Sparkline
              points={entries.map((e) => ({
                index: e.generation.index,
                score: e.generation.score,
                delta: e.generation.delta,
                action: e.verdict.action,
              }))}
              selectedIndex={curGen.index}
              onSelectPoint={setSelectedIdx}
            />
          </Panel>

          {/* Banyan Sapling Judge Verdict */}
          <SaplingGateCard verdict={curVerdict} mode="evolve" />

          {/* Chronological Mubit Generation Log */}
          <Panel title="Mubit Evolutionary Ledger">
            <div className="foundry-log-list" role="log" aria-label="Generation commentary log">
              {entries
                .slice()
                .reverse()
                .map(({ generation: g, verdict: v }) => (
                  <button
                    key={g.index}
                    type="button"
                    className={`foundry-log-item${g.index === curGen.index ? " selected" : ""}`}
                    onClick={() => setSelectedIdx(g.index)}
                  >
                    <div className="spread">
                      <span className="mono xs">
                        <strong>Gen #{g.index}</strong> · DRC {(g.score * 100).toFixed(0)}% (
                        {g.delta >= 0 ? "+" : ""}
                        {Math.round(g.delta * 100)}%)
                      </span>
                      <span
                        className={`mono micro foundry-action-tag ${v.gateAction.toLowerCase()}`}
                      >
                        {v.action}
                      </span>
                    </div>
                    <p className="flush small dim">{g.note}</p>
                  </button>
                ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
