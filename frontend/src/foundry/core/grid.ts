/**
 * Grid plumbing shared by router / drc / heal / evolve.
 * Pure data — no React, no network, no UI.
 */

import type { BoardState } from "./types";

/** One cell at most one owner: a pad or one net's trace. */
export interface Occupant {
  kind: "pad" | "trace";
  net: string;
  id: string;
}

export const key = (x: number, y: number): string => `${x},${y}`;

export function parseKey(k: string): [number, number] {
  const i = k.indexOf(",");
  return [Number(k.slice(0, i)), Number(k.slice(i + 1))];
}

export const DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
export const DIAGS: [number, number][] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** Cell -> occupant. Pads win over traces; same-net trace overlap collapses. */
export function occupancy(board: BoardState): Map<string, Occupant> {
  const occ = new Map<string, Occupant>();
  for (const p of board.pads) occ.set(key(p.x, p.y), { kind: "pad", net: p.net, id: p.id });
  for (const t of board.traces) {
    for (const [x, y] of t.path) {
      const k = key(x, y);
      const existing = occ.get(k);
      if (existing && existing.net !== t.net) continue; // inconsistent input: keep first owner
      occ.set(k, { kind: "trace", net: t.net, id: t.net });
    }
  }
  return occ;
}

/** net -> occupied cell keys (pads + trace cells). */
export function netCells(board: BoardState): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  const add = (net: string, k: string): void => {
    let s = m.get(net);
    if (!s) {
      s = new Set();
      m.set(net, s);
    }
    s.add(k);
  };
  for (const p of board.pads) add(p.net, key(p.x, p.y));
  for (const t of board.traces) for (const [x, y] of t.path) add(t.net, key(x, y));
  return m;
}

export function neighborsOf(x: number, y: number, dirs: [number, number][] = DIRS): [number, number][] {
  return dirs.map(([dx, dy]): [number, number] => [x + dx, y + dy]);
}

/** Deep copy — boards are plain JSON data, so structuredClone is exact. */
export function cloneBoard(board: BoardState): BoardState {
  return structuredClone(board);
}

/** Organic pacing between streamed steps. UI drives cadence via opts. */
export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
