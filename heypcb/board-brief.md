# Board brief — "SolderSight Bench QC"

One-paragraph brief for heypcb's `build_board` (Inky). Revise here, then paste
into the MCP call. Design target: **DRC 0 · ERC 0 · all fab checks pass · ~30–50
parts · 2 layers · JLC-assemblable.**

## Brief

> Build a benchtop PCB quality-control camera board: a two-layer 60 × 40 mm board
> built around an ESP32-S3-WROOM-1 (N8R8, 8 MB flash, 8 MB PSRAM) with a DVP camera
> connector for an OV2640 module (24-pin 0.5 mm FPC, matching the ESP32-S3-Korvo /
> XIAO ESP32S3 Sense camera wiring), a ring of 8 WS2812B addressable RGB LEDs for
> illumination and status, and a microSD card slot for storing known-good reference
> images. Power from USB-C (CC1/CC2 5.1 kΩ pulldowns, ESD protection), a 3.3 V LDO
> (≥600 mA) feeding the module, camera and LEDs, with a bulk 100 µF + decoupling per
> rail. LED data line through a 330 Ω series resistor; camera I²C (SDA/SCL) with
> 4.7 kΩ pull-ups; boot strapping (GPIO0 button, EN 10 kΩ pull-up + 1 µF to
> ground); 3.3 V only on strapping-relevant inputs. Expose TX/RX on a 4-pin header
> (3V3, TX, RX, GND) next to the boot and reset buttons. Ground pour on both
> layers, antenna end of the module clear of copper (keepout ≥ 5 mm on all layers,
> antenna overhanging the board edge). Silkscreen: board name "SolderSight Bench
> QC", LED ring center marked, fiducials in opposing corners.

## Why these choices (contest documentation draft)

- ESP32-S3 + OV2640 is a proven, cheap, JLC-assemblable combo (XIAO ESP32S3 Sense
  uses exactly this wiring) — "would it work if built" is defensible by reference
  designs.
- WS2812B ring doubles as diffuse illumination for photographs *and* a status
  display — the same trick real AOI light domes use.
- microSD stores the known-good template — mirrors SolderSight's template↔test
  diff triage, on-device.
- The story: the board was designed by one agent (Inky via heypcb MCP) and
  verified by a second (SolderSight's policy gate / eval) — the contest entry that
  *is* heypcb's product pitch.

## Entry-card metadata (for publish)

- Title: `SolderSight Bench QC — an AI PCB inspector you can hold`
- Tags (≤8): `esp32-s3`, `camera`, `quality-control`, `aoi`, `open-hardware`,
  `esp32`, `machine-vision`
- Licence: CERN-OHL-S v2
- Summary: what it does → why → how it was designed (MCP, agent loop, DRC 0 /
  ERC 0 / fab checks) → verification story (SolderSight gate on the copper) →
  BOM/build notes.
