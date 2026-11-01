#!/usr/bin/env python3
"""Measure a live PrivacyDrive worker through its HTTP/tunnel boundary."""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
import uuid
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from validation.workloads import DEFAULT_SEED, synthetic_passages


CASES = {"small": 1, "medium": 32, "heavy": 128}


def summary(values: list[float]) -> dict[str, float]:
    return {
        "mean_ms": round(statistics.fmean(values), 3),
        "median_ms": round(statistics.median(values), 3),
        "min_ms": round(min(values), 3),
        "max_ms": round(max(values), 3),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--warmups", type=int, default=1)
    args = parser.parse_args()

    with httpx.Client(timeout=240.0) as client:
        health = client.get(f"{args.url}/health").json()
        result: dict[str, object] = {
            "schema_version": 1,
            "measurement": "HTTP end-to-end through configured network/tunnel",
            "worker": health,
            "seed": DEFAULT_SEED,
            "warmups": args.warmups,
            "runs": args.runs,
            "cases": {},
        }
        for name, count in CASES.items():
            passages = synthetic_passages(1, count, DEFAULT_SEED)

            def execute() -> tuple[float, dict[str, object]]:
                started = time.perf_counter()
                response = client.post(
                    f"{args.url}/embed",
                    json={
                        "task_id": str(uuid.uuid4()),
                        "document_id": f"benchmark-{name}",
                        "passages": passages,
                        "privacy_label": "public",
                        "policy_version": "privacy-policy-v1",
                    },
                )
                response.raise_for_status()
                payload = response.json()
                return (time.perf_counter() - started) * 1000.0, payload

            for _ in range(args.warmups):
                execute()
            end_to_end: list[float] = []
            processing: list[float] = []
            receipt: dict[str, object] = {}
            for _ in range(args.runs):
                elapsed, receipt = execute()
                end_to_end.append(elapsed)
                processing.append(float(receipt["processing_ms"]))
            result["cases"][name] = {
                "passages": count,
                "end_to_end_samples_ms": [round(value, 3) for value in end_to_end],
                "processing_samples_ms": processing,
                "end_to_end": summary(end_to_end),
                "worker_processing": summary(processing),
                "vector_dimensions": receipt["vector_dimensions"],
                "model_revision": receipt["model_revision"],
            }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
