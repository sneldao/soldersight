# Mubit Hackathon — Build Plan: "PCB Defect Triage" (Visual Quality Inspection)

## Concept

A visual quality-inspection agent for PCB manufacturing. **Recurring task:** a PCB photo → defect type + severity + disposition (pass / rework / scrap). **Corrections become model updates:** an inspector overrides a disposition ("this scratch is cosmetic, not a defect") → the correction routes through Mubit → trains a task-adapted open model that learns your defect rules. **Showcase:** closed model (GPT-4o) baseline → corrections → task-adapted open model: better accuracy, lower cost, lower latency, with photo overlays that visibly change.

**Tracks hit:** Recurring tasks ✅ (defect triage) · Own your intelligence layer ✅ (closed → open, side-by-side) · Fast refresh ✅ (new defect type → correction → adaptation).

**Judging alignment:** Use of Mubit ✅ · Usefulness ✅ (QA is expensive, scrap is costly) · Technical execution ✅ (objective, measurable) · Demo ✅ (visual before/after with overlays).

## Inspiration (from Tavily research)
- **DeepPCB dataset** (1,500 PCB image pairs, 6 defect types): open, short, mousebite, spur, spurious copper, pin-hole. — https://github.com/tangsanli5201/DeepPCB
- **fardinhossain007/pcb-defect-detection**: ResNet-18, 91.2% F1, 6 defect classes, domain-specific report templates, "high recall over precision" rationale (missed defect = $1000+, false alarm = $2). — https://github.com/fardinhossain007/pcb-defect-detection
- **Roboflow PCB defect detection** blog + datasets. — https://roboflow.com/blog/pcb-defect-detection
- **Mubit's own example** is support-ticket classification (billing/bug/account/other) — our task is the same shape (classify + disposition), which is Mubit's sweet spot. — https://docs.mubit.ai/guides/first-adapter

## What we reuse (own tooling, allowed)
- **Imperfect Form** (`/Users/udingethe/Dev/imperfect-form`): MediaPipe/OpenCV in-browser vision, "no video leaves device" privacy pattern, multi-provider AI client (Gemini/Groq/Venice/Bedrock/heuristics).
- **Sikizana** (`/Users/udingethe/Dev/sikizana`): FastAPI backend, React frontend, OpenAI-compatible client, approve-button correction pattern, finding-kind classification.
- **Tieout** (`/Users/udingethe/Dev/tieout`): correction → propose → validate → activate → revoke pattern; Qwen3-8B local; metrics capture.
- **Jejak** (`/Users/udingethe/Dev/jejak`): photo → structured facts extraction (care-label scanning pattern).
- **fardinhossain007**: DeepPCB dataset, 6-defect taxonomy, domain-specific report templates, precision/recall rationale.

