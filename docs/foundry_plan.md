# SolderSight Foundry — build plan (A + B), 3 developers

**Pivot:** the main-track centerpiece becomes an **autonomous PCB engine** with two
modes on one shared substrate:

- **A — Evolve:** watch a board *design itself* — an evolutionary loop places + routes
  traces, scoring each generation; a fitness line climbs; a cleaner, denser board every
  few seconds. (Our answer to "a new feature every 15 min.")
- **B — Heal:** load a *real* defective DeepPCB board; the engine autonomously
  **re-routes the open / clears the short** and the board animates **red → green**,
  defect by defect.

Triage + Banyan Sapling (already built) become the supporting act: Sapling is the
**fitness/validity judge** that keeps the autonomy honest, and triage is how a board
enters Heal mode.

## The one hard truth that shapes the split
LLMs cannot autoroute — geometry is where they fail. So: **a deterministic procedural
engine does all geometry (reliable, beautiful); Mubit does creative direction + live
commentary + the valid/novel call.** This is non-negotiable for a demo that can't look
like noise.

## Where it lives
TypeScript, client-side, in the React app as a new **Foundry** view, and reusable as
vanilla JS in the static HF Space (free, live, no cold start). No new backend routing.
Mubit/Sapling called from the browser (CORS is open — proven).

---

## Data contracts — FREEZE THESE FIRST (everything parallelizes off them)

```ts
// foundry/core/types.ts  — Lane 1 owns this file; Lanes 2 & 3 import it, never edit it.
export interface Pad { id: string; x: number; y: number; net: string }
export interface Trace { net: string; path: [number, number][] }     // grid cells
export interface Violation { kind: "short" | "open" | "crossing" | "spacing"; at: [number, number] }
export interface BoardState {
  w: number; h: number;              // grid dims
  pads: Pad[];
  traces: Trace[];
  defects?: Violation[];             // Heal mode: what's wrong now
  score: number;                     // 0..1 fitness (DRC-derived)
  violations: Violation[];
}
export interface Netlist { pads: Pad[]; nets: string[][] }           // Evolve input (pad ids per net)
export interface Generation { index: number; board: BoardState; score: number; delta: number; note?: string }
export interface RepairStep { defect: Violation; action: string; before: BoardState; after: BoardState; note?: string; verified?: boolean }
```

Lane 1 also publishes the **engine API** (stub it day-one so 2 & 3 build against it):
```ts
evolve(netlist: Netlist, opts): AsyncIterable<Generation>   // yields generations as they improve
heal(board: BoardState): AsyncIterable<RepairStep>          // yields repairs one at a time
route(board, net): Trace | null                            // A* pathfind (shared primitive)
score(board): { score: number; violations: Violation[] }   // DRC
```
Both modes yield an **async iterable of steps** — Lane 2 just animates whatever streams
out, Lane 3 can inject model notes into `note`. That's the whole integration seam.

---

## Lane 1 — Core engine (geometry, DRC, evolution, repair)
**Owner: strongest systems dev. Pure logic, no UI, no network. The critical path.**
Directory: `frontend/src/foundry/core/` (files: `types.ts`, `router.ts`, `drc.ts`,
`evolve.ts`, `heal.ts`, `index.ts`).

Tasks:
1. `types.ts` + stub the engine API returning fake-but-valid streams **first** (unblocks 2 & 3 in ~20 min).
2. `router.ts` — A* on the grid between two pads, collision-aware (avoids other traces/pads). The visual workhorse.
3. `drc.ts` — `score(board)`: all nets connected? any two different nets adjacent (short)? crossings? density. Returns score 0..1 + violations.
4. `evolve.ts` — generate → `score` → keep best → mutate (re-place a pad, re-route a net) → repeat; `yield` each improved Generation. Seeded RNG (deterministic replay).
5. `heal.ts` — given a BoardState with `defects`, for each defect compute the fix (reroute the open via `router`, cut/reroute the short), `yield` a RepairStep with before/after.
6. Vitest unit tests: router finds a path on an open grid and avoids obstacles; `score` flags a planted short; `evolve` monotonically improves; `heal` removes a planted defect.

Deliverable: `import { evolve, heal, route, score } from "./foundry/core"` works, tested, deterministic. **Do not import React.**

## Lane 2 — Visualization, animation, demo UI
**Owner: frontend/design dev. The wow layer. Builds against Lane 1's stub immediately.**
Directory: `frontend/src/foundry/ui/` + a `Foundry` view wired into `App.tsx` (one new tab).

