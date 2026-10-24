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
  return (
    <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-dim)" }}>
      {t.toFixed(1)}s
    </span>
  );
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
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
        gap: 12,
      }}
      aria-label="Classifying regions"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton" style={{ aspectRatio: "1 / 1.2" }} />
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
    <main style={{ maxWidth: 1400, margin: "0 auto", padding: 24, display: "grid", gap: 20 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 22 }}>SolderSight</h1>
        <span style={{ color: "var(--text-dim)", fontFamily: "var(--mono)", fontSize: 13 }}>
          PCB defect triage · Mubit × Banyan
        </span>
      </header>

      {error && <ErrorPanel message={error} onDismiss={() => setError(null)} />}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ color: "var(--text-dim)", fontSize: 13 }}>Task lane</span>
        {LANES.map((name) => (
          <Button
            key={name}
            variant={name === lane ? "primary" : "ghost"}
            onClick={() => setLane(name)}
          >
            {name}
          </Button>
        ))}
        <span style={{ color: "var(--text-dim)", fontSize: 13 }}>{LANE_COPY[lane]}</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(320px, 1fr)",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: 20 }}>
          <Panel title="Board">
            <BoardStrip boards={boards} selectedId={selectedId} onSelect={setSelectedId} />
            {selected && <BoardView board={selected} showDefects={showDefects} />}
            <label
              style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--text-dim)" }}
            >
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
              <div style={{ display: "grid", gap: 12 }}>
                {result && (
                  <>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <Badge type={result.defect_type} />
                      <strong>{result.disposition}</strong>
                      {verifyResult && <GateChip action={verifyResult.gate.action} />}
                      <span style={{ color: "var(--text-dim)", fontSize: 13 }}>
                        board verdict = its worst confident region
                      </span>
                    </div>
                    {result.caveat && (
                      <p style={{ margin: 0, color: "var(--warn)", fontSize: 13 }}>
                        ⚠ {result.caveat}
                      </p>
                    )}
                    {result.region_errors != null && (
                      <p style={{ margin: 0, color: "var(--danger)", fontSize: 13 }}>
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
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
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

        <div style={{ display: "grid", gap: 20, alignContent: "start" }}>
          <Panel title="Triage">
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Button onClick={triageSelected} disabled={!selected || busy}>
                {busy ? "Classifying…" : `Triage selected board (${lane})`}
              </Button>
              <Elapsed active={busy} />
            </div>
            <label style={{ display: "grid", gap: 4, fontSize: 13, color: "var(--text-dim)" }}>
              Reference template for camera triage (optional — enables the defect diff)
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setTemplateFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <CameraCapture onCapture={capture} disabled={busy} />
            {result && (
              <div style={{ display: "grid", gap: 12 }}>
                <Badge type={result.defect_type} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Stat label="Severity" value={result.severity} />
                  <Stat label="Disposition" value={result.disposition} />
                  <Stat label="Confidence" value={`${Math.round(result.confidence * 100)}%`} />
                  <Stat label="Crops" value={result.regions.length} />
                </div>
                <p style={{ margin: 0, color: "var(--text-dim)" }}>{result.reason}</p>
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
