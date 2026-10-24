# SolderSight — 3-Min Demo Storyboard + Spoken Narration

**Code freeze:** Sun 25 Oct 05:00 GMT
**Repo:** https://github.com/sneldao/soldersight

---

## Demo arc (3:00 max)

| Time | Beat | Screen | Spoken narration |
|------|------|--------|------------------|
| 0:00–0:20 | Hook | Whole-board view of `00041004` — looks clean at 640px | "This board looks fine. A human inspector, a cheap vision model — they'd both say pass. But there's a broken trace here." |
| 0:20–0:45 | The crops | Zoom into region crops — the model sees what a whole board hides | "At 640px the defect is 30px. Invisible. So we diff the board against its known-good template, isolate the changed cells, and upscale them 8x. Suddenly the break is obvious." |
| 0:45–1:10 | Baseline fails | Vision model triages `00041004` → says **pass**, confidence 0.95 | "The cheap model clears it. Pass. It confidently rubber-stamps a defective board — the exact miss that ships a dead board to a customer." |
| 1:10–1:30 | Correction | Inspector overrides: open circuit → scrap | "We correct it. That correction feeds back into the task's instructions — the model learns your defect rules." |
| 1:30–2:00 | Trace audit (headline) | `python backend/trace_demo.py` — 14/14 self-contradicting boards blocked | "And here's the part no answer key was consulted: Sapling audits the 'ship it' decision against the model's **own crop-by-crop notes**. Board `00041003`: the model wrote 'visible short circuit' yet cleared it for shipping. Violation ~0.84 → blocked. The model contradicted itself." |
| 2:00–2:20 | Policy gate | `python backend/gate_demo.py` — AOI evidence vs policy, SHIP/BLOCK/REVIEW | "A second, independent check: AOI sensor evidence plus a written spec. Clean boards ship. Ambiguous ones go to review. Defective ones are blocked — fail-safe if the verifier is down." |
| 2:20–2:40 | Measured table | `/compare` output — baseline vs adapted lane, accuracy/cost/latency | "Same crops down both lanes. The baseline misses the break; the adapted lane catches it. Better accuracy, lower cost, lower latency." |
| 2:40–3:00 | Close | "We own our intelligence layer now" | "We stopped paying GPT-4 for PCB triage. Corrections become model updates. We own our intelligence layer — better, cheaper, faster." |

---

## Spoken narration (single take, ~180 words)

> This board looks fine. A human inspector, a cheap vision model — they'd both say pass. But there's a broken trace here.
>
> At 640 pixels the defect is 30 pixels wide — invisible. So we diff the board against its known-good template, isolate the changed cells, and upscale them eight times. Suddenly the break is obvious.
>
> The cheap model clears it anyway. Pass, confidence 95 percent. It confidently rubber-stamps a defective board — the exact miss that ships a dead board to a customer.
>
> We correct it. That correction feeds back into the task's instructions — the model learns your defect rules.
>
> And here's the part where no answer key was consulted: we audit the 'ship it' decision against the model's **own** crop-by-crop notes. Board zero-zero-zero-four-one-zero-zero-three: the model wrote 'visible short circuit' yet cleared it for shipping. Violation point-eight-four → blocked. The model contradicted itself.
>
> A second, independent check: AOI sensor evidence plus a written spec. Clean boards ship. Ambiguous ones go to review. Defective ones are blocked — fail-safe if the verifier is down.
>
> Same crops down both lanes. The baseline misses the break; the adapted lane catches it. Better accuracy, lower cost, lower latency.
>
> We stopped paying GPT-4 for PCB triage. Corrections become model updates. We own our intelligence layer — better, cheaper, faster.

---

## What to record

1. **Terminal:** `python backend/trace_demo.py` (deterministic, no API flakiness) — capture the 14/14 blocked line and the `00041003` row.
2. **Terminal:** `python backend/gate_demo.py` — capture the `00041004` BLOCK row (violation 96%).
3. **Browser:** `/compare` — baseline vs adapted side-by-side on one board.
4. **Browser:** Correction form — override a disposition, show `/rules` updating.

Edit these four clips together with the narration above. Total target: ~180 seconds.

---

## Assets ready in repo

- `backend/trace_demo.py` — the no-answer-key catch (headline)
- `backend/gate_demo.py` — the policy gate (secondary)
- `data/deeppcb/runs.jsonl` — recorded traces, 30 boards
- `backend/demo_render.html` — screenshotable dashboard of gate results
- Repo: https://github.com/sneldao/soldersight (main has demo data committed)
