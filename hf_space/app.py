"""
SolderSight — PCB defect triage, verified by Mubit's Banyan Sapling.

A vision model proposes whether a circuit board can ship. Banyan Sapling is the
check: it audits that decision against the model's own crop-by-crop notes (no answer
key) and against a written acceptance policy + the defects inspection found. The
result is a line decision — SHIP / BLOCK / REVIEW — with calibrated uncertainty.

Sapling is called LIVE (its research-preview endpoint needs no auth). If the endpoint
is cold or unreachable, the app falls back to a cache of *real* Sapling outputs,
clearly labelled — it never fabricates a verdict.

Run locally:  pip install -r requirements.txt && python app.py
"""

from __future__ import annotations

import gradio as gr

import demo_cases as dc
import sapling

CACHE = dc.load_cache()
RUNS = dc.load_runs()

REPO_URL = "https://github.com/sneldao/soldersight"
SAPLING_HF = "https://huggingface.co/MubitLabs/banyan-sapling"

LABEL_TEXT = {
    "supported": "Supported",
    "violation": "Policy violation",
    "insufficient_information": "Insufficient information",
    "inconsistent_context": "Inconsistent context",
}
LABEL_COLOR = {
    "supported": "#22c55e",
    "violation": "#ef4444",
    "insufficient_information": "#f59e0b",
    "inconsistent_context": "#94a3b8",
}
ACTION_STYLE = {
    "SHIP": ("✅ SHIP", "#22c55e", "cleared to ship"),
    "BLOCK": ("🛑 BLOCK", "#ef4444", "ship blocked"),
    "REVIEW": ("⚠️ REVIEW", "#f59e0b", "route to a human"),
}

POLICY_CHOICES = [
    (f"{b} — the catch" if b == "00041004" else b, b) for b in dc.POLICY_BOARDS
] + [(i["label"], i["id"]) for i in dc.ILLUSTRATIVE]
TRACE_CHOICES = [
    (f"{b} — wrote “visible short circuit”" if b == "00041003" else b, b)
    for b in dc.TRACE_BOARDS
]


# ---------------------------------------------------------------------------
# Verification: live first, real-cached fallback, never fabricated
# ---------------------------------------------------------------------------


def get_verdict(policy: str, evidence: str, claim: str, prefer_live: bool) -> dict:
    """Return a gate decision with a 'source' of live | cached | unavailable."""
    if prefer_live:
        resp = sapling.verify(policy, evidence, claim, timeout=35)
        if "error" not in resp and "probabilities" in resp:
            gate = sapling.gate_decision(resp)
            gate["source"] = "live"
            return gate
    cached = CACHE.get(dc.cache_key(policy, evidence, claim))
    if cached:
        return {**cached, "source": "cached"}
    resp = sapling.verify(policy, evidence, claim, timeout=35)
    gate = sapling.gate_decision(resp)
    gate["source"] = (
        "live" if ("error" not in resp and "probabilities" in resp) else "unavailable"
    )
    return gate


# ---------------------------------------------------------------------------
# HTML rendering (self-contained dark cards — read the same in light/dark themes)
# ---------------------------------------------------------------------------

CARD = (
    "background:#0b1220;border:1px solid #1e293b;border-radius:14px;padding:20px;"
    "color:#e2e8f0;font-family:ui-sans-serif,-apple-system,Segoe UI,Roboto,sans-serif;"
)


def _source_chip(source: str) -> str:
    if source == "live":
        return "<span style='background:#064e3b;color:#6ee7b7;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:600;'>● live via Banyan Sapling</span>"
    if source == "cached":
        return "<span style='background:#1e3a5f;color:#93c5fd;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:600;'>● cached real verdict (endpoint warming)</span>"
    return "<span style='background:#4c1d1d;color:#fca5a5;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:600;'>● verifier unavailable — fail-safe to review</span>"


def _prob_bars(probs: dict | None) -> str:
    if not probs:
        return ""
    order = sorted(probs, key=lambda k: -probs[k])
    rows = ""
    for k in order:
        pct = round(probs[k] * 100)
        rows += (
            f"<div style='display:grid;grid-template-columns:150px 1fr 44px;gap:10px;align-items:center;margin:6px 0;'>"
            f"<span style='font-size:12px;color:#94a3b8;'>{LABEL_TEXT.get(k, k)}</span>"
            f"<span style='height:8px;background:#1e293b;border-radius:999px;overflow:hidden;display:block;'>"
            f"<span style='display:block;height:100%;width:{pct}%;background:{LABEL_COLOR.get(k, '#64748b')};border-radius:999px;'></span></span>"
            f"<span style='font-size:12px;color:#cbd5e1;text-align:right;font-variant-numeric:tabular-nums;'>{pct}%</span>"
            f"</div>"
        )
    return rows


