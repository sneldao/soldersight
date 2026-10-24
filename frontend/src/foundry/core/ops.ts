/**
 * Board surgery shared by heal + evolve: swap a net's traces for a fresh
 * route and re-run DRC. Everything returns a *new* board object (pure).
 */

import { score } from "./drc";
import { cloneBoard } from "./grid";
import { route } from "./router";
import type { BoardState } from "./types";

/**
 * Replace `net`'s traces with a freshly routed one (seeded, so a retry with
 * a different rng explores a different topology). Returns the rescored board,
 * or null if the net cannot be routed under the given constraints.
 */
export function rerouteNet(
  board: BoardState,
  net: string,
  rng: () => number,
  clearance = false,
): BoardState | null {
  const staged = cloneBoard(board);
  staged.traces = staged.traces.filter((t) => t.net !== net);
  const trace = route(staged, net, { rng, clearance });
  if (!trace) return null;
  staged.traces.push(trace);
  const report = score(staged);
  staged.score = report.score;
  staged.violations = report.violations;
  return staged;
}

/** Total copper length — used to prefer equal-score-but-cleaner layouts. */
export function totalTraceLength(board: BoardState): number {
  let n = 0;
  for (const t of board.traces) n += t.path.length;
  return n;
}
