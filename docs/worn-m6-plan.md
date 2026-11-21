# Worn × MicroLumin M6 — glasses entry plan

Plan for the [Worn smart-glasses hackathon](https://worn-hacks.com) (MicroLumin
M6 waveguide display glasses; theme: *Second nature*). **One-day event, Sat
Nov 21 2026 — submissions close 2:00 PM ET.** CUNY City Tech, 285 Jay St,
Brooklyn.

## 1. The event, in brief

| Field          | Value                                                                      |
| -------------- | -------------------------------------------------------------------------- |
| **Hardware**   | MicroLumin M6 — waveguide display glasses; SDK handed out at the venue     |
| **Tracks**     | 01 Personal Insight · 02 Seamless Handoff · 03 Natural Interaction         |
| **Our track**  | **03** if the M6 camera is app-accessible; **02** if capture runs on the   |
|                | phone (see §4 — the architecture supports both, decide at the SDK brief)   |
| **Judging**    | Understands you · Adaptability (phone↔glasses) · Ergonomics · Works on     |
|                | glasses · Impact — each 0–2 / 10. Below 1 avg on *works on glasses* DQ's   |
| **Deadline**   | Sat Nov 21, 2:00 PM ET via Airtable — no late edits                        |
| **Submission** | Draft copy ready at `docs/SUBMISSION_WORN.md` — two bracketed slots        |
|                | to fill after hardware contact (render channel + observed behavior).     |
| **Prior work** | SolderSight predates the event → **disclose it** in the submission         |

## 2. The honest reframe — what the eval already proved

Do not pitch "AI looks at your board and finds defects." Our own eval measured
that claim and it is **false today**:

- Whole-board disposition accuracy: **0.26–0.44** — at or below the constant
  "pass" floor (0.50). False alarms on clean inputs: **0.21–0.89**.
- The single biggest fix: **show the model the golden reference** — 3 of 4
  models jump to Youden J **0.90–0.92**.
- Magnified crops help (aggregated board verdicts 0.60–0.97) but don't fix
  false alarms alone.
- The policy gate catches what classification misses: **14/14** ship calls
  blocked on boards the model's own region notes already flagged.
- The correction loop is the lift: inspector overrides a verdict → the rule
  joins the task → same crops, board disposition **0% → 83%**.

So the pitch is **reference-diff inspection** — hold the test board against
its known-good template, diff, crop the cells that changed, verdict per crop.
That is how real AOI works; it is also the only claim our own numbers support.
The eval isn't a liability — it's the credibility slide: *"We measured what
these models can't do. This is the workflow that works anyway."*

## 3. The wedge — a wearable AOI bench

**SolderSight on your face:** the field tech holds a board; the glasses overlay
which cells differ from golden and what each region's verdict is. Two hands
stay on the board — that is the entire ergonomics story, and it's the theme
name made physical.

The loop, worn:

1. **See** — test board against golden template → changed cells overlay, each
   with verdict (`pass` / `rework` / `scrap`), defect type, confidence.
2. **Decide** — board disposition lands: one line, e.g. *"REWORK — broken
   trace, cell 4"* — never a paragraph.
3. **Correct** — the tech overrides by voice: *"that's a broken trace, not
   clean copper."* The rule joins the instructions — the correction is a
   measured task, not a thumbs-up into the void.
4. **Gate** — before any board clears, Sapling audits the ship claim against
   the model's own notes. Self-contradicting verdict → **BLOCK**, on the
   glasses, red.

The product isn't the model — it's the **instrumented human-in-the-loop
inspection station**. Nobody's AOI box shows a learning curve; ours does.

## 4. Capture path — decide at the SDK brief

- **If M6 camera is accessible** → glasses capture + display; Track 03
  (Natural Interaction). Purest demo.
- **If not** → phone camera captures, glasses carry the overlay; this *is*
  Track 02 (Seamless Handoff) — each device doing what it does best. Frame it
  as deliberate, not degraded.
- **Alignment is the real risk**, not the model. Live registration of
  template↔test under venue lighting is the fragile step. Mitigations: a
  printed alignment card under the board (fixed standoff, corner marks), or
  the committed DeepPCB pairs as canned input — rung 3 below.

## 5. Architecture and contract

```
board photo (glasses or phone cam)
   → POST /triage/board/{id}   (existing: template diff → crops → Mubit per crop)
   → overlay payload           (new, glasses-side)
   → POST /corrections         (existing: voice override → rule)
   → POST /verify/board/{id}   (existing: Sapling gate → SHIP / BLOCK)
```

Glasses overlay payload (mirrors the region card the web app already renders):

```
{ cell: int, bbox: [x,y,w,h],        # board-frame relative
  verdict: "pass"|"rework"|"scrap",
  defect_type: string, confidence: float,
  note: string }                      # ≤ 60 chars — waveguide line limit
board: { disposition, gate: "SHIP"|"BLOCK" }
```

Nothing agent-side moves onto the glasses. `inspection.py`, `sapling.py`,
`/corrections`, and the recorded ledgers (`data/deeppcb/runs.jsonl`,
`corrections.jsonl`, `comparison.json`) are all committed and run offline —
the phone/laptop is the runtime, the glasses are a display+mic client.

