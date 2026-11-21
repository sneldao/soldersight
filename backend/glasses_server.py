"""Venue-proof replay server for the worn demo — rung 3 of the fallback ladder.

Stdlib only (no FastAPI, no httpx, no Mubit, no Sapling): one process serves
everything the glasses surface needs off the committed ledgers.

    cd backend && python3 glasses_server.py            # http://localhost:8001

    GET /glasses/board/{id}?lane=     one board's overlay payload (§5 contract)
    GET /glasses/stream/{id}?lane=    paced NDJSON replay — one region per tick,
                                      then the board verdict, then the gate —
                                      the "inspection happening live" feel
    GET /glasses                      the waveguide preview page
    GET /images/{name}                board photos
    GET /glasses/payloads             the whole baked corpus

The glasses client (whatever the M6 SDK turns out to need) can poll the board
endpoint or read the stream; the same JSON feeds the preview page, so what the
audience sees on the laptop is what would be on the lens.
"""

import argparse
import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import glasses

ROOT = Path(__file__).resolve().parent.parent
GLASSES_DIR = ROOT / "glasses"
IMAGES_DIR = ROOT / "data" / "deeppcb" / "images"

PACE_S = 0.7  # per-region beat — sells "inspection happening", not a data dump


def board_ids() -> list[str]:
    return sorted(
        p.name.replace("_test.jpg", "") for p in IMAGES_DIR.glob("*_test.jpg")
    )


class Handler(BaseHTTPRequestHandler):
    server_version = "SolderSightGlasses/1.0"

    def log_message(self, fmt, *args):  # quieter than default but not silent
        print(f"  {self.address_string()} {fmt % args}")

    def _send(self, body: bytes, status: int = 200, ctype: str = "application/json"):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, obj, status: int = 200):
        self._send(json.dumps(obj).encode(), status)

    def _file(self, path: Path, ctype: str):
        if (
            not path.is_file()
            or ROOT not in path.resolve().parents
            and path.resolve() != ROOT
        ):
            self._json({"error": "not found"}, 404)
            return
        self._send(path.read_bytes(), 200, ctype)

    def do_GET(self):
        url = urlparse(self.path)
        path = url.path
        lane = parse_qs(url.query).get("lane", ["adapted"])[0]

        if path in ("/glasses", "/glasses/", "/glasses/index.html"):
            return self._file(GLASSES_DIR / "index.html", "text/html; charset=utf-8")

        if path == "/glasses/payloads":
            return self._file(GLASSES_DIR / "payloads.json", "application/json")

        if path == "/glasses/boards":
            return self._json({"boards": board_ids()})

        if path.startswith("/glasses/board/"):
            board_id = path.rsplit("/", 1)[-1]
            payload = glasses.payload_for(board_id, lane)
            if payload is None:
                return self._json(
                    {"error": f"no recorded run for {lane}:{board_id}"}, 404
                )
            return self._json(payload)

        if path.startswith("/glasses/stream/"):
            board_id = path.rsplit("/", 1)[-1]
            payload = glasses.payload_for(board_id, lane)
            if payload is None:
                return self._json(
                    {"error": f"no recorded run for {lane}:{board_id}"}, 404
                )
            self.send_response(200)
            self.send_header("Content-Type", "application/x-ndjson")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(
                json.dumps(
                    {
                        "event": "board",
                        "board_id": board_id,
                        "lane": lane,
                        "grid": payload["grid"],
                        "image": payload["image"],
                    }
                ).encode()
                + b"\n"
            )
            self.wfile.flush()
            for region in payload["regions"]:
                self.wfile.write(
                    json.dumps({"event": "region", **region}).encode() + b"\n"
                )
                self.wfile.flush()
                time.sleep(PACE_S)
            self.wfile.write(
                json.dumps({"event": "verdict", **payload["board"]}).encode() + b"\n"
            )
            self.wfile.flush()
            time.sleep(PACE_S)
            self.wfile.write(
                json.dumps({"event": "gate", **payload["board"]["gate"]}).encode()
                + b"\n"
            )
            self.wfile.flush()
            return

        if path.startswith("/images/"):
            name = path.rsplit("/", 1)[-1]
            return self._file(IMAGES_DIR / name, "image/jpeg")

        self._json({"error": "not found"}, 404)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--port", type=int, default=8001)
    args = ap.parse_args()
    print(f"SolderSight glasses replay on http://localhost:{args.port}")
    print(f"  preview page:  http://localhost:{args.port}/glasses")
    print(
        f"  payload:       http://localhost:{args.port}/glasses/board/00041003?lane=baseline"
    )
    print(
        f"  paced stream:  http://localhost:{args.port}/glasses/stream/00041003?lane=baseline"
    )
    ThreadingHTTPServer(("0.0.0.0", args.port), Handler).serve_forever()
