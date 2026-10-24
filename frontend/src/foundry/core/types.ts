/**
 * Foundry core data contracts — FROZEN.
 *
 * Lane 1 owns this file. Lanes 2 & 3 import from it, never edit it.
 * Every type here is plain data (no React, no network) so the whole
 * engine runs client-side in the React app and the HF Space alike.
 *
 * Coordinate system: integer grid cells, `[x, y]`, `0 <= x < w`, `0 <= y < h`.
 * One cell can be occupied by at most one net's trace / pad.
 */

/** A solder pad — an anchor point of one net on the grid. */
export interface Pad {
  id: string;
  x: number;
  y: number;
  net: string;
}

/** A routed path: the ordered grid cells a trace occupies, endpoints inclusive. */
export interface Trace {
  net: string;
  path: [number, number][];
}

/** A DRC defect. `at` is a representative grid cell (for pulsing the overlay). */
export interface Violation {
  kind: "short" | "open" | "crossing" | "spacing";
  at: [number, number];
  /** Dot path for pinpointing the culprit(s), e.g. net ids / pad ids. */
  detail?: string;
}

/** A full snapshot of the board at some moment. */
export interface BoardState {
  w: number;
  h: number;
  pads: Pad[];
  traces: Trace[];
  /** Heal mode: the defects this board is known to have (subset of `violations` by design of the defect planter). */
  defects?: Violation[];
  /** 0..1 fitness (DRC-derived). */
  score: number;
  /** Current DRC violations (shorts / opens / spacing / crossings). */
  violations: Violation[];
}

/** Evolve-mode input: the design to lay out. `nets` maps net -> its pad ids. */
export interface Netlist {
  pads: Pad[];
  /** pad ids per net, e.g. [["u1.1","u2.2"], ...] */
  nets: string[][];
}

/** One generation emitted by `evolve()`. `delta` = score vs previous best. */
export interface Generation {
  index: number;
  board: BoardState;
  score: number;
  delta: number;
  /** Injected by Lane 3 (Mubit commentary). Engine may leave it undefined. */
  note?: string;
}

/** One repair emitted by `heal()`. `before`/`after` bracket the fix visually. */
export interface RepairStep {
  defect: Violation;
  /** e.g. "reroute: NET3 detours around the short" / "cut + reroute: NET7's open leg". */
  action: string;
  before: BoardState;
  after: BoardState;
  /** Injected by Lane 3 (Mubit commentary). */
  note?: string;
  /** True after a post-heal DRC re-check confirms the defect is gone. */
  verified?: boolean;
}

export interface EvolveOpts {
  /** Seed for the deterministic RNG — identical inputs replay identically. */
  seed?: number;
  /** Hard cap on generations. */
  maxGenerations?: number;
  /** Stop early once score reaches this. */
  minScore?: number;
  /** Cadence between yielded generations, ms (UI passes ~2000; tests pass ~0). */
  stepIntervalMs?: number;
}

export interface HealOpts {
  seed?: number;
  /** Cadence between yielded repair steps, ms. */
  stepIntervalMs?: number;
}

/** Result type of `score()` — the DRC report. */
export interface DrcReport {
  score: number;
  violations: Violation[];
}
