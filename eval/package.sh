#!/bin/bash
# Build the submission zip: eval code + dataset + committed results. No videos,
# no secrets, no .env files. Target: well under the 50MB cap.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=eval/soldersight-pcb-eval.zip
rm -f "$OUT"
zip -r "$OUT" eval \
  -x 'eval/soldersight-pcb-eval.zip' \
     'eval/results/*.tmp' \
     'eval/results/archive_nopolicy/*' \
     'eval/results/report_*partial*' \
     '*/.env' \
     '*/__pycache__/*' \
     '*.pyc'
ls -lh "$OUT"
unzip -l "$OUT" | tail -3
