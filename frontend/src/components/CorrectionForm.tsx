import { useState } from "react";
import { sendCorrection } from "../api";
import { DEFECT_TYPES, DISPOSITIONS, SEVERITIES } from "../types";
import type { Classification, DefectType, Disposition, Rules, Severity } from "../types";
import { Button, Panel } from "./ui";

export function CorrectionForm({
  boardId,
  original,
  rules,
  onCorrected,
}: {
  boardId: string;
  original: Classification;
  rules: Rules | null;
  onCorrected: (rules: Rules) => void;
}) {
  const [defectType, setDefectType] = useState<DefectType>(original.defect_type);
  const [severity, setSeverity] = useState<Severity>(original.severity);
  const [disposition, setDisposition] = useState<Disposition>(original.disposition);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const types = rules?.defect_types ?? [...DEFECT_TYPES];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      onCorrected(await sendCorrection({
        boardId,
        original,
        corrected: { defect_type: defectType, severity, disposition },
        reason,
      }));
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <Panel title="Correct the model">
      <p className="flush dim small">
        Correcting <code>{boardId}</code> as the model reported it:{" "}
        <strong>{original.defect_type}</strong> / {original.severity} /{" "}
        {original.disposition}.
      </p>
      <form onSubmit={submit} className="form">
        <label className="label">
          Defect type
          <input
            className="field"
            list="defect-types"
            value={defectType}
            onChange={(e) => setDefectType(e.target.value)}
          />
          <datalist id="defect-types">
            {types.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
        <label className="label">
          Severity
          <select className="field" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="label">
          Disposition
          <select className="field" value={disposition} onChange={(e) => setDisposition(e.target.value as Disposition)}>
            {DISPOSITIONS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label className="label">
          Reason the inspector gives
          <textarea className="field field-tall" value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <div className="hrow">
          <Button type="submit" disabled={status === "saving"}>Save correction</Button>
          {status === "saved" && <span className="good">Rule added to the adapted task.</span>}
          {status === "error" && <span className="bad">Could not save. Try again.</span>}
        </div>
      </form>
    </Panel>
  );
}
