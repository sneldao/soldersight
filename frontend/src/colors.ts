import type { DefectType } from "./types";

// Same palette as the --defect-* tokens in theme.css, for SVG attributes that need a literal value.
export const DEFECT_COLORS: Record<DefectType, string> = {
  open: "#f87171",
  short: "#fb923c",
  mousebite: "#fbbf24",
  spur: "#a78bfa",
  copper: "#34d399",
  pinhole: "#60a5fa",
  none: "#8b98a6",
};
