import { useEffect, useState } from "react";
import { fetchBoards, fetchRules, triage, triageBoard, verifyBoard } from "./api";
import { BenchmarkPanel } from "./components/BenchmarkPanel";
import { BoardView } from "./components/BoardView";
import { CameraCapture } from "./components/CameraCapture";
import { ComparePanel } from "./components/ComparePanel";
import { CorrectionForm } from "./components/CorrectionForm";
import { PolicyGate } from "./components/PolicyGate";
import { RegionCards } from "./components/RegionCards";
import { RulesPanel } from "./components/RulesPanel";
import { Badge, Button, Panel, Stat } from "./components/ui";
import { LANES, LANE_COPY } from "./laneTable";
import type { Board, Inspection, RegionResult, Rules, VerifyResult } from "./types";

export default function App() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lane, setLane] = useState<string>(LANES[0]);
  const [showDefects, setShowDefects] = useState(true);
  const [result, setResult] = useState<Inspection | null>(null);
  const [subject, setSubject] = useState<RegionResult | null>(null);
  const [rules, setRules] = useState<Rules | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
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
    run(() => triage(blob, "camera.jpg", lane));
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
        <span style={{ color: "var(--text-dim)" }}>PCB defect triage · Mubit × Banyan</span>
      </header>

      {error && <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p>}

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
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {boards.map((b) => (
                <Button
                  key={b.id}
                  variant={b.id === selectedId ? "primary" : "ghost"}
                  onClick={() => setSelectedId(b.id)}
                >
                  {b.id}
                </Button>
              ))}
            </div>
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

          {result && selected && (
            <Panel title={`Crops the ${result.lane} task was asked about`}>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Badge type={result.defect_type} />
                  <strong>{result.disposition}</strong>
                  <span style={{ color: "var(--text-dim)", fontSize: 13 }}>
                    board verdict = its worst region
                  </span>
                </div>
                <RegionCards
                  boardId={selected.id}
                  regions={result.regions}
                  picked={subject}
                  onPick={setSubject}
                />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  <Stat label="Mubit calls" value={result.metrics.calls} />
                  <Stat label="Latency" value={`${result.metrics.latency_ms}ms`} />
                  <Stat label="Tokens" value={result.metrics.total_tokens} />
                  <Stat label="Cost" value={`$${result.metrics.cost_usd}`} />
                </div>
              </div>
            </Panel>
          )}
        </div>

        <div style={{ display: "grid", gap: 20, alignContent: "start" }}>
          <Panel title="Triage">
            <Button onClick={triageSelected} disabled={!selected || busy}>
              {busy ? "Classifying…" : `Triage selected board (${lane})`}
            </Button>
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
                {selected && (
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

          <RulesPanel rules={rules} />

          {result && selected && (
            <CorrectionForm
              boardId={selected.id}
              original={subject ?? result}
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
