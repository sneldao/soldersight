# Submission drafts — micro1 Eval Hackathon

## Short description (for the event form)

**SolderSight PCB Defect Eval** — a vision eval for PCB manufacturing quality
inspection on the expert-labeled DeepPCB dataset: 1,127 tasks in three suites
(whole boards, defect crops, and a 92-board balanced "wide" suite with five
prompt variants), 7 frontier models on the core suites and 4 on the wide
suite. Finding: models almost never miss a defective board, but they flag
clean ones (board-level false-alarm rate 0.21-0.89) and cannot reliably tell
the two apart (Youden J 0.11-0.70), and when they do see a defect they under-call
its severity (scrap boards called scrap 8-50% of the time). We tested whether
that is an artifact: stating the worst-defect rule does not change it, a
base-rate hint trades false alarms for misses, and supplying the golden
reference image lifts three of four models to J 0.90-0.92, so the main
failure is detecting absence without a reference, not seeing defects. Severity
under-calling persists even with the reference (scrap recall 20-70%).
Deterministic code-based grading against expert labels with board-clustered
95% intervals, constant-answer floors, reference solutions and null fixtures
for every task, a model-free check that the clean boards are clean, and
stated confidence that is informative within a model but not comparable across
models (Gemini states >=0.90 on 617 of 621 trials at 57% accuracy). OpenAI-compatible
runner, fully reproducible offline.

## Where this submission is weakest (and what we did about it)

- *Only 30 boards in the first version* -> the wide suite adds 92 fresh boards
  from 8 DeepPCB groups, balanced scrap/rework/clean.
- *Clean boards judged from one image* -> clean twins are verified clean by the
  production change detector, and a golden-reference variant is included.
- *Failure might be the prompt* -> five prompt variants; results above.
- *The "below a constant answer" result did not replicate on the wide suite*
  (3 of 4 models sit slightly above 0.5), so it is not a headline; Youden J is.
- Wide suite: 4 models, 1 trial; no human-inspector baseline.

## What existed before vs. built for this event

- **Before:** SolderSight, a PCB inspection app — DeepPCB data subset,
  template-diff region proposer, production prompt, verdict aggregation.
- **For this event:** the `eval/` package — task dataset (core + wide suites),
  standalone runner + grader, metrics, prompt-variant ablation, frontier-model
  results.

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
