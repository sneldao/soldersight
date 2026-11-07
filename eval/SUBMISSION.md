# Submission drafts — micro1 Eval Hackathon

## Short description (for the event form)

**SolderSight PCB Defect Eval** — a vision eval for PCB manufacturing quality
inspection on the expert-labeled DeepPCB dataset (207 tasks, two suites,
7 frontier models × 3 trials). On whole-board images no model exceeds 44%
disposition accuracy, below the 50% a constant "pass" answer scores on the
balanced board suite — on scrap boards they name benign defect
types (`pinhole`, `spur`) and recommend `rework`, and on defect-free golden
samples they invent defects anyway (board-level false-alarm rates 0.21–0.89).
On defect-isolated crops the same models improve but still miss up to 13% of
defects and over-flag clean regions (one model flags 99.5% of clean crops).
The `crop`→board aggregation ablation shows a perception front-end helps
(up to 0.97 board accuracy) but doesn't fix over-flagging, and stated
confidence is not comparable across models (Gemini states ≥0.90 on 617 of 621
trials at 57% accuracy; the Claude models almost never do). Deterministic
code-based grading against expert labels, pass@k/pass^k across trials,
per-class recall, reference solutions proving solvability, and a grader
self-test on right and wrong answers. OpenAI-compatible runner; fully
reproducible offline.

## What existed before vs. built for this event

- **Before:** SolderSight, a PCB inspection app — DeepPCB data subset,
  template-diff region proposer, production prompt, verdict aggregation.
- **For this event:** the `eval/` package — task dataset, standalone runner +
  grader, metrics, frontier-model results.

## Video — as built (4:33, cap 5:00)

`video/eval/out/soldersight-eval-the-scan.mp4` — 1920x1080, H.264/AAC, burned-in
word-timed captions. The rendered video and voice-over MP3s are build artefacts,
not committed. Rebuild with `ELEVENLABS_API_KEY=... python3 video/eval/tts.py`
(voice-over), `python3 video/eval/capture.py` (scenes) and
`python3 video/eval/build.py` (assembly). The teardown scene's data comes from
`python3 video/eval/export_teardown_data.py`.

| Time | Beat |
|---|---|
| 0:00–0:22 | **The scan.** A dead board, a 40px open circuit, seven models, 7/7 wrong. |
| 0:22–1:05 | **The task.** 207 tasks, two suites, the prompt and JSON contract, the expert label. |
| 1:05–1:35 | **The grader.** Code not judgment; reference fixture scores 1.000, null model 0.000. |
| 1:35–2:17 | **Board results.** Disposition accuracy 0.26–0.44; failure runs both directions. |
| 2:17–3:09 | **Exhibits.** A missed short, a scrapped golden board, a clean crop called defective. |
| 3:09–4:09 | **The teardown.** The eval opened up: every call on the record, and the calibration finding. |
| 4:09–4:33 | **Repro + close.** 207 tasks, deterministic grader, 4,345 graded trials. |

### The headline finding the video lands

Computed over all 4,345 graded trials (`python eval/calibration.py`):

| | value |
|---|---|
| Pooled AUC of confidence → correctness | 0.580 (no signal = 0.50) |
| Per-model AUC | 0.455 (gpt-5-mini) to 0.835 (claude-opus-5-5); weighted mean 0.712 |
| Trials stated at confidence ≥ 0.90 | 1,027 |
| …of those, **wrong** | **386 (37.6%)**, of which 373 are Gemini (262) and Kimi (111) |

Confidence is informative *within* most models but it does not transfer
*between* them. Gemini states ≥0.90 on 617 of 621 trials at 57.2% accuracy and
Kimi on 284 (111 of them wrong), while the Claude models almost never reach 0.90. A
line engineer who picks one confidence cut-off for "trust this call" gets a
different, and for overconfident models a poor, guarantee depending on which
model sits behind it. The pooled 0.58 is therefore a statement about mixing
models, not about any single model's signal.

## Packaging

```bash
bash eval/package.sh   # writes eval/soldersight-pcb-eval.zip (code + data, <50MB)
```
