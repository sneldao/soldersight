import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { Board, Inspection, Rules, VerifyResult } from "./types";

const board: Board = {
  id: "00041000",
  templateUrl: "/assets/00041000_temp.jpg",
  testUrl: "/assets/00041000_test.jpg",
  annotations: [{ x1: 10, y1: 10, x2: 40, y2: 40, code: 2, type: "short" }],
};

const region = { x1: 0, y1: 0, x2: 320, y2: 320, delta: 12 };
const metrics = {
  latency_ms: 1200,
  prompt_tokens: 100,
  completion_tokens: 40,
  total_tokens: 140,
  cost_usd: 0.0002,
  mubit_request_id: "req-1",
};

// What /triage/board returns now that region calls can fail and low-confidence
// defects only caveat the verdict.
const inspection = {
  board_id: board.id,
  lane: "baseline",
  defect_type: "short",
  severity: "major",
  disposition: "rework",
  confidence: 0.8,
  reason: "Adjacent traces bridged.",
  caveat:
    "a scrap-grade region (open) was reported at only 40% confidence — flagged, not decisive",
  region_errors: 1,
  regions: [
    {
      defect_type: "short",
      severity: "major",
      disposition: "rework",
      confidence: 0.8,
      reason: "Adjacent traces bridged.",
      region,
      metrics,
      ground_truth: { defect_types: ["short"], disposition: "scrap", worst: "short" },
      score: { type_correct: true, disposition_correct: false },
    },
    { region, error: "model returned invalid output: invalid defect_type: blob", metrics },
  ],
  metrics: { calls: 1, latency_ms: 1523, total_tokens: 140, cost_usd: 0.0002, mubit_request_ids: ["req-1"] },
} as unknown as Inspection;

const rules: Rules = {
  corrections: [
    {
      ts: 1,
      board_id: board.id,
      original: { defect_type: "none" },
      corrected: { defect_type: "open", severity: "critical", disposition: "scrap" },
      reason: "bright gap is a broken circuit",
      index: 0,
      enabled: true,
    },
  ],
  rules: ["What reads as none is really open, critical, disposition scrap"],
  defect_types: ["open", "short", "none"],
  lanes: { baseline: "base prompt", adapted: "adapted prompt" },
  lane_health: {
    missed_defect_rate: -0.2,
    false_alarm_rate: 0.1,
    type_accuracy: 0.15,
    board_disposition_accuracy: 0.2,
  },
};

const gate: VerifyResult = {
  board_id: board.id,
  claimed_disposition: "pass",
  policy: "policy",
  evidence: "evidence",
  claim: "claim",
  evidence_mode: "trace",
  gate: {
    action: "REVIEW",
    label: "insufficient_information",
    reason: "The model contradicts its own notes.",
    confidence: 0.44,
    margin: null,
    unsure: true,
  },
  ground_truth: { defect_types: ["short"], disposition: "scrap", worst: "short" },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function mockBackend(overrides: Record<string, Response> = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    const key = Object.keys(overrides).find((pattern) => url.startsWith(pattern));
    if (key) return overrides[key];
    if (url === "/boards") return jsonResponse([board]);
    if (url === "/rules") return jsonResponse(rules);
    if (url.startsWith("/triage/board")) return jsonResponse(inspection);
    if (url.startsWith("/verify/board")) return jsonResponse(gate);
    return new Response("", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("App", () => {
  it("loads the board filmstrip with its labelled disposition", async () => {
    mockBackend();
    render(<App />);
    const option = await screen.findByRole("option", { name: /Board 00041000/ });
    expect(option).toHaveAttribute("aria-selected", "true");
    expect(option.textContent).toMatch(/00041000/);
  });

  it("carries a low-confidence scrap claim as a caveat instead of a verdict", async () => {
    mockBackend();
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /Triage selected board/ }));
    await waitFor(() => expect(screen.getByText(/flagged, not decisive/)).toBeInTheDocument());
  });

  it("reports failed crop calls and keeps them out of the verdict", async () => {
    mockBackend();
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /Triage selected board/ }));
    await waitFor(() => expect(screen.getByText(/1 crop call failed/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /region 1: call failed/ })).toBeInTheDocument();
  });

  it("stamps the gate's line decision next to the board verdict", async () => {
    mockBackend();
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /Triage selected board/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Verify against policy gate/ }));
    const chip = await screen.findByText("REVIEW");
    expect(chip.closest("div")?.textContent).toMatch(/rework/);
  });

  it("shows the trace/oracle evidence mode the gate used", async () => {
    mockBackend();
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /Triage selected board/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Verify against policy gate/ }));
    await screen.findByText("REVIEW");
    expect(document.body.textContent).toMatch(/no answer key|own notes|trace/i);
  });

  it("surfaces a failed triage as a dismissible error, not a bare line", async () => {
    mockBackend({ "/triage/board": new Response("all 5 region calls failed", { status: 502 }) });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /Triage selected board/ }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/502|region calls failed/);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss error" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
});
