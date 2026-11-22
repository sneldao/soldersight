# SolderSight — M6 overlay APK

docs/worn-m6-plan.md §12, option 2 — the display path. A zero-dependency
Android app that renders the worn-AOI overlay on the M6 glasses:
hairline cell grid over the board, verdict colours, one-line gate banner —
the same visual language as `glasses/index.html`. **The glasses are the
Android device** (Android 9, Unisoc W527, 2GB).

Built on the Worn `GlassesAppTemplate` (Nov 22): sideloaded apps don't
appear in the glasses' menu and can't start at boot, so the app carries
the template's persistence layer — an accessibility service Android
restarts at every boot, a foreground keep-alive, and an on-glasses HTTP
control server on `:8080`.

## Transport

**Stream (preferred)** — consumes the replay server's paced NDJSON; cells
light up one verdict at a time, then the verdict line, then the gate:

```
GET {base}/glasses/stream/{board}?lane={lane}
```

If the stream won't open, falls back to the one-shot snapshot:

```
GET {base}/glasses/board/{board}?lane={lane}
```

Point it at the replay server (`cd backend && python3 glasses_server.py`
→ :8001) once, persisted afterwards:

```bash
curl "http://<glasses-ip>:8080/config?base=http://<mac-ip>:8001&board=00041003&lane=baseline"
# or over adb:
adb shell am start -n com.soldersight.glasses/.MainActivity \
  --es base http://<mac-ip>:8001 --es board 00041003 --es lane baseline
```

## Wi-Fi control (ControlServer, port 8080)

```bash
curl http://<glasses-ip>:8080/open     # bring the overlay to the front
curl http://<glasses-ip>:8080/close    # back to the menu
curl http://<glasses-ip>:8080/ping     # is it running, is it on screen?
curl "http://<glasses-ip>:8080/config?base=…&board=…&lane=…"
curl -X POST http://<glasses-ip>:8080/gate \
  -H 'Content-Type: application/json' \
  -d '{"action":"BLOCK","reason":"open defects — do not ship"}'
```

`/gate` lands the demo closer on the lens instantly — no waiting for
stream pacing. Anyone on the same network can reach these; venue Wi-Fi
usually blocks device-to-device — a phone hotspot avoids that.

## Set up (once per pair of glasses)

1. In MLDemo, connect the glasses and turn on **Developer Mode** (Glasses
   screen › Developer). Replug the glasses' USB cable into your Mac and
   check `adb devices` lists them.
2. From this folder, run:
   ```bash
   ./setup.sh
   ```
   It builds and installs the app, turns on its accessibility service
   (that's what restarts it at every boot), exempts it from doze, and
   opens it.
3. Unplug. The app starts itself ~20 s after every power-on
   (`Config.OPEN_ON_BOOT`) and answers :8080 without a cable.

To take it off: `./remove.sh`.

## Build

JDK 17 + Android SDK (platform android-34). The wrapper downloads Gradle:

```bash
cd glasses-android
./gradlew assembleDebug  # → app/build/outputs/apk/debug/app-debug.apk
```

Dev-Mac toolchain (as used Nov 21 on mettle):

```bash
export JAVA_HOME=~/tools/jdk-17/Contents/Home
export ANDROID_HOME=~/tools/android-sdk
```

## Rendering notes

- 640×480 landscape. Board square left, verdict rows + status + gate to
  the right/bottom. Black is see-through on the waveguide — the layout is
  black with accent-green hairlines.
- Colours mirror `glasses/index.html`: pass `#4ade80`, rework `#fbbf24`,
  scrap `#f87171`; gate BLOCK red / SHIP green / REVIEW amber.
- `Config.SHOW_BOARD_IMAGE` draws the test photo desaturated under the
  cells (fetched from `/images/{name}`) — flip off if it reads as noise
  on the real waveguide.
- Touchpad: swipes → `DPAD_LEFT`/`RIGHT`, tap → `ENTER`, double-tap →
  `F12` (handled: back to the menu).
- Logs: `adb logcat -s SolderSight`.

## Status

Untested on hardware — first boot, stream pacing, and waveguide scaling
are venue unknowns. The boot/control paths reuse the organizer-tested
Worn template unchanged.
