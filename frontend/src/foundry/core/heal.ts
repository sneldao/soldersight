/**
 * Heal — turn a defective board green, one streamed RepairStep at a time.
 *
 * For each planted defect we compute the real fix with the shared engine
 * primitives (router + DRC): an open is re-routed; a short is resolved by
 * detouring the cheaper net with a 1-cell clearance. Every step carries the
 * before/after boards the UI animates between, plus `verified` from a
 * post-fix DRC re-check — honest even when a fix is impossible.
 */

import type { BoardState, HealOpts, Pad, RepairStep, Violation } from "./types";
import { DIRS, cloneBoard, netCells, occupancy, sleep } from "./grid";
import { mulberry32 } from "./rng";
import { rerouteNet } from "./ops";

const SEARCH_RADIUS = 2; // defect.at may point at either offending cell

export async function* heal(
  board: BoardState,
  opts: HealOpts = {},
): AsyncGenerator<RepairStep, void, void> {
  const interval = opts.stepIntervalMs ?? 100;
  const rng = mulberry32(opts.seed ?? 0xbea7);
  let current = cloneBoard(board);

  const defects: Violation[] =
    current.defects && current.defects.length > 0
      ? current.defects
      : current.violations.filter((v) => v.kind === "short" || v.kind === "open");

  for (const defect of defects) {
    if (defectResolved(current, defect)) continue; // an earlier fix already cleared this one
    const before = cloneBoard(current);
    let got: BoardState | null = null;
    let action = `fix: ${defect.kind} at ${defect.at[0]},${defect.at[1]}`;

    if (defect.kind === "open") {
      const r1 = fixOpen(before, defect, rng);
      if (r1) {
        got = r1;
        action = `reroute: reconnected ${netOf(before, defect) ?? "net"}`;
      }
    } else {
      const r1 = fixShort(before, defect, rng);
      if (r1) {
        got = r1;
        action = `detour: rebuilt trace with 1-cell clearance`;
      }
    }

    if (got) {
      current = got;
      const verified = defectResolved(current, defect);
      if (!verified) action += " (partial)";
      yield { defect, action, before, after: cloneBoard(current), verified };
    } else {
      // No fix found: stream the truth rather than pretending.
      yield {
        defect,
        action: `blocked: no fix for ${defect.kind} at ${defect.at[0]},${defect.at[1]}`,
        before,
        after: cloneBoard(before),
        verified: false,
      };
    }
    await sleep(interval);
  }
}

/** True if the exact violation we set out to fix is gone. */
function defectResolved(board: BoardState, defect: Violation): boolean {
  return !board.violations.some(
    (v) => v.kind === defect.kind && v.at[0] === defect.at[0] && v.at[1] === defect.at[1],
  );
}

/** --- open defects --- */

function fixOpen(before: BoardState, defect: Violation, rng: () => number): BoardState | null {
  const target = netOf(before, defect);
  if (!target) return null;
  // plain reroute first; clearance reroute as the careful fallback
  for (const clearance of [false, true]) {
    const after = rerouteNet(before, target, rng, clearance);
    if (after && worthIt(before, after, defect)) return after;
  }
  return null;
}

function netOf(board: BoardState, defect: Violation): string | null {
  if (defect.detail && !defect.detail.includes("~")) return defect.detail;
  // geometry fallback: nearest pad to the flagged cell
  let best: Pad | null = null;
  for (const p of board.pads) {
    const d = Math.abs(p.x - defect.at[0]) + Math.abs(p.y - defect.at[1]);
    if (!best || d < Math.abs(best.x - defect.at[0]) + Math.abs(best.y - defect.at[1])) best = p;
  }
  return best?.net ?? null;
}

/** --- short / spacing defects --- */

/** The two nets that touch near `at`, discovered from the actual geometry. */
function conflictingNets(board: BoardState, at: [number, number]): [string, string] | null {
  const occ = occupancy(board);
  const cells: { k: string; x: number; y: number; net: string }[] = [];
  for (let dx = -SEARCH_RADIUS; dx <= SEARCH_RADIUS; dx++) {
    for (let dy = -SEARCH_RADIUS; dy <= SEARCH_RADIUS; dy++) {
      const x = at[0] + dx;
      const y = at[1] + dy;
      if (x < 0 || y < 0 || x >= board.w || y >= board.h) continue;
      const o = occ.get(`${x},${y}`);
      if (o) cells.push({ k: `${x},${y}`, x, y, net: o.net });
    }
  }
  cells.sort(
    (a, b) =>
      Math.abs(a.x - at[0]) + Math.abs(a.y - at[1]) - (Math.abs(b.x - at[0]) + Math.abs(b.y - at[1])) ||
      a.k.localeCompare(b.k),
  );
  for (const c of cells) {
    for (const dir of DIRS) {
      const o = occ.get(`${c.x + dir[0]},${c.y + dir[1]}`);
      if (o && o.net !== c.net) return [c.net, o.net].sort() as [string, string];
    }
  }
  return null;
}

function fixShort(before: BoardState, defect: Violation, rng: () => number): BoardState | null {
  const pair = conflictingNets(before, defect.at);
  if (!pair) return null;
  const counts = netCells(before);
  const size = (net: string): number => counts.get(net)?.size ?? 0;
  // detour the cheaper net first; fall back to the other side of the short
  const victims = [...pair].sort((a, b) => size(a) - size(b));
  for (const victim of victims) {
    if (before.pads.filter((p) => p.net === victim).length < 2) continue; // single-pad net: unroutable
    for (const clearance of [true, false]) {
      const after = rerouteNet(before, victim, rng, clearance);
      if (after && worthIt(before, after, defect)) return after;
    }
  }
  return null;
}

/** Accept a fix only if it beats the defect we were aimed at. */
function worthIt(before: BoardState, after: BoardState, defect: Violation): boolean {
  if (defectResolved(after, defect)) return true;
  return after.violations.length < before.violations.length;
}
