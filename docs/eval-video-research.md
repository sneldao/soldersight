# Demo video research — micro1 Eval Hackathon

Research pass before rebuilding the eval video. Sources: the official
Participant Guide (22pp, authoritative), the Teardown reference repo, and
general hackathon-demo guidance.

## 1. What the event actually scores

The guide is explicit. Video is one of three artifacts (ZIP + video link +
written description), and it is scored only after eligibility, completeness,
integrity and reproducibility checks. The 100-point rubric:

| Criterion | Pts | What strong work looks like |
|---|---|---|
| Real-world relevance | 15 | Limitation matters in practice, not a trick. README says who relies on this work and what failure costs them. |
| Task design | 20 | Realistic, clear, unambiguous. Defensible correct answer + reference solution. Everything graded is stated in the task. |
| Grader reliability | 20 | No false passes or false fails. Accepts every reference solution, rejects deliberately wrong answers. |
| Evidence of model limitations | 15 | Several trials per task. Clear spread across models. Transcripts back up each explanation. |
| Reproducibility | 15 | A judge can run it from a clean environment using the README and reach the main results. |
| Human expertise and review | 10 | Doesn't read as unreviewed AI output. README says how AI was used and reviewed. |
| Insight / hot take | 5 | Turns an observed failure into a clear lesson. |

**40 of 100 points sit on task design + grader reliability.** The video is
where a judge *sees* those two things are real. That is the video's job, more
than "showing the product."

### The prescribed video structure (guide, p19)

> problem and why it matters (≈1 min), how a task looks and how it's graded
> (≈1.5 min), the results and one or two failure transcripts walked through
> (≈2 min), and the takeaway (≈0.5 min). You don't need to show your face,
> and an AI-generated voice is fine.

Hard cap 5 minutes. Link must open without requesting permission.

### The trap the guide warns about, twice

> "The model got it wrong" is a weak finding. Strong: "The model fails
> because it doesn't account for X when Y."

And: don't pick tasks because one model happened to fail them — pick tasks an
expert judges hard, then confirm with models. Also flags 0%-everywhere as
more likely a broken task than an impossible capability.

## 2. Where the current cut stands

`video/eval/out/soldersight-eval-the-scan.mp4` — 4:05, seven scenes, forensic
green-on-black, FIG labels, mono type, burned-in word-timed captions.

Timing against the guide's structure:

| Guide beat | Target | Current | Verdict |
|---|---|---|---|
| Problem | 60s | 22s | Underweighted |
| Task + grading | 90s | 82s | Close |
| Results + transcripts | 120s | 126s | On target |
| Takeaway | 30s | 15s | Thin |

The visual language is genuinely good and worth keeping. The x-ray treatment
(inverted board, scan sweep, reticle lock on the lesion) makes a PCB photo read
as a diagnostic scan. That is the "uniquely visual" advantage, and it's already
half-built.

What it doesn't do: it is a narrated slide deck. Panels appear, bars animate,
stamps land. Nothing is *manipulated*. The viewer is told the finding rather
than shown the mechanism.

## 3. The Teardown grammar (and what's actually transferable)

`elvarofficial/teardown` — a Claude Code skill that builds any machine as one
offline HTML page. Its own description of the pattern:

> the machine runs in the middle, every panel around it reads the real
> numbers, a button opens the part doing the work, and when nobody touches it
> the page tours itself.

Four moves, and none of them require 3D:

1. **The subject sits in the middle.** One object, always visible, everything
   else annotates it.
2. **Panels read real numbers.** Not decorative — bound to actual data.
3. **A button opens the part doing the work.** Progressive disclosure of
   mechanism, on demand.
4. **It tours itself.** The artifact is legible without a narrator, and the
   video is a recording of the tour.

The transferable idea for an eval: **the eval is the machine.** A model is the
subject in the middle. Its 621 calls are the parts. Open one and you see the
crop, the claim, the label, and whether it was right. That is a teardown of a
model's judgment, and it is exactly the "evidence of model limitations" +
"grader reliability" pair the rubric pays 35 points for.

