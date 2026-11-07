# "The Scan" — eval video narration (target ≈4:45, hard cap 5:00)

Voice: ElevenLabs "Keith - Warm East African Narrator" (uLfPT2jUO3X81OwnftBP),
model v4-class. Low, measured, forensic-documentary register.
One segment = one TTS file (vo/NN.mp3).

## 01 · Cold open — the scan (≈0:00–0:22)
Visual: xray.html — board fills frame, scan-line sweep, zoom into defect region.

[low, deliberate] This is a scan of a dead board. Somewhere in it — a forty
pixel lesion. An open circuit. Fatal. We showed this scan to seven of the
world's most capable vision models. Each one is a diagnostician.
[beat] And every single one of them got the diagnosis wrong.

## 02 · The task (≈0:22–1:14)
Visual: taskcard.html — the image beside the JSON contract; suite split
board vs crop; tasks.jsonl line.

In PCB quality control, triage is a diagnosis. Look at the board. Name the
lesion — open, short, mousebite, spur, stray copper, pinhole. Then rule on
disposition: pass, rework, or scrap. The rules are printed in the prompt —
there is no ambiguity. Two hundred and seven tasks, drawn from the
expert-labelled DeepPCB dataset, in two suites: the whole board, as the
camera sees it — and the magnified crop, the way a real inspection pipeline
isolates each flaw.

## 03 · The grader (≈1:14–1:44)
Visual: grader.html — scoring flow, ref fixture pass, null-model fail.

Grading is code, not judgment. The expert label is law — a trial passes only
when the disposition matches exactly. Missed defects and false alarms are
counted separately, across three independent trials per task. Reference
answers prove every task solvable. A null model scores zero.
[beat] No language-model judge anywhere in the loop.

## 04 · Board results (≈1:44–2:26)
Visual: metrics.html — bars animate per model (0.256–0.438 disp); FA column
lights up (0.21–0.89).

Here is what the seven diagnosticians did with the full-board scan.
[building] Disposition accuracy: forty-four percent — at best. Twenty-six
percent at worst. Coin-flip territory, on boards that are scrap.
And the failure runs in both directions. On defective boards, they miss the
fatal lesion — they name a benign pinhole and recommend rework. On golden
samples — boards with nothing wrong — they invent pathology anyway.
One model condemns eighty-nine percent of clean boards as faulty.

## 05 · Exhibits (≈2:26–3:18)
Visual: exhibits.html — real transcript cards, verbatim quotes, red ink.

Exhibit A. A short circuit. Ground truth: scrap. GPT-five-five writes —
"an isolated speck of excess copper... not forming a short." Rework.
Confident. Wrong.
Exhibit B. A pristine golden board. Grok describes — "a clear gap...
creating an open circuit." It scraps a perfect board.
Exhibit C. Magnified, and still blind: one model flags ninety-nine point
five percent of clean crops as defective.
[beat] They do not know what they do not know.

## 06 · The teardown (≈3:18–4:20)
Visual: teardown.html — the eval opened up. Board centre, parts list right,
calibration curve left. Every number bound to the prediction files.

So we opened the machine. Every call is on the record — the image it saw, the
claim it made, the expert label, and the verdict. Here is Kimi, confident on
most boards it sees. Open its most confident calls: same stated confidence,
and right and wrong sit side by side.
[building] Now pool all seven models, four thousand three hundred and
forty-five trials, and ask whether one confidence cut-off could be trusted.
One thousand and twenty-seven calls were stated at ninety percent or higher.
Three hundred and eighty-six of them were wrong. Look at who made them.
Gemini and Kimi account for three hundred and seventy-three. The Claude models
almost never say ninety. Inside most models, confidence does rank their own
answers, roughly nought point seven to nought point eight on the AUC. Across
models, it does not transfer.
[beat] Confidence is not a portable safety net. Calibrate it per model, or do
not lean on it.

## 07 · Repro + endcard (≈4:29–4:44)
Visual: endcard.html — repro commands, zip contents, stat plate.

Everything here reproduces. Two hundred and seven tasks, a deterministic
grader, four thousand three hundred and forty-seven trials of raw
transcripts — in a three-point-six megabyte zip. One command re-runs any
model through any OpenAI-compatible endpoint. [beat] The eval is
SolderSight. The boards are still waiting.
