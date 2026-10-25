/**
 * Lane 3 — Banyan Sapling Generation & Repair Judge (`judge.ts`).
 *
 * Sends a generation's DRC board summary as `evidence` +
 * `"This layout satisfies the design rules."` as `claim` against the Foundry
 * IPC DRC `policy`. Sapling's calibrated `supported` / `violation` verdict acts
 * as the validity / taste gate deciding which generations survive.
 */

import goldenData from "../../../../data/foundry/golden.json";
import type { BoardState, Generation, RepairStep, Violation } from "../core/types";

export const BANYAN_ENDPOINT =
  "https://6adbee0669a00298cd4774c9.endpoints.huggingface.cloud";

export const MAX_SURVIVE_VIOLATION_RISK = 0.15;

export type SaplingLabel =
  | "supported"
  | "violation"
  | "insufficient_information"
  | "inconsistent_context";

export type JudgeAction = "SURVIVE" | "PRUNE" | "MUTATE";
export type GateAction = "SHIP" | "BLOCK" | "REVIEW";

export interface SaplingRawResponse {
  raw_label?: SaplingLabel;
  status?: string;
  probabilities?: Record<SaplingLabel, number>;
  prediction_set?: SaplingLabel[];
  conformal_prediction_set?: SaplingLabel[];
  error?: string;
}

export interface SaplingJudgeVerdict {
  /** True when `supported` leads and violation risk < 15%. */
  survives: boolean;
  /** Evolutionary action: SURVIVE (clean) | PRUNE (critical violation) | MUTATE (needs refinement). */
  action: JudgeAction;
  /** Compatible with `PolicyGate.tsx` (`SHIP` | `BLOCK` | `REVIEW`). */
  gateAction: GateAction;
  label: SaplingLabel | null;
  confidence: number | null;
  margin: number | null;
  unsure: boolean;
  reason: string;
  probabilities: Record<SaplingLabel, number> | null;
  predictionSet: SaplingLabel[];
  policy: string;
  evidence: string;
  claim: string;
  source: "live" | "cached";
}

export interface JudgeOpts {
  endpoint?: string;
  policy?: string;
  claim?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /** Use the SHA-pinned real verdicts in `data/foundry/golden.json` without network calls. */
  offline?: boolean;
}

export const FOUNDRY_DRC_POLICY =
  "PCB layout design rules (IPC-2221 / Foundry DRC). " +
  "A layout FAILS and must be rejected if any open-circuit or short-circuit defect is present; " +
  "these are critical design rule violations. " +
  "A layout with trace crossing or spacing clearance defects must continue evolving and cannot be certified clean. " +
  "A layout with no detected defects and all nets routed PASSES and satisfies the design rules.";

export const FOUNDRY_LAYOUT_CLAIM = "This layout satisfies the design rules.";

const VIOLATION_PHRASE: Record<Violation["kind"], string> = {
  open: "open-circuit (broken trace)",
  short: "short-circuit (bridged traces)",
  crossing: "trace crossing",
  spacing: "spacing clearance",
};

/**
 * Render a `BoardState` into natural-language DRC evidence for Banyan Sapling.
 */
export function buildBoardEvidence(
  board: BoardState,
  context?: { boardId?: string; generationIndex?: number },
): string {
  const activeViolations =
    board.violations && board.violations.length > 0
      ? board.violations
      : (board.defects ?? []);
  const fitnessPct = Math.round(Math.max(0, Math.min(1, board.score)) * 100);
  const netNames = Array.from(new Set(board.pads.map((p) => p.net)));
  const subject = context?.boardId
    ? `on board ${context.boardId}`
    : context?.generationIndex !== undefined
      ? `on generation #${context.generationIndex}`
      : "on this board";

  if (activeViolations.length === 0) {
    return (
      `Automated DRC inspection ${subject} found no defects; all ${netNames.length || board.traces.length} nets ` +
      `are continuously routed with full trace clearance and 0 violations. ` +
      `The DRC engine reported ${fitnessPct}% confidence in this reading.`
    );
  }

  const parts = activeViolations.map(
    (v) => `1 ${VIOLATION_PHRASE[v.kind] ?? v.kind} defect at (${v.at[0]},${v.at[1]})`,
  );
  return (
    `Automated DRC inspection ${subject} detected: ${parts.join("; ")}. ` +
    `DRC fitness score is ${fitnessPct}%.`
  );
}

/**
 * Select the closest real cached Sapling response from `data/foundry/golden.json`
 * based on the board's violation profile.
 */
export function selectCachedSaplingResponse(board: BoardState): SaplingRawResponse {
  const active =
    board.violations && board.violations.length > 0
      ? board.violations
      : (board.defects ?? []);
  const hasCritical = active.some(
    (v) => v.kind === "short" || v.kind === "open" || v.kind === "crossing",
  );
  const verdicts = goldenData.saplingVerdicts as Record<string, SaplingRawResponse>;

  if (active.length === 0 && board.score >= 0.8) {
    return board.score >= 0.985 ? verdicts.heal_after : verdicts.gen_clean;
  }
  if (hasCritical) {
    return active.some((v) => v.kind === "short")
      ? verdicts.heal_before
      : verdicts.gen_defect;
  }
  return verdicts.gen_mid;
}

/**
 * Map a raw Banyan Sapling response into a calibrated `SaplingJudgeVerdict`.
 * Mirrors `backend/sapling.py` (`gate_decision`) and `static_space/index.html`.
 */