## 4. The finding the current cut is leaving on the table

Computed from `eval/results/predictions_*.jsonl` (4,345 scored trials, 7
models, both suites):

| | value |
|---|---|
| Mean confidence when **correct** | 0.773 |
| Mean confidence when **wrong** | 0.731 |
| AUC of confidence → correctness | **0.580** |
| Trials at confidence ≥ 0.90 | 1,027 |
| …of those, **wrong** | **386 (37.6%)** |

**Correction (supersedes the first draft of this section).** The first draft
read the pooled 0.58 as "confidence carries almost no information". That was a
pooling artifact: the seven models sit at very different confidence levels, so
pooling mixes between-model differences with within-model signal. Per model
(`python eval/calibration.py`) the AUC is 0.70–0.84 for six models and 0.455 for
gpt-5-mini (weighted mean 0.71). 373 of the 386 wrong answers stated at ≥0.90
come from Gemini (262) and Kimi (111).

The defensible finding, and what the video now says:

- Confidence is informative *within* most models but not comparable *across*
  them, so one cut-off does not transfer. Overconfident models (Gemini, Kimi)
  still pass many wrong answers at a high cut-off.
- That is a specific mechanism ("calibrate per model") rather than "the model
  got it wrong", and it needs no claim the data does not support.
- A reviewer who recomputes per-model AUC reaches the same numbers, which
  matters for the integrity and insight criteria.

Per-model, the high-confidence behaviour splits sharply:

| model | acc | n @ conf≥0.90 | acc @ conf≥0.90 |
|---|---|---|---|
| claude-opus-5-5 | 0.628 | 15 | 1.000 |
| claude-sonnet-5-5 | 0.640 | 14 | 1.000 |
| gemini-3-1-pro | 0.572 | 617 | 0.575 |
| gpt-5-5 | 0.361 | 58 | 0.862 |
| gpt-5-mini | 0.501 | 6 | 1.000 |
| grok-4-7 | 0.459 | 33 | 0.848 |
| kimi-k3-1-pro | 0.432 | 284 | 0.609 |

Gemini states ≥0.90 on 617 of 621 trials at 57.5% accuracy. Kimi on 284 at
60.9%. The Claude models are well-calibrated but rarely confident. That spread
is itself a finding, and it's the kind of "clear spread across models" the
rubric rewards.

## 5. Recommendation

Keep the forensic visual language. Change what the video is a recording *of*.

**Build the teardown page, then film its tour.** One HTML artifact,
`video/eval/teardown.html`, where:

- A board sits in the middle, x-ray treated, as now.
- Around it, panels bound to real data: the 7 models, their 621 calls each,
  disposition accuracy, false-alarm rate, and a confidence calibration curve.
- Click a model → its calls fan out. Click a call → the crop, the verbatim
  claim, the expert label, and a red or green verdict.
- A "confidence" control that scrubs the threshold (pooled across models) and
  shows how many wrong calls survive at 0.90, and which models they come from.

Then the video is a 4:30 tour of that page, cut to the guide's structure:

| Time | Beat | Content |
|---|---|---|
| 0:00–0:55 | Problem | The scan, the 40px lesion, the seven diagnosticians, 7/7 wrong. Keep the cold open, extend it. |
| 0:55–2:20 | Task + grader | Open one call: image, prompt, JSON contract, expert label. Then the grader: reference fixture scores 1.000, null model scores 0.000. Show the self-test, not a diagram of it. |
| 2:20–4:05 | Results + transcripts | The board/crop spread. Then the teardown: open a confident wrong call (kimi, 0.96, "isolated void… pinhole" on a scrap board with an open). Then the calibration curve and the 386/1027 number. |
| 4:05–4:30 | Takeaway | Confidence is not a portable safety net: calibrate per model. The fix is a pipeline, not a bigger model. Repro line + repo. |

