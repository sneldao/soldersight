import { useState } from "react";
import { sendCorrection } from "../api";
import { DEFECT_TYPES, DISPOSITIONS, SEVERITIES } from "../types";
import type { Classification, DefectType, Disposition, Severity } from "../types";
import { Button, Panel } from "./ui";

const field: React.CSSProperties = {
  background: "var(--bg)",
  border: "1px solid var(--panel-border)",
  borderRadius: 8,
  padding: "6px 10px",
};

export function CorrectionForm({ boardId, original }: { boardId: string; original: Classification }) {
  const [defectType, setDefectType] = useState<DefectType>(original.defect_type);
  const [severity, setSeverity] = useState<Severity>(original.severity);
  const [disposition, setDisposition] = useState<Disposition>(original.disposition);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      await sendCorrection({
        boardId,
        original,
        corrected: { defect_type: defectType, severity, disposition },
        reason,
      });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <Panel title="Correct the model">
      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 4 }}>
          Defect type
          <select style={field} value={defectType} onChange={(e) => setDefectType(e.target.value as DefectType)}>
            {DEFECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          Severity
          <select style={field} value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          Disposition
          <select style={field} value={disposition} onChange={(e) => setDisposition(e.target.value as Disposition)}>
            {DISPOSITIONS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          Reason
          <textarea style={{ ...field, minHeight: 60 }} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Button type="submit" disabled={status === "saving"}>Save correction</Button>
          {status === "saved" && <span style={{ color: "var(--accent)" }}>Saved to Mubit memory.</span>}
          {status === "error" && <span style={{ color: "var(--danger)" }}>Could not save. Try again.</span>}
        </div>
      </form>
    </Panel>
  );
}
