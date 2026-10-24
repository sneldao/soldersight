/**
 * Foundry engine — public API (real build).
 *
 * The seam contract is unchanged from the stubs:
 *   - both modes are `AsyncIterable`s — Lane 2 animates whatever streams out,
 *     Lane 3 injects commentary into `note`.
 *   - deterministic: same inputs + seed -> identical replay.
 */

export { evolve } from "./evolve";
export { heal } from "./heal";
export { route, type RouteOpts } from "./router";
export { score } from "./drc";
export { rerouteNet, totalTraceLength } from "./ops";
export { mulberry32, pick, shuffle } from "./rng";

export type {
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

/** All violation kinds, for UI legends. */
export const VIOLATION_KINDS: import("./types").Violation["kind"][] = [
  "short",
  "open",
  "crossing",
  "spacing",
];
