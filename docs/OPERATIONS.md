# PrivacyDrive operations

## Components and ports

| Component | Runs on | Bind address |
|---|---|---|
| Dashboard + orchestrator | User's Mac | `127.0.0.1:8000` |
| Edge worker | Trusted Windows laptop | `127.0.0.1:8001` |
| Cloud worker | Azure student VM | `127.0.0.1:8001` |
| Edge tunnel on Mac | User's Mac | `127.0.0.1:18001` |
| Cloud tunnel on Mac | User's Mac | `127.0.0.1:18002` |

No worker API needs a public inbound firewall port. SSH is used for management and
encrypted tunnelling; application requests use the worker HTTP API inside the
tunnel.

## Worker command

Run from a checked-out project or a directory containing the `privacydrive` package
and virtual environment:

```bash
PRIVACYDRIVE_TIER=edge \
PRIVACYDRIVE_WORKER_ID=edge-laptop \
PRIVACYDRIVE_THREADS=6 \
PRIVACYDRIVE_BATCH_SIZE=32 \
HF_HOME=.model-cache \
.venv/bin/uvicorn privacydrive.worker_api:app --host 127.0.0.1 --port 8001
```

For Azure, use `PRIVACYDRIVE_TIER=cloud`, a recognizable worker ID, two threads, and
`PRIVACYDRIVE_BATCH_SIZE=1`. The 1 GiB student VM cannot safely infer 32 passages in
one batch while its other services run. The deployed service is also memory-limited
so it cannot starve those services.

The repository includes repeatable launchers: run `scripts/start_cloud_worker.sh` on
Azure, and run `scripts/start_edge_worker.ps1` in a normal PowerShell window on the
edge laptop. Keep the edge window open during the demo.

The Azure account has user-service persistence enabled. On a replacement VM, enable it
once with `sudo loginctl enable-linger azureuser`; otherwise a user service stops when
the last SSH login closes.

## Health checks

With tunnels running on the Mac:

```bash
curl http://127.0.0.1:18001/health
curl http://127.0.0.1:18002/health
curl http://127.0.0.1:8000/api/status
```

A worker is usable only when `ready` is true. `loading_model`, `busy`, and `offline`
are valid states and are shown in the UI.

## Presentation-day checklist

- Connect both laptops to the same personal hotspot; do not rely on campus client-to-client networking.
- Confirm the edge laptop's current hotspot IP and update the ignored SSH config.
- Start both workers, then both SSH tunnels.
- Start the local app and verify three green worker indicators.
- Process one prepared public, personal, and restricted document.
- Keep the local-only mode available as a fallback; the privacy policy and optimizer
  remain demonstrable if a network fails.
- Keep screenshots or a short recording of the full three-tier run as a final backup.

## Evidence and experiment honesty

- `actual` uses the document's real passage count.
- `demo_medium` and `demo_heavy` repeat passages to create controlled batch loads and
  are labelled simulated in the UI and receipt.
- Dashboard energy is model-estimated, not hardware-metered.
- Baseline charts are simulations using versioned calibration parameters.
- Execution receipt latency is measured by the selected real worker.

## Never commit

Private SSH keys, passwords, database files, model caches, and machine-specific SSH
configuration are ignored. Change any password that has ever been pasted into a
chat or shared outside the team.
