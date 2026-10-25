import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../../App";
import type { BoardState, Generation, RepairStep } from "../core/types";
import { GOLDEN_EVOLVE, GOLDEN_HEAL } from "../intel";
import { BoardCanvas, EvolveView, FoundryView, HealView } from "./index";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Lane 2 — foundry/ui", () => {
  describe("BoardCanvas", () => {
    it("renders pads, copper traces, active red violations, and healed green callouts", () => {
      const board: BoardState = {
        ...GOLDEN_HEAL.initialBoard,
        violations: [{ kind: "open", at: [13, 7], detail: "NET_CLK" }],
      };
      const healed = [{ kind: "short" as const, at: [7, 4] as [number, number] }];

      render(
        <BoardCanvas
          board={board}
          healedDefects={healed}
          ariaLabel="Test PCB canvas"
        />,
      );

      expect(screen.getByRole("img", { name: "Test PCB canvas" })).toBeInTheDocument();
      expect(screen.getByText(/u1\.vcc/)).toBeInTheDocument();
      expect(screen.getByText(/OPEN @ \(13,7\)/)).toBeInTheDocument();
      expect(screen.getByText(/HEALED SHORT \(7,4\)/)).toBeInTheDocument();
      expect(screen.getByText(/1 active violation/)).toBeInTheDocument();
      expect(screen.getByText(/1 healed \(red → green\)/)).toBeInTheDocument();
    });
  });

  describe("EvolveView", () => {
    it("streams all 8 golden generations from 0.38 to 0.98 and flips Sapling to SURVIVE / SHIP", async () => {
      render(<EvolveView stepIntervalMs={0} />);

      // Initial state is Gen #0 (0.38 score, PRUNE / BLOCK)
      expect(screen.getByTestId("evolve-gen-counter").textContent).toMatch(/#0/);
      expect(screen.getByTestId("evolve-best-score").textContent).toMatch(/38%/);

      fireEvent.click(screen.getByRole("button", { name: /Run Evolve/i }));

      await waitFor(() => {
        expect(screen.getByTestId("evolve-gen-counter").textContent).toMatch(/#7 \/ 7/);
      });

      expect(screen.getByTestId("evolve-best-score").textContent).toMatch(/98%/);
      expect(screen.getByTestId("evolve-active-note").textContent).toMatch(
        /Converged: straight horizontal trunks/i,
      );
      expect(screen.getAllByText(/SHIP/).length).toBeGreaterThan(0);
    });

    it("animates an arbitrary injected AsyncIterable<Generation> via streamFactory", async () => {
      async function* mockEvolveStream(): AsyncGenerator<Generation, void, void> {
        yield {
          index: 0,
          score: 0.45,
          delta: 0.45,
          note: "Mock seed layout with crossing",
          board: GOLDEN_EVOLVE.generations[0].board,
        };
        yield {
          index: 1,
          score: 0.96,
          delta: 0.51,
          note: "Mock converged layout with zero DRC violations",
          board: GOLDEN_EVOLVE.generations[7].board,
        };
      }

      render(<EvolveView stepIntervalMs={0} streamFactory={mockEvolveStream} />);
      fireEvent.click(screen.getByRole("button", { name: /Run Evolve/i }));

      await waitFor(() => {
        expect(screen.getByTestId("evolve-active-note").textContent).toMatch(
          /Mock converged layout with zero DRC violations/,
        );
      });
      expect(screen.getByTestId("evolve-best-score").textContent).toMatch(/96%/);
    });
  });

  describe("HealView", () => {
    it("heals Board 00041004 from 0/3 to 3/3 defects healed, flipping red -> green and BLOCK -> SHIP", async () => {
      render(<HealView stepIntervalMs={0} />);

      expect(screen.getByTestId("heal-defect-counter").textContent).toBe(
        "0 / 3 defects healed",
      );
      expect(screen.getAllByText("BLOCK").length).toBeGreaterThan(0);

      fireEvent.click(screen.getByRole("button", { name: /^Heal Board$/i }));

      await waitFor(() => {
        expect(screen.getByTestId("heal-defect-counter").textContent).toBe(
          "3 / 3 defects healed",
        );
      });

      expect(screen.getByText(/HEALED SHORT \(7,4\)/)).toBeInTheDocument();
      expect(screen.getByText(/HEALED OPEN \(13,7\)/)).toBeInTheDocument();
      expect(screen.getByText(/HEALED SPACING \(5,9\)/)).toBeInTheDocument();
      expect(screen.getAllByText("SHIP").length).toBeGreaterThan(0);
    });

    it("consumes an injected AsyncIterable<RepairStep> streamFactory", async () => {
      async function* mockHealStream(): AsyncGenerator<RepairStep, void, void> {
        yield GOLDEN_HEAL.steps[0];
      }

      render(<HealView stepIntervalMs={0} streamFactory={mockHealStream} />);
      fireEvent.click(screen.getByRole("button", { name: /^Heal Board$/i }));

      await waitFor(() => {
        expect(screen.getByTestId("heal-defect-counter").textContent).toBe(
          "1 / 3 defects healed",
        );
      });
    });
  });

  describe("FoundryView & App Tab Integration", () => {
    it("switches between Evolve, Heal, and Split View modes and demo script beats", () => {
      render(<FoundryView stepIntervalMs={0} />);

      expect(screen.getByTestId("evolve-view")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("tab", { name: /Mode B · Heal/i }));
      expect(screen.getByTestId("heal-view")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("tab", { name: /Split View/i }));
      expect(screen.getByTestId("evolve-view")).toBeInTheDocument();
      expect(screen.getByTestId("heal-view")).toBeInTheDocument();
    });

    it("opens the Foundry tab inside App when clicked", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })),
      );

      render(<App />);
      const foundryTab = screen.getByRole("tab", { name: /^Foundry$/i });
      fireEvent.click(foundryTab);

      expect(await screen.findByTestId("foundry-view")).toBeInTheDocument();
    });
  });
});
