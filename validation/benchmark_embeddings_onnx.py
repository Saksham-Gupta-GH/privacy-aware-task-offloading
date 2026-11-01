#!/usr/bin/env python3
"""Benchmark the production ONNX embedder on one execution tier."""

from __future__ import annotations

import argparse
import json
import math
import os
import platform
import statistics
import sys
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from privacydrive.embedding_onnx import (  # noqa: E402
    DEFAULT_INFERENCE_BATCH_SIZE,
    MAX_TOKENS,
    MODEL_FILE,
    MODEL_ID,
    MODEL_REVISION,
    OnnxEmbedder,
)
from validation.workloads import CASES, DEFAULT_SEED, synthetic_passages  # noqa: E402


def summarize(samples_ms: list[float]) -> dict[str, float]:
    mean = statistics.fmean(samples_ms)
    standard_deviation = statistics.stdev(samples_ms) if len(samples_ms) > 1 else 0.0
    ordered = sorted(samples_ms)
    p95_index = max(0, math.ceil(0.95 * len(ordered)) - 1)
    return {
        "mean_ms": round(mean, 3),
        "median_ms": round(statistics.median(samples_ms), 3),
        "p95_ms": round(ordered[p95_index], 3),
        "stdev_ms": round(standard_deviation, 3),
        "coefficient_of_variation": round(standard_deviation / mean, 4) if mean else 0.0,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--cache-dir", type=Path)
    parser.add_argument("--threads", type=int)
    parser.add_argument("--warmups", type=int, default=2)
    parser.add_argument("--runs", type=int, default=10)
    args = parser.parse_args()
    if args.threads is not None and args.threads < 1:
        parser.error("--threads must be at least 1")

    load_started = time.perf_counter()
    embedder = OnnxEmbedder(cache_dir=args.cache_dir, threads=args.threads)
    load_ms = (time.perf_counter() - load_started) * 1000
    results: dict[str, object] = {
        "schema_version": 1,
        "runtime_name": "onnxruntime",
        "model": {
            "id": MODEL_ID,
            "revision": MODEL_REVISION,
            "file": MODEL_FILE,
            "max_tokens": MAX_TOKENS,
            "inference_batch_size": int(
                os.environ.get("PRIVACYDRIVE_BATCH_SIZE", DEFAULT_INFERENCE_BATCH_SIZE)
            ),
            "precision": "float32",
            "pooling": "attention-mask-aware mean pooling + L2 normalization",
        },
        "runtime": {
            "platform": platform.platform(),
            "machine": platform.machine(),
            "processor": platform.processor(),
            "python": platform.python_version(),
            "onnxruntime": ort.__version__,
            "numpy": np.__version__,
            "threads": args.threads,
        },
        "seed": DEFAULT_SEED,
        "warmups": args.warmups,
        "runs": args.runs,
        "cached_model_load_ms": round(load_ms, 3),
        "cases": {},
    }

    for case_name, (documents, passages_per_document) in CASES.items():
        passages = synthetic_passages(documents, passages_per_document, DEFAULT_SEED)
        for _ in range(args.warmups):
            embedder.embed(passages)
        samples: list[float] = []
        reference: np.ndarray | None = None
        for _ in range(args.runs):
            started = time.perf_counter()
            vectors = embedder.embed(passages)
            samples.append((time.perf_counter() - started) * 1000)
            if reference is None:
                reference = vectors
        assert reference is not None
        results["cases"][case_name] = {
            "documents": documents,
            "passages_per_document": passages_per_document,
            "total_passages": len(passages),
            "vector_shape": list(reference.shape),
            "reference_vector": [float(value) for value in reference[0]],
            "samples_ms": [round(value, 3) for value in samples],
            **summarize(samples),
        }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
