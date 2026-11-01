"""Shared lightweight ONNX text embedder used by every execution tier."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable

import numpy as np
import onnxruntime as ort
from huggingface_hub import hf_hub_download
from transformers import AutoTokenizer


MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"
MODEL_REVISION = "1110a243fdf4706b3f48f1d95db1a4f5529b4d41"
MODEL_FILE = "onnx/model.onnx"
MAX_TOKENS = 256
DEFAULT_INFERENCE_BATCH_SIZE = 32


class OnnxEmbedder:
    """Load the pinned model and produce normalized 384-dimensional embeddings."""

    def __init__(self, cache_dir: str | Path | None = None, threads: int | None = None) -> None:
        resolved_cache = Path(cache_dir or os.environ.get("HF_HOME", ".model-cache"))
        resolved_cache.mkdir(parents=True, exist_ok=True)
        model_path = hf_hub_download(
            repo_id=MODEL_ID,
            filename=MODEL_FILE,
            revision=MODEL_REVISION,
            cache_dir=str(resolved_cache),
        )
        self.tokenizer = AutoTokenizer.from_pretrained(
            MODEL_ID,
            revision=MODEL_REVISION,
            cache_dir=str(resolved_cache),
        )
        options = ort.SessionOptions()
        if threads is not None:
            options.intra_op_num_threads = max(1, threads)
            options.inter_op_num_threads = 1
        options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.session = ort.InferenceSession(
            model_path,
            sess_options=options,
            providers=["CPUExecutionProvider"],
        )
        self.input_names = {item.name for item in self.session.get_inputs()}
        self.output_name = self.session.get_outputs()[0].name
        self.dimensions = int(self.session.get_outputs()[0].shape[-1])
        self.batch_size = max(
            1,
            int(os.environ.get("PRIVACYDRIVE_BATCH_SIZE", DEFAULT_INFERENCE_BATCH_SIZE)),
        )

    def embed(self, passages: Iterable[str]) -> np.ndarray:
        values = list(passages)
        if not values:
            return np.empty((0, self.dimensions), dtype=np.float32)
        vectors: list[np.ndarray] = []
        for start in range(0, len(values), self.batch_size):
            batch = values[start : start + self.batch_size]
            encoded = self.tokenizer(
                batch,
                padding=True,
                truncation=True,
                max_length=MAX_TOKENS,
                return_tensors="np",
            )
            inputs = {
                name: np.asarray(encoded[name], dtype=np.int64)
                for name in self.input_names
                if name in encoded
            }
            token_embeddings = self.session.run([self.output_name], inputs)[0]
            attention_mask = np.asarray(encoded["attention_mask"], dtype=np.float32)[..., None]
            pooled = (token_embeddings * attention_mask).sum(axis=1) / np.clip(
                attention_mask.sum(axis=1), 1e-9, None
            )
            norms = np.linalg.norm(pooled, axis=1, keepdims=True)
            vectors.append((pooled / np.clip(norms, 1e-12, None)).astype(np.float32))
        return np.concatenate(vectors, axis=0)

