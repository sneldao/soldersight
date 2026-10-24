# SolderSight — Visual PCB Defect Triage (Mubit Hackathon Entry)

A visual quality-inspection agent for PCB manufacturing. **Recurring task:** a PCB
photo → defect type + severity + disposition (pass / rework / scrap). **Corrections
become model updates:** an inspector overrides a disposition ("this scratch is
cosmetic, not a defect") → the correction routes through Mubit → trains a
task-adapted open model that learns your defect rules. **Showcase:** closed model
(GPT-4o) baseline → corrections → task-adapted open model: better accuracy,
lower cost, lower latency, with photo overlays that visibly change.

Built for **Night Shift: $65K Mubit Hackathon** (London, Oct 23–25, 2026).

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
Scaffold only. All project code written during the event (Night Shift, Oct 23–25).
Open-source libraries and own tooling are fine; code must be written during the event.

## License
MIT (to be confirmed).
