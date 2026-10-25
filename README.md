# SolderSight — Visual PCB Defect Triage (Mubit Hackathon Entry)

A visual quality-inspection agent for PCB manufacturing. **Recurring task:** a PCB
photo → defect type + severity + disposition (pass / rework / scrap). **Corrections
change the model's behaviour:** an inspector overrides a verdict ("that bright gap is a
broken trace, not clean copper") → the rule joins the instructions SolderSight sends,
which is what Mubit forms a *task* from — so the corrected line becomes its own task,
measurable against the original one. **Showcase:** the same crops down two tasks, side
by side, with cost, latency and accuracy per call.

Mubit records every call (`mreq_…` ids are printed per crop), and the two tasks are
separable in the console by their instructions. There is no hidden fine-tune in this
story: what an inspector teaches is visible as a prompt, and provable as a number.

Built for **Night Shift: $65K Mubit Hackathon** (London, Oct 23–25, 2026).

## What the Demo Shows (≤ 2:00)

Our ≤ 2-minute demo walks through the closed-loop hardware pipeline across **Triage**,
**Banyan Sapling Verification**, and **SolderSight Foundry** (also playable offline from
`data/foundry/golden.json` and `data/deeppcb/runs.jsonl` so overloaded API servers never
break the demo):

1. **The Catch — Trace Audit & Policy Gate (No Answer Key):**
   - A baseline vision model (`gpt-4o-mini` routed through Mubit) inspects DeepPCB boards
     crop-by-crop (`00041003` / `00041004`), writes *"visible short circuit"* in its own
     region notes, yet stamps the whole board **`pass`**.
   - **Mubit's Banyan Sapling** audits the *"ship as-is"* claim against the model's **own
     notes** (no ground-truth labels consulted) and against our IPC acceptance policy —
     flagging **`violation` (84%–97.5%)** and stamping **`BLOCK`** (`14/14`
     self-contradicting boards stopped).
2. **Task Adaptation — Inspector Corrections → Measured Lift:**
   - An inspector submits 3 targeted corrections in the UI; SolderSight appends the rules
     to the adapted Mubit task instructions. Running the same 28 crops across 6 DeepPCB
     boards lifts **board disposition accuracy from 0% → 83%** at the same ~$0.0013/crop
     cost.
3. **Foundry Mode A (Evolve) — Watch a Board Design Itself:**
   - In the **`Foundry`** tab, we enter a one-line circuit brief (*"3-stage RC power
     filter, 6 pads"*). **Mubit** emits a validated netlist, the deterministic **A\* +
     IPC-2221 DRC engine** mutates pad placement and routes traces across 8 generations
      as the fitness curve climbs **`0.38 → 0.98`**, Mubit narrates each physical
     improvement, and **Banyan Sapling** flips from **`PRUNE · BLOCK` (97.5% violation)**
     to **`SURVIVE · SHIP` (<9% violation risk)**.
4. **Foundry Mode B (Heal) — Autonomous Red → Green Repair on Real Copper:**
   - Taking the blocked DeepPCB **Board `00041004`**, Foundry autonomously excises the
     copper bridge at `(7,4)`, stitches the broken clock line at `(13,7)`, and widens
     clearance at `(5,9)`—animating each defect **red → green** (`0 / 3 → 3 / 3 defects
     healed`, DRC `0.35 → 0.99`) until Banyan Sapling certifies the repaired board
     **`SHIP`**.

## What the corrections bought (measured, not claimed)

`gpt-4o-mini` through Mubit over 6 DeepPCB boards, 28 crops per lane, 3 inspector
corrections, one capture (`python backend/capture_comparison.py`):

| | baseline task | adapted task |
| --- | --- | --- |
| Defect crops with the right type | 0% | 17% |
| Defects missed | 100% | 17% |
| Clean crops falsely flagged | 0% | 100% |
| **Board disposition right** | **0%** | **83%** |
| Cost per crop | $0.001317 | $0.001285 |
| Latency per crop | 1972ms | 2275ms |

Defect crops and clean crops are scored apart, so untouched boards cannot inflate the
accuracy — and the tradeoff is on the table: the corrected line now over-flags clean
copper while catching the defects it used to walk past (the board verdict needs a
confident region, so the noise lands as a caveat rather than a scrapped board).
Corrections and scoring share these boards: this is the loop working, not a held-out
benchmark.

## Why crops, not whole boards

A 640×640 DeepPCB board carries 30–55px defects: at whole-board scale a vision model
calls a scrap board "no visible defects" with 90% confidence. SolderSight diffs the
board against its known-good template on an 8×8 grid (`backend/inspection.py`), keeps
the cells that changed, and upscales each to a 480px crop — so the model sees copper,
not a thumbnail. Every verdict records the region and the exact crop it was given
(`GET /crop/{board_id}/{index}`).

## Policy gate — Banyan Sapling (side quest: The "Policy" Challenge)

The vision model only *proposes* a disposition, and the cheap baseline demonstrably
clears defective boards as "pass". Before a board ships, SolderSight puts that
proposal to **Mubit's Banyan Sapling** as an independent verifier: it checks the
claim *"this board can ship as-is"* against a written **acceptance policy** and the
evidence, and returns `supported` / `violation` / `insufficient_information` /
`inconsistent_context` with calibrated uncertainty → a line decision, **SHIP /
BLOCK / REVIEW**.

By default the evidence is the vision model's **own crop-by-crop notes** — the gate
needs no answer key (this is the trace audit, below). Passing `evidence_types`
switches it to **oracle mode**, checking against the AOI/DeepPCB labels — kept for the
demo's ground-truth contrast. With neither `regions` nor `evidence_types` (and no
recorded run to replay) the gate **fails closed** with a 422 — the labels are the
answer key, and they enter the loop only when the caller names them.