## 6. Execution plan (today, ~3 hours)

| Time   | Step                                                                                          |
| ------ | --------------------------------------------------------------------------------------------- |
| +0:00  | SDK brief → answer §4 (camera? text vs bitmap? line width?) and freeze the contract in §5      |
| +0:30  | Rung 2 stub: overlay page rendering region verdicts at waveguide size over a board photo       |
| +1:00  | Rung 3: canned replay — stream board `00041003`/`00041004` region verdicts from `runs.jsonl`   |
|        | to the glasses; Sapling BLOCK as the closer                                                    |
| +1:45  | Rung 4 attempt: live capture → diff → crop → verdict on one staged board                       |
| +2:15  | Two full demo rehearsals at the working rung; submission text written                          |
| −0:30  | Submit early. Buffer is for venue wifi, not features.                                          |

## 7. Fallback ladder — every rung is a demo

1. Web Triage tab + talk-through — works today (prior work, disclosed)
2. — glasses-preview page: region cards at display size over the board photo
3. — M6 replaying committed verdicts for `00041003`/`00041004` (no live pipeline)
4. — M6 live: capture → diff → crop → verdict → gate, end to end

Aim for rung 4. Ship whatever the top working rung is at 1:30 PM.

## 8. Demo arc (three minutes, worn by the team)

**Say:** "Frontier models can't inspect a bare board — we benchmarked it, the
numbers are brutal. But line techs don't inspect bare boards; they inspect
against a golden reference. So that's what your glasses do."

1. **The board.** Real PCB (or printed DeepPCB test image) on the table,
   alignment card underneath. Look through the M6 — changed cells light up,
   per-region verdicts.
2. **The catch + the teach.** *"REWORK — broken trace, cell 4."* Override by
   voice; show the corrected lane scoring where the baseline failed.
3. **The gate.** Ship request → Sapling **BLOCK** — the model's own notes
   convicted it. *"14 for 14 on self-contradicting boards."*
4. **The close.** *"Hands never left the board. That's second nature."*

## 9. Scoring read

| Criterion          | Honest score | Why                                                                  |
| ------------------ | ------------ | -------------------------------------------------------------------- |
| Ergonomics         | 2            | Two-handed bench work + floating overlay — the strongest axis        |
| Works on glasses   | 1–2          | Physical, vivid; gated on §4 camera answer                           |
| Adaptability       | 1–2          | If phone-cam is the capture path, handoff is literally the product   |
| Understands you    | 0–1          | Weakest — the correction loop personalizes to *your line's* failure  |
|                    |              | modes, but it understands the board, not the wearer                  |
| Impact & pitch     | 2            | Hardware judges (MicroLumin CEO, hardware founders) feel a physical  |
|                    |              | AOI demo; the eval numbers make the honesty legible                  |

Ceiling ~8–9/10; Track 01 is the wrong room for this — don't chase Personal
Insight with a board inspector.

## 10. Risks

- **Camera access** unknown until the SDK brief → §4 decision, both tracks
  pre-framed.
- **Live registration** under venue lighting → canned pairs + alignment card.
- **Venue wifi** → Mubit is a cloud call; `runs.jsonl` replay covers it.
- **Scope** → the Foundry tab is *not* in the demo. Triage + corrections +
  gate only.
- **Prior work** → disclose in the Airtable form; the delta being submitted
  is the glasses surface and the worn workflow.

## 11. Built (Nov 21)

Rung 2 + rung 3 of the fallback ladder exist and run offline:

- `backend/glasses.py` — §5 payload builder (`payload_for`, `payload_from_triage`
  for the live path). `PINNED_RUNS` pins `baseline:00041003` to the batch whose
  own notes say "short circuit". `python -m glasses snapshot` refreshes
  `glasses/gate_verdicts.json` from live Sapling; `python -m glasses payloads`
  rebakes `glasses/payloads.{json,js}` after any new recorded run.
- `backend/glasses_server.py` — stdlib-only venue box on :8001: `GET /glasses`
  (preview page), `GET /glasses/board/{id}?lane=`, `GET /glasses/stream/{id}`
  (paced NDJSON — region per tick, verdict, gate), `/images/{name}`.
- `glasses/index.html` — waveguide preview (rung 2): green-on-black cell overlay,
  one-line verdict, gate banner. Fetch order: replay server → :8000 backend →
  embedded `payloads.js` — so it also runs from `file://` with no servers.
- `GET /glasses/board/{id}` on the FastAPI backend (same contract, recorded runs).
- `glasses/gate_verdicts.json` — **Sapling was 503 on Nov 21**; the hero verdict
  (`baseline:00041003` → violation 0.84 → BLOCK) is the value documented in
  `docs/sapling-gate.md`, marked `source: "recorded"`. Re-run `snapshot` to refresh.