Two things to fix regardless of direction:

1. **`eval/results/report.md` was stale** — it listed 4 models at 11:21 while
   `report.json` had 7 at 14:09, with different numbers. Regenerated from the
   committed predictions; README figures were already correct. Any on-screen
   number must come from the regenerated report.
2. **The takeaway is 15s.** The rubric's insight criterion is only 5 points,
   but the closing line is what a judge remembers. Give it 25–30s.

## 6. What I would not do

- Don't rebuild in 3D. Teardown's value here is the *interaction grammar*, not
  the renderer. A WebGL board buys nothing a 2D x-ray crop doesn't.
- Don't lengthen past 4:30. The cap is 5:00 and the guide's own budget is
  tight; padding reads as thin material.
- Don't lead with the 0.26–0.44 accuracy table. It is the weaker finding and
  it invites "so what, it's a hard dataset." Lead with the calibration result,
  use accuracy as support.

---

## 7. What shipped

`video/eval/out/soldersight-eval-the-scan.mp4` — 4:44, 1920x1080, H.264/AAC,
burned-in word-timed captions, 23.9 MB.

The teardown page (`video/eval/scenes/teardown.html`) replaced the ablation
scene. It is a real interactive artifact: click a model, click a call, scrub
the confidence threshold. The video is a recording of its tour. Every number on
it is bound to `eval/results/predictions_*.jsonl` via
`video/eval/export_teardown_data.py` — nothing is hardcoded in the HTML.

### Bugs found and fixed in the existing build

These were all live in the previous cut:

1. **`eval/results/report.md` was stale** — 4 models at 11:21 while
   `report.json` had 7 at 14:09, with different numbers. Regenerated from the
   committed predictions.
2. **The endcard was being truncated.** Clips totalled 254.8s but `build.py`
   capped output at `-t 245`, so the last ~10s was cut. The cap is now derived
   from the real clip lengths.
3. **Narration drifted ~9s ahead of picture** from scene 3 onward, because VO
   offsets were hardcoded against a shorter assumed timeline. Now computed from
   measured clip durations.
4. **Captions were never burned in.** The default `ffmpeg` on this machine
   (9.0.2, Homebrew) is built without libass, so the `subtitles` filter failed
   and the build silently shipped caption-free. `build.py` now probes for an
   ffmpeg that actually has libass and fails loudly if none exists.
5. **Exhibit C paired a missed defect with a false-alarm statistic.** It showed
   a real short called "none → PASS" (a *miss*) but labelled it `FA 0.995` (a
   *false alarm*). Replaced with a genuine false alarm — gpt-5-5 calling a clean
   crop a spur at 0.86 — so the exhibit and the number describe the same
   failure. Narration updated to match.
6. **The endcard said "4,347 TRIALS GRADED".** 4,347 rows were recorded but 2
   were unparseable and dropped by the grader, so 4,345 were graded. Corrected
   in the endcard and the narration.
7. **`caplib.assemble` double-counted the final frame**, so clips came out
   longer than requested (62s → 71.4s). Now always repeats the last frame and
   clamps with `-t`.
8. **Screencast paint starvation** — long static holds captured at 2–11fps.
   Fixed with a slow always-running animation that keeps the compositor
   painting (now 56–59fps).
9. **Caption orphan** — the closing line split as "The boards are still" /
   "waiting." The chunker now folds a 1-word remainder into the previous line.
10. **The fade-out ate the closing line.** It started 2.4s before the end and
    faded the last words mid-sentence. Now fades over the final second, after
    the VO lands.

### Verification

- All 7 segments: VO ends before its scene ends (no clipped narration).
- 133 caption events, last at 4:42.76 of 4:44.
- Loudness: mean −15.2 dB, peak −0.7 dB.
- Every on-screen figure traced to `export_teardown_data.py` output.