def _verdict_block(
    gate: dict, *, claim: str, evidence: str, policy: str, banner: str = ""
) -> str:
    action = gate.get("action", "REVIEW")
    glyph, color, sub = ACTION_STYLE.get(action, ACTION_STYLE["REVIEW"])
    label = gate.get("label")
    conf = gate.get("confidence")
    conf_txt = f" · {round(conf * 100)}% calibrated" if conf is not None else ""
    pset = gate.get("prediction_set") or []
    unsure_note = (
        f"<p style='margin:10px 0 0;font-size:12px;color:#64748b;'>Conformal set keeps "
        f"{len(pset)} labels in play — calibrated uncertainty, not a guess.</p>"
        if len(pset) > 1
        else ""
    )
    given = (
        f"<b style='color:#cbd5e1;'>Claim:</b> {claim}\n\n"
        f"<b style='color:#cbd5e1;'>Evidence:</b> {evidence}\n\n"
        f"<b style='color:#cbd5e1;'>Policy:</b> {policy}"
    )
    return f"""
    <div style='{CARD}'>
      {banner}
      <div style='display:flex;align-items:center;gap:14px;'>
        <div style='font-size:26px;font-weight:800;color:{color};'>{glyph}</div>
        <div>
          <div style='font-size:15px;color:#e2e8f0;font-weight:600;'>{sub.capitalize()}</div>
          <div style='font-size:13px;color:#94a3b8;'>Verdict: {LABEL_TEXT.get(label, label or 'unavailable')}{conf_txt}</div>
        </div>
        <div style='margin-left:auto;'>{_source_chip(gate.get('source', 'cached'))}</div>
      </div>
      <p style='margin:14px 0 6px;font-size:13px;color:#cbd5e1;'>{gate.get('reason', '')}</p>
      <div style='margin-top:10px;'>{_prob_bars(gate.get('probabilities'))}</div>
      {unsure_note}
      <details style='margin-top:14px;'>
        <summary style='cursor:pointer;color:#93c5fd;font-size:13px;'>What Sapling was given</summary>
        <div style='margin-top:8px;font-size:12px;color:#94a3b8;line-height:1.6;white-space:pre-wrap;'>{given}</div>
      </details>
    </div>
    """


# ---------------------------------------------------------------------------
# Tab callbacks
# ---------------------------------------------------------------------------


def board_image(board_id: str):
    p = dc.IMAGES_DIR / f"{board_id}_test.jpg"
    return str(p) if p.exists() else None


def policy_inputs(choice: str):
    illus = {i["id"]: i for i in dc.ILLUSTRATIVE}
    if choice in illus:
        case = dc.illustrative_case(illus[choice]["types"])
        meta = {"image": None, "vision": None, "truth": None}
        return case["policy"], case["evidence"], case["claim"], meta
    case = dc.policy_case(choice, RUNS)
    meta = {
        "image": board_image(choice),
        "vision": dc.board_vision(choice, RUNS),
        "truth": dc.board_ground_truth(choice, RUNS),
    }
    return case["policy"], case["evidence"], case["claim"], meta


def render_policy(choice: str, prefer_live: bool):
    policy, evidence, claim, meta = policy_inputs(choice)
    gate = get_verdict(policy, evidence, claim, prefer_live)

    banner = ""
    vis, truth = meta["vision"], meta["truth"]
    if (
        vis
        and truth
        and vis.get("disposition") == "pass"
        and truth.get("disposition") not in ("pass", "unknown")
    ):
        if gate.get("action") != "SHIP":
            banner = (
                f"<div style='background:#2a0f12;border:1px solid #ef4444;border-radius:10px;padding:12px;margin-bottom:14px;color:#fca5a5;font-size:13px;'>"
                f"<b>Caught it.</b> The vision model cleared this board as <b>pass</b> "
                f"({round((vis.get('confidence') or 0) * 100)}%), but it truly needs "
                f"<b>{truth['disposition']}</b> ({truth.get('worst')}). Sapling blocked the ship.</div>"
            )

    context = ""
    if vis:
        context = (
            f"<div style='{CARD}margin-bottom:14px;'>"
            f"<div style='font-size:12px;color:#64748b;margin-bottom:4px;'>Vision model (gpt-4o-mini via Mubit) proposed</div>"
            f"<div style='font-size:15px;color:#e2e8f0;'><b>{vis.get('disposition')}</b> "
            f"<span style='color:#94a3b8;'>— {vis.get('reason', '')}</span></div></div>"
        )
    return meta["image"], context + _verdict_block(
        gate, claim=claim, evidence=evidence, policy=policy, banner=banner
    )


