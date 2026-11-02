#!/usr/bin/env bash
set -euo pipefail

worker_dir="${PRIVACYDRIVE_WORKER_DIR:-$HOME/privacydrive-worker}"
auth_dir="${PRIVACYDRIVE_AUTH_DIR:-$worker_dir/data}"
require_auth="${PRIVACYDRIVE_REQUIRE_AUTH:-true}"
allowed_origins="${PRIVACYDRIVE_ALLOWED_ORIGINS:-https://privacy-aware-task-offloading.vercel.app,http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000}"
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
  --setenv=PRIVACYDRIVE_REQUIRE_AUTH="$require_auth" \
  --setenv=PRIVACYDRIVE_ALLOWED_ORIGINS="$allowed_origins" \
  "$worker_dir/.venv/bin/uvicorn" privacydrive.public_gateway:app \
  --host 127.0.0.1 --port 8002

echo "Public gateway started on 127.0.0.1:8002. Check: systemctl --user status $service"

