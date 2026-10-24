---
title: SolderSight — PCB Ship-Gate, verified by Banyan Sapling
emoji: 🔍
colorFrom: blue
colorTo: red
sdk: gradio
sdk_version: 6.30.0
app_file: app.py
pinned: false
license: mit
short_description: Banyan Sapling verifies PCB "ship it" decisions — against the model's own notes (no answer key) and against policy. Live, calibrated, fail-safe.
---

# SolderSight — PCB ship-gate, verified by Mubit's Banyan Sapling

A cheap vision model (gpt-4o-mini via Mubit) decides whether a circuit board can ship.
Cheap models are confidently wrong — they clear defective boards as *pass*. **Banyan
Sapling** is the check that catches them, two ways:

- **Trace audit (no answer key)** — Sapling audits the "ship it" decision against the
  vision model's *own* crop-by-crop notes. The catch is the model contradicting itself
  (it wrote *"visible short circuit"*, then the board was up for shipping). No ground
  truth, no dataset labels.
- **Policy gate** — Sapling verifies the decision against an independent inspection
  (AOI) reading + a written acceptance policy → **SHIP / BLOCK / REVIEW**, fail-safe to
  human review.

## The catch

Board `00041004`: the vision model says **pass** (95%). The board truly has an open +
short circuit → **scrap**. Sapling returns **violation at 96% → BLOCK**.

## How verification works

Sapling is called **live** against Mubit's research-preview endpoint
(`…endpoints.huggingface.cloud` — **no auth required**). If the endpoint is cold-starting or
unreachable, the app falls back to a bundled cache of **real** Sapling verdicts
(`data/sapling_cache.json`, produced by `build_cache.py`) — clearly labelled, never a
fabricated number.

## Run locally

```bash
pip install -r requirements.txt
python app.py
# optional: refresh the cached real verdicts
python build_cache.py
```

## Files

```
app.py            # Gradio app (live-first, cached-real fallback)
sapling.py        # vendored Banyan Sapling client (same code as the backend)
demo_cases.py     # shared evidence/claim builders per board
build_cache.py    # regenerate data/sapling_cache.json (real Sapling outputs)
requirements.txt  # gradio 6.30.0 pinned
data/             # runs.jsonl, 30 board images, sapling_cache.json
```

## Deploy on Hugging Face Spaces

1. Create a Space (SDK: Gradio, version 6.30.0).
2. Upload `app.py`, `sapling.py`, `demo_cases.py`, `build_cache.py`, `requirements.txt`,
   `README.md`, and the `data/` folder.
3. No secret is required — Sapling's research-preview endpoint needs no auth. (Set
   `BANYAN_ENDPOINT` as a variable only to point at a self-hosted Sapling.)

## Repo

https://github.com/sneldao/soldersight — full app (FastAPI + React), tests, and the
`backend/trace_demo.py` / `backend/gate_demo.py` demos.

---

Built for Mubit Night Shift Hackathon (London, Oct 23–25, 2026).
