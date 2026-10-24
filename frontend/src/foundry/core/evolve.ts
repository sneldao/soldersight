/**
 * Evolve — the board designs itself. A seeded evolutionary loop:
 * lay out -> route all nets -> score -> mutate (re-route a net / nudge a
 * pad, seeded) -> keep the improvement -> repeat. The stream yields one
 * `Generation` per improvement, so the UI's fitness line climbs and the
 * board visibly refines every step. Deterministic: same netlist + seed
 * replays identically.
 */

import type { BoardState, EvolveOpts, Generation, Netlist, Pad, Violation } from "./types";
import { DIAGS, DIRS, cloneBoard, key, neighborsOf, occupancy, sleep } from "./grid";
import { mulberry32, pick, shuffle } from "./rng";
import { score } from "./drc";
import { route } from "./router";
import { rerouteNet, totalTraceLength } from "./ops";

const IDLE_LIMIT = 12; // give up after this many consecutive unproductive mutations

export async function* evolve(
  netlist: Netlist,
  opts: EvolveOpts = {},
): AsyncGenerator<Generation, void, void> {
  const maxGenerations = opts.maxGenerations ?? 30;
  const minScore = opts.minScore ?? 0.98;
  const interval = opts.stepIntervalMs ?? 100;
  const rng = mulberry32(opts.seed ?? 0xc01d);

  const seed0 = seedBoard(netlist, rng);
  const seed1 = routeAll(seed0, rng);
  const r0 = score(seed1);
  let best: BoardState = { ...seed1, score: r0.score, violations: r0.violations };

  // Baseline generation: the chart starts here.
  let index = 0;
  yield { index, board: cloneBoard(best), score: best.score, delta: 0 };
  await sleep(interval);

  let idle = 0;
  while (index < maxGenerations && idle < IDLE_LIMIT && best.score < minScore) {
    const candidate = mutate(best, rng);
    if (candidate && better(candidate, best)) {
      const delta = Math.round((candidate.score - best.score) * 1000) / 1000;
      best = candidate;
      index += 1;
      yield { index, board: cloneBoard(best), score: best.score, delta };
      await sleep(interval);
      idle = 0;
    } else {
      idle += 1;
    }
  }
}

/** A new candidate is kept if it scores higher, or ties score with less copper. */
function better(candidate: BoardState, best: BoardState): boolean {
  if (candidate.score > best.score) return true;
  return candidate.score === best.score && totalTraceLength(candidate) < totalTraceLength(best);
}

/** --- initial population --- */

/** Spread pads on a coarse grid (organic order, guaranteed mutual spacing). */
function seedBoard(netlist: Netlist, rng: () => number): BoardState {
  const n = Math.max(1, netlist.pads.length);
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const STEP = 3;
  const w = cols * STEP + 3;
  const h = rows * STEP + 3;
  const slots = shuffle(rng, [...netlist.pads]);
  const pads: Pad[] = slots.map((p, i) => ({
    id: p.id,
    net: p.net,
    x: 2 + (i % cols) * STEP,
    y: 2 + Math.floor(i / cols) * STEP,
  }));
  return { w, h, pads, traces: [], score: 0, violations: [] };
}

/** Route every net (in seed-shuffled net order); clearance as fallback. */
function routeAll(board: BoardState, rng: () => number): BoardState {
  const nets = [...new Set(board.pads.map((p) => p.net))];
  const ordered = shuffle(rng, nets);
  const staged = cloneBoard(board);
  for (const net of ordered) {
    const trace = route(staged, net, { rng }) ?? route(staged, net, { rng, clearance: true });
    if (trace) staged.traces.push(trace);
  }
  return staged;
}

/** --- mutation operators (seeded — the evolution's variation source) --- */

function mutate(best: BoardState, rng: () => number): BoardState | null {
  const board = cloneBoard(best);
  const viol = board.violations;

  // mostly DRC-driven: aim mutations at whatever is still wrong
  if (viol.length > 0 && rng() < 0.85) {
    const v = pick(rng, viol);
    if (v.kind === "open") {
      const net = v.detail && !v.detail.includes("~") ? v.detail : nearestNet(board, v.at);
      if (net) {
        const after = rerouteNet(board, net, rng, rng() < 0.5);
        if (after) return after;
      }
    } else {
      // short / spacing / crossing: detour one side of the violation
      const net = victimNear(board, v, rng);
      if (net) {
        const after = rerouteNet(board, net, rng, true) ?? rerouteNet(board, net, rng, false);
        if (after) return after;
      }
    }
  }

  // otherwise: explore — re-route a random net or drift a pad
  if (rng() < 0.3) return nudgePad(board, rng);
  const nets = [...new Set(board.pads.map((p) => p.net))].filter(
    (net) => board.pads.filter((p) => p.net === net).length >= 2,
  );
  if (nets.length === 0) return null;
  const net = pick(rng, nets);
  return rerouteNet(board, net, rng, rng() < 0.3);
}

/** Move one pad to a free neighboring cell, then re-route its net. */
function nudgePad(board: BoardState, rng: () => number): BoardState | null {
  const occ = occupancy(board);
  if (board.pads.length === 0) return null;
  const pad = pick(rng, board.pads);
  const cands: [number, number][] = neighborsOf(pad.x, pad.y, [...DIRS, ...DIAGS]).filter(
    ([x, y]) => x >= 1 && y >= 1 && x < board.w - 1 && y < board.h - 1 && !occ.has(key(x, y)),
  );
  if (cands.length === 0) return null;
  const [tx, ty] = pick(rng, cands);
  const nudged = cloneBoard(board);
  nudged.pads = nudged.pads.map((p) => (p.id === pad.id ? { ...p, x: tx, y: ty } : p));
  return rerouteNet(nudged, pad.net, rng, rng() < 0.5) ?? rerouteNet(nudged, pad.net, rng, false);
}

function nearestNet(board: BoardState, at: [number, number]): string | null {
  let best: Pad | null = null;
  for (const p of board.pads) {
    const d = Math.abs(p.x - at[0]) + Math.abs(p.y - at[1]);
    if (!best || d < Math.abs(best.x - at[0]) + Math.abs(best.y - at[1])) best = p;
  }
  return best?.net ?? null;
}

/** One net implicated in the violation; the cheaper reroute target. */
function victimNear(board: BoardState, v: Violation, rng: () => number): string | null {
  const occ = occupancy(board);
  const seen = new Set<string>();
  for (const [dx, dy] of [...DIRS, ...DIAGS]) {
    const o = occ.get(key(v.at[0] + dx, v.at[1] + dy));
    if (o) seen.add(o.net);
  }
  const routable = [...seen].filter((n) => board.pads.filter((p) => p.net === n).length >= 2);
  return routable.length > 0 ? pick(rng, routable) : null;
}
