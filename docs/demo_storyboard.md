# SolderSight — "No Answer Key" demo film

**Code freeze:** Sun 25 Oct 05:00 GMT
**Repo:** https://github.com/sneldao/soldersight
**Script:** [`video/script.md`](../video/script.md) — five plates, ~2:10

> Supersedes the earlier screen-recording storyboard. The film is now a
> rendered "case file": paper plates, hairline isometric machines, red
> reserved for defects and verdicts. Assets live in `video/`.

## Visual system (locked)

- **Paper theme** iso-glow figures — hairline ink, `Fig N` plate chrome
- **Red (`#dc2626`)** = defect / violation / verdict only; amber = live/scanning
- **Editorial spreads** for connective tissue — mono captions, hairline rules
- Real data everywhere: vectorized DeepPCB copper, real model quotes, real metrics

## The five plates

| Plate | Scene | Asset |
|-------|-------|-------|
| Fig 1 · The board | Hi-spec iso PCB — real `00041003` copper vectorized to outlines, meander/via densification, defect callout at true coords | `video/board2.js` → `board2.html` |
| Fig 2 · The testimony | Iso terminal types the model's own words, then `ship as-is` | `video/figs.js` (`testimony`) → `iso-scenes.html` |
| Fig 3 · The audit | Exhibit A vs Exhibit B, red leader threads, VIOLATION 0.84 → BLOCK | `video/plates.html#p1` |
| Stat beat | 14/14 condemned by their own notes | `video/plates.html#p2` |
| The machine | ROUTE + ADAPT + VERIFY + compare table | `video/plates.html#p3` + `gate` figure |
| Title | NO ANSWER KEY + repo + HF link | `video/plates.html#p4` |

## Pipeline

- `video/traces.json` / `tracepath.txt` — DeepPCB bitmap → RLE-merged SVG rects
  (551 regions), reusable for any board.
- Figures: `figs.js` + `board2.js` → assembled via iso-glow `gallery.html`
  (palette: `Signal` red + `Ember` amber).
- Editorial plates: `plates.html` (`#p1`…`#p4`, `:target`-selected, 1920×1080).
- Capture: `agent-browser` at 1920×1080, `?demo` triggers figure state sequences.

## Sound

- Voice: ElevenLabs v4, low documentary register (script in `video/script.md`)
- Stamps/arm land with a thunk; one full second of silence after "ship"
- Optional subtle music bed under voice

## Live artifact reuse

The same HTML figures are the HF Space / expo-table interactive —
`?demo` autoplays; click/space drives them manually. Zero network needed.
