# SolderSight demo — edit decision list (frozen)

Output: `video/demo/out/soldersight-demo.mp4` — 1920×1080, 30fps, H.264 yuv420p CRF 18, AAC 192k, `+faststart`.
Hard cap 2:00 (uploads >2:00 are refused). Target ≈1:46.

Audio assets (done, do not regenerate):
- VO: `vo/01.mp3`…`vo/07.mp3` (Mark, eleven_v4). Word timestamps: `vo/NN.stt.json` (`words[].start/end`, type=="word").
- Bed: `audio/bed.mp3` (116s). SFX: `audio/stamp.mp3`, `audio/ship.mp3`, `audio/whoosh.mp3`.

## Timeline (seconds; VO start → visual)

| t | VO | Visual | SFX |
|---|---|---|---|
| 0.0–13.0 | 01 @ 0.6 | **Plates cold open.** `video/board2.html` iso board w/ defect callout (0–5) → `video/iso-scenes.html` testimony terminal typing the model's own words then "ship as-is" (5–9.5) → `video/plates.html#p1` Exhibit A vs B → VIOLATION → BLOCK (9.5–13) | stamp when BLOCK lands; whoosh at 13.0 |
| 13.0–29.0 | 02 @ 13.2 | **Triage.** Landing w/ masthead (13–17) → cursor clicks board thumb, drag compare slider template↔test (17–21) → "Triage selected board (baseline)", skeletons → region cards; punch-in on one card's `mreq_…` id + $cost + latency, then the Mubit calls/latency/tokens/cost stat row (21–29) | soft click on clicks (optional) |
| 29.0–49.5 | 03 @ 29.4 | Baseline card reading "none · pass" (29–33) → correction form, reason typed: "that bright gap is a broken trace, not clean copper" (33–39) → "What this line has taught" rules (39–42) → "Compare lanes": baseline vs adapted, punch-in "open · scrap · matches the labels" (42–46) → Recorded comparison table, punch-in on **Board disposition right 0% → 83%** row, land on word "eighty-three"/"83%" (46–49.5) | — |
| 49.5–66.0 | 04 @ 49.6 | "Verify against policy gate →" → gate card **✕ BLOCK — Ship blocked, policy violation N% calibrated**; BLOCK must be on screen by the word "Blocked" (49.5–60) → `video/plates.html#p2` 14/14 stat plate (60–66) | stamp on word "Blocked" |
| 66.0–82.2 | 05 @ 66.2 | **Foundry Evolve.** Foundry tab (cue card hidden) → brief "3-stage RC power filter, 6 pads" → Run Evolve (Stage cadence) → sparkline climbs, Mubit commentary changes → Gen 7 **SURVIVE · SHIP** | ship chime at SURVIVE |
| 82.2–94.3 | 06 @ 82.4 | **Foundry Heal** 00041004: 0/3 BLOCK → Heal Board (Stage cadence) → defects flip red→green, 3/3 → post-repair gate **SHIP — Cleared to ship** on the words "Cleared to ship" | ship chime on "Cleared to ship" |
| 94.3–106 | 07 @ 94.5 | `video/plates.html#p4` title plate (repo + HF Space link), hold, fade to black 105–106 | — |

## Mix
- VO at 0 dB reference, loudness-normalise final to ≈ −14 LUFS integrated, true peak ≤ −1 dBTP.
- Bed: ≈ −20 dB under VO (sidechain duck), up to ≈ −12 dB in VO gaps and the last 6s; 1s fade in, 2s fade out.
- SFX ≈ −8 dB relative to VO.

## Picture rules
- Real app, real data, 1920×1080 viewport. No layout glitches, no spinners longer than ~1s on screen (trim waits), no dev overlays, Foundry cue card hidden.
- Walkthrough energy: visible cursor moving to each control before clicking (injected cursor + click ripple), smooth punch-ins on the key number of every beat (CSS-transform camera in-page or crop-scale in post — eased, never linear, 1.0→1.6× max).
- Cuts on VO phrase boundaries; whoosh/crossfade ≤ 8 frames between beats.

## Captions (burned in)
- From `vo/NN.stt.json` word timestamps offset by each segment's start. 2–5 words per chunk, bottom-centre, above lower 8% safe area.
- Style: app paper palette — near-black ink text on off-white pill, current word in app accent orange; bold sans ~54px. Never cover the punch-in subject (raise to top if needed).
- Brand name must read "SolderSight" (STT spelled it "Soldersite" in 07 — fix), "Mubit" as spelled.
