/**
 * Lane 3 — Mubit Live Designer Commentary (`commentary.ts`).
 *
 * Produces concise, engineering-grade PCB layout notes for `Generation.note`
 * and `RepairStep.note` ("tightened the ground return, −2 crossings").
 * Supports live Mubit (`gpt-4o-mini`) calls, a cached golden set from
 * `data/foundry/golden.json`, and deterministic metric-backed notes.
 */

import goldenData from "../../../../data/foundry/golden.json";
import type { Generation, RepairStep, Violation } from "../core/types";
import { MUBIT_BASE_URL, MUBIT_MODEL } from "./spec";

export interface CommentaryOpts {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /** Prefer cached / deterministic notes without network calls. */
  offline?: boolean;
}

export const COMMENTARY_SYSTEM_PROMPT = `You are a terse PCB layout engineer narrating an autonomous layout & repair loop.
Given a board generation or defect repair step, return JSON {"note": "..."} where "note" is ONE crisp sentence (6 to 16 words) citing concrete routing metrics (net names, coordinates, crossings/shorts/opens delta, or DRC fitness).`;

export const GOLDEN_EVOLVE_NOTES: Record<number, string> = Object.fromEntries(
  goldenData.evolve.generations.map((g) => [g.index, g.note ?? ""]),
);

export const GOLDEN_HEAL_NOTES: Record<string, string> = Object.fromEntries(
  goldenData.heal.steps.map((s) => [
    `${s.defect.kind}:${s.defect.at[0]},${s.defect.at[1]}`,
    s.note ?? "",
  ]),
);

const runtimeCache = new Map<string, string>();

/** Validate and normalize a designer commentary note (non-empty single-line string). */
export function validateCommentary(raw: unknown): string {
  if (typeof raw === "string") {
    const trimmed = raw.trim().replace(/\s+/g, " ");
    if (!trimmed) throw new Error("Commentary note cannot be empty.");
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === "object" && "note" in parsed) {
        return validateCommentary((parsed as { note: unknown }).note);
      }
    } catch {
      // Plain text string is valid
    }
    return trimmed.slice(0, 180);
  }
  if (raw && typeof raw === "object" && "note" in raw) {
    const val = (raw as { note: unknown }).note;
    if (typeof val === "string" && val.trim()) {
      return val.trim().replace(/\s+/g, " ").slice(0, 180);
    }
  }
  throw new Error("Invalid commentary payload: expected non-empty note string.");
}