- **Gate redundancy** (`glasses.gate_for` → shared rungs in
  `backend/verifier.py`, each labels its `source`): live Sapling → recorded
  snapshot → LLM verifier (`use_llm`/`GLASSES_LLM_GATE=1`; Mubit `/openai/v1` →
  Mubit `/compat/groq/v1` (gpt-oss-120b, free tier, key registered in console
  Nov 21) → evomap → ambient) → deterministic policy check (`rule_gate` —
  always on, zero network). The same rungs now back `/verify/board` and
  `/verify/trace` when Sapling errors (`verify_bundle`), and
  `python -m gate_eval` benchmarks every rung on the recorded ledger
  (Nov 21: llm + rules both convict 12/12 noted defects, 0 false blocks). Verified live Nov 21:
  `mubit+groq` BLOCKs `adapted:00041000` (open defects) and SHIPs
  `baseline:00041004` — every gate call instrumented in the Mubit console.
  Sapling itself: endpoint 503 (paused HF dedicated endpoint — Mubit-owned,
  can't wake it; demo Space also paused and proxies the same endpoint;
  self-host = 46 GB checkpoint, H200 reference — `MubitLabs/banyan-sapling`).
  Other probed-and-dead rungs: Anthropic route valid-but-zero-credit,
  freemodel 401, openmodel 404, aiml 403, featherless 403, aisa 402.
  `rule_gate` is honest, not a Sapling stand-in: it answers only "did the
  model's own notes forbid shipping as-is?"

Still open until the SDK brief: §4 capture path, the real M6 transport
(the contract assumes a client that can poll HTTP or read NDJSON), rung 4.

## 12. Transport gap — the one thing between this and a submission

**Nov 21 review:** the data plane is proven end-to-end offline (payloads,
replay server, gate ladder all verified live). The sibling entry (mettle)
is ahead on exactly one axis: it has a **built, sideload-ready M6 viewer
APK** that polls an HTTP relay and renders mono-green cards. Soldersight
has no display path — closing that gap *is* the submission. Options ranked
by venue-time cost:

1. **M6 built-in browser — check first, zero code.** The M6 is Android 9;
   if it ships a usable browser, point it at
   `http://<mac-ip>:8001/glasses` — `glasses/index.html` already is the
   waveguide renderer (cell overlay, one-line verdict, gate banner) and
   already falls back to embedded `payloads.js`. If this works, rung 3 is
   live in minutes. Test this before building anything.
2. **Mettle-pattern APK (~1–2h with the scaffold as reference).** The
   mettle `glasses-android/` app is the same shape this needs: one
   activity polling HTTP and painting mono-green. The endpoints it would
   consume already exist — `GET /glasses/board/{id}?lane=` (baked
   payloads) and `GET /glasses/stream/{id}` (paced NDJSON replay). Don't
   rewrite the pipeline; write the viewer. Note mettle's lesson: APK
   *iteration* on one device is costly — prefer options 1/3 before
   committing to on-device builds.
3. **Zero-build push channels** — same hardware facts as the mettle doc:
   `MLVISION Secret Vision` teleprompter/text push, or iOS notification
   mirroring if the M6 renders iPhone notifications. Weakest fidelity
   (text only — no cell overlay), but it still lands the demo's closer:
   `BLOCK`/`SHIP` + one line on the glasses.

**Venue WiFi:** same constraint as mettle — event networks isolate
clients, and every channel here hits `http://<mac-ip>:8001`. Plan A is
the iPhone hotspot: Mac + M6 join it, `glasses_server.py` binds the
Mac's hotspot IP. **Test the hotspot path before leaving, not at the
venue.**

**Also required before touching hardware:** write
`docs/SUBMISSION_WORN.md` — the Airtable is due 2:00 PM with no late
edits, and the draft costs nothing now. Follow the mettle pattern:
complete copy with two bracketed slots (render channel + observed
on-device behavior) filled after hardware contact.

**Revised execution order (supersedes §6 for remaining time):**

| Order | Step |
| ----- | ---- |
| 1 | `SUBMISSION_WORN.md` draft (no hardware needed) |
| 2 | Hotspot test: Mac + phone on iPhone hotspot, replay server reachable |
| 3 | M6 browser probe → `http://<mac-ip>:8001/glasses` (option 1 above) |
| 4 | If browser fails: clone mettle's APK viewer pattern against `/glasses/stream/{id}` |
| 5 | If APK fails: Secret Vision / notification push of `gate` line only |
| 6 | Two rehearsals at the working rung; submit with buffer |

**Score impact:** transport closed → works-on-glasses 2, ceiling ~8/10.
Transport open → a laptop demo at a glasses hackathon, ~5/10. Binary and
cheap to close — do it before anything else.

## 13. Mapping to existing docs

- [`../eval/README.md`](../eval/README.md) — the numbers §2 cites; the
  credibility slide.
- [`sapling-gate.md`](./sapling-gate.md) — the BLOCK beat in the demo arc.
- [`demo_storyboard.md`](./demo_storyboard.md) — case-file framing carries
  to the overlay copy (Fig plates → region cards).
- [`heypcb-challenge-plan.md`](./heypcb-challenge-plan.md) — the sibling
  hardware entry; concept #1 ("Bench QC") converged on the same worn-AOI
  idea independently.
- `../data/foundry/demo_script.md` — the 4-beat structure this arc mirrors.