## What we build fresh (during the event)
- Mubit client wrapper (one base URL change + Mubit key).
- Correction → feedback → model-update wiring.
- Metrics capture (accuracy, cost, latency) + side-by-side comparison UI.
- Demo PCB image set (curated from DeepPCB) + ground-truth labels.
- 3-min MP4 + PDF deck.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  React frontend (Vite)                                      │
│  - PCB image grid (DeepPCB samples)                         │
│  - Defect overlay (bounding boxes + labels)                  │
│  - Triage panel: defect type / severity / disposition       │
│  - Correction UI: edit disposition + reason → submit         │
│  - Side-by-side: closed model vs task-adapted open model    │
│  - Metrics dashboard: accuracy / cost / latency              │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  FastAPI backend                                            │
│  - /triage: image → LLM vision classification (via Mubit)   │
│  - /corrections: inspector override → corrections.jsonl     │
│  - /metrics: accuracy/cost/latency per model lane           │
│  - /compare: baseline vs adapted lanes                      │
│  - /rules: learned rules + both task prompts                │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  Mubit (api.mubit.ai/openai/v1)                             │
│  - All LLM calls (vision classification) route here         │
│  - Task forms from: model + instructions + output format    │
│  - Corrections become new kept examples → adapter training   │
│  - Try models: side-by-side provider vs adapter              │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  Provider (OpenAI gpt-4o) — closed model baseline           │
│  + starter credit / own key                                 │
└─────────────────────────────────────────────────────────────┘
```

## The LLM task (Mubit task definition)

**Model:** `gpt-4o` (vision-capable, via Mubit's OpenAI host).

**Instructions (system prompt template, adapted per lane):**

Baseline lane uses the base taxonomy (`BASE_DEFECT_TYPES`). Adapted lane injects `learned_rules()` — one rule line per correction — and `allowed_types()` which can add brand-new defect types (e.g. `tombstoning`) not in the original taxonomy.

```
You are a PCB quality inspector. Look at this close-up of a board and classify it:
- defect_type: one of [{types}]
- severity: one of [cosmetic, minor, major, critical]
- disposition: one of [pass, rework, scrap]
- confidence: 0.0-1.0
- reason: one sentence
{rules}
Reply as JSON only: {"defect_type":..., "severity":..., "disposition":..., "confidence":..., "reason":...}
```

`{types}` is the current defect taxonomy (base + any types introduced by corrections). `{rules}` is one rule line per distinct correction, latest wording wins. Baseline lane renders `{rules}` as empty; adapted lane renders all learned rules.

**Output format:** JSON (fixed → forms one task).

**Session:** `metadata.session_id = "soldersight-<image_id>"` per image.

**Task forms from:** same model + instructions + output format across calls. ✓

## Correction → model update mechanism

Two paths:

**Path A — Local learned-rules adaptation (immediate, shipped):**
1. Inspector corrects a classification in the UI (defect type, severity, disposition, reason).
2. App stores the correction in `data/deeppcb/corrections.jsonl` via `POST /corrections`.
3. `learned_rules()` turns each correction into an instruction rule; `allowed_types()` adds any new defect type to the taxonomy.
4. The adapted lane's system prompt injects these rules + types, so the model immediately stops repeating the same mistake — no adapter training wait.
5. `GET /rules` exposes corrections, learned rules, defect types, and both task prompts (baseline vs adapted).
6. `POST /compare` runs the same crops down both lanes to show baseline vs adapted accuracy side by side.

**Path B — Mubit adapter training (pending):**
1. App sends 25+ triage calls (image → classification) through Mubit → task forms, collects kept examples, trains adapter v1.
2. Human reviews classifications in the UI. For wrong ones, edits disposition/severity/reason and clicks "Correct."
3. App re-sends the corrected (image, corrected_classification) pair as a new call for the same task → becomes a new kept example.
4. Mubit trains adapter v2 from the corrected examples.
5. Adapter v2 passes tests → available in Try models.
6. Demo: compare provider (closed) vs adapter v2 (task-adapted open) on 5 new images → side-by-side accuracy/cost/latency.

## The 6 defect types (from DeepPCB / fardinhossain007)
- **Open circuit** — discontinuity in trace (critical, scrap/rework)
- **Short circuit** — unintended connection (critical, scrap)
- **Mousebite** — small notch in trace (minor/major)
- **Spur** — extra copper protrusion (minor)
- **Spurious copper** — unwanted copper (minor/major)
- **Pin-hole** — small hole in copper (minor)

Plus "none" (clean board → pass).

## Demo data (curated from DeepPCB)
- 30 PCB images: 25 for training (mix of defect types + clean), 5 for test.
- Ground-truth labels from DeepPCB annotations.
- Bounding boxes for overlay visualization.

## 3-minute demo arc
1. **(0:00–0:40)** 6 PCB photos land. Closed model (GPT-4o) triages: 2 wrong (cosmetic scratch flagged as defect; dent misclassified as crack). Show latency + token cost + accuracy.
2. **(0:40–1:20)** Inspector corrects the 2 wrong ones ("cosmetic, not defect"; "dent, not crack"). Corrections route through Mubit. Show the model update landing.
3. **(1:20–2:10)** 5 new PCB photos. Task-adapted open model triages: all correct. Side-by-side: closed model (2/5 wrong) vs open model (5/5 right), with cost (open 4× cheaper) and latency (open 3× faster).
4. **(2:10–2:50)** Fast-refresh beat: a brand-new defect type (e.g., "tombstoning") appears → one correction → model adapts. Show the overlay update.
5. **(2:50–3:00)** "We own our intelligence layer now." Show the QA report template (domain-specific, from fardinhossain007's approach).

## 42-hour build plan

### Fri 17:00–22:00 (kickoff + setup) ✅ done
- [x] Create repo `soldersight`, init FastAPI + Vite React scaffold.
- [x] Set up Mubit key + provider key (OpenAI) in console. Verify one call routes through Mubit.
- [x] Download DeepPCB dataset (30-image curated subset). Prepare ground-truth labels + bounding boxes.
- [x] Write the system prompt (instructions) for the classification task.
- [x] Send 25+ triage calls through Mubit → task forms, collects kept examples.

### Sat 08:00–18:00 (core build) ✅ done
- [x] Build triage endpoint: image → LLM vision classification via Mubit.
- [x] Build correction endpoint: corrected (image, output) → stored locally + learned rules.
- [x] Build React UI: image grid, defect overlay (bounding boxes), triage panel, correction UI.
- [x] Build metrics capture: accuracy, cost (tokens), latency per model.
- [x] Run closed-model baseline on 30 images → capture errors + metrics (recorded in `runs.jsonl`).

### Sat 18:00–Sun 02:00 (correction loop + model update) ✅ core done / adapter pending
- [x] Implement correction → feedback → model update wiring (local learned-rules path).
- [ ] Trigger adapter training (25+ kept examples). Monitor task status (Reviewing → Training → Testing). — pending Mubit re-integration.
- [ ] Once adapter passes: test on 5 new images. Capture metrics. — pending.
- [x] Build side-by-side comparison backend (`/compare` baseline vs adapted lanes).
- [ ] Build side-by-side comparison UI (frontend). — pending.
- [x] Fast-refresh beat: add "tombstoning" defect type, one correction, show adaptation (backend + tests).

### Sun 02:00–05:00 (code freeze prep)
- [ ] Record 3-min MP4 (screen capture + voiceover). Show the full correction→model update arc.
- [ ] Build PDF deck (architecture, metrics, before/after).
- [ ] Test expo demo at table (offline-capable? ensure Mubit calls work on venue Wi-Fi).
- [ ] Submit MP4 + PDF before 05:00 GMT freeze.

### Sun 05:30 (judging round 1 — expo)
- Live demo at table. Show the correction→model update arc interactively.

### Sun 12:30 (if finalist — 5-min stage demo)
- Full demo with metrics.

## Submission format
- MP4 or MOV video (3 min max) + PDF deck.
- No YouTube links accepted.
- Submissions open Sat 24 Oct 20:00 BST; code freeze Sun 25 Oct 05:00 GMT.
- Can resubmit until freeze; latest submission judged.

## Key Mubit mechanics to verify early
1. Vision calls (image + instructions) form a task? Need to confirm Mubit keeps vision calls as examples. Test with 2-3 calls early.
2. Does the adapter support vision? If adapters are text-only, fall back to text description of the defect (extracted features) instead of raw image. Test early.
3. Training threshold: 25 kept examples. Send 30+ calls to be safe.
4. Correction mechanism: re-send corrected (input, output) as new call for same task. Verify it becomes a kept example.

## Fallback if vision doesn't work
- Use text descriptions of defects (e.g., "PCB #42: small copper trace discontinuity near component U3, 0.3mm gap, located top-left quadrant") instead of raw images.
- Still visual: show the PCB image + the text description + the classification. The overlay comes from DeepPCB annotations (pre-computed bounding boxes), not from the LLM.
- This keeps the LLM as the core (Mubit's task) and the visual wow (photo + overlay) intact.

## Risks
- Mubit vision support unclear → test on day 1, have text-description fallback.
- 25-example threshold → need 30+ calls; scripted, fine.
- Training time → adapter training may take minutes to hours; start early, don't wait until Sunday.
- Network at venue → ensure Mubit calls work; have a cached/demo mode.

## What makes this wow
- **Visual:** PCB photos with defect overlays that change after correction. Judges see the model stop flagging cosmetic marks.
- **Objective:** defect labels are ground-truthable; accuracy goes up measurably.
- **Real stakes:** scrap cost, QA throughput, 6-12 month ROI (from fardinhossain007's analysis).
- **Mubit showcase:** correction → model update → improvement is the entire demo. The "own your intelligence layer" story: we stopped paying GPT-4 for PCB triage and now own a task-adapted open model that's better, cheaper, faster.
