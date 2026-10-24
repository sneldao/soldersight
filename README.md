# SolderSight — Visual PCB Defect Triage (Mubit Hackathon Entry)

A visual quality-inspection agent for PCB manufacturing. **Recurring task:** a PCB
photo → defect type + severity + disposition (pass / rework / scrap). **Corrections
become model updates:** an inspector overrides a disposition ("this scratch is
cosmetic, not a defect") → the correction routes through Mubit → trains a
task-adapted open model that learns your defect rules. **Showcase:** closed model
(GPT-4o) baseline → corrections → task-adapted open model: better accuracy,
lower cost, lower latency, with photo overlays that visibly change.

Built for **Night Shift: $65K Mubit Hackathon** (London, Oct 23–25, 2026).

## Policy gate — Banyan Sapling (side quest: The "Policy" Challenge)

The vision model only *proposes* a disposition, and the cheap baseline demonstrably
clears defective boards as "pass". Before a board ships, SolderSight puts that
proposal to **Mubit's Banyan Sapling** as an independent verifier: it checks the
claim *"this board can ship as-is"* against a written **acceptance policy** and the
defects **inspection actually found** (the AOI/DeepPCB labels), and returns
`supported` / `violation` / `insufficient_information` / `inconsistent_context` with
calibrated uncertainty. SolderSight turns that into a line decision — **SHIP /
BLOCK / REVIEW**.

> Board `00041004`: vision said **pass**; the board has an open + short circuit
> (**scrap**). Sapling returned **violation @ 96%** → **ship blocked.** The verifier
> caught the classifier before a dead board left the line.

See it work: `python backend/gate_demo.py` (the catch, on real boards), or click
**"Verify against policy gate →"** in the UI after triaging a board.
Details: [`docs/sapling-gate.md`](docs/sapling-gate.md).

## Tracks hit
- **Recurring tasks** — defect triage (classify + disposition).
- **Own your intelligence layer** — closed (GPT-4o) → task-adapted open model, quality/cost/latency side by side.
- **Fast refresh** — new defect type → one correction → model adapts.

## Judging (equally weighted)
Use of Mubit · Usefulness · Technical execution · Demo. Code freeze Sun 25 Oct 05:00 GMT;
expo judging 05:30 GMT; finalist stage demos 12:30 GMT; awards 13:30 GMT.

## Docs
- [`docs/plan.md`](docs/plan.md) — full 42-hour build plan, architecture, demo arc, risks.
- [`docs/README.md`](docs/README.md) — docs index.

## Setup (during the event)
1. Copy `.env.example` → `.env` and fill in `MUBIT_API_KEY` (and provider key in the Mubit console).
2. Backend: `cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && uvicorn main:app --reload`
3. Frontend: `cd frontend && npm install && npm run dev`

## Pre-commit
Secrets scanning (gitleaks) + linting (ruff for Python) run via the `pre-commit` framework.
Install: `pre-commit install`. Run manually: `pre-commit run --all-files`.

## Status

Core build complete (Oct 24). Backend: `/triage`, `/corrections`, `/compare`, `/metrics`, `/rules` endpoints; region-based inspection (`inspection.py`); learned-rules prompt adaptation; all 17 backend tests pass. Frontend: board grid, before/after compare slider, defect overlays, triage panel, correction form; all 4 frontend tests pass.

Remaining before code freeze (Sun 25 Oct 05:00 GMT):
- Side-by-side comparison + metrics dashboard UI (frontend)
- Mubit adapter training re-integration (Path B)
- 3-min MP4 + PDF deck
- Expo demo test

See `docs/plan.md` for the full 42-hour build plan with checklists.

## License
MIT (to be confirmed).
