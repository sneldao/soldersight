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
