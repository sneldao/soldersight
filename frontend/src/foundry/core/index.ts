/**
 * Foundry engine — public API (stub build).
 *
 * STUB: fake-but-valid async streams so Lanes 2 & 3 can integrate today.
 * The signatures are final; swapping stubs for the real engine is invisible
 * to callers. Real implementations land in router.ts / drc.ts / evolve.ts /
 * heal.ts behind these same exports.
 *
 * Seam contract (the whole integration):
 *   - both modes are `AsyncIterable`s — Lane 2 animates whatever streams out,
 *     Lane 3 injects commentary into `note`.
 *   - deterministic: same inputs + seed -> identical replay.
 */

import type {
  BoardState,
  DrcReport,
  EvolveOpts,
  Generation,
  HealOpts,
  Netlist,
  Pad,
  RepairStep,
  Trace,
  Violation,
} from "./types";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Laid-out pads for a netlist: simple bounded grid arrangement (stub shape). */
function stubLayout(netlist: Netlist): { w: number; h: number; pads: Pad[] } {
  const cols = Math.ceil(Math.sqrt(netlist.pads.length)) || 1;
  const cell = 3;
  const pads = netlist.pads.map((pad, i) => ({
    ...pad,
    x: (i % cols) * cell + 2,
    y: Math.floor(i / cols) * cell + 2,
  }));
  const maxX = Math.max(...pads.map((p) => p.x), 4);
  const maxY = Math.max(...pads.map((p) => p.y), 4);
  return { w: maxX + 3, h: maxY + 3, pads };
}

/**
 * STUB Evolve: yields `maxGenerations` (default 12) generations with a
 * plausibly-climbing score on the laid-out board geometry.
 */
export async function* evolve(
  netlist: Netlist,
  opts: EvolveOpts = {},
): AsyncGenerator<Generation, void, void> {
  const { w, h, pads } = stubLayout(netlist);
  const max = opts.maxGenerations ?? 12;
  const interval = opts.stepIntervalMs ?? 100;
  let best = 0.4;
  for (let index = 0; index < max; index++) {
    const score = Math.min(0.98, best + (0.98 - best) * 0.25 + 0.01);
    const board: BoardState = { w, h, pads, traces: [], score, violations: [] };
    yield { index, board, score, delta: index === 0 ? score : score - best };
    best = score;
    await sleep(interval);
  }
}

/**
 * STUB Heal: replays `board.defects` (or a synthetic one) as RepairSteps,
 * flipping each defect red->green with before/after snapshots.
 */
export async function* heal(
  board: BoardState,
  opts: HealOpts = {},
): AsyncGenerator<RepairStep, void, void> {
  const interval = opts.stepIntervalMs ?? 100;
  const defects: Violation[] =
    board.defects?.length
      ? board.defects
      : [{ kind: "open", at: [Math.floor(board.w / 2), Math.floor(board.h / 2)] }];
  let current = board;
  for (const defect of defects) {
    const after: BoardState = { ...current, score: Math.min(1, current.score + 0.2) };
    after.violations = current.violations.filter((v) => v !== defect && v.at[0] !== defect.at[0] && v.at[1] !== defect.at[1]);
    yield {
      defect,
      action: `fix: ${defect.kind} at ${defect.at[0]},${defect.at[1]}`,
      before: current,
      after,
      verified: true,
    };
    current = after;
    await sleep(interval);
  }
}

/** STUB route: straight L-shaped path from the net's first pad toward its second. */
export function route(board: BoardState, net: string): Trace | null {
  const netPads = board.pads.filter((p) => p.net === net);
  if (netPads.length < 2) return null;
  const [a, b] = netPads;
  const path: [number, number][] = [];
  let [cx, cy] = [a.x, a.y];
  path.push([cx, cy]);
  while (cx !== b.x) {
    cx += Math.sign(b.x - cx);
    path.push([cx, cy]);
  }
  while (cy !== b.y) {
    cy += Math.sign(b.y - cy);
    path.push([cx, cy]);
  }
  return { net, path };
}

/** STUB score: passes the board's own current numbers through. */
export function score(board: BoardState): DrcReport {
  return {
    score: board.score,
    violations: board.violations.map((v) => ({ ...v })),
  };
}

/** All violation kinds, for UI legends. */
export const VIOLATION_KINDS: Violation["kind"][] = ["short", "open", "crossing", "spacing"];
