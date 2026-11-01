#!/usr/bin/env python3
"""Benchmark the pinned PrivacyDrive embedding workload on one execution tier."""

from __future__ import annotations

import argparse
import json
import math
import platform
import statistics
import time
from pathlib import Path

import numpy as np
import torch
from transformers import AutoModel, AutoTokenizer

from workloads import CASES, DEFAULT_SEED, synthetic_passages


MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"
MODEL_REVISION = "1110a243fdf4706b3f48f1d95db1a4f5529b4d41"
MAX_TOKENS = 256
INFERENCE_BATCH_SIZE = 32
def mean_pool(model_output: object, attention_mask: torch.Tensor) -> torch.Tensor:
    token_embeddings = model_output[0]
    expanded_mask = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
    summed = torch.sum(token_embeddings * expanded_mask, dim=1)
    counts = torch.clamp(expanded_mask.sum(dim=1), min=1e-9)
    return summed / counts


def embed(
    passages: list[str], tokenizer: object, model: torch.nn.Module
) -> np.ndarray:
    vectors: list[torch.Tensor] = []
    with torch.inference_mode():
        for start in range(0, len(passages), INFERENCE_BATCH_SIZE):
            batch = passages[start : start + INFERENCE_BATCH_SIZE]
            encoded = tokenizer(
                batch,
                padding=True,
                truncation=True,
                max_length=MAX_TOKENS,
                return_tensors="pt",
            )
            output = model(**encoded)
            pooled = mean_pool(output, encoded["attention_mask"])
            vectors.append(torch.nn.functional.normalize(pooled, p=2, dim=1).cpu())
    return torch.cat(vectors, dim=0).numpy()


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
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--warmups", type=int, default=2)
    parser.add_argument("--runs", type=int, default=10)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument(
        "--torch-threads",
        type=int,
        help="Explicit CPU inference-thread limit for a documented emulation profile.",
    )
    args = parser.parse_args()

    if args.torch_threads is not None and args.torch_threads < 1:
        parser.error("--torch-threads must be at least 1")
    torch.set_num_threads(args.torch_threads or max(1, torch.get_num_threads()))

    load_started = time.perf_counter()
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, revision=MODEL_REVISION)
    model = AutoModel.from_pretrained(MODEL_ID, revision=MODEL_REVISION)
    model.eval()
    load_ms = (time.perf_counter() - load_started) * 1000

    results: dict[str, object] = {
        "schema_version": 1,
        "model": {
            "id": MODEL_ID,
            "revision": MODEL_REVISION,
            "max_tokens": MAX_TOKENS,
            "inference_batch_size": INFERENCE_BATCH_SIZE,
            "precision": "float32",
            "pooling": "attention-mask-aware mean pooling + L2 normalization",
        },
        "runtime": {
            "platform": platform.platform(),
            "machine": platform.machine(),
            "processor": platform.processor(),
            "python": platform.python_version(),
            "torch": torch.__version__,
            "transformers": __import__("transformers").__version__,
            "numpy": np.__version__,
            "torch_threads": torch.get_num_threads(),
        },
        "seed": args.seed,
        "warmups": args.warmups,
        "runs": args.runs,
        "cold_model_load_ms": round(load_ms, 3),
        "cases": {},
    }

    for case_name, (document_count, passages_per_document) in CASES.items():
        passages = synthetic_passages(document_count, passages_per_document, args.seed)
        for _ in range(args.warmups):
            embed(passages, tokenizer, model)

        elapsed_samples: list[float] = []
        reference_vectors: np.ndarray | None = None
        for _ in range(args.runs):
            started = time.perf_counter()
            vectors = embed(passages, tokenizer, model)
            elapsed_samples.append((time.perf_counter() - started) * 1000)
            if reference_vectors is None:
                reference_vectors = vectors

        assert reference_vectors is not None
        results["cases"][case_name] = {
            "documents": document_count,
            "passages_per_document": passages_per_document,
            "total_passages": len(passages),
            "vector_shape": list(reference_vectors.shape),
            "reference_vector_head": [round(float(v), 8) for v in reference_vectors[0, :8]],
            "samples_ms": [round(value, 3) for value in elapsed_samples],
            **summarize(elapsed_samples),
        }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
