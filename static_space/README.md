---
title: SolderSight × Banyan Sapling — PCB ship-gate
emoji: 🔍
colorFrom: blue
colorTo: red
sdk: static
app_file: index.html
pinned: false
license: mit
short_description: Live Banyan Sapling gate for PCB ship decisions
---

# SolderSight × Banyan Sapling — PCB ship-gate

A cheap vision model (gpt-4o-mini via Mubit) decides whether a circuit board can ship.
Cheap models are confidently wrong — they clear defective boards as *pass*. **Banyan
Sapling** is the check that catches them:

- **Trace audit (no answer key)** — audits the "ship it" decision against the vision
  model's *own* crop-by-crop notes. On `00041003` the model wrote *"visible short
  circuit"*, then the board was up for shipping → Sapling: **violation → BLOCK**.
- **Policy gate** — verifies the decision against an independent inspection (AOI)
  reading + a written acceptance policy → **SHIP / BLOCK / REVIEW**.

This is a **static** Space: your browser calls Banyan Sapling's research-preview
endpoint **live** (it's open and needs no auth). Cached *real* verdicts load instantly
and serve as the fallback if the endpoint is cold — nothing here is fabricated.

Open weights (Apache-2.0): [MubitLabs/banyan-sapling](https://huggingface.co/MubitLabs/banyan-sapling).
Full app, tests, and CLI demos: [github.com/sneldao/soldersight](https://github.com/sneldao/soldersight).

Built for Mubit Night Shift Hackathon (London, Oct 2026).