> Board `00041004`: vision said **pass**; the board has an open + short circuit
> (**scrap**). Sapling returned **violation @ 96%** → **ship blocked.** The verifier
> caught the classifier before a dead board left the line.

See it work: `python backend/gate_demo.py` (the catch, on real boards), or click
**"Verify against policy gate →"** in the UI after triaging a board.

**Trace audit (no answer key).** The stronger check uses no ground truth at all:
Sapling audits the *ship* decision against the vision model's **own crop-by-crop
notes** (`POST /verify/trace`). On recorded traces it blocked **14/14** boards whose
own notes contradicted shipping — e.g. `00041003`, where the model wrote *"visible
short circuit"* yet the board was up for shipping: **violation ≈ 0.84 → blocked**, on
the model's own sentence. Run `python backend/trace_demo.py`.
Details: [`docs/sapling-gate.md`](docs/sapling-gate.md).

**Live demo (no install):** [huggingface.co/spaces/Papajams/soldersight-sapling](https://huggingface.co/spaces/Papajams/soldersight-sapling)
— a free static HF Space that calls Banyan Sapling **live from your browser**
(cached real verdicts as instant fallback). See [`docs/huggingface_strategy.md`](docs/huggingface_strategy.md).

## SolderSight Foundry — Autonomous PCB Engine (Evolve + Heal)

Where **Triage** catches defective boards and adapts the vision task, **Foundry** (the
**Foundry** tab in the app) closes the hardware loop with two autonomous modes on one
shared substrate:

1. **Mode A — Evolve (Watch a Board Design Itself):**
   - Enter a one-line circuit brief (e.g. *"3-stage RC power filter, 6 pads"*).
   - **Mubit (`gpt-4o-mini`)** synthesizes a schema-validated `Netlist` (`foundry/intel/spec.ts`, with curated fallback in `data/foundry/netlists.json`).
   - The deterministic **A\* router + IPC-2221 DRC engine** (`foundry/core`) mutates pad placements and re-routes copper traces across generations (`0.38 → 0.98` DRC fitness).
   - **Mubit** narrates each physical improvement (`commentary.ts`), while **Banyan Sapling** (`judge.ts`) acts as the calibrated validity/taste gate (`PRUNE → MUTATE → SURVIVE / SHIP` once violation risk drops below 15%).
2. **Mode B — Heal (Autonomous Red → Green Repair on Real Copper):**
   - Loads DeepPCB **Board `00041004`**—the exact board where the baseline vision model falsely claimed `pass` and our Policy Gate blocked shipment.
   - The A\* repair engine autonomously excises the copper bridge at `(7,4)`, stitches the broken clock line at `(13,7)`, and shifts `NET_SDA` at `(5,9)` for IPC clearance.
   - Each defect visibly flips **red → green** (`0 / 3 → 3 / 3 defects healed`, DRC fitness `0.35 → 0.99`), and Banyan Sapling re-verifies the board from **`BLOCK` (97.5% violation)** to **`SHIP` (`supported`, 7.8% violation risk)**.

Defaults to `data/foundry/golden.json` (real recorded Mubit notes + SHA-pinned Banyan
Sapling verdicts) for zero-latency stage playback, with a **Run Live Engine** toggle for
live browser execution. See [`docs/foundry_plan.md`](docs/foundry_plan.md) and
[`data/foundry/demo_script.md`](data/foundry/demo_script.md).

## Tracks hit
- **Recurring tasks** — defect triage (classify + disposition) and iterative DRC layout/repair.
- **Own your intelligence layer** — two tasks over the same crops, quality/cost/latency side by side, plus calibrated open-weight Sapling verification.
- **Fast refresh** — a new defect name in one correction joins the taxonomy immediately; in Foundry, a one-line brief evolves a clean PCB layout in seconds.

## Judging (equally weighted)
Use of Mubit · Usefulness · Technical execution · Demo. Code freeze Sun 25 Oct 05:00 GMT;
expo judging 05:30 GMT; finalist stage demos 12:30 GMT; awards 13:30 GMT.

## Docs
- [`docs/README.md`](docs/README.md) — full documentation index.
- [`docs/foundry_plan.md`](docs/foundry_plan.md) — SolderSight Foundry 3-lane architecture (`foundry/core`, `foundry/ui`, `foundry/intel`).
- [`data/foundry/demo_script.md`](data/foundry/demo_script.md) — 2-minute live stage script (4 beats).
- [`docs/sapling-gate.md`](docs/sapling-gate.md) — Banyan Sapling trace audit (no answer key) & policy gate.
- [`docs/huggingface_strategy.md`](docs/huggingface_strategy.md) — deployed static + live CORS Hugging Face Space.
- [`docs/expo_test_plan.md`](docs/expo_test_plan.md) — expo table runbook & fallback checklist.
- [`docs/plan.md`](docs/plan.md) — original 42-hour build plan & architecture.

## Setup (during the event)
1. Copy `.env.example` → `.env` and fill in `MUBIT_API_KEY` (your OpenAI key stays in the
   Mubit console under **Provider keys**; the starter credit works too).
2. Data: nothing to download. `data/deeppcb/` carries a committed 30-pair subset of the
   [DeepPCB](https://github.com/tangsanli5201/DeepPCB) dataset — template/test images plus
   the dataset's own defect boxes — and the ledgers behind the numbers above
   (`runs.jsonl`, `comparison.json`, `corrections.jsonl`).
3. Backend: `cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && uvicorn main:app --reload`
4. Frontend: `cd frontend && npm install && npm run dev` → http://localhost:5173
5. Tests: `backend/.venv/bin/python -m pytest backend` and `cd frontend && npm test`.
   Both run offline — the model call is faked, so nothing spends credit.

## Endpoints
`GET /boards` · `GET /assets/{file}` · `GET /crop/{board_id}/{index}` ·
`POST /triage` (upload; optional `template` enables the diff, else quadrant crops) ·
`POST /triage/board/{board_id}?lane=` ·
`POST /corrections` · `POST /corrections/{index}/disable` (append-only rule removal) ·
`GET /rules` (what the line has taught, both task prompts, adapted-vs-baseline health) ·
`POST /compare` (same crops, both lanes) · `GET /metrics` · `GET /benchmark` (last capture) ·
`POST /verify/board/{board_id}` (Banyan Sapling policy gate; defaults to the model's own
region notes, `evidence_types` opts into the AOI-label oracle) ·
`POST /verify/trace` (Sapling trace audit vs the model's own notes, no ground truth).

## Pre-commit
Secrets scanning (gitleaks) + linting (ruff for Python) run via the `pre-commit` framework.
Install: `pre-commit install`. Run manually: `pre-commit run --all-files`.

## Status

Core build + SolderSight Foundry complete (Oct 25).
- **Backend:** concurrent per-region triage with per-crop failure isolation and confidence-weighted board verdict, corrections→instructions adaptation with append-only rule disabling, compare, metrics, benchmark, and Banyan Sapling policy gate + trace audit (`inspection.py`, `sapling.py`); **42 backend tests pass**.
- **Foundry (`frontend/src/foundry/` + `data/foundry/`):**
  - `foundry/core`: deterministic A\* router, IPC-2221 DRC scorer, seeded evolutionary loop (`evolve()`), and autonomous defect repair (`heal()`).
  - `foundry/intel`: Mubit netlist architect (`spec.ts`), live designer commentary (`commentary.ts`), Banyan Sapling validity/taste judge (`judge.ts`), and offline-safe golden replay (`golden.ts`).
  - `foundry/ui`: interactive SVG `BoardCanvas` (animated copper traces, DeepPCB `00041004` photo underlay, pulsing red violations flipping green on repair), `EvolveView`, `HealView`, `Sparkline`, `SaplingGateCard`, and `FoundryView` with 4-beat stage runbook wired into `App.tsx`.
- **Frontend:** case-file paper identity, `Triage` + `Foundry` workspace tabs, board filmstrip, compare slider, defect overlays, region cards, correction form, policy gate; `tsc --noEmit` and `vite build` clean.
- **Demo data:** 30-pair DeepPCB subset (`data/deeppcb/`) + Foundry golden run and curated netlists (`data/foundry/`) committed so a fresh clone runs 100% offline.

## License
MIT (to be confirmed).
