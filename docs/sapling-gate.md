# The Policy Gate — Banyan Sapling as SolderSight's safety check

**Side Quest: The "Policy" Challenge.** Sapling doing the hard part, on a realistic input.

## Trace audit — the model's own words vs the decision to ship (no answer key)

The strongest version uses **no ground truth at all**. A vision model inspects a board
crop by crop and writes a note on each. Separately, a shipping decision is made. Sapling
audits that decision against the model's **own notes** — never the dataset labels — and
flags it when the model already said, in its own words, that it saw a short or open
circuit. The catch is the model *contradicting itself*.

- Evidence = `sapling.build_trace_evidence(regions)` — the model's verbatim per-crop
  observations (`defect_type`, `severity`, `confidence`, `reason`).
- Claim = `sapling.SHIP_CLAIM` ("this board can ship as-is").
- Endpoint = `POST /verify/trace` (regions in body; no board/label lookup).
- Demo = `python backend/trace_demo.py`:

```
lane      board      crops model noted            sapling     gate
baseline  00041003       6 open,pinhole,short     violation   BLOCK
...
14/14 shipping claims blocked — each a board the model's own notes said not to ship.
No ground truth was consulted.
```

Board `00041003`: the model wrote *"there is a visible short circuit potentially
affecting the functionality"* on a crop. Sapling scored the ship claim a **violation
(~0.84)** on the strength of that sentence alone. This is trace auditing — what the
agent concluded, checked against what it actually observed.

The policy gate below is the second, independent check (claim vs an AOI sensor + spec).

## The problem

SolderSight's vision model (gpt-4o-mini, routed through Mubit) is cheap and fast —
and fallible. On the baseline lane it clears defective boards as **pass**: on the
30-board DeepPCB subset, every scored baseline call has `disposition_correct: false`.
A cheap model confidently rubber-stamping a board with an open circuit is exactly
the failure that ships a dead board to a customer.

You can't fix that by making the classifier a little better. You need an
*independent* check that answers a different question: **is it actually allowed to
ship this board?** That is semantic verification, not classification — and it's
what Banyan Sapling is built for.

## The design

Before any board is cleared, its proposed outcome is treated as a **claim** and
verified against two things Sapling takes as inputs:

| Sapling input | SolderSight source |
|---------------|--------------------|
| **policy**   | A written acceptance spec (open/short → scrap; spur/copper/mousebite/pin-hole → rework; clean → pass; ambiguous → human). `sapling.DEFAULT_POLICY`. |
| **evidence** | What inspection actually found — the DeepPCB / AOI defect labels, rendered to prose by `sapling.build_evidence()`. Independent of the vision model. |
| **claim**    | The shippability question: *"this board passes QA and is approved to ship as-is."* `sapling.SHIP_CLAIM`. |

Sapling returns one of `supported` / `violation` / `insufficient_information` /
`inconsistent_context`, with calibrated probabilities and a conformal prediction
set. SolderSight maps that to a line decision (`sapling.gate_decision`):

- **`violation` → BLOCK.** A disqualifying defect is present; ship stopped.
- **`supported` (low violation risk) → SHIP.** Cleared.
- **`insufficient_information` / `inconsistent_context` / supported-but-risky → REVIEW.** Routed to a human. On a verifier outage the gate also fails safe to REVIEW.

### Why the claim is fixed to "ship it"

Probing the live endpoint showed Sapling reads `violation` as *"the evidence shows a
policy violation"* — it returns `violation` for an open-circuit board whether the
claim says "ship" or "scrap". So the honest question to put to it is shippability,
and we let the verdict — not the vision model's wording — drive the gate. Sapling's
`violation` signal is sharp and bimodal (~0.96 with a real defect, ~0.08 when
clean), while `supported` stays modest even on clean boards (it won't treat "no
defect detected" as proof of a good board). The gate therefore clears a board only
when `supported` leads *and* violation risk is under 15% — it reliably stops a
defective board without rubber-stamping an uncertain one.

## The catch, on real boards

`python backend/gate_demo.py` replays each board's recorded vision verdict as the
claim, hands Sapling the AOI defects as evidence, and shows the gate decision:

```
board      truth   worst      vision  -> sapling                    gate
-------------------------------------------------------------------------------
00041004   scrap   short      pass    -> violation             96% BLOCK   <-- caught
...
Gate range on illustrative evidence:
  clean board    -> supported                  SHIP
  spur only      -> insufficient_information   REVIEW
  open circuit   -> violation                  BLOCK
```

Board `00041004`: the vision model said **pass**; the board truly has an open and a
short (**scrap**). Sapling returned **violation at 96%** and the gate **blocked the
ship**. That is the whole point — the cheap model was wrong, and the verifier caught
it before the board left the line.

## Where it lives

- `backend/sapling.py` — Sapling client (httpx + certifi), policy/evidence/claim builders, `gate_decision`.
- `backend/main.py` — `POST /verify/board/{id}` bundles gate + evidence + claim + policy + ground truth.
- `frontend/src/components/PolicyGate.tsx` — the verdict badge, calibrated probability bars, and conformal-uncertainty note. Appears after triage via **"Verify against policy gate →"**.
- `backend/gate_demo.py` — the batch catch, on real boards.
- `backend/test_sapling.py` — the gate mapping and endpoint, tested offline.

Endpoint: Mubit's research-preview Banyan Sapling
(`https://6adbee0669a00298cd4774c9.endpoints.huggingface.cloud`, no auth).
Override with `BANYAN_ENDPOINT` to point at self-hosted open weights.
