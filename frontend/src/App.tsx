import { useEffect, useState } from "react";
import { fetchBoards, triage, verifyBoard } from "./api";
import { BoardView } from "./components/BoardView";
import { CameraCapture } from "./components/CameraCapture";
import { CorrectionForm } from "./components/CorrectionForm";
import { PolicyGate } from "./components/PolicyGate";
import { Badge, Button, Panel, Stat } from "./components/ui";
import type { Board, Classification, VerifyResult } from "./types";

export default function App() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDefects, setShowDefects] = useState(true);
  const [result, setResult] = useState<Classification | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBoards()
      .then((list) => {
        setBoards(list);
        if (list.length) setSelectedId(list[0].id);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const selected = boards.find((b) => b.id === selectedId) ?? null;

  async function run(image: Blob, filename: string) {
    setBusy(true);
    setError(null);
    setVerifyResult(null);
    try {
      setResult(await triage(image, filename));
    } catch (err) {
      setError(err instanceof Error ? err.message : "triage failed");
    } finally {
      setBusy(false);
    }
  }

  async function triageSelected() {
    if (!selected) return;
    const res = await fetch(selected.testUrl);
    await run(await res.blob(), `${selected.id}_test.jpg`);
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
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 24, display: "grid", gap: 20 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 22 }}>SolderSight</h1>
        <span style={{ color: "var(--text-dim)" }}>PCB defect triage</span>
      </header>

      {error && <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)", gap: 20 }}>
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
          <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--text-dim)" }}>
            <input type="checkbox" checked={showDefects} onChange={(e) => setShowDefects(e.target.checked)} />
            Show defect annotations
          </label>
        </Panel>

        <div style={{ display: "grid", gap: 20, alignContent: "start" }}>
          <Panel title="Triage">
            <Button onClick={triageSelected} disabled={!selected || busy}>
              {busy ? "Classifying…" : "Triage selected board"}
            </Button>
            <CameraCapture onCapture={(blob) => run(blob, "camera.jpg")} disabled={busy} />
            {result && (
              <div style={{ display: "grid", gap: 12 }}>
                <Badge type={result.defect_type} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Stat label="Severity" value={result.severity} />
                  <Stat label="Disposition" value={result.disposition} />
                  <Stat label="Confidence" value={`${Math.round(result.confidence * 100)}%`} />
                </div>
                <p style={{ margin: 0, color: "var(--text-dim)" }}>{result.reason}</p>
                {selected && (
                  <Button variant="ghost" onClick={verify} disabled={verifying}>
                    {verifying ? "Verifying against policy…" : "Verify against policy gate →"}
                  </Button>
                )}
              </div>
            )}
          </Panel>

          {verifyResult && <PolicyGate result={verifyResult} />}

          {result && selected && <CorrectionForm boardId={selected.id} original={result} />}
        </div>
      </div>
    </main>
  );
}
