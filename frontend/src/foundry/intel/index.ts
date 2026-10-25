/**
 * Lane 3 — Mubit Intelligence + Banyan Sapling Judge + Golden Replay (`foundry/intel`).
 *
 * Public surface for Lane 2 (`foundry/ui`) and final app integration.
 */

export {
  CURATED_NETLISTS,
  DEFAULT_NETLIST,
  DEFAULT_NETLIST_PRESET,
  MUBIT_BASE_URL,
  MUBIT_MODEL,
  NETLIST_SYSTEM_PROMPT,
  NetlistValidationError,
  briefToNetlist,
  generateNetlist,
  generateNetlistWithMeta,
  matchCuratedNetlist,
  specFromBrief,
  validateNetlist,
  type NetlistPreset,
  type NetlistSpecResult,
  type SpecOpts,
} from "./spec";

export {
  COMMENTARY_SYSTEM_PROMPT,
  GOLDEN_EVOLVE_NOTES,
  GOLDEN_HEAL_NOTES,
  buildDeterministicGenerationNote,
  buildDeterministicRepairNote,
  commentOnGeneration,
  commentOnRepair,
  commentOnStep,
  validateCommentary,
  withGenerationCommentary,
  withRepairCommentary,
  type CommentaryOpts,
} from "./commentary";

export {
  BANYAN_ENDPOINT,
  FOUNDRY_DRC_POLICY,
  FOUNDRY_LAYOUT_CLAIM,
  MAX_SURVIVE_VIOLATION_RISK,
  buildBoardEvidence,
  evaluateSaplingResponse,
  judgeBoard,
  judgeGeneration,
  judgeRepairStep,
  selectCachedSaplingResponse,
  withSaplingJudgment,
  type GateAction,
  type JudgeAction,
  type JudgeOpts,
  type SaplingJudgeVerdict,
  type SaplingLabel,
  type SaplingRawResponse,
} from "./judge";

export {
  GOLDEN_EVOLVE,
  GOLDEN_HEAL,
  GOLDEN_RUN,
  replayGoldenEvolve,
  replayGoldenHeal,
  type GoldenEvolveRecord,
  type GoldenHealRecord,
} from "./golden";

export { DEMO_BEATS, type DemoBeat } from "./script";
