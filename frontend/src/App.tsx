import { useEffect, useState } from "react";
import { fetchBoards, fetchRules, triage, triageBoard, verifyBoard } from "./api";
import { boardDisposition, DISPOSITION_COLORS } from "./colors";
import { BenchmarkPanel } from "./components/BenchmarkPanel";
import { BoardView } from "./components/BoardView";
import { CameraCapture } from "./components/CameraCapture";
import { ComparePanel } from "./components/ComparePanel";
import { CorrectionForm } from "./components/CorrectionForm";
import { PolicyGate } from "./components/PolicyGate";
import { RegionCards } from "./components/RegionCards";
import { RulesPanel } from "./components/RulesPanel";
import { Badge, Button, ErrorPanel, GateChip, Panel, Stat } from "./components/ui";
import { LANES, LANE_COPY } from "./laneTable";
import type { Board, Inspection, RegionResult, Rules, VerifyResult } from "./types";

// Ticks while a call is in flight — feedback reads as speed.
function Elapsed({ active }: { active: boolean }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    setT(0);
    const id = setInterval(() => setT((v) => v + 0.1), 100);
    return () => clearInterval(id);
  }, [active]);
  if (!active) return null;
  return <span className="elapsed">{t.toFixed(1)}s</span>;
}

// A filmstrip of the dataset boards, each dotted with its labelled disposition.
function BoardStrip({
  boards,
  selectedId,
  onSelect,
}: {
  boards: Board[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="thumb-strip" role="listbox" aria-label="Boards">
      {boards.map((b) => {
        const disposition = boardDisposition(b.annotations.map((a) => a.type));
        return (
          <button
            key={b.id}
            type="button"
            role="option"
            aria-selected={b.id === selectedId}
            aria-label={`Board ${b.id}, labelled ${disposition}`}
            className={`thumb${b.id === selectedId ? " selected" : ""}`}
            onClick={() => onSelect(b.id)}
          >
            <img src={b.testUrl} alt={`Board ${b.id}`} loading="lazy" />
            <span className="row">
              <span className="id">{b.id}</span>
              <span
                className="dot"
                title={`labels: ${disposition}`}
                style={{ background: DISPOSITION_COLORS[disposition] }}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Pulsing placeholders where the region cards will land.
function RegionSkeletons({ count }: { count: number }) {
  return (
    <div className="region-grid" aria-label="Classifying regions">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton region-skel" />
      ))}
    </div>
  );
}

export default function App() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lane, setLane] = useState<string>(LANES[0]);
  const [showDefects, setShowDefects] = useState(true);
  const [result, setResult] = useState<Inspection | null>(null);
  const [subject, setSubject] = useState<RegionResult | null>(null);
  const [rules, setRules] = useState<Rules | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchBoards(), fetchRules()])
      .then(([list, loaded]) => {
        setBoards(list);
        setRules(loaded);
        if (list.length) setSelectedId(list[0].id);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const selected = boards.find((b) => b.id === selectedId) ?? null;

  async function run(call: () => Promise<Inspection>) {
    setBusy(true);
    setError(null);
    setVerifyResult(null);
    setSubject(null);
    try {
      setResult(await call());
    } catch (err) {
      setError(err instanceof Error ? err.message : "triage failed");
    } finally {
      setBusy(false);
    }
  }

  function triageSelected() {
    if (!selected) return;
    run(() => triageBoard(selected.id, lane));
  }

  function capture(blob: Blob) {
    run(() => triage(blob, "camera.jpg", lane, templateFile));
  }

  async function verify() {
    if (!selected || !result) return;
    setVerifying(true);
    setError(null);
    try {
      setVerifyResult(await verifyBoard(selected.id, result));
    } catch (err) {
      setError(err instanceof Error ? err.message : "verify failed");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <main className="shell">
      <header className="masthead">
        <h1>SolderSight</h1>
        <span className="tagline">PCB defect triage · Mubit × Banyan</span>
      </header>

      {error && <ErrorPanel message={error} onDismiss={() => setError(null)} />}

      <div className="hrow">
        <span className="dim small">Task lane</span>
        {LANES.map((name) => (
          <Button
            key={name}
            variant={name === lane ? "primary" : "ghost"}
            onClick={() => setLane(name)}
          >
            {name}
          </Button>
        ))}
        <span className="dim small">{LANE_COPY[lane]}</span>
      </div>

      <div className="columns">
        <div className="main-col">
          <Panel title="Board">
            <BoardStrip boards={boards} selectedId={selectedId} onSelect={setSelectedId} />
            {selected && <BoardView board={selected} showDefects={showDefects} />}
            <label className="mini-pick">
              <input
                type="checkbox"
                checked={showDefects}
                onChange={(e) => setShowDefects(e.target.checked)}
              />
              Show defect annotations
            </label>
          </Panel>

          {(busy || result) && selected && (
            <Panel title={`Crops the ${result?.lane ?? lane} task was asked about`}>
              <div className="stack">
                {result && (
                  <>
                    <div className="hrow">
                      <Badge type={result.defect_type} />
                      <strong>{result.disposition}</strong>
                      {verifyResult && <GateChip action={verifyResult.gate.action} />}
                      <span className="dim small">
                        board verdict = its worst confident region
                      </span>
                    </div>
                    {result.caveat && (
                      <p className="flush warn-line small">⚠ {result.caveat}</p>
                    )}
                    {result.region_errors != null && (
                      <p className="flush bad small">
                        {result.region_errors} crop call{result.region_errors > 1 ? "s" : ""} failed —
                        verdict excludes them
                      </p>
                    )}
                  </>
                )}
                {busy ? (
                  <RegionSkeletons count={result?.regions.length || 5} />
                ) : (
                  result && (
                    <RegionCards
                      boardId={selected.id}
                      regions={result.regions}
                      picked={subject}
                      onPick={setSubject}
                    />
                  )
                )}
                {result && (
                  <div className="stat-grid">
                    <Stat label="Mubit calls" value={result.metrics.calls} />
                    <Stat label="Latency" value={`${result.metrics.latency_ms}ms`} />
                    <Stat label="Tokens" value={result.metrics.total_tokens} />
                    <Stat label="Cost" value={`$${result.metrics.cost_usd}`} />
                  </div>
                )}
              </div>
            </Panel>
          )}
        </div>

        <div className="rail">
          <Panel title="Triage">
            <div className="hrow">
              <Button onClick={triageSelected} disabled={!selected || busy}>
                {busy ? "Classifying…" : `Triage selected board (${lane})`}
              </Button>
              <Elapsed active={busy} />
            </div>
            <label className="mini-label">
              Reference template for camera triage (optional — enables the defect diff)
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setTemplateFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <CameraCapture onCapture={capture} disabled={busy} />
            {result && (
              <div className="stack">
                <Badge type={result.defect_type} />
                <div className="pivot-grid">
                  <Stat label="Severity" value={result.severity} />
                  <Stat label="Disposition" value={result.disposition} />
                  <Stat label="Confidence" value={`${Math.round(result.confidence * 100)}%`} />
                  <Stat label="Crops" value={result.regions.length} />
                </div>
                <p className="flush dim">{result.reason}</p>
                {selected && result.board_id && (
                  <Button variant="ghost" onClick={verify} disabled={verifying}>
                    {verifying
                      ? "Verifying against policy…"
                      : "Verify against policy gate →"}
                  </Button>
                )}
              </div>
            )}
          </Panel>

          {verifyResult && <PolicyGate result={verifyResult} />}

          <RulesPanel rules={rules} onChanged={setRules} />

          {result && selected && (
            <CorrectionForm
              boardId={selected.id}
              original={subject && !subject.error ? subject : result}
              rules={rules}
              onCorrected={setRules}
            />
          )}
        </div>
      </div>

      <ComparePanel boardId={selectedId} />
      <BenchmarkPanel />
    </main>
  );
}
