# SolderSight PCB Defect Eval

## What it tests

Whether a vision-language model can *see* PCB manufacturing defects — opens,
shorts, mousebites, spurs, spurious copper and pin-holes — well enough to
classify them and decide a board's disposition (`pass` / `rework` / `scrap`).

## Who it's for, and why it matters

PCB assembly lines inspect every board optically. A missed defect ships a dead
board; a false alarm costs a re-inspection and, at volume, a line that stops
trusting the tool. Any model proposed as an inspector has to be right in both
directions, with a defect only 30–55px wide in a 640px image. This eval
measures both failure modes against expert labels, and separates *perception*
(can the model see the defect?) from *classification* (can it name what it
sees?). What it finds is not mainly silent misses (models almost never answer
"no defect" on a defective board) but over-flagging clean boards and naming a
benign defect type where a fatal one is present, which turns a `scrap` into a
`rework`.

## Task overview

207 tasks in two suites over the
[DeepPCB](https://github.com/tangsanli5201/DeepPCB) dataset (30 board pairs with
expert defect annotations; `tasks/tasks.jsonl`, images in `tasks/images/`):

| suite | tasks | input | what it isolates |
|---|---|---|---|
| `board` | 60 | whole 640×640 board photo | defect perception at native resolution |
| `crop` | 147 | template-diff cells upscaled to 480px | classification once the defect is visible |

- `board:*` — classify the whole board. 30 tasks are the defective test
  images (29 scrap, 1 rework truth) and 30 are the dataset's defect-free
  template images (`board:*:clean`), so board-level false alarms are
  measurable alongside misses.
- `crop:*` — classify each changed cell a production inspection pipeline would
  send to the model. 77 crops contain defects, 70 are clean, so missed-defect
  and false-alarm rates are both measurable. When several defect types overlap
  one crop, the worst governs the expected disposition (the QA rule: ship
  status is set by the worst defect present).

Every task uses the same prompt a production inspector model would get:
classify `defect_type`, `severity`, `disposition`, `confidence`, `reason` as
JSON, plus an explicit disposition policy (`open`/`short` → `scrap`;
`mousebite`/`spur`/`copper`/`pinhole` → `rework`; `none` → `pass`) so every
answer the grader checks is stated in the task. No labels, hints or defect
locations appear in the input — only the image.

**Why it's hard:** DeepPCB defects are 30–55px features in a 640px image.
Vision models tile images into patches and routinely miss features that small,
then answer with high confidence. The `crop` suite is the ablation: the same
model, same prompt, same defects — only the input resolution changes. The gap
between suites is the finding.

## Grading

Code-based, deterministic, no LLM judge. Per task, a trial **passes** when the
predicted `disposition` matches the expert label; `type_accuracy` (predicted
`defect_type` ∈ labeled types) is reported separately — note it is lenient on
multi-defect boards/crops: naming *any* annotated defect type earns credit,
so a model can score type accuracy while missing the fatal defect (which is
why `disposition_accuracy` is the headline). Aggregates per
model × suite:

- `disposition_accuracy`, `type_accuracy` — exact match vs DeepPCB labels
- `missed_defect_rate` — defective inputs answered `none`. *The headline
  number:* in QA a miss ships a dead board.
- `false_alarm_rate` — clean inputs flagged defective
- `inconsistent_rate` — `defect_type`/`disposition` pairs that violate the
  taxonomy (e.g. `short` + `pass`): the model contradicting itself
- `board_disposition_accuracy` — crop predictions aggregated per board via the
  production rule (worst confident region sets the verdict)
- `self_contradictions` — boards passed while a confident region noted a defect
- `invalid_output_rate` — responses that weren't the required JSON
- `pass@k` / `pass^k` — per-task success across trials (any-of-k / all-of-k)
- `recall_by_worst` — disposition accuracy grouped by expert worst-type, so
  class imbalance can't hide a model that only handles majority classes

### Grader validation

`python eval/selftest.py` grades two fixtures through the same code path as
real results and asserts:

- `reference/reference_predictions.jsonl` — the expert label rendered as a
  prediction — scores **1.000** on every metric (task solvable, grader accepts
  correct answers)
- `reference/wrong_predictions.jsonl` — a null model that always answers
  "clean, ship it" — misses **100%** of defective tasks

Results are committed in `results/selftest.json`.

## How to run

