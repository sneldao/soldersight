/**
 * A* grid router — collision-aware pathfinding between a net's pads.
 * The visual workhorse: everything (evolve + heal) routes through this.
 *
 * - 4-connected moves, manhattan heuristic (admissible).
 * - Blocks cells owned by other nets; passes through own-net cells.
 * - Optional `clearance`: intermediate cells also avoid all cells
 *   4-adjacent to another net (used by heal to de-short, and by DRC-driven
 *   evolution retries).
 * - Seeded RNG breaks A* ties, so rerouting the same net with a new rng
 *   explores a different (often cleaner) equal-length path — this is the
 *   mutation operator the evolutionary loop climbs with.
 */

import type { BoardState, Pad, Trace } from "./types";
import { DIRS, key, neighborsOf, occupancy, parseKey, type Occupant } from "./grid";
import { mulberry32, shuffle } from "./rng";

export interface RouteOpts {
  /** Seeded tie-breaker; different seeds -> different valid topologies. */
  rng?: () => number;
  /** Route with one cell of gap vs every other net (takes more cells). */
  clearance?: boolean;
}

type PadLike = Pick<Pad, "id" | "x" | "y">;

/** Multi-pad nets route as a greedy nearest-neighbor chain of A* legs. */
export function route(board: BoardState, net: string, opts: RouteOpts = {}): Trace | null {
  const rng = opts.rng ?? mulberry32(0xfe00d);
  const netPads = board.pads.filter((p) => p.net === net);
  if (netPads.length < 2) return null;

  const ordered = orderPads(netPads);
  const occ = occupancy(board);
  const own = new Set<string>();
  const cells: [number, number][] = [];

  for (let i = 0; i < ordered.length - 1; i++) {
    const clearance = clearanceSet(occ, net, opts.clearance === true);
    const leg = astar(
      ordered[i]!.x,
      ordered[i]!.y,
      ordered[i + 1]!.x,
      ordered[i + 1]!.y,
      occ,
      own,
      clearance,
      net,
      rng,
    );
    if (!leg) return null; // any failed leg fails the net deterministically
    for (const c of leg) own.add(key(c[0], c[1]));
    // concat legs, skipping the shared pad cell at each junction
    const startAt = cells.length > 0 ? 1 : 0;
    for (let j = startAt; j < leg.length; j++) cells.push(leg[j]!);
  }
  if (cells.length < 2) return null;
  return { net, path: cells };
}

/** Greedy nearest-neighbor order; deterministic (id sorts break ties). */
function orderPads(pads: PadLike[]): PadLike[] {
  const rest = [...pads].sort((a, b) => (a.id < b.id ? -1 : 1));
  const chain = [rest.shift()!];
  while (rest.length > 0) {
    const last = chain[chain.length - 1]!;
    rest.sort((a, b) => {
      const da = Math.abs(a.x - last.x) + Math.abs(a.y - last.y);
      const db = Math.abs(b.x - last.x) + Math.abs(b.y - last.y);
      return da - db || (a.id < b.id ? -1 : 1);
    });
    chain.push(rest.shift()!);
  }
  return chain;
}

/** Cells that are 4-adjacent to another net's cells (empty for no clearance). */
function clearanceSet(occ: Map<string, Occupant>, net: string, enabled: boolean): Set<string> {
  const set = new Set<string>();
  if (!enabled) return set;
  for (const [k, o] of occ) {
    if (o.net === net) continue;
    const [x, y] = parseKey(k);
    for (const nk of neighborsOf(x, y, DIRS)) set.add(key(nk[0], nk[1]));
  }
  return set;
}

/** A* over 4-connected cells. Returns the ordered path incl. endpoints. */
function astar(
  sx: number,
  sy: number,
  gx: number,
  gy: number,
  occ: Map<string, Occupant>,
  own: Set<string>,
  clearance: Set<string>,
  net: string,
  rng: () => number,
): [number, number][] | null {
  const startK = key(sx, sy);
  const goalK = key(gx, gy);

  const allowed = (x: number, y: number): boolean => {
    const k = key(x, y);
    const o = occ.get(k);
    if (o) return o.net === net; // other net's cell: blocked; own: pass-through
    if (own.has(k)) return true; // cells routed earlier in this call
    if (clearance.has(k) && k !== startK && k !== goalK) return false;
    return true;
  };
  if (!allowed(sx, sy) || !allowed(gx, gy)) return null;

  const h = (x: number, y: number): number => Math.abs(x - gx) + Math.abs(y - gy);
  const gScore = new Map<string, number>([[startK, 0]]);
  const parent = new Map<string, string>();
  // tiny grid — an open list we min-scan is plenty fast and dependency-free
  let open: { k: string; x: number; y: number; f: number }[] = [{ k: startK, x: sx, y: sy, f: h(sx, sy) }];
  const closed = new Set<string>();

  while (open.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) if (open[i]!.f < open[bestIdx]!.f) bestIdx = i;
    const current = open[bestIdx]!;
    open = open.filter((_, i) => i !== bestIdx);

    if (current.k === goalK) {
      const path: [number, number][] = [];
      let k: string | undefined = goalK;
      while (k) {
        path.push(parseKey(k));
        k = parent.get(k);
      }
      return path.reverse();
    }
    if (closed.has(current.k)) continue;
    closed.add(current.k);

    const nbrs = neighborsOf(current.x, current.y, DIRS);
    shuffle(rng, nbrs); // seeded tie-break: the mutation operator for evolve()
    for (const [nx, ny] of nbrs) {
      const nk = key(nx, ny);
      if (closed.has(nk) || !allowed(nx, ny)) continue;
      const tentative = gScore.get(current.k)! + 1;
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, tentative);
        parent.set(nk, current.k);
        open.push({ k: nk, x: nx, y: ny, f: tentative + h(nx, ny) });
      }
    }
  }
  return null;
}
