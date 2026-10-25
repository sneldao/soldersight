import { describe, expect, it, vi } from "vitest";
import { evolve, heal } from "../core";
import {
  CURATED_NETLISTS,
  DEMO_BEATS,
  FOUNDRY_LAYOUT_CLAIM,
  GOLDEN_EVOLVE,
  GOLDEN_HEAL,
  NetlistValidationError,
  buildBoardEvidence,
  commentOnGeneration,
  commentOnRepair,
  generateNetlistWithMeta,
  judgeBoard,
  judgeGeneration,
  judgeRepairStep,
  matchCuratedNetlist,
  replayGoldenEvolve,
  replayGoldenHeal,
  validateCommentary,
  validateNetlist,
  withGenerationCommentary,
  withRepairCommentary,
  withSaplingJudgment,
} from "./index";

describe("Lane 3 — foundry/intel", () => {
  describe("spec.ts — Mubit netlist generation & schema validation", () => {
    it("validates all curated presets in data/foundry/netlists.json", () => {
      expect(CURATED_NETLISTS.length).toBeGreaterThanOrEqual(4);
      for (const preset of CURATED_NETLISTS) {
        const validated = validateNetlist(preset.netlist, {
          maxW: preset.gridWidth,
          maxH: preset.gridHeight,
        });
        expect(validated.pads.length).toBeGreaterThanOrEqual(6);
        expect(validated.nets.length).toBeGreaterThanOrEqual(3);
      }
    });

    it("matches '3-stage RC power filter, 6 pads' to the rc-power-filter preset", () => {
      const matched = matchCuratedNetlist("3-stage RC power filter, 6 pads");
      expect(matched.id).toBe("rc-power-filter");
      expect(matched.netlist.pads).toHaveLength(6);
      expect(matched.netlist.nets).toHaveLength(3);
    });

    it("rejects malformed netlists with NetlistValidationError", () => {
      expect(() => validateNetlist(null)).toThrow(NetlistValidationError);
      expect(() => validateNetlist({ pads: [], nets: [] })).toThrow(NetlistValidationError);
      // Duplicate coordinates
      expect(() =>
        validateNetlist({
          pads: [
            { id: "p1", x: 2, y: 2, net: "A" },
            { id: "p2", x: 2, y: 2, net: "A" },
          ],
          nets: [["p1", "p2"]],
        }),
      ).toThrow(/Duplicate pad coordinates/);
      // Mixed net names in one net group
      expect(() =>
        validateNetlist({
          pads: [
            { id: "p1", x: 1, y: 1, net: "A" },
            { id: "p2", x: 3, y: 3, net: "B" },
          ],
          nets: [["p1", "p2"]],
        }),
      ).toThrow(/mixes pads from different nets/);
    });

    it("parses and validates live Mubit netlist JSON and falls back to curated on failure", async () => {
      const mockFetchOk = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  pads: [
                    { id: "u1.1", x: 1, y: 1, net: "VCC" },
                    { id: "u2.1", x: 8, y: 1, net: "VCC" },
                    { id: "u1.2", x: 1, y: 6, net: "GND" },
                    { id: "u2.2", x: 8, y: 6, net: "GND" },
                  ],
                  nets: [
                    ["u1.1", "u2.1"],
                    ["u1.2", "u2.2"],
                  ],
                }),
              },
            },
          ],
        }),
      });

      const liveRes = await generateNetlistWithMeta("2-rail power bus", {
        apiKey: "test-key",
        fetchImpl: mockFetchOk as unknown as typeof fetch,
      });
      expect(liveRes.source).toBe("mubit");
      expect(liveRes.netlist.pads).toHaveLength(4);

      const mockFetchFail = vi.fn().mockRejectedValue(new Error("network down"));
      const fallbackRes = await generateNetlistWithMeta("3-stage RC power filter, 6 pads", {
        apiKey: "test-key",
        fetchImpl: mockFetchFail as unknown as typeof fetch,
      });
      expect(fallbackRes.source).toBe("curated");
      expect(fallbackRes.presetId).toBe("rc-power-filter");
      expect(fallbackRes.netlist.pads).toHaveLength(6);
    });
  });

  describe("commentary.ts — Mubit designer notes & stream wrappers", () => {
    it("validates string and JSON-wrapped commentary notes", () => {
      expect(validateCommentary('{"note": "tightened the ground return, −2 crossings"}')).toBe(
        "tightened the ground return, −2 crossings",
      );
      expect(validateCommentary("  rerouted VIN north of GND  ")).toBe("rerouted VIN north of GND");
      expect(() => validateCommentary("   ")).toThrow();
    });

    it("enriches Generation and RepairStep streams with designer notes", async () => {
      const genNotes: string[] = [];
      for await (const gen of withGenerationCommentary(
        evolve(GOLDEN_EVOLVE.netlist, { maxGenerations: 3, stepIntervalMs: 0 }),
        { offline: true },
      )) {
        expect(gen.note).toBeTruthy();
        expect(gen.note).not.toBe("stub generation");
        genNotes.push(gen.note!);
      }
      expect(genNotes).toHaveLength(3);

      const repairNotes: string[] = [];
      for await (const step of withRepairCommentary(
        heal(GOLDEN_HEAL.initialBoard, { stepIntervalMs: 0 }),
        { offline: true },
      )) {
        expect(step.note).toBeTruthy();
        expect(step.note).not.toBe("stub repair");
        repairNotes.push(step.note!);
      }
      expect(repairNotes.length).toBeGreaterThanOrEqual(1);
    });

    it("uses live Mubit commentary when apiKey and fetchImpl succeed", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '{"note": "Tightened GND return loop by 3 cells; −1 crossing."}',
              },
            },
          ],
        }),
      });

      const note = await commentOnGeneration(GOLDEN_EVOLVE.generations[2], GOLDEN_EVOLVE.generations[1], {
        apiKey: "test-key",
        fetchImpl: mockFetch as unknown as typeof fetch,
      });
      expect(note).toBe("Tightened GND return loop by 3 cells; −1 crossing.");

      const healNote = await commentOnRepair(GOLDEN_HEAL.steps[0], {
        offline: true,
      });
      expect(healNote).toContain("(7,4)");
    });
  });

  describe("golden.ts — golden.json replay for Evolve and Heal", () => {
    it("replays GOLDEN_EVOLVE with monotonically climbing DRC scores and orthogonal traces", async () => {
      const streamed = [];
      for await (const gen of replayGoldenEvolve(GOLDEN_EVOLVE.netlist, { stepIntervalMs: 0 })) {
        streamed.push(gen);
        for (const trace of gen.board.traces) {
          expect(trace.path.length).toBeGreaterThanOrEqual(2);
          for (let i = 1; i < trace.path.length; i++) {
            const [x1, y1] = trace.path[i - 1];
            const [x2, y2] = trace.path[i];
            expect(Math.abs(x2 - x1) + Math.abs(y2 - y1)).toBe(1);
          }
        }
      }
      expect(streamed).toHaveLength(8);
      for (let i = 1; i < streamed.length; i++) {
        expect(streamed[i].score).toBeGreaterThan(streamed[i - 1].score);
      }
      const last = streamed[streamed.length - 1];
      expect(last.score).toBeGreaterThanOrEqual(0.95);
      expect(last.board.violations).toHaveLength(0);
      expect(last.note).toBeTruthy();
    });

    it("replays GOLDEN_HEAL on Board 00041004 removing all 3 defects red -> green", async () => {
      const steps = [];
      for await (const step of replayGoldenHeal(GOLDEN_HEAL.initialBoard, { stepIntervalMs: 0 })) {
        steps.push(step);
        expect(step.verified).toBe(true);
        expect(step.after.score).toBeGreaterThan(step.before.score);
        expect(step.after.violations.length).toBeLessThan(step.before.violations.length);
      }
      expect(steps).toHaveLength(3);
      expect(steps[0].defect.kind).toBe("short");
      expect(steps[1].defect.kind).toBe("open");
      expect(steps[2].defect.kind).toBe("spacing");
      expect(steps[2].after.violations).toHaveLength(0);
      expect(steps[2].after.score).toBeCloseTo(0.99, 2);
    });
  });

  describe("judge.ts — Banyan Sapling generation & repair judge", () => {
    it("formats DRC board evidence and uses the canonical design-rules claim", () => {
      const ev0 = buildBoardEvidence(GOLDEN_EVOLVE.generations[0].board, { generationIndex: 0 });
      expect(ev0).toContain("open-circuit (broken trace)");
      expect(ev0).toContain("trace crossing");
      expect(FOUNDRY_LAYOUT_CLAIM).toBe("This layout satisfies the design rules.");
    });

    it("rejects defective early generations (violation ~97.5%) and certifies clean converged generations (supported)", async () => {
      const earlyVerdict = await judgeGeneration(GOLDEN_EVOLVE.generations[0], { offline: true });
      expect(earlyVerdict.label).toBe("violation");
      expect(earlyVerdict.survives).toBe(false);
      expect(earlyVerdict.action).toBe("PRUNE");
      expect(earlyVerdict.gateAction).toBe("BLOCK");
      expect(earlyVerdict.probabilities?.violation).toBeGreaterThan(0.95);

      const finalVerdict = await judgeGeneration(GOLDEN_EVOLVE.generations[7], { offline: true });
      expect(finalVerdict.label).toBe("supported");
      expect(finalVerdict.survives).toBe(true);
      expect(finalVerdict.action).toBe("SURVIVE");
      expect(finalVerdict.gateAction).toBe("SHIP");
      expect(finalVerdict.probabilities?.violation).toBeLessThan(0.15);
    });

    it("flips Board 00041004 from BLOCK (violation) before healing to SHIP (supported) after Step 3", async () => {
      const beforeVerdict = await judgeBoard(GOLDEN_HEAL.initialBoard, { offline: true });
      expect(beforeVerdict.gateAction).toBe("BLOCK");
      expect(beforeVerdict.survives).toBe(false);

      const afterVerdict = await judgeRepairStep(GOLDEN_HEAL.steps[2], { offline: true });
      expect(afterVerdict.gateAction).toBe("SHIP");
      expect(afterVerdict.survives).toBe(true);
      expect(afterVerdict.label).toBe("supported");
    });

    it("streams paired (generation, verdict) items through withSaplingJudgment", async () => {
      const pairs = [];
      for await (const item of withSaplingJudgment(replayGoldenEvolve(), { offline: true })) {
        pairs.push(item);
      }
      expect(pairs).toHaveLength(8);
      expect(pairs[0].verdict.survives).toBe(false);
      expect(pairs[7].verdict.survives).toBe(true);
      expect(DEMO_BEATS).toHaveLength(4);
    });
  });
});
