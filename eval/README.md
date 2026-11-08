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
"no defect" on a defective board) but **false alarms on clean boards** and a
weak sense of severity: a model that does see a defect often names a benign
one where a fatal one is present, which turns a `scrap` into a `rework`.
A second, larger suite (`wide`) tests how much of that is the prompt, the
sample, or the missing reference image; see
[Threats to validity](#threats-to-validity-and-what-we-did-about-them).

## Task overview

1,127 tasks in three suites over the
[DeepPCB](https://github.com/tangsanli5201/DeepPCB) dataset (expert defect
annotations). `board` and `crop` use 30 board pairs (`tasks/tasks.jsonl`);
`wide` uses 92 other boards from 8 DeepPCB groups (`tasks/tasks_wide_<variant>.jsonl`, one file per prompt variant).
Images are in `tasks/images/`.

| suite | tasks | input | what it isolates |
|---|---|---|---|
| `board` | 60 | whole 640×640 board photo | defect perception at native resolution |
| `crop` | 147 | template-diff cells upscaled to 480px | classification once the defect is visible |
| `wide` | 920 | 92 defective boards + 92 clean twins, each under 5 prompt variants | replication on fresh boards, and what a fairer prompt or a golden reference changes |

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
- `recall_by_worst` / `recall_by_disposition` — accuracy grouped by expert
  worst-type or expert disposition (scrap / rework / pass), so class imbalance
  can't hide a model that only handles majority classes
- `detection` — TPR, FPR and **Youden's J** (TPR − FPR) for "did the model flag
  any defect", with 95% CIs from a bootstrap over whole boards. J is 0 for a
  model that always flags, never flags, or flags at random, whatever the class
  balance, and it ignores both defect naming and the disposition rule. It is the
  headline detection metric
- `*_ci95` — board-clustered bootstrap intervals (a board's rows are correlated:
  same image, repeated trials, clean twin)
- `named_real_type_wrong_disposition` — among defective inputs where the model
  named a defect that really is annotated, the share with the wrong disposition.
  It measures how much of the disposition error is "saw something real, not the
  worst thing" rather than "saw nothing" (see the worst-defect confound below)

### Grader validation

`python eval/selftest.py` grades two fixtures through the same code path as
real results and asserts:

- `reference/reference_predictions.jsonl` — the expert label rendered as a
  prediction — scores **1.000** on every metric (task solvable, grader accepts
  correct answers)
- `reference/wrong_predictions.jsonl` — a null model that always answers
  "clean, ship it" — misses **100%** of defective tasks
- the same two fixtures for all 920 `wide` tasks, including the binary variant:
  reference scores balanced accuracy 1.0, the null model flags nothing
  (TPR = FPR = 0)

Results are committed in `results/selftest.json`. Ground truth is also checked
independently of any model: see the clean-twin check in the `wide` section.

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

# the wide suite: 5 prompt variants, one output file each (files stay small)
for v in production worst prior binary paired; do
  python eval/run_eval.py --model gpt-4o --suite wide --variant $v --trials 1 \
      --out eval/results/wide_gpt-4o_$v.jsonl
done
python eval/grader.py --predictions eval/results/wide_*.jsonl \
    --report eval/results/wide_report.md
python eval/wide_analysis.py      # prompt sensitivity + leave-out-largest-group
```

Any OpenAI-compatible chat-completions endpoint works: OpenAI, OpenRouter,
Together, vLLM, Neon AI Gateway, etc. Set `EVAL_API_KEY` and optionally
`OPENAI_BASE_URL`. `--min-interval` paces request starts for rate-limited
gateways; `--temperature` is recorded in each row's `settings` when provided.

To rebuild the dataset from the source data: `python eval/build_dataset.py`
(deterministic; requires `pillow` + `numpy` only). The `wide` suite needs the
full dataset (`git clone https://github.com/tangsanli5201/DeepPCB`), then
`python eval/build_wide.py --deeppcb DeepPCB/PCBData`; the built images are
committed, so this is only for regeneration.

## Results

Seven frontier models from six labs, 3 trials per task, default settings,
via an OpenAI-compatible gateway (2025-11). Full table in
`results/report.md`; every row of `results/predictions_*.jsonl` carries the
raw response (transcript), token usage, latency and the prompt hash.

Board suite (60 tasks: 30 defective + 30 clean golden samples):

| model | disposition acc [95% CI] | missed defect | false alarm | Youden J [95% CI] | pass@k | pass^k |
|---|---|---|---|---|---|---|
| claude-opus-5-5 | 0.406 [0.30, 0.53] | 0.000 | 0.744 | 0.26 [0.12, 0.41] | 0.450 | 0.367 |
| claude-sonnet-5-5 | 0.438 [0.32, 0.56] | 0.000 | 0.467 | 0.53 [0.38, 0.69] | 0.550 | 0.317 |
| gemini-3-1-pro | 0.400 [0.30, 0.51] | 0.000 | 0.711 | 0.29 [0.14, 0.44] | 0.467 | 0.333 |
| gpt-5-5 | 0.256 [0.17, 0.35] | 0.000 | 0.889 | 0.11 [0.03, 0.19] | 0.367 | 0.150 |
| gpt-5-mini | 0.428 [0.37, 0.48] | 0.089 | 0.211 | 0.70 [0.58, 0.81] | 0.533 | 0.300 |
| grok-4-7 | 0.339 [0.22, 0.46] | 0.011 | 0.578 | 0.41 [0.28, 0.56] | 0.483 | 0.167 |
| kimi-k3-1-pro | 0.339 [0.24, 0.44] | 0.000 | 0.767 | 0.23 [0.12, 0.36] | 0.533 | 0.150 |

The board suite is balanced by construction (30 defective, 30 clean), so a
constant answer is a meaningful floor: always answering `pass` scores 0.500 and
always answering `scrap` scores 0.483. With only 30 boards the intervals are
wide: **no model is credibly above that floor, and four (gpt-5-5, gpt-5-mini,
grok, kimi) are credibly below it** (upper CI bound < 0.5). The other three
straddle it. On the crop suite the constant `pass` floor is 0.476, and gpt-5-5
(0.404) is under it. (`python eval/calibration.py` prints these baselines.)
The 30-board sample is the reason the `wide` suite exists; it did not fully
reproduce the "below the floor" result, as the next section reports.

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

## Threats to validity, and what we did about them

The first version of this eval (the 207 `board` + `crop` tasks) had three
weaknesses a careful reviewer would raise. The `wide` suite exists to test each
one directly instead of arguing about it.

### 1. Only 30 boards, nearly all scrap

**Concern.** 30 board pairs from a single DeepPCB group, 29 of them scrap, gives
wide intervals and a narrow board population.

**Response.** `wide` takes 92 boards the core set never uses, drawn round-robin
from 8 of DeepPCB's 11 groups (`results/wide_validation.json`). It is balanced by
design: 50 scrap boards (25 with a short, 25 open-only), 42 rework boards, and
one clean twin per board, so scrap : rework : pass is 50 : 42 : 92. The largest
group (`group13000`) holds 37 of the 92 boards; every headline number below is
also reported without it (`python eval/wide_analysis.py`) and none changes
materially. Nothing in `wide` overlaps the core boards.

**What this does not fix.** 92 boards is still modest, the pool of
well-registered pairs is skewed toward a few groups (see the selection rule
below), 3 groups are absent for that reason, and `wide` ran one trial per task on
four models, not three trials on seven (see Limitations).

### 2. The "clean board" half is judged from one image with no reference

**Concern.** A single clean image has no ground reference, so a model that sees a
pad gap or a stray speck and calls it a defect is arguably being reasonable. The
false-alarm half of the eval could be under-determined.

**Response, in three parts.**

- *Ground truth for clean is checked without any model.* A clean twin is the same
  capture as its defective board with every annotated defect (plus a 10px margin)
  replaced by the defect-free template, so it carries the same scan noise.
  Only boards where the repaired twin is genuinely clean are used: the
  production change detector (`backend/inspection.py`, threshold 5.0, calibrated
  on clean boards at about 2.0) must find no changed region on the twin. All 92
  twins pass (max cell delta 0.0), against 86 of 92 defective captures that the
  same detector flags. The rule is strict: only 126 of the 1,470 non-core
  defective boards pass it (the rest carry misregistration residue that would
  make the "clean" twin differ from its template), and 3 groups
  (`group12000`, `group12300`, `group50600`) have none. `wide` uses 92 of the 126.
- *The golden reference is supplied.* `wide/paired` shows the model the golden
  template first and the board under test second, which is how production AOI
  works. If the single-image clean task were unfair, this variant would not
  help. It helps a lot (table below).
- *The conclusion is scoped accordingly.* The claim is no longer "models can't
  tell clean from defective". It is "without a reference image, three of four
  tested models flag a large share of clean boards, and with one, three of four
  nearly stop".

### 3. Is the failure just the prompt?

**Concern.** The production prompt (a) never says to report the *worst* defect
on a board with several, (b) offers "none" among six defect types, and (c) says
nothing about how common clean boards are. Over-flagging and scrap→rework might
be prompt artifacts.

**Response.** Every `wide` board is run under five prompts that each change one
thing: `production` (the shipped prompt, unchanged), `worst` (adds the
report-the-worst rule), `prior` (worst + "about half the boards are defect-free;
flag only what you can point to"), `binary` (defective yes/no only, no
taxonomy), and `paired` (worst + the golden reference image). Youden J
(TPR − FPR; 0 = cannot tell defective from clean) with false-alarm / miss rates in
parentheses, one trial, 92 defective + 92 clean boards:

| model | production | worst | prior | binary | paired |
|---|---|---|---|---|---|
| claude-sonnet-5-5 | 0.55 (FA 0.45 / miss 0.00) | 0.54 (0.46 / 0.00) | 0.71 (0.21 / 0.09) | 0.56 (0.43 / 0.00) | **0.92** (0.08 / 0.00) |
| gemini-3-1-pro | 0.43 (0.56 / 0.00) | 0.40 (0.59 / 0.01) | 0.65 (0.30 / 0.04) | 0.70 (0.30 / 0.00) | **0.90** (0.10 / 0.00) |
| gpt-5-5 | 0.21 (0.79 / 0.00) | 0.18 (0.81 / 0.00) | 0.40 (0.60 / 0.00) | 0.25 (0.75 / 0.00) | 0.62 (0.38 / 0.00) |
| gpt-5-mini | 0.65 (0.28 / 0.06) | 0.66 (0.23 / 0.11) | 0.72 (0.17 / 0.11) | **0.88** (0.07 / 0.05) | **0.90** (0.09 / 0.01) |

What this shows:

- **Stating the worst-defect rule does not fix over-flagging.** `worst` is within
  noise of `production` for all four models. (It does remove some of the
  disposition confound: among answers that named a real annotated defect, the
  share with the wrong disposition falls from 0.25–0.51 to 0.18–0.42. Most of
  the scrap→rework error remains, so it is not mainly a wording artifact.)
- **A base-rate hint helps, at a price.** `prior` cuts false alarms by 0.22–0.28
  for the three models that over-flag most, but it starts to cost real misses
  for three of the four models (4–11% of defective boards called clean). It
  trades one error for the other.
- **The taxonomy is a cause for some models, not others.** Dropping the defect
  taxonomy (`binary`) removes most of the over-flagging for gpt-5-mini (J 0.88)
  and half of it for Gemini, and changes nothing for Claude Sonnet or gpt-5-5.
- **A golden reference closes most of the detection gap for three of four
  models** (J 0.90–0.92), but not gpt-5-5 (0.62, false-alarm rate 0.38), and it
  does not fix severity: with the reference, scrap boards are still called
  correctly only 65% (Sonnet), 70% (Gemini), 66% (gpt-5-5) and 20% (gpt-5-mini)
  of the time, while rework boards are right 98–100%. Models that see something
  tend to call it minor.

Those are the findings that survive the three objections. The over-flagging
result in the core suite is real, but it is mostly a *no reference image*
effect, which is what an engineer deploying a VLM as an inspector most needs to
know.

On `wide`, accuracy against the constant-answer floor (always `pass` = 0.500):

| model (production prompt) | disposition acc [95% CI] | missed | false alarm | Youden J [95% CI] | recall scrap / rework / pass |
|---|---|---|---|---|---|
| claude-sonnet-5-5 | 0.607 [0.52, 0.68] | 0.000 | 0.446 | 0.55 [0.45, 0.65] | 0.38 / 1.00 / 0.55 |
| gemini-3-1-pro | 0.576 [0.50, 0.65] | 0.000 | 0.565 | 0.43 [0.33, 0.53] | 0.50 / 0.98 / 0.43 |
| gpt-5-5 | 0.413 [0.34, 0.48] | 0.000 | 0.793 | 0.21 [0.13, 0.29] | 0.30 / 1.00 / 0.21 |
| gpt-5-mini | 0.587 [0.51, 0.66] | 0.065 | 0.283 | 0.65 [0.54, 0.75] | 0.08 / 0.91 / 0.72 |

So the earlier "every model is below a constant answer" does **not** replicate
on the balanced `wide` suite: three models sit slightly above 0.5 (Sonnet's
and gpt-5-mini's intervals narrowly clear it, Gemini's touches it) and only
gpt-5-5 is below. What does replicate is the
shape: near-zero misses, large false-alarm rates, and scrap boards mostly not
called scrap. We therefore headline Youden J and the scrap recall, not the floor
comparison.

## Limitations

- `wide` was run on **four** models (Sonnet, Gemini, gpt-5-5, gpt-5-mini) with
  **one** trial per task; the seven-model, three-trial results are the core
  suites. Intervals resample boards, so they reflect sample size but not
  run-to-run sampling noise.
- Clean twins are image edits of real captures, and DeepPCB's defects are
  themselves artificial (the dataset's authors added them to real boards). This is
  a controlled benchmark of visual discrimination, not a field-failure study.
- Selecting well-registered pairs skews `wide` toward the groups that register
  cleanly (`group13000` is 40% of the boards). Leaving it out changes no
  conclusion, but the board population is still not a random sample of
  production.
- `type_accuracy` is lenient on multi-defect boards (naming any annotated
  type earns credit). That is why `disposition_accuracy` and Youden J are the
  headlines.
- Only one board in the core `board` suite has rework truth; `wide` fixes this
  (42 rework boards).
- No human-inspector baseline was collected. Expert labels are the dataset's own.

## Cost and runtime

Core suites: 207 tasks × 3 trials = 621 model calls per model. `wide`: 920 tasks
× 1 trial = 920 calls per model. Measured on Neon AI Gateway; the gateway did not
expose per-token pricing, so `total_cost_usd` is 0 in most reports. From token
counts (`wide` run: 0.7–1.4M input and 0.06–0.55M output tokens per model) at
public list prices this is a few dollars per model for `wide`; reasoning-heavy
models dominate. Wall-clock for `wide` was roughly 15–60 minutes per model at
concurrency 4; `--min-interval` paces request starts for stricter rate limits.

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
├── build_wide.py           # rebuild the wide suite from the full DeepPCB clone
├── wide_analysis.py        # prompt sensitivity + leave-out-largest-group
├── calibration.py          # per-model confidence AUC + constant-answer baselines
├── tasks/tasks.jsonl + tasks_wide_<variant>.jsonl + images/   # 207 core + 920 wide tasks
├── reference/              # perfect + null fixtures (core and wide)
├── results/                # predictions_*.jsonl (core), wide_<model>_<variant>.jsonl, report.*,
│                           # wide_report.*, wide_analysis.json, wide_validation.json,
│                           # selftest.json
├── transcripts/            # representative failure transcripts (see below)
└── package.sh              # builds the submission zip
```

## Main failure mode and takeaway

**No frontier model tested is a reliable standalone PCB inspector, and the
failure is not mainly missed defects.** Across seven models on the core
suite and four on the 92-board `wide` suite:

1. **They almost never miss a defective board** (missed-defect rate 0.000 for
   six of seven models on the core boards) **but flag clean ones**: board-level
   false-alarm rates are 0.21–0.89 (core) and 0.28–0.79 (`wide`, production
   prompt). Youden J, which is blind to a model's tendency to flag, is 0.11–0.70
   (core) and 0.21–0.65 (`wide`).
2. **That is mostly a missing-reference effect, and partly a prompt effect.**
   Stating the worst-defect rule changes nothing. A base-rate hint trades false
   alarms for misses. Supplying the golden template lifts three of four models to
   J 0.90–0.92. See the threats-to-validity section for the ablation.
3. **They under-call severity even when they see the defect.** Scrap boards are
   called scrap only 8–50% of the time with the production prompt and 20–70%
   with a reference; rework boards are right 91–100%. Models that see a defect
   name a benign one (`pinhole`, `copper`, `spur`, `mousebite`) and recommend
   `rework` where an open or short requires `scrap`. In QA that is the costlier
   direction.

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
