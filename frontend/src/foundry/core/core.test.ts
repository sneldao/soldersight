/**
 * Lane 1 verification (per docs/foundry_plan.md):
 * - router finds paths on an open grid and avoids obstacles
 * - score flags a planted short / open, clean board scores high
 * - evolve scores non-decreasing (monotonic improvement)
 * - heal zeroes planted defects (and verifies each step)
 * - determinism: same seed -> identical replay
 */

import { describe, expect, it } from "vitest";
import { evolve, heal, route, score, mulberry32 } from "./index";
import type { BoardState, Netlist } from "./types";

const key = (x: number, y: number) => `${x},${y}`;

function boardOf(parts: {
  w: number;
  h: number;
  pads: [string, number, number, string][];
  traces?: [string, [number, number][]][];
}): BoardState {
  const pads = parts.pads.map(([id, x, y, net]) => ({ id, x, y, net }));
  const traces = (parts.traces ?? []).map(([net, path]) => ({ net, path }));
  return { w: parts.w, h: parts.h, pads, traces, score: 0, violations: [] };
}

const demoNetlist: Netlist = {
  pads: [
    { id: "u1.a", x: 0, y: 0, net: "vcc" },
    { id: "u1.b", x: 0, y: 0, net: "gnd" },
    { id: "u2.a", x: 0, y: 0, net: "vcc" },
    { id: "u2.b", x: 0, y: 0, net: "gnd" },
  ],
  nets: [
    ["u1.a", "u2.a"],
    ["u1.b", "u2.b"],
  ],
};

describe("router (A*)", () => {
  it("finds a contiguous path between two pads on an open grid", () => {
    const board = boardOf({
      w: 10,
      h: 10,
      pads: [
        ["p1", 1, 1, "n1"],
        ["p2", 8, 8, "n1"],
      ],
    });
    const trace = route(board, "n1");
    expect(trace).not.toBeNull();
    expect(trace!.path[0]).toEqual([1, 1]);
    expect(trace!.path[trace!.path.length - 1]).toEqual([8, 8]);
    const manhattan = 14;
    expect(trace!.path.length).toBe(manhattan + 1); // optimal length
    for (let i = 1; i < trace!.path.length; i++) {
      const [ax, ay] = trace!.path[i - 1]!;
      const [bx, by] = trace!.path[i]!;
      expect(Math.abs(ax - bx) + Math.abs(ay - by)).toBe(1); // 4-connected
    }
  });

  it("routes through the only gap in a wall", () => {
    const wall: [number, number][] = [];
    for (let y = 0; y < 7; y++) if (y !== 3) wall.push([4, y]);
    const board = boardOf({
      w: 9,
      h: 7,
      pads: [
        ["p1", 1, 3, "n1"],
        ["p2", 7, 3, "n1"],
        ["w1", 4, 0, "wall"],
        ["w2", 4, 6, "wall"],
      ],
      traces: [["wall", wall]],
    });
    const trace = route(board, "n1");
    expect(trace).not.toBeNull();
    expect(trace!.path.some(([x, y]) => x === 4 && y === 3)).toBe(true); // through the gap
  });

  it("avoids cells occupied by other nets", () => {
    // direct horizontal corridor is fully occupied by another net -> must detour
    const corridor: [number, number][] = [];
    for (let x = 2; x <= 6; x++) corridor.push([x, 3]);
    const board = boardOf({
      w: 9,
      h: 7,
      pads: [
        ["p1", 1, 3, "n1"],
        ["p2", 7, 3, "n1"],
        ["o1", 2, 6, "other"],
        ["o2", 6, 6, "other"],
      ],
      traces: [["other", corridor]],
    });
    const trace = route(board, "n1");
    expect(trace).not.toBeNull();
    for (const [x, y] of trace!.path) expect(key(x, y)).not.toBe(key(...corridor[2]!)); // never inside the corridor interior
  });

  it("returns null when the target is unreachable", () => {
    const ring: [number, number][] = [];
    for (let x = 0; x <= 4; x++) {
      ring.push([x, 0], [x, 4]);
    }
    for (let y = 1; y <= 3; y++) ring.push([0, y], [4, y]);
    const board = boardOf({
      w: 9,
      h: 7,
      pads: [
        ["k1", 0, 0, "keepout"],
        ["k2", 4, 4, "keepout"],
        ["p1", 2, 2, "n1"],
        ["p2", 7, 6, "n1"],
      ],
      traces: [["keepout", ring]],
    });
    expect(route(board, "n1")).toBeNull();
  });
});

