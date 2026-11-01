# Workload-validation results

## Status: production workload validated; idle crossover not observed

The pinned workload runs on the local client, trusted edge, and Azure worker. The
physical M1 is faster than the Ryzen edge at idle, so the project does **not** claim
that offloading always improves latency. Offloading is useful when a permitted remote
tier has resource availability that the client lacks, while privacy remains a hard
constraint. The dashboard, scheduler, database, worker API, local search, receipts,
and baseline comparison are implemented and tested.

## Local client candidate

- Role: mobile-client stand-in
- Hardware: Apple M1 MacBook Air, 8 CPU cores, 8 GB memory
- Operating system: macOS 14.4.1, arm64
- PyTorch threads used: 4
- Warm-up runs per case: 2
- Measured runs per case: 10
- Cached model-load time: 263.094 ms

| Case | Total passages | Median | Mean | p95 | Coefficient of variation |
|---|---:|---:|---:|---:|---:|
| small | 1 | 18.506 ms | 18.811 ms | 20.488 ms | 4.79% |
| long | 32 | 441.005 ms | 444.991 ms | 466.068 ms | 2.64% |
| batch | 512 | 7,343.942 ms | 7,348.078 ms | 7,576.884 ms | 1.95% |

All three cases satisfy the predeclared stability threshold of 15% coefficient of
variation. The first model download took roughly 36 seconds and is setup time, not a
cold-start measurement. The cached process load above is the relevant cold-load value.

The raw samples and processing fingerprint are in `results/local.json`.

## Preliminary interpretation

The workload spans roughly 18 ms to 7.3 seconds of local computation, so it is large
enough to test for a crossover. This does not establish that offloading wins: a remote
tier must still beat local by at least 15% in median end-to-end time for a heavier case
after inspection, transfer, queueing, processing, and result-return time are included.

## Trusted edge result

- Hardware: AMD Ryzen 5 5500U, 6 cores / 12 logical processors, 8 GB memory
- Operating system: Windows 11, x86-64
- Runtime: Python 3.12.4, PyTorch 2.8.0+cpu, 6 PyTorch threads
- Network: private personal hotspot; observed Mac-to-edge ping averaged about 8 ms
- Pre-run state: plugged in; 1.55 GB physical memory available
- Warm-up runs per case: 2
- Measured runs per case: 10
- Cached model-load time: 233.154 ms

| Case | M1 client median | Ryzen edge median | Edge/client ratio | Edge CV |
|---|---:|---:|---:|---:|
| small (1 passage) | 18.506 ms | 42.488 ms | 2.30× | 6.61% |
| long (32 passages) | 441.005 ms | 1,076.319 ms | 2.44× | 5.91% |
| batch (512 passages) | 7,343.942 ms | 17,614.587 ms | 2.40× | 11.26% |

All edge cases remain below the predeclared 15% variability limit. Compute-only edge
execution is slower for all current cases; network transfer cannot reverse that result.
This fixed workload therefore fails crossover criterion 3 on the physical M1 client.

The full reference vectors from M1 and edge have cosine similarity `1.0000000000`,
above the required `0.9999` threshold. Their maximum absolute component difference is
approximately `7.45e-08`, consistent with expected cross-platform floating-point noise.

## Production ONNX runtime

The application uses the same pinned `all-MiniLM-L6-v2` revision, tokenizer,
attention-mask-aware mean pooling, L2 normalization, and float32 output on every tier.
Local ONNX medians were 38.166 ms (1 passage), 919.003 ms (32), and 19,660.484 ms
(512). The worker output is 384 dimensions.

### Azure HTTP/tunnel measurement

The Standard_B2ats_v2 student VM has two burstable vCPUs and 1 GiB RAM while other
services remain active. A batch of 32 exceeded safe available memory. The production
worker therefore uses `PRIVACYDRIVE_BATCH_SIZE=1` plus a 360 MiB service limit. This is
a resource-aware configuration, not hidden hardware scaling.

| Case | Passages | Median worker processing | Median end-to-end |
|---|---:|---:|---:|
| Small | 1 | 76.286 ms | 518.674 ms |
| Medium | 32 | 2,389.966 ms | 3,912.631 ms |
| Heavy | 128 | 9,564.676 ms | 15,441.439 ms |

Each value is the median of three measured runs following one warm-up. End-to-end
includes JSON serialization, SSH tunnelling, transfer, and worker execution. Raw data
is in `results/cloud-http.json`. The worker stayed healthy through the memory-safe run.

The Windows production ONNX HTTP measurement remains to be repeated when the physical
edge laptop is on the same hotspot. Existing PyTorch edge results and cross-platform
vector-consistency checks are complete; the application correctly marks that tier
offline when it is absent.

## Emulated resource-constrained client result

The M1 was limited to one PyTorch CPU inference thread while all model and workload
settings remained unchanged. This profile is supplementary and does not replace the
physical four-thread M1 baseline.

| Case | Emulated client median | Ryzen edge median | Faster tier |
|---|---:|---:|---|
| small (1 passage) | 26.346 ms | 42.488 ms | emulated client |
| long (32 passages) | 815.899 ms | 1,076.319 ms | emulated client |
| batch (512 passages) | 13,897.054 ms | 17,614.587 ms | emulated client |

The edge remains approximately 23–38% slower even against the one-thread M1 profile.
No further CPU restriction will be introduced merely to force a crossover.

The earlier isolated PyTorch cloud profile reached roughly 533 MB RSS and could not
coexist reliably with the VM's other services. Replacing it with ONNX and streaming
batches made the cloud worker feasible without upgrading the student account.

## Optimizer sensitivity

The reproducible all-ready experiment shows an actual latency–energy trade-off. For
latency weights 0 through 0.75, three permitted tasks select edge and two restricted
tasks stay local (1,061.536 ms, 1.4711 J average). With latency weight 1.0, all five
select local (918.800 ms, 2.2970 J). Scaling power parameters by ±30% at weight 0.65
changes estimated energy to 1.0298–1.9125 J but does not change any placement. See
`results/scheduler-experiments.json`.
