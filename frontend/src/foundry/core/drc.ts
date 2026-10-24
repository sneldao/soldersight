/**
 * DRC — design-rule check + fitness score.
 * `score(board)` is the single authority on how good a board is; both
 * evolve (accept/reject mutations) and heal (verify a fix) consult it.
 *
 * Checks, in weight order:
 *  - open:    a multi-pad net whose pads are split across >1 connected region
 *  - short:   two different nets occupy 4-adjacent cells (incl. pad adjacency)
 *  - crossing: structurally impossible in the one-owner cell model;
 *             kept in the contract for downstream data
 *  - spacing: two different nets diagonal-adjacent (decorative penalty)
 *  - density: too much of the board eaten by copper
 */

import type { BoardState, DrcReport, Pad, Violation } from "./types";
import { DIAGS, DIRS, key, netCells, occupancy, parseKey } from "./grid";

const OPEN_PENALTY = 0.35;
const SHORT_PENALTY = 0.3;
const CROSSING_PENALTY = 0.25;
const SPACING_PENALTY = 0.06;
const DENSITY_PENALTY_PER_EXCESS = 0.8; // per unit fill above DENSITY_SOFT_CAP
const DENSITY_SOFT_CAP = 0.45;

/** Full DRC: fitness 0..1 + every violation currently on the board. */
export function score(board: BoardState): DrcReport {
  const occ = occupancy(board);
  const violations: Violation[] = [];

  // --- shorts (orthogonal) + spacing (diagonal) between different nets ---
  for (const [k, o] of occ) {
    const [x, y] = parseKey(k);
    for (const dir of DIRS) {
      const nk = key(x + dir[0], y + dir[1]);
      const other = occ.get(nk);
      if (!other || other.net === o.net || nk <= k) continue; // count each pair once
      violations.push({ kind: "short", at: parseKey(nk), detail: `${o.net}~${other.net}` });
    }
    for (const dir of DIAGS) {
      const nk = key(x + dir[0], y + dir[1]);
      const other = occ.get(nk);
      if (!other || other.net === o.net || nk <= k) continue;
      violations.push({ kind: "spacing", at: parseKey(nk), detail: `${o.net}~${other.net}` });
    }
  }

  // --- opens: each multi-pad net must live in exactly one connected region ---
  const cellsByNet = netCells(board);
  const padsByNet = new Map<string, Pad[]>();
  for (const p of board.pads) {
    const list = padsByNet.get(p.net) ?? [];
    list.push(p);
    padsByNet.set(p.net, list);
  }
  for (const [net, pads] of padsByNet) {
    if (pads.length < 2) continue; // single-pad net: nothing to connect
    const cells = cellsByNet.get(net) ?? new Set<string>();
    const regions = connectedRegions(cells);
    if (regions.length <= 1) continue;
    // every pad region beyond the largest is an unrouted island -> open
    regions.sort((a, b) => b.size - a.size || minKeyOf(a).localeCompare(minKeyOf(b)));
    for (let r = 1; r < regions.length; r++) {
      const padInRegion = pads.find((p) => regions[r]!.has(key(p.x, p.y)));
      const at: [number, number] = padInRegion
        ? [padInRegion.x, padInRegion.y]
        : [...parseKey(minKeyOf(regions[r]!))];
      violations.push({ kind: "open", at, detail: net });
    }
  }

  violations.sort(
    (a, b) => key(a.at[0], a.at[1]).localeCompare(key(b.at[0], b.at[1])) || a.kind.localeCompare(b.kind),
  );

  // --- fitness ---
  const opens = violations.filter((v) => v.kind === "open").length;
  const shorts = violations.filter((v) => v.kind === "short").length;
  const crossings = violations.filter((v) => v.kind === "crossing").length;
  const spacing = violations.filter((v) => v.kind === "spacing").length;
  const fill = occ.size / Math.max(1, board.w * board.h);
  let s = 1;
  s -= opens * OPEN_PENALTY;
  s -= shorts * SHORT_PENALTY;
  s -= crossings * CROSSING_PENALTY;
  s -= spacing * SPACING_PENALTY;
  if (fill > DENSITY_SOFT_CAP) s -= (fill - DENSITY_SOFT_CAP) * DENSITY_PENALTY_PER_EXCESS;
  return { score: Math.max(0, Math.min(1, Math.round(s * 1000) / 1000)), violations };
}

/** Connected components (4-adjacency) of a set of cell keys. */
function connectedRegions(cells: Set<string>): Set<string>[] {
  const seen = new Set<string>();
  const regions: Set<string>[] = [];
  for (const start of cells) {
    if (seen.has(start)) continue;
    const region = new Set<string>();
    const queue: string[] = [start];
    seen.add(start);
    while (queue.length > 0) {
      const k = queue.pop()!;
      region.add(k);
      const [x, y] = parseKey(k);
      for (const dir of DIRS) {
        const nk = key(x + dir[0], y + dir[1]);
        if (cells.has(nk) && !seen.has(nk)) {
          seen.add(nk);
          queue.push(nk);
        }
      }
    }
    regions.push(region);
  }
  return regions;
}

function minKeyOf(s: Set<string>): string {
  let min = "";
  for (const k of s) if (!min || k < min) min = k;
  return min;
}
