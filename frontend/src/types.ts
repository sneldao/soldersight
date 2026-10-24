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

// Banyan Sapling verdicts for the policy gate.
export const SAPLING_LABELS = [
  "supported",
  "violation",
  "insufficient_information",
  "inconsistent_context",
] as const;
export type SaplingLabel = (typeof SAPLING_LABELS)[number];

export type GateAction = "SHIP" | "BLOCK" | "REVIEW";

export interface GateDecision {
  action: GateAction;
  label: SaplingLabel | null;
  reason: string;
  confidence: number | null;
  margin: number | null;
  unsure: boolean;
  probabilities?: Record<SaplingLabel, number>;
  prediction_set?: SaplingLabel[];
  error?: string;
}

export interface VerifyResult {
  board_id: string;
  claimed_disposition: Disposition;
  policy: string;
  evidence: string;
  claim: string;
  gate: GateDecision;
  ground_truth: { defect_types: DefectType[]; disposition: Disposition; worst: string };
}
