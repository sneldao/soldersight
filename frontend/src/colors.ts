import type { KnownDefectType } from "./types";

// Same palette as the --defect-* tokens in theme.css, for SVG attributes that need a
// literal value. A defect type a correction introduced has no token, so it takes the
// neutral colour rather than rendering undefined.
export const DEFECT_COLORS: Record<KnownDefectType, string> = {
  open: "#f87171",
  short: "#fb923c",
  mousebite: "#fbbf24",
  spur: "#a78bfa",
  copper: "#34d399",
  pinhole: "#60a5fa",
  none: "#8b98a6",
};

export function defectColor(type: string): string {
  return DEFECT_COLORS[type as KnownDefectType] ?? DEFECT_COLORS.none;
}

// Disposition colours, shared by the gate chip and the board strip's truth dot.
// Deep enough to read on the paper background.
export const DISPOSITION_COLORS: Record<string, string> = {
  pass: "#047857",
  rework: "#b45309",
  scrap: "#dc2626",
};

// Mirrors backend DISPOSITION_BY_TYPE / SEVERITY_RANK in main.py — used to badge
// each board strip thumbnail with what the labels say the right disposition is.
const SEVERITY_RANK: Record<string, number> = {
  none: 0,
  spur: 1,
  pinhole: 1,
  copper: 2,
  mousebite: 2,
  short: 3,
  open: 3,
};

const DISPOSITION_BY_TYPE: Record<string, string> = {
  open: "scrap",
  short: "scrap",
  mousebite: "rework",
  spur: "rework",
  copper: "rework",
  pinhole: "rework",
  none: "pass",
};

export function boardDisposition(types: string[]): string {
  const real = types.filter((t) => t !== "none");
  if (!real.length) return "pass";
  const worst = real.reduce((a, b) =>
    (SEVERITY_RANK[b] ?? 0) > (SEVERITY_RANK[a] ?? 0) ? b : a,
  );
  return DISPOSITION_BY_TYPE[worst] ?? "rework";
}
