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
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 600,
        color,
        border: `1px solid ${color}`,
        background: `${color}1f`,
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
