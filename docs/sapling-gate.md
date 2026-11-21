# The Policy Gate — Banyan Sapling as SolderSight's safety check

Sapling doing the hard part, on a realistic input.

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
| **evidence** | **Oracle mode** (opt-in via `evidence_types`): what inspection actually found — the DeepPCB / AOI defect labels, rendered by `sapling.build_evidence()`. This mode is shown here for the ground-truth contrast; `POST /verify/board` *defaults* to the model's own notes (the trace audit above, `sapling.build_trace_evidence()`), which needs no answer key. |
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

## Service status & fallbacks (Nov 21, 2026)

The research-preview endpoint is **paused** — it answers 503 instantly, the
signature of a stopped HF dedicated endpoint in Mubit's account (we can't wake
it; their demo Space `MubitLabs/banyan-sapling-demo` is paused too and only
proxies the same endpoint). The request/response contract is unchanged, so the
integration needs no edits when it comes back.

Until then the gate verifies through a labeled fallback ladder — every verdict
reports its `source`, so nothing pretends to be Sapling. The rungs live in
`backend/verifier.py` and are shared by both surfaces: `verify_bundle`
(`/verify/board`, `/verify/trace`) and `glasses.gate_for` (which inserts a
recorded-snapshot rung for the venue-proof replay):

1. **`live`** — Sapling, when reachable.
2. **`recorded`** — committed snapshots in `glasses/gate_verdicts.json`
   (e.g. `baseline:00041003` → violation 0.84 → BLOCK, the documented value).
3. **`llm`** — an independent OpenAI-compatible verifier (`verifier.llm_gate`):
   Mubit `/openai/v1` → Mubit `/compat/groq/v1` (free-tier `gpt-oss-120b`,
   registered under Provider keys in the console — verified live: BLOCKs
   `adapted:00041000`, SHIPs `baseline:00041004`) → evomap
   (`evomap-glm-5.1`, free) → ambient gateways. Opt-in on the glasses path
   (`GLASSES_LLM_GATE=1`); always attempted on `/verify` when Sapling errors.
   Probed dead: Anthropic route (valid key, zero credit), freemodel,
   openmodel, aiml, featherless, aisa.
4. **`rules`** — `verifier.rule_gate`: the acceptance policy as code over the
   recorded evidence (region notes in trace mode, pseudo-regions from
   `evidence_types` in oracle mode). Always on, zero network. Honest — it
   answers only "did the evidence forbid shipping as-is?"; it is not a
   Sapling stand-in.
5. **`unavailable`** — Sapling down *and* no evidence regions to grade: the
   fail-safe REVIEW, labeled as such.

Self-hosting the real Sapling: `hf download MubitLabs/banyan-sapling`, run the
bundled `inference.py` (pinned runtime — Python 3.12 / CUDA 13 / H200
reference, ~46 GB checkpoint), point `BANYAN_ENDPOINT` at it.

### Gate eval — measuring the rungs

`python -m gate_eval [--llm] [--live]` replays every recorded (lane, board)
through each rung and scores it two ways: *conviction* (notes recorded a
defect → did the gate block?) and *oracle safety* (truth says scrap/rework →
did the pipeline still ship?). Result on the 23-board ledger, `llm` live via
`mubit+groq` (Nov 21):

| rung | policy-correct | shipped-defective | false-block | notes-convicted |
|------|----------------|-------------------|-------------|-----------------|
| `llm` (gpt-oss-120b) | 12/23 (52%) | 11 | 0 | **12/12** |
| `rules` | 12/23 (52%) | 11 | 0 | **12/12** |

All 11 shipped-defective are **vision misses**, not gate misses — the model
wrote clean notes on truly defective boards (the baseline lane's known
blindness), and no verifier can convict evidence it never received. What the
eval proves: whenever the notes record a defect, every rung blocks it, and
nothing false-blocks a clean board. On this evidence shape a free LLM and a
policy-as-code check agree exactly — Sapling's remaining edge is calibrated
uncertainty on ambiguous evidence, not catch rate.

### Ambiguous evidence — where semantics pay

`python -m gate_eval --ambiguous [--llm]` replays 12 synthetic cases built to
separate the rungs: notes whose *text* says "look again" while the structured
`defect_type` field says `none` (hedged cracks, hazy bridges, glare-occluded
pads, low-confidence cleans, contradictions, cosmetic caveats). Result with
`llm` live via `mubit+groq` (Nov 21):

| rung | expected actions | failure mode |
|------|------------------|--------------|
| `rules` | 6/12 | SHIPs every hedged/low-confidence note — it only reads `defect_type` |
| `llm` | 9/12 | catches all 6 ambiguous cases (4 REVIEW, 2 conservative BLOCK); over-escalates one error case to BLOCK |

The gap is real and one-directional: rules' misses are silent SHIPs (the
dangerous direction); the LLM's are over-cautious BLOCKs. This is the load a
semantic verifier carries that policy-as-code can't — and a free LLM already
captures most of it. When Sapling's endpoint returns, `--live` adds its
calibrated column to this table; the bet to check is whether its
`insufficient_information` calls land better than an off-the-shelf model's.

### The hedge signal — a re-inspection queue for free

The same eval now prints a `hedged` column: clean notes flagged by
`verifier.hedged_regions()` for hedge language or confidence < 0.8. On the
23-board ledger, **8 of the 11 shipped-defective boards carried hedge signals**
(the model said "appears clean"/"may be" on boards that were truly defective);
only 3 vision misses were confident-and-wrong. A re-inspection pass that takes
a second, magnified look at hedged regions targets the majority of the miss
surface — that queue costs nothing to compute and is where upstream detection
work should focus.

Additional surfaces: `backend/verifier.py` (the shared ladder),
`backend/gate_eval.py` (the rung benchmark), `backend/glasses.py` (`gate_for`,
§5 overlay payloads), `backend/glasses_server.py` (stdlib replay box,
`:8001`), `glasses/index.html` (waveguide preview, works from `file://`),
`glasses/payloads.{json,js}` (all recorded boards baked).
