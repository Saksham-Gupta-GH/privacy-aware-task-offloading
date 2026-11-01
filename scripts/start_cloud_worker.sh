#!/usr/bin/env bash
set -euo pipefail

worker_dir="${PRIVACYDRIVE_WORKER_DIR:-$HOME/privacydrive-worker}"
service="privacydrive-cloud.service"

if [[ ! -x "$worker_dir/.venv/bin/uvicorn" ]]; then
  echo "Worker environment not found at $worker_dir"
  exit 1
fi

systemctl --user stop "$service" 2>/dev/null || true
systemctl --user reset-failed "$service" 2>/dev/null || true
systemd-run --user \
  --unit=privacydrive-cloud \
  --property=MemoryMax=360M \
  --property=Restart=on-failure \
  --working-directory="$worker_dir" \
  --setenv=PRIVACYDRIVE_TIER=cloud \
  --setenv=PRIVACYDRIVE_WORKER_ID=azure-student-vm \
  --setenv=PRIVACYDRIVE_THREADS=2 \
  --setenv=PRIVACYDRIVE_BATCH_SIZE=1 \
  --setenv="HF_HOME=$worker_dir/model-cache" \
  "$worker_dir/.venv/bin/uvicorn" privacydrive.worker_api:app \
  --host 127.0.0.1 --port 8001

echo "Cloud worker started. Check: systemctl --user status $service"
