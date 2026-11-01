# PrivacyDrive workload-validation gate

This directory benchmarks document-embedding generation. While the three-tier workload
gate remains open, only deployment-independent local foundation work proceeds: the
versioned privacy policy, synthetic corpus, and local classifier. The application UI,
scheduler, database, and worker APIs remain gated.

## Frozen workload definition

- **User-visible operation:** Prepare a document for smart search.
- **Scheduling task:** One document.
- **Dispatch batch:** One or more per-document tasks that have the same permitted tier.
- **Text handling:** Split each document into passages, embed each passage, and return
  normalized 384-dimensional vectors to the client.
- **Query processing and similarity search:** Local only; outside this benchmark.
- **Timing:** Warm steady-state inference is the primary comparison. Model load/cold-start
  time is recorded separately.

## Pinned processing stack

- Model: `sentence-transformers/all-MiniLM-L6-v2`
- Model revision: `1110a243fdf4706b3f48f1d95db1a4f5529b4d41`
- PyTorch: `2.8.0`
- Transformers: `4.57.6`
- NumPy: `1.26.2`
- Pooling: attention-mask-aware mean pooling followed by L2 normalization
- Maximum passage length: 256 tokens
- Inference batch size: 32 passages
- Precision: float32

The exact same settings must be used on the client, edge worker, and Azure worker.

## Predeclared go/no-go criteria

The workload passes only when all of the following are true:

1. The same synthetic workload and pinned stack run successfully on all three tiers.
2. Corresponding vectors have cosine similarity of at least `0.9999` across tiers.
3. Local wins at least one light case, and edge or cloud beats local by at least 15%
   in median end-to-end latency for at least one heavier case.
4. The remote win includes inspection, upload, queueing, processing, and result-return
   time. A compute-only win does not count.
5. At least two warm-up runs and ten measured runs are collected per condition.
6. A condition with a coefficient of variation above 15% is repeated or explained.

If criterion 3 fails, change the workload based on measurements (for example, more
passages per document or a larger model) and rerun the gate. Any CPU restriction used
for the client must be recorded as **emulated resource-constrained client**.

## Workload cases

| Case | Documents | Passages per document | Total passages |
|---|---:|---:|---:|
| small | 1 | 1 | 1 |
| long | 1 | 32 | 32 |
| batch | 16 | 32 | 512 |

The text is deterministic and synthetic. `--seed` defaults to `20261101`.

## Emulated mobile-client profile

The physical M1 client is substantially faster than the trusted edge laptop. A single
additional profile is defined before measurement to represent a resource-constrained
mobile client: the same M1, model, inputs, precision, and batch size with PyTorch limited
to one CPU inference thread. It must be labelled **emulated resource-constrained client**
in the interface and paper. The original unrestricted M1 measurements remain the primary
physical-client baseline and are never replaced.

```bash
python3 validation/benchmark_embeddings.py \
  --torch-threads 1 \
  --output validation/results/local-emulated-mobile.json
```

## Run

```bash
python3 validation/benchmark_embeddings.py --output validation/results/local.json
```

Run the same command on each machine and preserve the generated JSON. Network transfer
and end-to-end timing will be added only after the worker contract is locked in the next
phase; until then, this benchmark establishes whether compute differences are large
enough to justify that work.
