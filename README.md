# PrivacyDrive

PrivacyDrive is a Google Drive-like research prototype for **privacy-aware task
offloading in mobile edge computing**. A document is inspected on the user's device,
classified by sensitivity, and its embedding task is placed on the local device, a
trusted edge laptop, or an Azure cloud VM. Privacy is a hard constraint; latency,
estimated client energy, queue load, availability, and deadlines are optimization
objectives only after disallowed destinations have been removed.

## What the demo proves

- Classification happens locally with explainable, versioned rules.
- Restricted and uncertain documents stay local; personal documents may use the
  trusted edge; public documents may use any tier.
- The optimizer shows all three candidates, predicted latency and energy, exclusion
  reasons, and the final placement.
- Each execution returns a receipt naming the real worker and measured processing
  time.
- Embeddings and search queries stay on the client. Remote workers are stateless.
- Calibrated experiments compare the proposed method with always-local,
  always-cloud, and latency-only baselines, including privacy violations.

## Browser-private frontend

The default **Private workspace** now:

- reads `.txt` and text-based `.pdf` files entirely in the browser;
- classifies content before any remote request;
- stores documents in browser IndexedDB rather than the application server;
- performs local vector indexing and semantic search via in-browser MiniLM WebAssembly (`onnx-community/all-MiniLM-L6-v2-ONNX` q4 via Transformers.js);
- creates semantic extractive summaries using centroid relevance and Maximal Marginal Relevance (MMR);
- runs a privacy-first latency/energy/availability optimizer in the browser;
- executes restricted work locally and can dispatch permitted work to the trusted edge or Azure worker;
- reclassifies remotely dispatched text at the Azure public gateway (`https://20-219-130-205.sslip.io`) so a modified browser cannot bypass the privacy policy;
- shows predicted costs, blocked tiers, the placement reason, and a real execution receipt; and
- rejects scanned PDFs honestly until OCR is explicitly added.

**Live Deployment:**
- Vercel Web Application: [https://privacy-aware-task-offloading.vercel.app](https://privacy-aware-task-offloading.vercel.app)
- Azure Public Gateway: [https://20-219-130-205.sslip.io](https://20-219-130-205.sslip.io)

The **Distributed demo** tab retains the measured local/edge/Azure embedding and smart
search workflow. Browser classification, scheduling, and summarization have automated
TypeScript tests; the shared worker summarizer has Python tests.

## Structured summaries (local source changes; not yet deployed)

The workspace now requests a maximum of 180 words instead of three sentences.
Summaries retain section headings and source-based bullets, attaching recognized
employer/project context to each selected fact. MiniLM embeds candidates across
the whole document in batches (16 units per browser batch; workers use their
configured inference batch size). Selection combines MMR with section coverage,
employer coverage, quantified-achievement preference and exact-fact deduplication.
The model-free fallback uses the same structure and budget, with heuristic ranking.

`POST /api/browser/summarize` and `POST /summarize` accept `word_budget` (20–500,
default 180). `sentence_count` remains accepted as a deprecated compatibility field
but no longer controls the active summary path. The summary remains a string,
formatted with `##` headings and `-` bullets; receipts identify the structured
operation. Update the frontend, gateway/control plane and workers together before
expecting this behavior in the live deployment. Existing cached summaries need to
be regenerated.

Context detection is heuristic, especially for unusual resumes and PDF layouts.
Coverage is encouraged within the budget, not guaranteed for every section.
Oversized individual facts may be marked with an ellipsis. No generative model is
used. Older sentence-count helpers remain as regression baselines, not the active
workspace implementation. Method changes and paper edits are tracked in
[the paper alignment log](docs/PAPER_ALIGNMENT_LOG.md).

## Architecture

```text
React private workspace (PDF/TXT reading, classification, IndexedDB, scheduler)
      |---------------- browser-local summarizer
      |
Local control plane (policy recheck and worker availability)
      |--- SSH tunnel -- trusted Windows edge worker
      `--- SSH tunnel -- Azure cloud worker

Distributed research tab
      `--- local orchestrator + SQLite + local ONNX smart-search index
```

The workload is semantic text embedding with the pinned
`sentence-transformers/all-MiniLM-L6-v2` ONNX model. Demo workload expansion is
clearly labelled as simulated; worker execution and receipts are real.

## Privacy policy

| Label | Allowed execution tiers |
|---|---|
| Public | Local, edge, cloud |
| Personal | Local, trusted edge |
| Restricted | Local only |
| Uncertain | Local only, manual review |

Raw documents are stored only in the local SQLite database. A permitted remote
worker sees a task only while executing it and does not persist it. This prototype
assumes the edge is trusted and does not protect against a compromised client or
edge, metadata leakage, or classification errors.

## Run locally

Prerequisites: Python 3.9+ and Node.js 20+.

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
npm --prefix frontend install
npm --prefix frontend run build
./scripts/start_demo.sh
```

Open <http://127.0.0.1:8000>. The first start downloads the pinned model. The app
still works with remote workers offline; availability is part of the scheduling
decision.

## Connect real workers

Workers bind to loopback. SSH tunnels expose them only to the local orchestrator:

```bash
# Edge (uses the ignored validation/.edge_ssh_config)
ssh -F validation/.edge_ssh_config -N \
  -L 18001:127.0.0.1:8001 privacydrive-edge

# Azure (set the address in your shell; do not commit credentials)
ssh -i ~/.ssh/id_privacydrive_azure -o IdentitiesOnly=yes -N \
  -L 18002:127.0.0.1:8001 azureuser@YOUR_AZURE_IP
```

The dashboard automatically reports `ready`, `busy`, or `offline`. See
[`docs/OPERATIONS.md`](docs/OPERATIONS.md) for deployment, verification, and the
presentation-day checklist.

## Verification

```bash
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/python scripts/run_scheduler_experiments.py
npm --prefix frontend test
npm --prefix frontend run build
PRIVACYDRIVE_DATABASE=/tmp/privacydrive-smoke.db \
  .venv/bin/python scripts/smoke_test.py
```

Calibration code, raw JSON results, cross-machine vector checks, and limitations
are in [`validation/`](validation/). All included documents are fictional.

## Suggested live demo

1. In **Private workspace**, click **Load fictional demo**.
2. Open the public event and choose **Client + edge busy**. Click
   **Evaluate & summarize**: Azure is selected and returns a real cloud receipt.
3. Open the fictional payment-card document with the same settings. Cloud and edge
   are visibly blocked and the receipt says `browser-local-client` / `No network used`.
4. When the trusted edge laptop is connected, process the personal résumé there.
5. Use **Distributed demo** to show local smart search, then show the baseline chart
   in **Experiments**.

The privacy decision never changes to meet a deadline. If no permitted tier can
meet it, the scheduler reports no feasible placement.

