#!/usr/bin/env python3
"""Compare reference embeddings exported by two execution tiers."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("left", type=Path)
    parser.add_argument("right", type=Path)
    parser.add_argument("--minimum-cosine", type=float, default=0.9999)
    args = parser.parse_args()

    left_data = json.loads(args.left.read_text(encoding="utf-8"))
    right_data = json.loads(args.right.read_text(encoding="utf-8"))
    if left_data["model_revision"] != right_data["model_revision"]:
        raise SystemExit("Model revisions do not match")

    left = np.asarray(left_data["vector"], dtype=np.float64)
    right = np.asarray(right_data["vector"], dtype=np.float64)
    if left.shape != right.shape:
        raise SystemExit(f"Vector shapes differ: {left.shape} vs {right.shape}")

    cosine = float(np.dot(left, right) / (np.linalg.norm(left) * np.linalg.norm(right)))
    maximum_absolute_difference = float(np.max(np.abs(left - right)))
    passed = cosine >= args.minimum_cosine
    print(f"cosine_similarity={cosine:.10f}")
    print(f"max_absolute_difference={maximum_absolute_difference:.10g}")
    print(f"threshold={args.minimum_cosine:.10f}")
    print(f"result={'PASS' if passed else 'FAIL'}")
    if not passed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
