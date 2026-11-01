#!/usr/bin/env python3
"""Export one full reference vector for cross-tier numerical consistency checks."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from transformers import AutoModel, AutoTokenizer

from benchmark_embeddings import MODEL_ID, MODEL_REVISION, embed
from workloads import DEFAULT_SEED, synthetic_passages


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, revision=MODEL_REVISION)
    model = AutoModel.from_pretrained(MODEL_ID, revision=MODEL_REVISION)
    model.eval()
    vector = embed(synthetic_passages(1, 1, DEFAULT_SEED), tokenizer, model)[0]

    result = {
        "model_id": MODEL_ID,
        "model_revision": MODEL_REVISION,
        "seed": DEFAULT_SEED,
        "dimensions": int(vector.shape[0]),
        "vector": [float(value) for value in vector],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()

