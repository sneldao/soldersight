# SolderSight Foundry — 2-Minute Live Demo Script

**Runtime:** ~2:00 (4 beats)
**Stack:** Deterministic A* / DRC procedural engine + **Mubit (`gpt-4o-mini`)** netlist architect & live layout commentary + **Banyan Sapling** calibrated validity/taste gate.
**Fail-safe:** Defaults to `data/foundry/golden.json` (real recorded Mubit + SHA-pinned Banyan Sapling verdicts); **"Run live"** calls both endpoints directly from the browser.

---

## Beat 1 — The Hook: Why Autonomous Hardware Needs Split Brain (0:00 – 0:25)

**On screen:** Open the **Foundry** tab. Show the two modes side-by-side: **Evolve** (a board designing itself) and **Heal** (real DeepPCB board `00041004` with red AOI defect callouts).

**Narration:**
> "Everyone has seen agents write code in a loop. Hardware is harder: if you ask an LLM to autoroute copper coordinates directly, you get geometric noise and shorted rails.
>
> **SolderSight Foundry** splits the brain in three:
> 1. **Mubit** acts as the architect and layout commentator — turning a one-line circuit brief into a validated netlist and narrating each trade-off.
> 2. A **deterministic A\* and DRC engine** handles every micron of copper geometry.
> 3. **Banyan Sapling** is the taste and validity gate — verifying whether each generation actually satisfies IPC design rules before it's allowed to survive."

---

## Beat 2 — Mode A (Evolve): Watch a Board Design Itself (0:25 – 1:05)

**On screen:** Select **"3-stage RC power filter, 6 pads"** in **Evolve** mode and click **Run**.
- Generation 0 starts at **0.38 DRC fitness** (`open` on `VFILT` at `(11,8)`, trace crossing at `(7,5)`, spacing violation at `(8,6)`). Sapling flags **`violation` (97.5% calibrated)** → generation pruned.
- Over the next ~14 seconds (1 step every ~2s), the fitness sparkline climbs monotonically: `0.38 → 0.52 → 0.64 → 0.73 → 0.81 → 0.88 → 0.94 → 0.98`.
- Mubit's designer note updates on each generation (*"Stitched open VFILT leg at (11,8); −1 open violation"*, *"Uncrossed VIN/GND trunk via north channel"*, *"Pulled GND return 1 cell south; full IPC clearance achieved"*).
- At Generation 7 (**0.98 fitness, 0 violations**), Banyan Sapling flips from **`violation`** to **`supported` (47.7% supported, 8.9% violation risk < 15% threshold)** → **SURVIVE / CLEARED**.

**Narration:**
> "In **Evolve** mode, we type a one-line brief — *'3-stage RC power filter, 6 pads'*. Mubit emits a schema-validated netlist.
>
> Watch the fitness curve climb every two seconds. Early generations have an open leg on `VFILT` and a trace crossing at `(7,5)`. Banyan Sapling reads the DRC evidence against our IPC rule spec and rejects those generations at **97% violation probability**.
>
> As the evolutionary loop mutates pad placements and re-routes via A\*, Mubit narrates each physical improvement. By Generation 7, wirelength is minimal, every clearance holds, and Sapling certifies the layout **`supported`** with under 9% residual violation risk."

---

## Beat 3 — Mode B (Heal): Autonomous Red → Green Repair on Real Copper (1:05 – 1:45)

**On screen:** Switch to **Heal** mode on DeepPCB **Board `00041004`** (the same board where the baseline vision model falsely said `pass` and our Triage + Sapling gate caught the short/open).
- Click **Heal Board**.
- Defect counter starts at **`0 / 3 defects healed`** (DRC fitness `0.35`, Sapling: **`BLOCK` · 97.5% violation**).
- **Step 1 (`short` at `7,5`):** Engine cuts the copper bridge between `NET_VCC` and `NET_GND` and detours `NET_VCC` north. Region flips **red → green** (`1 / 3 healed`, fitness `0.62`).
- **Step 2 (`open` at `11,7`):** Engine routes an orthogonal A\* dogleg across the broken `NET_CLK` trace (`2 / 3 healed`, fitness `0.85`).
- **Step 3 (`spacing` at `5,9`):** Engine shifts `NET_SDA` one cell south to restore IPC clearance (`3 / 3 healed`, fitness `0.99`).
- Post-heal Sapling verification flips to **`SHIP` (`supported`, 7.8% violation risk)**.

**Narration:**
> "Now look at **Heal** mode. Earlier, our Triage and Policy Gate caught Board `00041004` — a real DeepPCB board with a bridged short and a broken trace that a naive vision model would have shipped.
>
> Instead of stopping at 'scrap,' Foundry heals it autonomously. Defect by defect, the A\* router cuts the short at `(7,5)`, stitches the open clock line at `(11,7)`, and widens trace spacing at `(5,9)`. Watch each defect flip **red to green** as Mubit logs the engineering change order — and Banyan Sapling re-verifies the repaired board from **97% violation (`BLOCK`)** to **cleared (`SHIP`)**."

---

## Beat 4 — Close: Closed-Loop Hardware Autonomy (1:45 – 2:00)

**On screen:** Show the final healed board with `3 / 3 defects healed`, `0.99 DRC score`, Mubit's repair log, and Banyan Sapling's calibrated conformal bar.

**Narration:**
> "One engine, two modes, zero hallucinated geometry: **Mubit** directs and explains, **A\* + DRC** routes real copper, and **Banyan Sapling** enforces calibrated engineering truth — both in this app and live in the browser."
