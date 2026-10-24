# SolderSight — Hugging Face Gradio Space Strategy

**Goal:** A living, linkable demo that shows Mubit's full stack (calibration → Sapling verification → task adaptation) in one visual, manufacturable domain. Free to host on HF Spaces, no server to manage, discoverable by the open-weights / verification-model community.

---

## Why Hugging Face?

| Reason | Why it matters for SolderSight |
|--------|-------------------------------|
| **Banyan Sapling weights are already on HF** (MubitLabs/banyan-sapling, Apache 2.0) | We're in the same ecosystem; judges and Mubit's team will look there |
| **Gradio Spaces are free and CPU-hosted** | No infrastructure cost, no server to babysit during the hackathon |
| **One shareable URL** | Easy to drop in Discord, X, LinkedIn, and the side-quest submission |
| **Outlasts the event** | The demo keeps working after code freeze; it's a portfolio piece |

---

## Space design: "SolderSight — PCB Defect Triage with Mubit Banyan Sapling"

### Layout (Gradio Blocks)

```
┌─────────────────────────────────────────────────────────────┐
│  SolderSight — PCB Defect Triage with Mubit Banyan Sapling  │
├─────────────────────────────────────────────────────────────┤
│  [Gallery]  [Trace Audit]  [Policy Gate]  [About]           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Board view │  │  Crop view  │  │  Verdict    │         │
│  │  (image)    │  │  (zoomed)   │  │  (badge)    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  [Upload PCB image]  [Run trace audit]  [Run policy gate]   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Model's own notes: "visible short circuit..."      │   │
│  │  Sapling verdict: violation ~0.84 → BLOCK           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Tabs

1. **Gallery** — Static grid of DeepPCB boards with ground-truth overlays; before/after slider (baseline vs adapted lane). Always-on, no API calls.

2. **Trace Audit** (the headline) — Upload a PCB image or paste model crop-by-crop notes → Sapling audits the "ship it" decision against the model's *own* words → flags self-contradictions (e.g., "visible short circuit" + disposition=pass). No ground truth consulted. This is the no-answer-key pivot that competes with Fox/Trace Auditor.

3. **Policy Gate** — Upload a PCB image → vision model proposes disposition → Sapling verifies against written acceptance policy + AOI evidence → SHIP / BLOCK / REVIEW with calibrated confidence. Board `00041004` is the catch: vision says pass, Sapling says violation 96% → BLOCK.


---

## Technical approach for HF free tier

| Component | Approach |
|-----------|----------|
| **Vision model calls** | Mocked/pre-recorded from `data/deeppcb/runs.jsonl` (30 boards, recorded verdicts). No live API spend in the Space. |
| **Sapling verification** | Gated behind "Run Sapling" button → calls Mubit API on-demand. Free tier Spaces can make outbound HTTPS calls. |
| **Image display** | Gradio `Image` component; DeepPCB images served from the repo or bundled in the Space. |
| **State** | Gradio `State` to track the current board, model notes, and Sapling verdict across interactions. |

### Why mocked vision calls are fine here

The demo's point isn't "can a VLM see a 30px defect?" — it's "Sapling catches when the model contradicts itself and when it violates policy." We already have recorded runs with the vision model's confidently wrong answers. The Space replays those and lets Sapling do the verification work.

### app.py skeleton

```python
import gradio as gr
import json
import requests
from pathlib import Path

RUNS = Path(__file__).parent / "data" / "runs.jsonl"
runs = [json.loads(l) for l in RUNS.read_text().splitlines() if l.strip()]

MUBIT_BASE = "https://api.mubit.ai/anthropic"

def run_trace_audit(model_notes: str):
    """Sapling audits the 'ship it' decision against the model's own notes."""
    resp = requests.post(f"{MUBIT_BASE}/verify", json={
        "policy": "open/short → scrap; clean → pass",
        "evidence": model_notes,
        "claim": "this board can ship as-is"
    })
    return verdict_html

def run_policy_gate(image, board_id):
    """Vision model proposes → Sapling verifies against AOI evidence + policy."""
    return verdict_html

with gr.Blocks() as demo:
    gr.Markdown("# SolderSight — PCB Defect Triage with Mubit Banyan Sapling")
    with gr.Tabs():
        with gr.TabItem("Gallery"):
            ...
        with gr.TabItem("Trace Audit"):
            notes_input = gr.Textbox(label="Model's crop-by-crop notes")
            audit_btn = gr.Button("Run trace audit")
            audit_out = gr.HTML()
            audit_btn.click(run_trace_audit, notes_input, audit_out)
        with gr.TabItem("Policy Gate"):
            img_input = gr.Image(label="Upload PCB image")
            gate_btn = gr.Button("Run policy gate")
            gate_out = gr.HTML()
            gate_btn.click(run_policy_gate, [img_input], gate_out)
        with gr.TabItem("About"):
            gr.Markdown("...")

demo.launch()
```

### What to show in each tab (demo story)

| Tab | What the user sees | The Mubit story beat |
|-----|-------------------|---------------------|
| Gallery | 30 DeepPCB boards, before/after slider | Runtime calibration — same board, baseline vs adapted lane |
| Trace Audit | Model's own notes → Sapling flags contradiction | Sapling verifies self-consistency, no answer key |
| Policy Gate | Vision says pass → AOI evidence + policy → BLOCK | Sapling verifies against independent evidence + written spec |
| About | Three pillars mapped to features | Full stack in one app |

### Launch checklist

- [ ] Create `hf_space/` directory with `app.py`, `requirements.txt`, `README.md`
- [ ] Bundle a small subset of `runs.jsonl` + 5-10 board images in the Space
- [ ] Test locally: `gradio app.py`
- [ ] Create HF Space (SDK: gradio, SDK version pinned)
- [ ] Add Mubit API key as a Space secret (for on-demand Sapling calls)
- [ ] Share the Space URL in the side-quest submission, X post, and LinkedIn post

### Why this helps Mubit's global launch

Mubit wants novel, imaginative use cases that demonstrate their stack end-to-end. A Gradio Space gives them:

1. **A live, linkable demo** they can point to when explaining "agentic runtime calibration" and "Banyan Sapling verification"
2. **A visual, non-software domain** (PCB manufacturing) — shows Sapling works beyond code agents and support tickets
3. **The no-answer-key trace audit** — the differentiator that competes with Fox/Trace Auditor, but in a physical, manufacturable domain
4. **Open-weights alignment** — Sapling is Apache 2.0 on HF; our Space lives in the same community

This is a portfolio piece that outlasts the hackathon and keeps working for judges, press, and Mubit's team long after code freeze.
4. **About** — Explanation of Mubit's three pillars (runtime calibration, Sapling verification, Minima routing) mapped to SolderSight features. Links to repo, demo video, side-quest submission.
