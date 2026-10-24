# SolderSight — Expo Table Test Plan

**Venue:** Night Shift, London — expo judging 05:30 GMT, Sun 25 Oct
**Network risk:** venue Wi-Fi may be flaky — plan for offline/demo mode

---

## Setup checklist (before expo table)

1. Start backend: `cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000` (`.env` sourced with `MUBIT_API_KEY`)
2. Start frontend: `cd frontend && npm run dev` (default port 5173)
3. Confirm both servers respond: `curl http://localhost:8000/boards` and `curl http://localhost:5173`
4. Have `trace_demo.py` and `gate_demo.py` outputs pre-captured as fallback (deterministic, no live API needed)
5. Pre-open `backend/demo_render.html` for screenshots if live Mubit calls fail

---

## Demo flow at the table

| Step | Action | Expected result | Fallback if network fails |
|------|--------|-----------------|---------------------------|
| 1 | Open frontend, select board `00041004` | Board grid + test image loads | N/A (local static files) |
| 2 | Click "Triage selected board" | Classification returns (pass/rework/scrap) | Show pre-captured `runs.jsonl` output |
| 3 | Click "Verify against policy gate" | Sapling verdict badge + probability bars | Show `gate_demo.py` terminal output |
| 4 | Override disposition in CorrectionForm | "Saved to Mubit memory" status | Show `/rules` JSON endpoint |
| 5 | Run `python backend/trace_demo.py` | 14/14 shipping claims blocked | N/A (reads local `runs.jsonl`) |

---

## Budget

Live Mubit calls: ~$0.013 per board per lane. If doing 5 boards × 2 lanes at the expo, budget ~$0.13. Keep `trace_demo.py` and `gate_demo.py` outputs cached as screenshots — they read from local `runs.jsonl` and cost nothing.

---

## What judges will ask (and answers)

**Q: How does Mubit fit in?**
A: All LLM calls route through Mubit's OpenAI-compatible gateway (`api.mubit.ai/openai/v1`). Corrections travel through the task's instructions — each correction becomes a rule line fed to the adapted lane. No `mubit-sdk` dependency (the memory plane was unreachable on this account).

**Q: What's the catch?**
A: Sapling audits the 'ship it' decision against the vision model's own crop-by-crop notes — no answer key. Board `00041003` wrote 'visible short circuit' yet cleared for shipping: violation ~0.84 → blocked.

**Q: How is this different from just a better classifier?**
A: It's not a better classifier — it's an independent verification step. The vision model proposes; Sapling verifies against AOI evidence + written policy. Fail-safe to human review if the verifier is down.

---

## If the backend dies mid-demo

1. Restart: `source .venv/bin/activate && uvicorn main:app --reload --port 8000`
2. Re-fetch boards: frontend auto-loads `/boards` on mount
3. If Mubit calls fail: switch to pre-captured terminal outputs (`trace_demo.py`, `gate_demo.py`) and `demo_render.html` screenshots
4. Note: tests fake the model client — they never spend credit, and they still pass offline