```bash
pip install -r eval/requirements.txt   # openai, pillow, numpy (Python 3.11+)
cp eval/.env.example eval/.env         # fill in EVAL_API_KEY

# k trials per task; resumable — rerun skips finished (task, trial) pairs
python eval/run_eval.py --model gpt-4o --suite board --trials 3 \
    --out eval/results/predictions_gpt-4o_board.jsonl
python eval/run_eval.py --model gpt-4o --suite crop --trials 3 \
    --out eval/results/predictions_gpt-4o_crop.jsonl

python eval/grader.py --predictions eval/results/predictions_*.jsonl \
    --report eval/results/report.md
```

Any OpenAI-compatible chat-completions endpoint works: OpenAI, OpenRouter,
Together, vLLM, Neon AI Gateway, etc. Set `EVAL_API_KEY` and optionally
`OPENAI_BASE_URL`. `--min-interval` paces request starts for rate-limited
gateways; `--temperature` is recorded in each row's `settings` when provided.

To rebuild the dataset from the source data: `python eval/build_dataset.py`
(deterministic; requires `pillow` + `numpy` only).

## Results

Seven frontier models from six labs, 3 trials per task, default settings,
via an OpenAI-compatible gateway (2025-11). Full table in
`results/report.md`; every row of `results/predictions_*.jsonl` carries the
raw response (transcript), token usage, latency and the prompt hash.

Board suite (60 tasks: 30 defective + 30 clean golden samples):

| model | disposition acc | missed defect | false alarm | pass@k | pass^k |
|---|---|---|---|---|---|
| claude-opus-5-5 | 0.406 | 0.000 | 0.744 | 0.450 | 0.367 |
| claude-sonnet-5-5 | 0.438 | 0.000 | 0.467 | 0.550 | 0.317 |
| gemini-3-1-pro | 0.400 | 0.000 | 0.711 | 0.467 | 0.333 |
| gpt-5-5 | 0.256 | 0.000 | 0.889 | 0.367 | 0.150 |
| gpt-5-mini | 0.428 | 0.089 | 0.211 | 0.533 | 0.300 |
| grok-4-7 | 0.339 | 0.011 | 0.578 | 0.483 | 0.167 |
| kimi-k3-1-pro | 0.339 | 0.000 | 0.767 | 0.533 | 0.150 |

The board suite is balanced by construction (30 defective, 30 clean), so a
constant answer is a meaningful floor: always answering `pass` scores 0.500 and
always answering `scrap` scores 0.483. **All seven models score below 0.500**,
i.e. worse than a fixed answer that ignores the image. On the crop suite the constant
`pass` floor is 0.476, and gpt-5-5 (0.404) is also under it.
(`python eval/calibration.py` prints these baselines.)

Crop suite (147 tasks: 77 defective crops, 70 clean):

| model | disposition acc | missed defect | false alarm | pass@k | pass^k | board acc |
|---|---|---|---|---|---|---|
| claude-opus-5-5 | 0.719 | 0.061 | 0.433 | 0.789 | 0.667 | 0.933 |
| claude-sonnet-5-5 | 0.721 | 0.117 | 0.324 | 0.789 | 0.673 | 0.767 |
| gemini-3-1-pro | 0.642 | 0.013 | 0.619 | 0.680 | 0.605 | 0.967 |
| gpt-5-5 | 0.404 | 0.017 | 0.995 | 0.435 | 0.367 | 0.800 |
| gpt-5-mini | 0.531 | 0.134 | 0.543 | 0.653 | 0.388 | 0.600 |
| grok-4-7 | 0.508 | 0.056 | 0.714 | 0.619 | 0.361 | 0.733 |
| kimi-k3-1-pro | 0.469 | 0.056 | 0.838 | 0.585 | 0.367 | 0.900 |

Board-level verdicts aggregated from crop predictions (production rule:
worst confident region sets the verdict) reach 0.60–0.97 — versus
0.26–0.44 when the same models look at the whole board directly.

Model versions are the gateway's current aliases; trials are independent
samples at default temperature, so pass@k/pass^k expose run-to-run variance.

## Cost and runtime

207 tasks × 3 trials = 621 model calls per model for a full run (both
suites). Measured on Neon AI Gateway: roughly 100k–600k input+output tokens
per model depending on suite mix and reasoning length; gateway usage
metadata did not expose per-token pricing, so `total_cost_usd` is 0 in the
reports — estimate a few USD per frontier model at list prices. Wall-clock
was a few hours for all 14 suite-runs at concurrency 4 (slower reasoning
models dominate); `--min-interval` paces request starts for stricter rate
limits.

## Provenance

