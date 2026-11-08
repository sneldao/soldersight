# "The Scan" — eval video narration (4:41, hard cap 5:00)

Voice: ElevenLabs "Keith - Warm East African Narrator" (uLfPT2jUO3X81OwnftBP),
model eleven_v3. Low, measured, forensic-documentary register. One segment =
one TTS file (vo/NN.mp3). `tts.py` holds the source text; this file mirrors it
with the visual for each scene.

## 01 · The scan (0:00–0:22)
Visual: s1_xray — board 00041001 fills frame, sweep, reticle locks the single
fatal open; seven verdict chips all read REWORK. (All 7 models x 3 trials ruled
rework; ground truth is scrap.)

This is a scan of a dead board. Somewhere in it — a forty pixel lesion. An open circuit. Fatal. We showed this scan to seven of the world's most capable vision models, three times each. Twenty-one verdicts. Every one said: rework.

## 02 · The task (0:22–0:58)
Visual: s2_task — prompt contract, task line, defect glyphs, odometer to 1,127,
then the three suites.

Every board that ships — phone, car, implant — passed through an inspector exactly like this. The task is a diagnosis: name the lesion, then rule on disposition — pass, rework, scrap. The rules are in the prompt; the ground truth is expert-labelled DeepPCB. Eleven hundred and twenty-seven tasks in three suites: whole boards, magnified crops, and a wide set of ninety-two fresh boards, each with a clean twin.

## 03 · The grader (0:58–1:32)
Visual: s3_grader — scoring flow, board-clustered intervals, reference fixture,
null model, clean twins certified by a pixel-diff detector.

Grading is code, not judgment. The expert label is law — a trial passes only when the disposition matches exactly. Missed defects and false alarms are counted separately, with intervals that resample whole boards. Reference answers prove every task solvable. A null model scores zero. The clean twins are certified by a pixel-diff detector. No language-model judge anywhere in the loop.

## 04 · Board results (1:32–2:04)
Visual: s4_metrics — disposition accuracy bars, scrap-ruled-scrap 35%, then the
false-alarm bars.

Here is what the seven diagnosticians did with the full-board scan. Disposition accuracy: forty-four percent at best. Twenty-six at worst. Scrap boards were ruled scrap in barely a third of trials. They almost never call a defective board clean — they under-rule it. And they raise the alarm on almost everything: on golden boards with nothing wrong, one model condemns eighty-nine percent.

## 05 · Exhibits (2:04–2:34)
Visual: s5_exhibits — two transcript cards (under-called short; scrapped golden
board).

Exhibit A. A short circuit. Ground truth: scrap. GPT-five-five writes — an isolated speck of excess copper, not forming a short. Rework. Confident. Wrong. Exhibit B. A pristine golden board. Grok describes — a clear gap, creating an open circuit. It scraps a perfect board. They do not know what they do not know.

## 06 · Is it the prompt? (2:34–3:18)
Visual: s6_reference — wide suite, Youden J for 4 models x 5 prompts; golden
reference swaps in; scrap-ruled-scrap before/after.

A fair objection: maybe it is the prompt. So we ran ninety-two fresh boards, each with a clean twin, under five different prompts. State the worst-defect rule: nothing changes. Tell the model half the boards are clean: false alarms fall, but real defects start slipping through. Now do what a real inspection line does — hand it a golden reference. Three of four models stop crying wolf; discrimination jumps to point nine. But the verdict does not follow: scrap boards are ruled scrap only two times in three, at best. A reference fixes noticing. It does not fix judging.

## 07 · The teardown (3:18–4:18)
Visual: teardown — tts.py segment "06" (calibration findings, unchanged).

## 08 · Repro + endcard (4:18–4:41)
Visual: s7_endcard — stat plate, repro commands.

Everything here reproduces. Eleven hundred and twenty-seven tasks, a deterministic grader, eight thousand transcripts — in a six-point-seven megabyte zip. One command re-runs any model through any OpenAI-compatible endpoint. The eval is SolderSight. The boards are still waiting.
