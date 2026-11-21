# INKY.md

Instructions for Inky on this project. Inky reads this file at the start of every message, so write here what you would otherwise repeat.

## Product and fixed requirements
- SolderSight Bench QC: benchtop PCB quality-control camera board.
- Two copper layers, 60 x 40 mm; ESP32-S3-WROOM-1-N8R8 (8 MB flash, 8 MB PSRAM).
- OV2640 on a 24-contact 0.5 mm FPC, requested XIAO ESP32S3 Sense camera wiring; establish the actual camera flex power contract before wiring.
- Eight WS2812B addressable LEDs in a ring; microSD image storage.
- USB-C input, separate 5.1k CC resistors, ESD protection; 3.3 V LDO rated at least 600 mA, bulk 100 uF and bypass capacitors.
- LED data series 330 ohms; camera SCCB pull-ups 4.7k.
- GPIO0 boot button, reset button, EN 10k pull-up plus 1 uF; strapping inputs must see only 3.3 V.
- UART header order 3V3, TX, RX, GND beside the two buttons.
- Both-face ground pours; antenna overhang and at least 5 mm all-layer copper keepout.
- Board name and LED ring center on silk; opposing-corner fiducials.
- No fabrication or assembly house specified by user.

## Decisions and cautions
- User delegated reasonable implementation choices and requested completion.
- Do not assume every OV2640 camera flex accepts 3.3 V on every supply pin.
- Check exact WS2812B variant supply minimum before promising 3.3 V LED operation.
- Reserve ESP32-S3 N8R8 internal PSRAM pins; do not use GPIO35–37 for camera.
- Previous component additions are not a finished circuit; sourcing and wiring remain incomplete.