def render_trace(choice: str, prefer_live: bool):
    case = dc.trace_case(choice, RUNS)
    gate = get_verdict(case["policy"], case["evidence"], case["claim"], prefer_live)
    note = (
        "<div style='background:#0b1220;border:1px solid #1e293b;border-radius:10px;padding:12px;margin-bottom:14px;color:#93c5fd;font-size:12px;'>"
        "No ground truth is used here. The evidence is the model's <b>own</b> crop-by-crop "
        "notes; the catch is the model contradicting itself.</div>"
    )
    return board_image(choice), note + _verdict_block(
        gate, claim=case["claim"], evidence=case["evidence"], policy=case["policy"]
    )


# ---------------------------------------------------------------------------
# UI
# ---------------------------------------------------------------------------

ABOUT_MD = f"""
### What this is
A vision model (gpt-4o-mini, routed through **Mubit**) triages PCB photos — but cheap
models are confidently wrong, clearing defective boards as *pass*. **Banyan Sapling**
is the check that catches them. Two verifications:

| Gate | Evidence | Catches |
|------|----------|---------|
| **Policy gate** | what inspection (AOI) found + a written spec | the model shipping a board that violates policy |
| **Trace audit** | the model's **own** crop-by-crop notes — *no answer key* | the model contradicting itself |

### The Mubit stack in miniature
- **Runtime calibration** — baseline vs. corrected "task" lanes (repo's `/compare`).
- **Banyan Sapling** — semantic verification with calibrated uncertainty (this Space).
- Open weights, Apache-2.0: [{SAPLING_HF}]({SAPLING_HF}).

Sapling is called **live** (no auth on the research-preview endpoint). If it's cold,
the app shows a **cached real verdict** — never a fabricated one.

**Repo:** [{REPO_URL}]({REPO_URL}) · Built for Mubit Night Shift (London, Oct 2026).
"""

THEME = gr.themes.Soft(primary_hue="blue", neutral_hue="slate")

with gr.Blocks(
    theme=THEME,
    title="SolderSight × Banyan Sapling",
    css="""
.gradio-container {max-width: 980px !important; margin: 0 auto !important;}
#hero {background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:16px;padding:26px 28px;margin-bottom:8px;}
#hero h1 {color:#f8fafc;margin:0 0 6px;font-size:1.6rem;letter-spacing:-0.3px;}
#hero p {color:#94a3b8;margin:0;font-size:0.95rem;}
""",
) as demo:
    gr.HTML(
        "<div id='hero'><h1>SolderSight — PCB ship-gate, verified by Banyan Sapling</h1>"
        "<p>A cheap vision model decides if a board can ship. Mubit's Banyan Sapling checks "
        "that decision — against the model's own notes, and against policy — and blocks the bad ones.</p></div>"
    )

    with gr.Tabs():
        with gr.TabItem("Trace audit — no answer key"):
            gr.Markdown(
                "Sapling audits the claim **“this board can ship as-is”** against the model's "
                "*own* inspection notes. On `00041003` the model literally wrote "
                "*“visible short circuit”* — then the board was up for shipping."
            )
            with gr.Row():
                with gr.Column(scale=1):
                    t_choice = gr.Dropdown(
                        TRACE_CHOICES, value=dc.TRACE_BOARDS[0], label="Board trace"
                    )
                    t_img = gr.Image(label="Inspected board", height=240)
                    t_live = gr.Button(
                        "Re-run live via Banyan Sapling", variant="primary"
                    )
                with gr.Column(scale=1):
                    t_out = gr.HTML()

        with gr.TabItem("Policy gate"):
            gr.Markdown(
                "The vision model proposes a disposition. Sapling verifies it against an "
                "independent inspection (AOI) reading + a written acceptance policy → "
                "**SHIP / BLOCK / REVIEW**. Start on **the catch**."
            )
            with gr.Row():
                with gr.Column(scale=1):
                    p_choice = gr.Dropdown(
                        POLICY_CHOICES, value="00041004", label="Board"
                    )
                    p_img = gr.Image(label="Inspected board", height=240)
                    p_live = gr.Button(
                        "Re-run live via Banyan Sapling", variant="primary"
                    )
                with gr.Column(scale=1):
                    p_out = gr.HTML()

        with gr.TabItem("About"):
            gr.Markdown(ABOUT_MD)

    # Instant first paint from cached-real verdicts; "Re-run live" hits the endpoint.
    demo.load(lambda: render_trace(dc.TRACE_BOARDS[0], False), outputs=[t_img, t_out])
    demo.load(lambda: render_policy("00041004", False), outputs=[p_img, p_out])

    t_choice.change(lambda c: render_trace(c, False), t_choice, [t_img, t_out])
    t_live.click(lambda c: render_trace(c, True), t_choice, [t_img, t_out])
    p_choice.change(lambda c: render_policy(c, False), p_choice, [p_img, p_out])
    p_live.click(lambda c: render_policy(c, True), p_choice, [p_img, p_out])


if __name__ == "__main__":
    demo.launch()