export function evaluateSaplingResponse(
  raw: SaplingRawResponse,
  inputs: { policy: string; evidence: string; claim: string },
  source: "live" | "cached",
): SaplingJudgeVerdict {
  if (!raw || raw.error || !raw.probabilities) {
    return {
      survives: false,
      action: "MUTATE",
      gateAction: "REVIEW",
      label: null,
      confidence: null,
      margin: null,
      unsure: true,
      reason: "Verifier unavailable — holding generation for further mutation (fail-safe).",
      probabilities: null,
      predictionSet: [],
      policy: inputs.policy,
      evidence: inputs.evidence,
      claim: inputs.claim,
      source,
    };
  }

  const probs = raw.probabilities;
  const labels = Object.keys(probs) as SaplingLabel[];
  const topLabel =
    raw.raw_label ??
    labels.reduce((best, curr) => (probs[curr] > probs[best] ? curr : best), labels[0]);
  const ranked = Object.values(probs).sort((a, b) => b - a);
  const topProb = ranked[0] ?? 0;
  const secondProb = ranked[1] ?? 0;
  const margin = Number((topProb - secondProb).toFixed(3));
  const predictionSet = raw.prediction_set ?? raw.conformal_prediction_set ?? [];
  const unsure = raw.status === "unsure" || predictionSet.length > 1;
  const violationRisk = probs.violation ?? 0;

  let action: JudgeAction;
  let gateAction: GateAction;
  let reason: string;

  if (topLabel === "violation") {
    action = violationRisk >= 0.9 ? "PRUNE" : "MUTATE";
    gateAction = "BLOCK";
    reason = "Layout violates IPC/DRC design rules — generation rejected by Banyan Sapling.";
  } else if (topLabel === "supported") {
    if (violationRisk >= MAX_SURVIVE_VIOLATION_RISK) {
      action = "MUTATE";
      gateAction = "REVIEW";
      reason = `Supported, but ${Math.round(violationRisk * 100)}% violation risk remains — continue evolving.`;
    } else {
      action = "SURVIVE";
      gateAction = "SHIP";
      reason = "Layout satisfies IPC/DRC design rules — certified by Banyan Sapling.";
    }
  } else if (topLabel === "insufficient_information") {
    action = "MUTATE";
    gateAction = "REVIEW";
    reason = "Insufficient DRC evidence to certify layout — continue evolving.";
  } else {
    action = "MUTATE";
    gateAction = "REVIEW";
    reason = "Inconsistent DRC evidence — continue evolving.";
  }

  return {
    survives: action === "SURVIVE",
    action,
    gateAction,
    label: topLabel,
    confidence: Number(topProb.toFixed(3)),
    margin,
    unsure,
    reason,
    probabilities: { ...probs },
    predictionSet: [...predictionSet],
    policy: inputs.policy,
    evidence: inputs.evidence,
    claim: inputs.claim,
    source,
  };
}

/**
 * Judge a `BoardState` with Banyan Sapling (live browser CORS call with
 * automatic fallback to the real cached verdicts in `data/foundry/golden.json`).
 */
export async function judgeBoard(
  board: BoardState,
  opts: JudgeOpts = {},
  context?: { boardId?: string; generationIndex?: number },
): Promise<SaplingJudgeVerdict> {
  const policy = opts.policy ?? FOUNDRY_DRC_POLICY;
  const claim = opts.claim ?? FOUNDRY_LAYOUT_CLAIM;
  const evidence = buildBoardEvidence(board, context);
  const inputs = { policy, evidence, claim };

  const fetchFn = opts.fetchImpl ?? (typeof fetch !== "undefined" ? fetch : undefined);
  if (opts.offline || !fetchFn) {
    const cached = selectCachedSaplingResponse(board);
    return evaluateSaplingResponse(cached, inputs, "cached");
  }

  const endpoint = (opts.endpoint ?? BANYAN_ENDPOINT).replace(/\/$/, "") + "/";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000);

  try {
    const response = await fetchFn(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputs }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Sapling HTTP ${response.status}`);
    }
    const raw = (await response.json()) as SaplingRawResponse;
    if (!raw || !raw.probabilities) {
      throw new Error("Invalid Sapling response shape");
    }
    return evaluateSaplingResponse(raw, inputs, "live");
  } catch {
    const cached = selectCachedSaplingResponse(board);
    return evaluateSaplingResponse(cached, inputs, "cached");
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Judge an Evolve `Generation` with Banyan Sapling.
 */
export async function judgeGeneration(
  gen: Generation,
  opts: JudgeOpts = {},
): Promise<SaplingJudgeVerdict> {
  return judgeBoard(gen.board, opts, { generationIndex: gen.index });
}

/**
 * Judge a Heal `RepairStep` (`step.after` board state) with Banyan Sapling.
 */
export async function judgeRepairStep(
  step: RepairStep,
  opts: JudgeOpts = {},
  boardId = goldenData.heal.boardId,
): Promise<SaplingJudgeVerdict> {
  return judgeBoard(step.after, opts, { boardId });
}

/**
 * Stream adapter that pairs every `Generation` with its Banyan Sapling taste/validity verdict.
 */
export async function* withSaplingJudgment(
  stream: AsyncIterable<Generation>,
  opts: JudgeOpts = {},
): AsyncGenerator<{ generation: Generation; verdict: SaplingJudgeVerdict }, void, void> {
  for await (const generation of stream) {
    const verdict = await judgeGeneration(generation, opts);
    yield { generation, verdict };
  }
}
