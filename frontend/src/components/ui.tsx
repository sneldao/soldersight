import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import type { DefectType } from "../types";
import { defectColor } from "../colors";

export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return <section className="panel">{title && <h2>{title}</h2>}{children}</section>;
}

export function Badge({ type }: { type: DefectType }) {
  // Hue goes on the fill via --badge, ink on top of it. As coloured *text* on
  // paper every defect hue lands at 1.5-2.7:1; as a background they all clear
  // 5.5:1 against --text.
  const color = defectColor(type);
  return (
    <span className="badge" style={{ "--badge": color } as CSSProperties}>
      {type}
    </span>
  );
}

export function Button({
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  const primary = variant === "primary";
  return <button {...props} className={`${primary ? "btn btn-primary" : "btn ghost"}`} />;
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

// Dismissible error banner — keeps context (what was attempted) instead of a bare
// red line.
export function ErrorPanel({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="err-panel" role="alert">
      <span>{message}</span>
      {onDismiss && (
        <button type="button" aria-label="Dismiss error" onClick={onDismiss}>
          ×
        </button>
      )}
    </div>
  );
}

// The policy gate's line decision, stamped inline — SHIP / BLOCK / REVIEW.
// Stamped as white on a solid tab: --danger as 12px text on paper sits at 4.47:1,
// and ink on the solid stamps fails too (3.2-3.7); white clears all three fills
// (4.83-5.48). Classes .gate-chip.{ship,block,review} in app.css carry the look.
export function GateChip({ action }: { action: "SHIP" | "BLOCK" | "REVIEW" }) {
  return <span className={`gate-chip ${action.toLowerCase()}`}>{action}</span>;
}
