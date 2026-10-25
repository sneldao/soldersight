/**
 * Lane 3 — Golden Run Replay (`golden.ts`).
 *
 * Exposes the recorded Evolve + Heal runs from `data/foundry/golden.json` as
 * `AsyncIterable<Generation>` and `AsyncIterable<RepairStep>` matching Lane 1's
 * exact engine seam. Lane 2 can play the golden run by default (zero latency,
 * flake-proof demo) and swap in the live stream with a one-line change.
 */

import goldenData from "../../../../data/foundry/golden.json";
import type {
  BoardState,
  EvolveOpts,
  Generation,
  HealOpts,
  Netlist,
  RepairStep,
  Violation,
} from "../core/types";

const sleep = (ms: number): Promise<void> =>
  ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

function cloneBoard(board: BoardState): BoardState {
  return {
    w: board.w,
    h: board.h,
    pads: board.pads.map((p) => ({ ...p })),
    traces: board.traces.map((t) => ({
      net: t.net,
      path: t.path.map(([x, y]): [number, number] => [x, y]),
    })),
    ...(board.defects
      ? {
          defects: board.defects.map((d) => ({
            kind: d.kind as Violation["kind"],
            at: [d.at[0], d.at[1]] as [number, number],
            ...(d.detail ? { detail: d.detail } : {}),
          })),
        }
      : {}),
    score: board.score,
    violations: board.violations.map((v) => ({
      kind: v.kind as Violation["kind"],
      at: [v.at[0], v.at[1]] as [number, number],
      ...(v.detail ? { detail: v.detail } : {}),
    })),
  };
}

export interface GoldenEvolveRecord {
  presetId: string;
  brief: string;
  netlist: Netlist;
  generations: Generation[];
}

export interface GoldenHealRecord {
  boardId: string;
  title: string;
  image: string;
  initialBoard: BoardState;
  steps: RepairStep[];
}

export const GOLDEN_EVOLVE: GoldenEvolveRecord = {
  presetId: goldenData.evolve.presetId,
  brief: goldenData.evolve.brief,
  netlist: {
    pads: goldenData.evolve.netlist.pads.map((p) => ({ ...p })),
    nets: goldenData.evolve.netlist.nets.map((n) => [...n]),
  },
  generations: goldenData.evolve.generations.map((g) => ({
    index: g.index,
    score: g.score,
    delta: g.delta,
    note: g.note,
    board: cloneBoard(g.board as unknown as BoardState),
  })),
};

export const GOLDEN_HEAL: GoldenHealRecord = {
  boardId: goldenData.heal.boardId,
  title: goldenData.heal.title,
  image: goldenData.heal.image,
  initialBoard: cloneBoard(goldenData.heal.initialBoard as unknown as BoardState),
  steps: goldenData.heal.steps.map((s) => ({
    defect: {
      kind: s.defect.kind as Violation["kind"],
      at: [s.defect.at[0], s.defect.at[1]] as [number, number],
      ...(s.defect.detail ? { detail: s.defect.detail } : {}),
    },
    action: s.action,
    note: s.note,
    verified: s.verified,
    before: cloneBoard(s.before as unknown as BoardState),
    after: cloneBoard(s.after as unknown as BoardState),
  })),
};

export const GOLDEN_RUN = {
  version: goldenData.version,
  recordedAt: goldenData.recordedAt,
  mubitModel: goldenData.mubitModel,
  saplingEndpoint: goldenData.saplingEndpoint,
  saplingWeightsSha256: goldenData.saplingWeightsSha256,
  evolve: GOLDEN_EVOLVE,
  heal: GOLDEN_HEAL,
};

/**
 * Replay the golden Evolve run as an `AsyncGenerator<Generation>` matching
 * Lane 1's `evolve(netlist, opts)` signature.
 */
export async function* replayGoldenEvolve(
  _netlist: Netlist = GOLDEN_EVOLVE.netlist,
  opts: EvolveOpts = {},
): AsyncGenerator<Generation, void, void> {
  const interval = opts.stepIntervalMs ?? 0;
  const max = opts.maxGenerations ?? GOLDEN_EVOLVE.generations.length;
  const minScore = opts.minScore ?? 1;

  for (let i = 0; i < Math.min(max, GOLDEN_EVOLVE.generations.length); i++) {
    const gen = GOLDEN_EVOLVE.generations[i];
    yield {
      index: gen.index,
      score: gen.score,
      delta: gen.delta,
      note: gen.note,
      board: cloneBoard(gen.board),
    };
    if (gen.score >= minScore) break;
    if (i < GOLDEN_EVOLVE.generations.length - 1 && interval > 0) {
      await sleep(interval);
    }
  }
}

/**
 * Replay the golden Heal run as an `AsyncGenerator<RepairStep>` matching
 * Lane 1's `heal(board, opts)` signature.
 */
export async function* replayGoldenHeal(
  _board: BoardState = GOLDEN_HEAL.initialBoard,
  opts: HealOpts = {},
): AsyncGenerator<RepairStep, void, void> {
  const interval = opts.stepIntervalMs ?? 0;

  for (let i = 0; i < GOLDEN_HEAL.steps.length; i++) {
    const step = GOLDEN_HEAL.steps[i];
    yield {
      defect: { ...step.defect, at: [step.defect.at[0], step.defect.at[1]] },
      action: step.action,
      note: step.note,
      verified: step.verified,
      before: cloneBoard(step.before),
      after: cloneBoard(step.after),
    };
    if (i < GOLDEN_HEAL.steps.length - 1 && interval > 0) {
      await sleep(interval);
    }
  }
}
