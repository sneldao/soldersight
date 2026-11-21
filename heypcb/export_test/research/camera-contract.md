# OV2640FSL camera connection

User supplied the 24-contact module contract: 1 STROBE (unused), 2 AGND, 3 SIOD, 4 AVDD 2.8 V, 5 SIOC, 6 RESETB, 7 VSYNC, 8 PWDN, 9 HREF, 10 DVDD 1.3 V, 11 DOVDD 3.3 V, 12 D9, 13 XCLK, 14 D8, 15 DGND, 16 D7, 17 PCLK, 18 D6, 19 D2, 20 D5, 21 D3, 22 D4, 23 D1, 24 D0. User URL https://www.mpja.com/download/ov2640data%20sheet.pdf returned HTTP 404; the module contract is user-provided, not independently read from that PDF.

Existing D9..D2 and sync/clock/SCCB GPIO allocations preserved. D1 uses GPIO41, D0 GPIO2; PWDN remains GPIO42 with added 10k pulldown. RESETB disconnected from GPIO41 and pulled up to 3V3 with 10k for software-only reset.

Added MCP1700T-2802E/TT (C625349) for AVDD, TLV70013DDCR (C2868517) for DVDD; both inputs from 3V3. Each input and output carries 1uF and 100nF. TLV70013DDCR unavailable in assembly inventory: separately fitted, procurement not confirmed. Datasheets retained as C625349.pdf and C2868517.pdf. Generated schematic review reported no regulator wiring errors.

To preserve 60x40 mm and two layers, placement needed J1/J3/J4/SW1/SW2 on back, with higher two-face assembly cost. Latest sync seats all 60 footprints, but LED ring and camera-connector edge station remain unsatisfied; no copper routed. Do not report manufacturing ready. ESP32-CAM in the module description is a compatibility keyword, not a request to add an ESP32-CAM development board.