Tasks:
1. `BoardCanvas` — render a `BoardState` (pads, traces, defects) as SVG/canvas on the case-file paper theme (reuse `theme.css` tokens + `app.css`; **do not edit `theme.css`**). Traces draw with a path-length animation; defects pulse red.
2. Evolve view — consume the `Generation` stream: morph the board between generations, a **climbing fitness line** (sparkline), a generation counter + "best score" stamp. Autonomous "Run" button that streams.
3. Heal view — consume the `RepairStep` stream: show defect → draw the fix → flip that region **red→green**; a **"N defects healed / M total" counter**. Reuse the real board image under the overlay (existing `/assets`, `DefectOverlay` patterns).
4. Showmanship: the cadence (new generation / heal every ~2s), the counters, a "replay" of the golden run. Keep contrast AA (follow the `--danger-ink` precedent).
5. A `Foundry` tab in `App.tsx` (additive — one import, one `<TabItem>`; minimize App.tsx churn to avoid conflicts).

Deliverable: feed it a mock stream → it animates beautifully. Swapping the mock for Lane 1's real stream is a one-line change.

## Lane 3 — Mubit intelligence + data + demo integration
**Owner: AI/integration dev. Keeps Mubit central and the demo flake-proof.**
Directory: `frontend/src/foundry/intel/` + `data/foundry/` seeds + the demo script.

Tasks:
1. `spec.ts` — Mubit call: a one-line brief ("3-stage RC power filter, 6 pads") → a **Netlist** JSON (schema-validated). Prompt + JSON contract; falls back to curated netlists in `data/foundry/netlists.json` if the call fails.
2. `commentary.ts` — Mubit call: given a Generation/RepairStep, return a short **designer note** ("tightened the ground return, −2 crossings") for `step.note`. Cheap, cosmetic, high-charm. Cache a golden set.
3. Sapling tie (keeps the side-quest model in the main demo): `judge.ts` — send a generation's board summary as `evidence` + "this layout satisfies the design rules" as `claim` → Sapling `supported/violation` becomes a **validity/novelty gate** on which generations survive. (Honest, not a safety-layer reskin — Sapling is the *taste function*.)
4. **Golden run**: record one great Evolve run + one Heal run to `data/foundry/golden.json` (same cached-real pattern as the HF Space) so the live demo never depends on model latency. Lane 2 plays this by default; live is the "Run live" button.
5. Demo script/narration (~2 min) tying A+B to the Mubit stack; coordinate the final wiring PR.

Deliverable: real netlists + commentary flow through the contract; golden run guarantees a clean demo; Sapling visibly judges generations.

---

## Git discipline (this repo has had multi-agent clobbering — follow exactly)
- One **branch per lane**: `foundry/core`, `foundry/ui`, `foundry/intel`. PR each into `main`.
- Each lane edits **only its own directory**. The sole shared files are `App.tsx` (Lane 2, one tab) and `types.ts` (Lane 1, frozen after hour 1). Nobody else touches those.
- `git pull --rebase` before pushing; small commits; never `git add -A` across another lane's dir.
- Integration = a final wiring PR (Lane 3) after the three land.

## Timeline + cut lines (freeze Sun 05:00 GMT)
- **Hour 0–1:** Lane 1 freezes `types.ts` + API stubs. Lanes 2 & 3 start against the stub.
- **Hour 1–3:** router + DRC + heal (L1); BoardCanvas + both views on mock (L2); netlist + commentary + golden seeds (L3).
- **Hour 3–4:** evolve loop (L1); real-stream swap + polish (L2); Sapling judge + script (L3).
- **Hour 4+:** integration PR, golden-run record, rehearse.
- **MVP cut (if short on time): ship B (Heal) only** — it reuses the real boards + existing overlay infra and is the lowest-risk guaranteed-clean visual. Evolve (A) is the stretch/wow.
- **Hard fallback:** the golden-run JSON means even with zero live calls at demo time, both modes play perfectly from disk.

## Verification (per lane, before the wiring PR)
- L1: `vitest` unit tests green; `evolve` scores non-decreasing; `heal` zeroes planted defects.
- L2: renders the golden run with no console errors; AA contrast holds; `tsc` clean; build OK.
- L3: netlist + commentary validate against schema; golden.json replays; Sapling judge returns a real verdict.
- Integration: the Foundry tab runs both modes from golden.json offline, and "Run live" works when a key/endpoint is up.

## Why this wins where the Roblox demo does
Their loop self-evolves a game; ours self-evolves **circuit designs** — same autonomous,
improving-before-your-eyes energy, but it reads as engineering magic, and every
generation is **Mubit-directed and Sapling-judged** (so it's the best *use of Mubit*,
not just a flashy loop). Heal mode adds the tangible, visceral "watch it fix a real
broken board" beat.
