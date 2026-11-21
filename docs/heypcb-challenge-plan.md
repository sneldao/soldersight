# heypcb Hardware Challenge — entry plan

Research pass and plan for the [heypcb $2,000 Hardware Challenge](https://heypcb.ai/challenge)
(Circuit World No. 01, Sep 1 – Nov 30 2026). Written Nov 16, 2026 — **14 days to the
deadline (Nov 30, 11:59 PM PT; winners announced by Dec 7).** Sources: heypcb.ai
(challenge rules, Circuit World, blog, MCP README), Tavily research on comparable
contests, and a browse of the live entries.

## 1. The contest, in brief

Circuit World (heypcb.ai/world) is a gallery of ~20,000 open-source PCB designs,
browsable by category (Robotics, Keyboards, Audio, RF, Power, IoT, Retro…) and forkable
in heypcb's browser editor. The challenge runs on it:

| | Prize 01 · Most likes | Prize 02 · Best board |
|---|---|---|
| Prize | $1,000 ($500 cash + $500 heypcb credit) | $1,000 ($500 cash + $500 credit) |
| How | Most likes when entries close | heypcb team picks, likes irrelevant |
| Context | **Number to beat: 96** (as of Nov 16, updates daily) | **61 entries**, listed in daily random order |

Both winners also get a guaranteed heypcb internship and a founding-engineer
interview — arguably the larger prize.

Rules that shape strategy:

- Free to enter; a trial account can win; **unlimited boards per person**, each
  competing for both prizes. One prize per board — if one board wins both, the
  best-board prize rolls to the runner-up.
- Entries must be **designed in heypcb** (their editor, or their MCP). Forks count
  only with "substantial design work of your own," described in the summary.
- One like per account (liking your own board counts). No bots, no multi-accounts.
- A tie in likes goes to the **earliest entry** → publish before Nov 29.
- An entry card publicly displays **stored error counts · DRC: 0 · ERC: 0**, part
  count, and board size — quality is legible before anyone reads a word.

## 2. Research findings

### heypcb's own taste and narrative

heypcb is a YC-track startup (Justin Kim, Inky Ganbold) pitching **Prompt-to-Hardware**:
the "Inky" design agent, the MCP server for AI agents, multiplayer editing, Time
Machine version history for AI edits, and Explore (11,000+ boards on one map). Their
blog celebrates agent-built boards ("Claude Code used it to build a routed 8×8 RGB
display"). Their curated **"Great starting points"** category favors small, clever,
minimal boards (dpoint: 6 parts, 9×9 mm; joypad-os: 5 parts) over kitchen-sink dev kits.

Read together: **an entry that demonstrates their own pitch — an agent-designed,
agent-verified board — is the poster child they would want to pick.**

### Judging criteria, benchmarked against comparable contests

PCBWay's design contests weight roughly: project design 30% (schematic, component
selection, layout quality), documentation 30%, real-world usefulness 25%, popularity
15%. Recurring winner advice (element14, Hackaday): judges read 20–50 entries at a
time; the idea must be understandable in seconds, and documentation does half the
winning. Hackaday Europe 2026 ("PCBs with a plot"): boards that gather a story and
invite interaction become meaningful objects — visual design and narrative beat specs.

### The competition is soft

61 entries; most are anonymous, clearly single-prompt AI boards
(`roboforge-8a40e53e`: ESP32-S3 + DRV8833 + MPU-6050; generic dev kits; `A simple
board`: 3 parts). FusionBox (always-on ESP32-S3 + LoRa field controller) is the only
entry with a real personal story. Nobody is playing the agent-verified angle.

### Likes are a distribution contest, not a design contest

All-time like leaders on Circuit World are famous-name boards (JPL rover 9,759;
HackRF 8,206; torvalds' guitarpedal 2,475) — recognition, utility and story, not
polish. An unknown entrant wins likes through story + distribution channels:

- **heypcb's own Discord** (discord.gg/Qun7ZtY2Xy) — entrants and founders live there.
- **X @heypcbai** (they reshare entries), LinkedIn (the founders post there).
- Reddit (r/esp32, r/PCB, r/diyelectronics), Show HN, the Hackaday tip line.

### The lever: heypcb's MCP server

`https://api.heypcb.ai/mcp` (Streamable HTTP, OAuth) or the local `npx -y @heypcb/mcp`.
High-level flow: `build_board` (one brief → Inky designs schematic, placement,
routing, DRC/ERC + fab checks) → `get_board` / `preview_board` / `get_board_image` →
`check_board` until fab-ready (each finding names the `fixWith` call) → `export`
(KiCad project, Gerbers, BOM, CPL, STEP). Inky turns take ~7 minutes (`wait_for_turn`).
`build_board` / `ask_inky` / `check_board` are **paid engine calls** billed to the
heypcb account; sign in once via `npx @heypcb/mcp login` (or a personal key from
Settings → Devices & API keys).

## 3. The wedge

Enter **a board whose function is inspecting other boards**, designed end-to-end
through heypcb's own MCP, with the two-agent process documented. It matches the
founders' product story (maximizes Best Board odds) and carries the most likeable
narrative in the contest (two AIs: one designs, one catches defects — SolderSight's
whole thesis).

Concept options, in order:

1. **"SolderSight Bench QC"** — ESP32-S3 + camera + LED ring: point it at any PCB,
   get defect type / severity / disposition (pass / rework / scrap) on device. The
   SolderSight loop made physical; a real product people want.
2. **"Golden Reference"** — a tiny test-coupon board carrying *known, intentional*
   defect patterns (shorts, opens, pinholes) as a calibration target for AI AOI
   tools. Weird, memorable, deeply on-brand — "PCBs with a plot."
3. **Fork-and-verify** — fork a popular board (crkbd, a sensor board), add
   substantial work, and document that every revision passed the SolderSight gate.
   Fastest, weakest story.

## 4. Execution plan (14 days)

| Days | Step |
|---|---|
| 1–2 | Connect the MCP (one `login`), drive concept #1 with `build_board`, iterate with `check_board` until **DRC: 0, ERC: 0, all fab checks pass**. Target ~30–50 parts, 2 layers, JLC-assembly-friendly parts (KiCad/LCSC/JLCPCB ecosystem). |
| 3–5 | Polish: ground pour, silkscreen art (the board should want to be photographed), title + tags (≤8), CERN-OHL-S licence, and a summary written like contest documentation: what it does, why, how it was designed/verified, BOM and build notes — with real evidence (DRC count, gate verdicts, links to SolderSight). |
| 6 | Publish to Circuit World (Share → Publish…) → Entry badge → copy the entry link. |
| 6–13 | Distribution blitz: heypcb Discord first (post the build log, not just the finished board), then an X thread with the demo video, Reddit, Show HN, LinkedIn, Hackaday tip line. Check the daily "number to beat." Engage with other entries. |
| Buffer | A second, different-concept board mid-blitz is cheap insurance (unlimited entries; each competes for both prizes). |

## 5. Probability read

- **Best board:** genuinely good odds. Weak pool, wedge matches the judges' own
  narrative, and DRC: 0 + documentation covers ~60% of the comparable rubrics.
- **Most likes:** long shot. 96 → likely 200+ by close; needs one post to actually
  land (Reddit/HN front page). Worth doing since every post serves both prizes —
  and if our board wins both, best-board rolls to the runner-up, which is fine.

## 6. Risks

- MCP `build_board`/`check_board` are paid — needs heypcb account credit.
- "Designed in heypcb" is a removal condition — design in their editor/MCP, not
  Foundry alone. Foundry's netlist can seed the brief, but Inky must do the board.
- Like-race fair play: no bots or multi-accounts; asking real people to like is the
  sanctioned path ("share it anywhere you like").
- Deadline discipline: ties go to earliest entry → aim to publish by Nov 27.