function summarizeViolations(violations: Violation[]): string {
  if (!violations.length) return "0 violations";
  const counts = new Map<Violation["kind"], number>();
  for (const v of violations) {
    counts.set(v.kind, (counts.get(v.kind) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([kind, n]) => `${n} ${kind}${n > 1 ? "s" : ""}`)
    .join(", ");
}

function totalCopperCells(gen: Generation): number {
  return gen.board.traces.reduce((acc, t) => acc + t.path.length, 0);
}

/** Deterministic metric-driven note when generation index isn't in the golden cache. */
export function buildDeterministicGenerationNote(
  gen: Generation,
  prev?: Generation,
): string {
  const cached = GOLDEN_EVOLVE_NOTES[gen.index];
  if (cached && gen.board.w === 16 && gen.board.h === 12) {
    return cached;
  }

  const vioDiff = prev ? prev.board.violations.length - gen.board.violations.length : 0;
  const copper = totalCopperCells(gen);
  const deltaPct = `${gen.delta >= 0 ? "+" : ""}${Math.round(gen.delta * 100)}%`;

  if (gen.board.violations.length === 0) {
    return `Converged clean route (${copper} cells, ${deltaPct} fitness, 0 DRC violations).`;
  }
  if (vioDiff > 0) {
    return `Tightened routing (${deltaPct} fitness, −${vioDiff} DRC violation${vioDiff > 1 ? "s" : ""}; ${summarizeViolations(gen.board.violations)} left).`;
  }
  return `Mutated pad placement (${deltaPct} fitness, ${copper} copper cells; ${summarizeViolations(gen.board.violations)}).`;
}

/** Deterministic metric-driven note for a Heal repair step. */
export function buildDeterministicRepairNote(step: RepairStep): string {
  const key = `${step.defect.kind}:${step.defect.at[0]},${step.defect.at[1]}`;
  const cached = GOLDEN_HEAL_NOTES[key];
  if (cached) return cached;

  const [x, y] = step.defect.at;
  const remaining = step.after.violations.length;
  const tail =
    remaining === 0
      ? "0 DRC violations remaining."
      : `${remaining} violation${remaining === 1 ? "" : "s"} remaining.`;

  switch (step.defect.kind) {
    case "short":
      return `Excised copper bridge at (${x},${y}) and rerouted clear of adjacent return; ${tail}`;
    case "open":
      return `Stitched open trace across (${x},${y}) via orthogonal A* dogleg; ${tail}`;
    case "crossing":
      return `Untangled trace crossing at (${x},${y}) onto perimeter channel; ${tail}`;
    case "spacing":
      return `Shifted trace at (${x},${y}) by 1 cell to restore IPC clearance; ${tail}`;
  }
}

function resolveEnvApiKey(): string | undefined {
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    if (metaEnv?.VITE_MUBIT_API_KEY) return metaEnv.VITE_MUBIT_API_KEY;
    if (metaEnv?.MUBIT_API_KEY) return metaEnv.MUBIT_API_KEY;
  } catch {
    // ignore
  }
  const proc = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process;
  if (proc?.env) {
    return proc.env.VITE_MUBIT_API_KEY || proc.env.MUBIT_API_KEY;
  }
  return undefined;
}

async function callMubitCommentary(
  userPrompt: string,
  cacheKey: string,
  fallback: string,
  opts: CommentaryOpts = {},
): Promise<string> {
  const hit = runtimeCache.get(cacheKey);
  if (hit) return hit;

  const apiKey = opts.apiKey ?? resolveEnvApiKey();
  const fetchFn = opts.fetchImpl ?? (typeof fetch !== "undefined" ? fetch : undefined);
  if (opts.offline || !apiKey || !fetchFn) {
    runtimeCache.set(cacheKey, fallback);
    return fallback;
  }

  const baseUrl = (opts.baseUrl ?? MUBIT_BASE_URL).replace(/\/$/, "");
  const model = opts.model ?? MUBIT_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8_000);

  try {
    const response = await fetchFn(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: COMMENTARY_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 64,
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Mubit HTTP ${response.status}`);
    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body.choices?.[0]?.message?.content;
    const note = validateCommentary(content);
    runtimeCache.set(cacheKey, note);
    return note;
  } catch {
    runtimeCache.set(cacheKey, fallback);
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}

/** Generate or retrieve a designer note for one `Generation`. */
export async function commentOnGeneration(
  gen: Generation,
  prev?: Generation,
  opts: CommentaryOpts = {},
): Promise<string> {
  const fallback =
    gen.note && gen.note !== "stub generation"
      ? gen.note
      : buildDeterministicGenerationNote(gen, prev);
  const cacheKey = `gen:${gen.index}:${gen.score.toFixed(2)}:${gen.board.violations.length}`;
  const prompt = `Generation #${gen.index}: score=${gen.score.toFixed(2)} (delta=${gen.delta >= 0 ? "+" : ""}${gen.delta.toFixed(2)}), copperCells=${totalCopperCells(gen)}, violations=${summarizeViolations(gen.board.violations)}. Return {"note": "..."}.`;
  return callMubitCommentary(prompt, cacheKey, fallback, opts);
}

/** Generate or retrieve a designer note for one `RepairStep`. */
export async function commentOnRepair(
  step: RepairStep,
  opts: CommentaryOpts = {},
): Promise<string> {
  const fallback =
    step.note && step.note !== "stub repair"
      ? step.note
      : buildDeterministicRepairNote(step);
  const cacheKey = `heal:${step.defect.kind}:${step.defect.at[0]},${step.defect.at[1]}:${step.after.score.toFixed(2)}`;
  const prompt = `Repair step: defect=${step.defect.kind} at (${step.defect.at[0]},${step.defect.at[1]}), action="${step.action}", score ${step.before.score.toFixed(2)} -> ${step.after.score.toFixed(2)}, remainingViolations=${step.after.violations.length}. Return {"note": "..."}.`;
  return callMubitCommentary(prompt, cacheKey, fallback, opts);
}

/** Unified helper for either a `Generation` or a `RepairStep`. */
export async function commentOnStep(
  step: Generation | RepairStep,
  opts: CommentaryOpts = {},
): Promise<string> {
  if ("defect" in step) {
    return commentOnRepair(step, opts);
  }
  return commentOnGeneration(step, undefined, opts);
}

/**
 * Wrap an `evolve()` stream and inject Mubit commentary into `generation.note`.
 */
export async function* withGenerationCommentary(
  stream: AsyncIterable<Generation>,
  opts: CommentaryOpts = {},
): AsyncGenerator<Generation, void, void> {
  let prev: Generation | undefined;
  for await (const gen of stream) {
    const note = await commentOnGeneration(gen, prev, opts);
    const enriched: Generation = { ...gen, note };
    yield enriched;
    prev = enriched;
  }
}

/**
 * Wrap a `heal()` stream and inject Mubit commentary into `step.note`.
 */
export async function* withRepairCommentary(
  stream: AsyncIterable<RepairStep>,
  opts: CommentaryOpts = {},
): AsyncGenerator<RepairStep, void, void> {
  for await (const step of stream) {
    const note = await commentOnRepair(step, opts);
    yield { ...step, note };
  }
}
