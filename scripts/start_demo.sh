#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_dir"

if [[ ! -x .venv/bin/uvicorn ]]; then
  echo "Missing .venv. Run: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  exit 1
fi

if [[ ! -f frontend/dist/index.html ]]; then
  echo "Frontend build missing. Run: npm --prefix frontend install && npm --prefix frontend run build"
  exit 1
fi

export HF_HOME="${HF_HOME:-$project_dir/.model-cache}"
export PRIVACYDRIVE_DATABASE="${PRIVACYDRIVE_DATABASE:-$project_dir/data/privacydrive.db}"
export PRIVACYDRIVE_EDGE_URL="${PRIVACYDRIVE_EDGE_URL:-http://127.0.0.1:18001}"
export PRIVACYDRIVE_CLOUD_URL="${PRIVACYDRIVE_CLOUD_URL:-http://127.0.0.1:18002}"

exec .venv/bin/uvicorn privacydrive.orchestrator_api:app --host 127.0.0.1 --port 8000
