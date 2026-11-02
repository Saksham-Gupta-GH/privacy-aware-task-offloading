#!/usr/bin/env bash
set -euo pipefail

worker_dir="${PRIVACYDRIVE_WORKER_DIR:-$HOME/privacydrive-worker}"
auth_dir="${PRIVACYDRIVE_AUTH_DIR:-$worker_dir/data}"
service="privacydrive-gateway.service"

if [[ ! -x "$worker_dir/.venv/bin/uvicorn" ]]; then
  echo "Worker environment not found at $worker_dir"
  exit 1
fi

mkdir -p "$auth_dir"

systemctl --user stop "$service" 2>/dev/null || true
systemctl --user reset-failed "$service" 2>/dev/null || true

systemd-run --user \
  --unit=privacydrive-gateway \
  --property=MemoryMax=96M \
  --property=Restart=on-failure \
  --working-directory="$worker_dir" \
  --setenv=PRIVACYDRIVE_CLOUD_URL="http://127.0.0.1:8001" \
  --setenv=PRIVACYDRIVE_EDGE_URL="http://127.0.0.1:18001" \
  --setenv=PRIVACYDRIVE_AUTH_DATABASE="$auth_dir/privacydrive-auth.db" \
  "$worker_dir/.venv/bin/uvicorn" privacydrive.public_gateway:app \
  --host 127.0.0.1 --port 8002

echo "Public gateway started on 127.0.0.1:8002. Check: systemctl --user status $service"