- **Data:** DeepPCB (Tang et al.), public research dataset —
  https://github.com/tangsanli5201/DeepPCB. The 30-board subset and its
  template/test image pairs come from the SolderSight project; annotations are
  the dataset's own defect boxes. DeepPCB is a niche manufacturing dataset, so
  contamination (models having memorized the labels) is unlikely — and the
  labels are not present in the input images regardless.
- **Prior work:** SolderSight, a PCB visual-inspection app (Oct 2026) that
  routes its model calls through the Mubit gateway. What existed before this
  event: the DeepPCB data subset, the template-diff region proposer
  (`backend/inspection.py`), the production prompt, and the verdict
  aggregation rule. What was built for this event: everything in `eval/` —
  task construction, the standalone runner and grader, reference fixtures,
  self-tests, metrics, and the model results in `results/`. The eval code is
  self-contained and does not import the backend or call Mubit.
- **AI use:** the eval harness, grader and dataset builder were drafted with AI
  coding assistance; every task's ground truth comes from the dataset's expert
  annotations (not generated), the grading rules were reviewed against the
  taxonomy, and the grader was validated on reference and wrong-answer
  fixtures (`results/selftest.json`).

## Layout

```
eval/
├── README.md / SUBMISSION.md
├── requirements.txt / .env.example
├── build_dataset.py        # rebuild tasks/ from ../data/deeppcb
├── make_reference.py       # regenerate reference/ fixtures
├── selftest.py             # grader validation (right + wrong answers)
├── run_eval.py             # OpenAI-compatible harness (trials, pacing, resume)
├── grader.py               # deterministic grader → report.md/json
├── calibration.py          # per-model confidence AUC + constant-answer baselines
├── tasks/tasks.jsonl + images/   # 207 tasks + inputs
├── reference/              # perfect + null fixtures
├── results/                # predictions_*.jsonl, report.*, selftest.json
├── transcripts/            # representative failure transcripts (see below)
└── package.sh              # builds the submission zip
```

## Main failure mode and takeaway

**No frontier model is a reliable PCB inspector — and it fails in both
directions.** On whole-board images, disposition accuracy is 0.26–0.44
across all seven models. On defective boards they rarely answer "no defect"
(missed-defect rate is 0.000 for six of seven models) but they misjudge what is
there: asked to triage a scrap board, models name a *benign* defect type
(`pinhole`, `copper`, `spur`) and recommend `rework`. On the defect-free
template images — golden samples that should obviously pass — the same
models invent defects anyway, with board-level false-alarm rates of
0.21–0.89. They cannot tell a defective board from a clean one.

Zooming in helps but does not solve it. On defect-isolated crops the same
models improve (best board-verdict aggregation reaches 0.97 for Gemini), yet
even there the best crop-level disposition accuracy is 0.72, defect misses
persist (up to 13%), and false alarms remain severe — gpt-5-5 flags 99.5%
of clean crops as defective, kimi 83.8%.

### Confidence is not interchangeable across models

Stated confidence ranks right and wrong answers well for most models but is
useless as a *shared* threshold. Per-model AUC of confidence → disposition
correctness (0.5 = no signal; `python eval/calibration.py`):

| model | accuracy | mean confidence | AUC | trials ≥0.90 | wrong among them |
|---|---|---|---|---|---|
| claude-opus-5-5 | 0.628 | 0.61 | 0.835 | 15 | 0 |
| claude-sonnet-5-5 | 0.640 | 0.60 | 0.766 | 14 | 0 |
| gpt-5-5 | 0.361 | 0.79 | 0.765 | 58 | 8 |
| kimi-k3-1-pro | 0.432 | 0.86 | 0.732 | 284 | 111 |
| gemini-3-1-pro | 0.572 | 0.93 | 0.730 | 617 | 262 |
| grok-4-7 | 0.459 | 0.73 | 0.700 | 33 | 5 |
| gpt-5-mini | 0.501 | 0.75 | 0.455 | 6 | 0 |

Six of seven models carry real signal within themselves (weighted mean AUC
0.71); gpt-5-mini's confidence is uninformative. But the models sit at very
different confidence levels: Gemini states ≥0.90 on 617 of 621 trials at 57%
accuracy, while the Claude models almost never reach 0.90. Pooled over all
seven models the AUC is only 0.58, and 373 of the 386 wrong answers stated at
≥0.90 come from Gemini and Kimi. So a single confidence cut-off does not
transfer between models, and for an overconfident model a high cut-off still
passes many wrong answers.

The practical takeaway: VLM-based PCB triage needs a perception front-end
(diff-based region proposal, magnification) *and* a calibrated decision
layer — neither alone is sufficient. See `transcripts/` for the raw
input/output of representative misses and false alarms per model.
