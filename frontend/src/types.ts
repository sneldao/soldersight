export const DEFECT_TYPES = [
  "open",
  "short",
  "mousebite",
  "spur",
  "copper",
  "pinhole",
  "none",
] as const;
export type DefectType = (typeof DEFECT_TYPES)[number];

export const SEVERITIES = ["cosmetic", "minor", "major", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const DISPOSITIONS = ["pass", "rework", "scrap"] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

export interface Classification {
  defect_type: DefectType;
  severity: Severity;
  disposition: Disposition;
  confidence: number;
  reason: string;
}

// One DeepPCB annotation: pixel box plus a numeric defect code (1–6).
export interface Annotation {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  code: number;
  type: DefectType;
}

// DeepPCB code → our defect type. Codes come from the dataset's annotation files.
export const DEEPPCB_CODE_TO_TYPE: Record<number, DefectType> = {
  1: "open",
  2: "short",
  3: "mousebite",
  4: "spur",
  5: "copper",
  6: "pinhole",
};

export interface Board {
  id: string;
  templateUrl: string;
  testUrl: string;
  annotations: Annotation[];
}
