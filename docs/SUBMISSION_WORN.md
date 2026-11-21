# Worn submission draft — SolderSight

> Working draft for the Airtable submission due **Sat Nov 21, 2:00 PM ET** —
> no late edits. Fill the bracketed bits after judging what actually ran on
> hardware. Track 03 · Natural Interaction (02 · Seamless Handoff if the
> phone is the capture path).

## Project name

SolderSight — a wearable second pair of eyes for PCB inspection

## Tagline

Hold the board. The glasses show you which cells changed — and which
verdict is safe to ship.

## The problem

A field tech inspecting a PCB works two-handed: tweezers, magnifier,
the board itself. Every "AI inspection" tool we benchmarked wants them to
stop, photograph the board, upload it to a laptop, and read a verdict —
hands off the work, eyes off the board. And the models themselves are
fragile: we measured seven frontier vision models on expert-labelled
boards and whole-board disposition accuracy ran 0.26–0.44 — at or below
the constant "pass" floor, with false-alarm rates up to 0.89.

## What it does

SolderSight doesn't ask the model to find defects in the open world — it
asks the question AOI actually answers: **what changed versus the golden
reference?** Give the model the known-good template and 3 of 4 models
jump to 0.90+ detection (our own eval numbers). The tech holds the board;
the glasses overlay which cells differ and each region's verdict —
pass / rework / scrap — and a ship gate that blocks any verdict the
model's own notes already contradicted (14/14 on self-contradicting
boards). When the tech disagrees, they say so — the correction becomes a
new measured task: same crops, board disposition went 0% → 83% on the
corrected lane.

## How it works

`backend/inspection.py` diffs the test board against its template, crops
the changed cells, and scores each crop through Mubit. `glasses.py`
shapes the result into a stable overlay contract —
`{cell, bbox, verdict, defect_type, confidence, note ≤60 chars}` plus a
board-level `{disposition, gate}` — served from a zero-dependency
replay server (`glasses_server.py`) that runs on the paired laptop.
[Render channel on device: TBD at venue — M6 browser / sideloaded viewer
/ SDK push / notification mirror.]

The ship gate is a labeled fallback ladder: live Banyan Sapling →
recorded snapshots → independent LLM verifier → deterministic policy
check on the model's own notes. Every verdict names its `source`;
nothing impersonates a service that's down.

## Prior work disclosure (required)

SolderSight predates this event. Prior work: the triage pipeline
(template diff → crop → per-region verdict), the corrections→instructions
adaptation loop, the Banyan Sapling policy gate and trace audit, the
Foundry evolver/healer, the DeepPCB eval (1,127 tasks, committed results),
and the web Triage UI.

**Built at this event:** the entire glasses surface — the overlay payload
contract (`backend/glasses.py`), the venue replay server
(`backend/glasses_server.py`) with paced NDJSON streams, the waveguide
preview (`glasses/index.html` — overlay, one-line verdict, gate banner,
runs from `file://`), baked payload sets (`glasses/payloads.*`), the gate
fallback ladder (`glasses.gate_for`, snapshot → LLM verifier → policy
rules), and [whichever render channel landed on hardware].

## Demo

Three minutes, worn by the team. A real board (or printed DeepPCB test
image) sits on the table. The judge wears the M6: changed cells light up,
region verdicts tick past, then the model says "ship" on a board its own
notes flagged — and the gate slams **BLOCK**. The tech overrides by voice;
the corrected lane scores 83% where the baseline scored 0. Hands never
left the board.

Fallback ladder: web Triage + talk-through → preview page over the board
photo → canned replay on whatever render channel works → live capture.

## Why it wins on the rubric

- **Understands you** — the correction loop personalizes to *your line's*
  failure modes; the instrument learns from the person holding it.
- **Adaptability** — laptop does the diffing, glasses carry the overlay;
  if the phone is the camera, capture and display are literally two
  devices doing what each does best.
- **Ergonomics** — the strongest axis: two-handed bench work with the
  verdict floating in vision. No phone, no laptop glance, no upload step.
- **Works on glasses** — [fill in after hardware: which channel, what it
  rendered, latency observed].
- **Impact** — AOI is a real industry; "field tech with a second pair of
  eyes" is a workflow judges can feel on the table.

## Tech stack

Python/FastAPI (triage, gate, replay server), Mubit-routed vision models,
Banyan Sapling policy gate (+ labeled fallback ladder), DeepPCB dataset,
vanilla HTML/JS overlay renderer, [M6 render channel TBD].

## Repo

github.com/udirobert/soldersight — glasses surface: `docs/worn-m6-plan.md`,
`backend/glasses.py`, `backend/glasses_server.py`, `glasses/`
