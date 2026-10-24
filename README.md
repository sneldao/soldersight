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

## What the corrections bought (measured, not claimed)

`gpt-4o-mini` through Mubit over 6 DeepPCB boards, 28 crops per lane, 3 inspector
corrections, one capture (`python backend/capture_comparison.py`):

| | baseline task | adapted task |
| --- | --- | --- |
| Defect crops with the right type | 6% | 17% |
| Defects missed | 89% | 11% |
| Clean crops falsely flagged | 0% | 90% |
| **Board disposition right** | **0%** | **83%** |
| Cost per crop | $0.001317 | $0.001333 |
| Latency per crop | 1165ms | 1166ms |

Defect crops and clean crops are scored apart, so untouched boards cannot inflate the
accuracy — and the tradeoff is on the table: the corrected line now over-flags clean
copper (90%) while catching the defects it used to walk past. Corrections and scoring
share these boards: this is the loop working, not a held-out benchmark.

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
defects **inspection actually found** (the AOI/DeepPCB labels), and returns
`supported` / `violation` / `insufficient_information` / `inconsistent_context` with
calibrated uncertainty. SolderSight turns that into a line decision — **SHIP /
BLOCK / REVIEW**.

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

## Tracks hit
- **Recurring tasks** — defect triage (classify + disposition), one task per instruction set.
- **Own your intelligence layer** — two tasks over the same crops, quality/cost/latency side by side.
- **Fast refresh** — a new defect name in one correction joins the taxonomy the task accepts.

## Judging (equally weighted)
Use of Mubit · Usefulness · Technical execution · Demo. Code freeze Sun 25 Oct 05:00 GMT;
expo judging 05:30 GMT; finalist stage demos 12:30 GMT; awards 13:30 GMT.

## Docs
- [`docs/plan.md`](docs/plan.md) — full 42-hour build plan, architecture, demo arc, risks.
- [`docs/README.md`](docs/README.md) — docs index.

## Setup (during the event)
1. Copy `.env.example` → `.env` and fill in `MUBIT_API_KEY` (your OpenAI key stays in the
   Mubit console under **Provider keys**; the starter credit works too).
2. Data: `bash scripts/get-data.sh` puts DeepPCB `temp/test/annotation` pairs under
   `data/deeppcb/` (not committed — they are the dataset's files, not ours).
3. Backend: `cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && uvicorn main:app --reload`
4. Frontend: `cd frontend && npm install && npm run dev` → http://localhost:5173
5. Tests: `backend/.venv/bin/python -m pytest backend` and `cd frontend && npm test`.
   Both run offline — the model call is faked, so nothing spends credit.

## Endpoints
`GET /boards` · `GET /assets/{file}` · `GET /crop/{board_id}/{index}` ·
`POST /triage` (upload, quadrant crops) · `POST /triage/board/{board_id}?lane=` ·
`POST /corrections` · `GET /rules` (what the line has taught, and both task prompts) ·
`POST /compare` (same crops, both lanes) · `GET /metrics` · `GET /benchmark` (last capture) ·
`POST /verify/board/{board_id}` (Banyan Sapling policy gate).

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