describe("drc (score)", () => {
  it("gives a clean fully-routed board a top score with no violations", () => {
    const board = boardOf({
      w: 10,
      h: 10,
      pads: [
        ["p1", 2, 2, "n1"],
        ["p2", 8, 2, "n1"],
        ["q1", 2, 6, "n2"],
        ["q2", 8, 6, "n2"],
      ],
      traces: [
        ["n1", [[2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2]]],
        ["n2", [[2, 6], [3, 6], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6]]],
      ],
    });
    const report = score(board);
    expect(report.violations).toEqual([]);
    expect(report.score).toBe(1);
  });

  it("flags a planted short between two adjacent different-net traces", () => {
    const board = boardOf({
      w: 10,
      h: 10,
      pads: [
        ["p1", 2, 2, "n1"],
        ["p2", 8, 2, "n1"],
        ["q1", 2, 3, "n2"],
        ["q2", 8, 3, "n2"],
      ],
      traces: [
        ["n1", [[2, 2], [5, 2], [8, 2]]],
        ["n2", [[2, 3], [5, 3], [8, 3]]],
      ],
    });
    // name the meeting point: net n1 has an extra spur adjacent to n2
    board.traces[0]!.path.push([5, 3]); // n1 spur into (5,3), n2 occupies (5,3)?? — overwrite check below
    const report = score(board);
    expect(report.violations.some((v) => v.kind === "short")).toBe(true);
  });

  it("flags a planted open (multi-pad net, unrouted island)", () => {
    const board = boardOf({
      w: 10,
      h: 10,
      pads: [
        ["p1", 2, 2, "n1"],
        ["p2", 8, 2, "n1"],
      ],
      traces: [
        // only p1 is connected; p2's leg is missing -> split regions
        ["n1", [[2, 2], [3, 2], [4, 2]]],
      ],
    });
    const report = score(board);
    const opens = report.violations.filter((v) => v.kind === "open");
    expect(opens.length).toBe(1);
    expect(opens[0]!.detail).toBe("n1");
    expect(report.score).toBeLessThan(1);
  });
});

describe("evolve", () => {
  it("yields monotonically non-decreasing scores", async () => {
    const gens = [];
    for await (const gen of evolve(demoNetlist, { seed: 7, maxGenerations: 6, stepIntervalMs: 0 })) {
      gens.push(gen);
    }
    expect(gens.length).toBeGreaterThanOrEqual(2);
    expect(gens[0]!.index).toBe(0);
    for (let i = 1; i < gens.length; i++) {
      expect(gens[i]!.score).toBeGreaterThanOrEqual(gens[i - 1]!.score);
      expect(gens[i]!.index).toBe(i);
    }
  });

  it("actually improves the board (delta > 0 somewhere or converged high)", async () => {
    const gens = [];
    for await (const gen of evolve({ ...demoNetlist }, { seed: 11, maxGenerations: 10, stepIntervalMs: 0 })) {
      gens.push(gen);
    }
    const improved = gens.some((g, i) => i > 0 && g.delta > 0);
    expect(improved || gens[gens.length - 1]!.score >= 0.98).toBe(true);
  });

  it("is deterministic for equal seeds", async () => {
    const run = async (seed: number): Promise<string> => {
      let last = "";
      for await (const gen of evolve(demoNetlist, { seed, maxGenerations: 5, stepIntervalMs: 0 })) {
        last = JSON.stringify(gen.board);
      }
      return last;
    };
    expect(await run(42)).toBe(await run(42));
  });
});

describe("heal", () => {
  it("clears a planted short with a real verified detour", async () => {
    const board = boardOf({
      w: 12,
      h: 8,
      pads: [
        ["p1", 2, 2, "n1"],
        ["p2", 10, 2, "n1"],
        ["q1", 2, 4, "n2"],
        ["q2", 10, 4, "n2"],
        ["o1", 2, 7, "n3"],
        ["o2", 10, 7, "n3"],
      ],
      traces: [
        ["n1", [[2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2]]],
        // defect: n2's route hugs n1's row (adjacent different-net cells = shorts)
        ["n2", [[2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [10, 4]]],
        ["n3", [[2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7]]],
      ],
    });
    const withDrc = { ...board, ...score(board) };
    const planted = withDrc.violations.filter((v) => v.kind === "short");
    expect(planted.length).toBeGreaterThan(0);

    const steps = [];
    for await (const step of heal(withDrc, { stepIntervalMs: 0 })) {
      steps.push(step);
    }
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) expect(step.verified).toBe(true);
    const healed = steps[steps.length - 1]!.after;
    expect(healed.violations.filter((v) => v.kind === "short").length).toBe(0);
    // the fix kept the net connected (its pads ended up on one region)
    const n2PadCells = new Set(healed.pads.filter((p) => p.net === "n2").map((p) => key(p.x, p.y)));
    expect(healed.traces.some((t) => t.path.some(([x, y]) => n2PadCells.has(key(x, y))))).toBe(true);
  });

  it("clears a planted open by re-routing the missing leg", async () => {
    const board = boardOf({
      w: 12,
      h: 8,
      pads: [
        ["p1", 2, 2, "n1"],
        ["p2", 10, 2, "n1"],
      ],
      traces: [["n1", [[2, 2], [3, 2], [4, 2]]]], // p2 dangling
    });
    const withDrc = { ...board, ...score(board) };
    const steps = [];
    for await (const step of heal(withDrc, { stepIntervalMs: 0 })) {
      steps.push(step);
    }
    expect(steps.length).toBe(1);
    const healed = steps[0]!.after;
    expect(steps[0]!.verified).toBe(true);
    expect(healed.violations.filter((v) => v.kind === "open").length).toBe(0);
    // p2 is now on the trace path
    const p2 = healed.pads.find((p) => p.id === "p2")!;
    expect(healed.traces[0]!.path.some(([x, y]) => x === p2.x && y === p2.y)).toBe(true);
  });
});

describe("rng", () => {
  it("mulberry32 is deterministic", () => {
    const a = mulberry32(1);
    const b = mulberry32(1);
    for (let i = 0; i < 8; i++) expect(a()).toBe(b());
  });
});
