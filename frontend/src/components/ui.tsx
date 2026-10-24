import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { DefectType } from "../types";
import { defectColor } from "../colors";

export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section
      style={{
        background: "var(--panel)",
        border: "1px solid var(--panel-border)",
        borderRadius: "var(--radius)",
        padding: "var(--gap)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--gap)",
      }}
    >
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}

export function Badge({ type }: { type: DefectType }) {
  const color = defectColor(type);
  // Hue goes on the fill, ink on top of it. As coloured *text* on paper every defect
  // hue lands at 1.5-2.7:1; as a background they all clear 5.5:1 against --text.
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 700,
        color: "var(--text)",
        background: color,
        border: `1px solid color-mix(in srgb, ${color} 70%, black)`,
      }}
    >
      {type}
    </span>
  );
}

export function Button({
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  const primary = variant === "primary";
  return (
    <button
      {...props}
      style={{
        padding: "8px 14px",
        borderRadius: 8,
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.5 : 1,
        background: primary ? "var(--accent)" : "transparent",
        color: primary ? "#04110b" : "var(--text)",
        border: primary ? "none" : "1px solid var(--panel-border)",
        fontWeight: 600,
        ...props.style,
      }}
    />
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div style={{ color: "var(--text-dim)", fontSize: 12 }}>{label}</div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 18 }}>{value}</div>
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
// Stamped as ink on a solid tab: --danger as 12px text on paper sits at 4.47:1, just
// under AA, and a filled stamp clears it for all three verdicts.
export function GateChip({ action }: { action: "SHIP" | "BLOCK" | "REVIEW" }) {
  const fill =
    action === "SHIP"
      ? "var(--ok)"
      : action === "BLOCK"
        ? "var(--danger)"
        : "var(--warn)";
  return (
    <span
      className="gate-chip"
      style={{ color: "var(--text)", background: fill, borderColor: fill }}
    >
      {action}
    </span>
  );
}
