# Side Quest: The "Policy" Challenge — submission pack

Fill in `<team name>`, `<repo link>`, and attach the demo. Entry goes in the
`side-quests` Discord channel. Tag **@MubitLabs** on X and **Mubit** on LinkedIn.

## The task, in one line

> Banyan Sapling audits a PCB "ship it" decision against the vision model's **own
> crop-by-crop notes** — no answer key. It catches the model clearing a board it had
> already said, in its own words, has a short circuit.

Two gates ship in the repo:
- **Trace audit** (`/verify/trace`, `trace_demo.py`) — claim vs the model's *own
  observations*. **No ground truth.** This is the headline.
- **Policy gate** (`/verify/board`, `gate_demo.py`) — claim vs an independent AOI
  sensor + written policy. Three-tier SHIP / BLOCK / REVIEW.

## What to show in the demo (≤2 min, or screenshots)

Terminal, deterministic, no API flakiness:

```
$ python backend/trace_demo.py
Auditing "this board can ship as-is" against the inspection model's OWN notes.
No dataset labels are used — the catch is the model contradicting itself.

lane      board      crops model noted            sapling     gate
baseline  00041003       6 open,pinhole,short     violation   BLOCK
...
14/14 shipping claims blocked — each a board the model's own notes said not to ship.
No ground truth was consulted.
```

Zoom in on `00041003`: the model literally wrote *"there is a visible short circuit
potentially affecting the functionality"* on one crop — and the ship decision is
blocked because of **the model's own sentence**, at violation ≈ 0.84.

---

## X post (draft)

> A vision model inspected a circuit board, wrote "visible short circuit" on one crop
> — and still green-lit the board to ship.
>
> @MubitLabs Banyan Sapling caught it: violation. Ship blocked.
>
> No answer key. It audits the model's shipping decision against the model's OWN
> notes. 14/14 self-contradicting boards stopped.
>
> [attach trace_demo.py run / the 00041003 close-up]
> #NightShift

## LinkedIn post (draft)

> **Catching an AI that contradicts itself — no answer key required.**
>
> At Mubit's Night Shift hackathon I built SolderSight, a PCB defect-triage app. A
> vision model inspects a board crop by crop and writes a note on each. The failure I
> wanted to catch: the model writes *"visible short circuit"* on one crop, then a
> shipping decision clears the whole board anyway. A dead board goes out the door.
>
> So I added a trace auditor built on **Mubit's Banyan Sapling**, an open-weight model
> for semantic verification. Before a board ships, Sapling checks one claim — *"this
> board can ship as-is"* — against the model's **own crop-by-crop notes**. Not against
> the dataset labels. No ground truth enters the loop. The catch is purely the model
> contradicting itself.
>
> On recorded inspection traces it blocked **14 of 14** boards whose own notes said
> they shouldn't ship — e.g. board 00041003, where the model had written "visible
> short circuit," scored a **violation at ~0.84** and the ship was blocked.
>
> There's also a policy gate that reconciles the decision against an independent
> optical-inspection sensor and a written acceptance spec (SHIP / BLOCK / REVIEW,
> fail-safe to human review). Both run offline in tests; Sapling does the hard part.
>
> Repo + 2-minute demo below. Thanks to Mubit for the weekend and the model. 🌳
> [attach demo] · <repo link>

---

## Discord `side-quests` entry (template)

> **Team:** <team name>
> **Task:** Banyan Sapling audits a PCB "ship it" decision against the vision model's
> own crop-by-crop notes — no answer key — and catches it clearing a board it had
> called a short circuit. Plus a policy gate vs an independent AOI sensor + spec.
> **X:** <link>  ·  **LinkedIn:** <link>
> **Repo:** <repo link>  (trace audit: `backend/trace_demo.py`, `backend/sapling.py`; `docs/sapling-gate.md`)

## Checklist

- [ ] Record `python backend/trace_demo.py` (headline) and/or `gate_demo.py`
- [ ] Post on X, tag **@MubitLabs**
- [ ] Post on LinkedIn, tag **Mubit**
- [ ] Post the `side-quests` entry with both links + repo by **14:00 BST**
- [ ] (Optional) like Banyan Sapling on Hugging Face 🤗
