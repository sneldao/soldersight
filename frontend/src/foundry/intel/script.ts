/**
 * Lane 3 — Live Demo Narration Script (`script.ts`).
 *
 * Structured 2-minute demo script tying Mode A (Evolve) + Mode B (Heal) to
 * Mubit (`gpt-4o-mini`) and Banyan Sapling. Mirrors `data/foundry/demo_script.md`.
 */

export interface DemoBeat {
  id: "hook" | "evolve" | "heal" | "close";
  title: string;
  window: string;
  mode: "overview" | "evolve" | "heal";
  narration: string;
  cue: string;
}

export const DEMO_BEATS: DemoBeat[] = [
  {
    id: "hook",
    title: "The Split-Brain Hardware Architecture",
    window: "0:00 – 0:25",
    mode: "overview",
    cue: "Open Foundry tab showing Evolve + Heal modes and Banyan Sapling badge.",
    narration:
      "LLMs cannot autoroute copper coordinates directly without geometric noise. SolderSight Foundry splits the brain in three: Mubit directs the netlist and narrates layout trade-offs, a deterministic A* and DRC engine routes every trace, and Banyan Sapling gates which generations satisfy IPC design rules.",
  },
  {
    id: "evolve",
    title: "Mode A — Evolve: A Board Designs Itself",
    window: "0:25 – 1:05",
    mode: "evolve",
    cue: "Run '3-stage RC power filter, 6 pads'. Watch fitness climb 0.38 -> 0.98 over 8 generations.",
    narration:
      "From a one-line brief—'3-stage RC power filter, 6 pads'—Mubit emits a schema-validated netlist. Generation 0 starts at 0.38 DRC fitness with an open VFILT leg and a VIN/GND crossing; Sapling rejects it at 97.5% violation probability. Over 8 generations the A* loop untangles the trunk, Mubit logs each physical improvement, and Sapling certifies Generation 7 as 'supported' at 0.98 fitness.",
  },
  {
    id: "heal",
    title: "Mode B — Heal: Autonomous Red → Green Repair on Board 00041004",
    window: "1:05 – 1:45",
    mode: "heal",
    cue: "Switch to Heal mode on DeepPCB Board 00041004 and watch 3/3 defects flip red -> green.",
    narration:
      "Earlier our Triage and Policy Gate caught DeepPCB Board 00041004—a board with a bridged short and an open trace that a baseline vision model would have shipped. Instead of scrapping it, Foundry heals it: excising the short at (7,5), stitching the open clock trace at (11,7), and restoring IPC clearance at (5,9), flipping Sapling from 97.5% violation (BLOCK) to cleared (SHIP).",
  },
  {
    id: "close",
    title: "Closed-Loop Hardware Autonomy",
    window: "1:45 – 2:00",
    mode: "overview",
    cue: "Show 3/3 healed counter, 0.99 DRC fitness, Mubit engineering log, and Sapling conformal bar.",
    narration:
      "One engine, two modes, zero hallucinated geometry: Mubit directs and explains, A* + DRC routes real copper, and Banyan Sapling enforces calibrated engineering truth.",
  },
];
