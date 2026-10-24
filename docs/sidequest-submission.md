# Side Quest: The "Policy" Challenge — submission pack

Fill in `<team name>`, `<repo link>`, and attach the demo. Entry goes in the
`side-quests` Discord channel. Tag **@MubitLabs** on X and **Mubit** on LinkedIn.

## The task, in one line

> Banyan Sapling as an independent QA gate: it blocks a PCB from shipping when a
> cheap vision model has wrongly cleared a board that inspection shows is defective.

## What to show in the demo (≤2 min, or screenshots)

1. Pick board `00041004`, triage it — the gpt-4o-mini vision model returns **pass**.
2. Click **"Verify against policy gate →"**.
3. Sapling returns **violation @ 96%**, gate shows **BLOCK — ship blocked**, with the
   "Caught it" banner (claimed *pass*, truth *scrap/open*).
4. (Optional) terminal: `python backend/gate_demo.py` — the batch catch across boards
   plus the SHIP / REVIEW / BLOCK range on clean / spur / open evidence.

---

## X post (draft)

> We gave our PCB-inspection app a safety brake built on @MubitLabs Banyan Sapling.
>
> A cheap vision model cleared a circuit board as "PASS." The board had an open +
> short circuit.
>
> Sapling — fed the policy + what inspection actually found — called it a VIOLATION
> at 96% and blocked the ship. 🛑
>
> Not a chat box. Semantic verification doing the safety-critical part.
>
> [attach 30–60s screen capture of the BLOCK]
> #NightShift

## LinkedIn post (draft)

> **Teaching an AI quality line to say "no."**
>
> At Mubit's Night Shift hackathon we built SolderSight — a PCB defect-triage app.
> A cheap vision model looks at a board and proposes pass / rework / scrap. The
> problem: cheap models are confidently wrong. Ours cleared a board with an open
> circuit as "pass" — the kind of miss that ships a dead board to a customer.
>
> So we added a second, independent step built on **Mubit's Banyan Sapling**, an
> open-weight model for semantic verification. Before anything ships, Sapling checks
> one claim — *"this board can ship as-is"* — against a written acceptance policy and
> the defects inspection actually found. It returns supported / violation / not-enough-
> information, with calibrated uncertainty.
>
> On a real board it returned **violation at 96%** and the gate **blocked the ship** —
> catching the cheap classifier before the board left the line. Clean boards clear;
> ambiguous ones route to a human; the gate fails safe if the verifier is unreachable.
>
> Sapling doing the hard part, not a chat box. Repo + 2-minute demo below.
>
> Thanks to Mubit for the weekend and the model. 🌳
> [attach demo] · <repo link>

---

## Discord `side-quests` entry (template)

> **Team:** <team name>
> **Task:** Banyan Sapling as an independent QA gate — blocks a PCB from shipping when
> a cheap vision model wrongly clears a defective board.
> **X:** <link>  ·  **LinkedIn:** <link>
> **Repo:** <repo link>  (policy gate: `backend/sapling.py`, `docs/sapling-gate.md`)

## Checklist

- [ ] Record the BLOCK demo (UI flow above) and/or `gate_demo.py` run
- [ ] Post on X, tag **@MubitLabs**
- [ ] Post on LinkedIn, tag **Mubit**
- [ ] Post the `side-quests` entry with both links + repo by **14:00 BST**
- [ ] (Optional) like Banyan Sapling on Hugging Face 🤗
