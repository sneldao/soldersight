export const DEFECT_TYPES = [
  "open",
  "short",
  "mousebite",
  "spur",
  "copper",
  "pinhole",
  "none",
] as const;
export type KnownDefectType = (typeof DEFECT_TYPES)[number];
// A correction can add a defect type the taxonomy did not carry, so the wire value is
// any string; the known names stay for colouring and autocomplete.
export type DefectType = KnownDefectType | (string & {});

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

// One region the AOI-style proposer picked out of the board, in test-image pixels.
export interface Region {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  delta: number;
}

export interface CallMetrics {
  latency_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  mubit_request_id: string | null;
}

export interface RegionScore {
  type_correct: boolean;
  disposition_correct: boolean;
}

// One crop, one Mubit call, and what the DeepPCB labels say was in it.
// `error` rows are calls that failed: they stay out of the verdict and the scoring.
export interface RegionResult extends Classification {
  region: Region;
  metrics: CallMetrics;
  ground_truth?: GroundTruth;
  score?: RegionScore;
  error?: string;
}

export interface GroundTruth {
  defect_types: DefectType[];
  disposition: Disposition;
  worst: string;
}

export interface RunMetrics {
  calls: number;
  latency_ms: number;
  total_tokens: number;
  cost_usd: number;
  mubit_request_ids: (string | null)[];
}

// The board verdict is its worst confident region; a low-confidence defect claim
// rides along as a caveat instead.
export interface Inspection extends Classification {
  board_id: string | null;
  lane: string;
  regions: RegionResult[];
  metrics: RunMetrics;
  caveat?: string;
  region_errors?: number | null;
}

export interface LaneSummary {
  calls: number;
  boards: number;
  scored: number;
  defect_regions: number;
  type_accuracy: number | null;
  disposition_accuracy: number | null;
  missed_defect_rate: number | null;
  false_alarm_rate: number | null;
  board_disposition_accuracy: number | null;
  avg_latency_ms: number | null;
  total_tokens: number;
  total_cost_usd: number;
  avg_cost_usd: number | null;
}

export interface BoardVerdict {
  id: string;
  ground_truth: GroundTruth;
  verdicts: Record<
    string,
    {
      defect_type: DefectType;
      disposition: Disposition;
      cost_usd: number;
      latency_ms: number;
      correct: boolean;
    }
  >;
  // The same crops, judged down each lane.
  regions: Record<string, RegionResult[]>;
}

export interface Comparison {
  boards: BoardVerdict[];
  lanes: Record<string, LaneSummary>;
}

export interface BenchmarkBoard {
  id: string;
  ground_truth: GroundTruth;
  verdicts: BoardVerdict["verdicts"];
}

// capture_comparison.py's saved file: one recorded run over several boards.
export interface Benchmark {
  generated_utc: string;
  model: string;
  corrections: number;
  boards: BenchmarkBoard[];
  lanes: Record<string, LaneSummary>;
}

export interface CorrectionRow {
  ts: number;
  board_id: string;
  original: Partial<Classification>;
  corrected: Partial<Classification>;
  reason: string;
  index: number;
  enabled: boolean;
}

export interface Rules {
  corrections: CorrectionRow[];
  rules: string[];
  defect_types: DefectType[];
  lanes: { baseline: string; adapted: string };
  // What the adapted task buys vs costs on recorded runs (null until both lanes
  // have scored runs): deltas in rate space, negative missed/false-alarm is better.
  lane_health: {
    missed_defect_rate: number | null;
    false_alarm_rate: number | null;
    type_accuracy: number | null;
    board_disposition_accuracy: number | null;
  } | null;
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
  // "trace" = the model's own region notes (no answer key); "oracle" = AOI labels.
  evidence_mode: "trace" | "oracle";
  gate: GateDecision;
  ground_truth: { defect_types: DefectType[]; disposition: Disposition; worst: string };
}
