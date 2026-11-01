"""Identical HTTP embedding worker deployed at local, edge, and cloud tiers."""

from __future__ import annotations

import asyncio
import hashlib
import os
import platform
import socket
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .embedding_onnx import MODEL_ID, MODEL_REVISION, OnnxEmbedder
from .summarizer import split_sentences, summarize_extractively, summarize_semantically


class EmbedRequest(BaseModel):
    task_id: str = Field(min_length=1, max_length=100)
    document_id: str = Field(min_length=1, max_length=100)
    passages: list[str] = Field(min_length=1, max_length=512)
    privacy_label: str
    policy_version: str


class SummarizeRequest(BaseModel):
    task_id: str = Field(min_length=1, max_length=100)
    document_id: str = Field(min_length=1, max_length=100)
    content: str = Field(min_length=1, max_length=1_000_000)
    sentence_count: int = Field(default=3, ge=1, le=10)
    privacy_label: str
    policy_version: str


class WorkerRuntime:
    def __init__(self) -> None:
        self.tier = os.environ.get("PRIVACYDRIVE_TIER", "local")
        self.worker_id = os.environ.get(
            "PRIVACYDRIVE_WORKER_ID", f"{self.tier}-{socket.gethostname()}"
        )
        self.cache_dir = os.environ.get("HF_HOME", ".model-cache")
        self.threads = int(os.environ.get("PRIVACYDRIVE_THREADS", "1"))
        self.embedder: OnnxEmbedder | None = None
        self.state = "loading_model"
        self.queue_depth = 0
        self.semaphore = asyncio.Semaphore(1)
        self.started_at = time.time()

    def load(self) -> None:
        self.embedder = OnnxEmbedder(cache_dir=self.cache_dir, threads=self.threads)
        self.state = "ready"


runtime = WorkerRuntime()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await asyncio.to_thread(runtime.load)
    yield


app = FastAPI(title="PrivacyDrive Worker", version="1.0.0", lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "worker_id": runtime.worker_id,
        "tier": runtime.tier,
        "state": runtime.state,
        "ready": runtime.embedder is not None and runtime.state in {"ready", "busy"},
        "queue_depth": runtime.queue_depth,
        "model_id": MODEL_ID,
        "model_revision": MODEL_REVISION,
        "runtime": "onnxruntime",
        "inference_batch_size": runtime.embedder.batch_size if runtime.embedder else None,
        "platform": platform.platform(),
        "uptime_seconds": round(time.time() - runtime.started_at, 1),
    }


@app.post("/embed")
async def embed(request: EmbedRequest) -> dict[str, Any]:
    if runtime.embedder is None:
        raise HTTPException(status_code=503, detail="Model is not ready")
    runtime.queue_depth += 1
    try:
        async with runtime.semaphore:
            runtime.queue_depth -= 1
            runtime.state = "busy"
            started = time.perf_counter()
            vectors = await asyncio.to_thread(runtime.embedder.embed, request.passages)
            processing_ms = (time.perf_counter() - started) * 1000.0
            digest = hashlib.sha256(np.asarray(vectors, dtype=np.float32).tobytes()).hexdigest()
            return {
                "receipt_id": str(uuid.uuid4()),
                "task_id": request.task_id,
                "document_id": request.document_id,
                "worker_id": runtime.worker_id,
                "tier": runtime.tier,
                "processing_ms": round(processing_ms, 3),
                "passage_count": len(request.passages),
                "vector_dimensions": int(vectors.shape[1]),
                "output_digest": digest,
                "model_revision": MODEL_REVISION,
                "vectors": vectors.tolist(),
            }
    finally:
        runtime.state = "ready"
        if runtime.queue_depth < 0:
            runtime.queue_depth = 0


@app.post("/summarize")
async def summarize(request: SummarizeRequest) -> dict[str, Any]:
    runtime.queue_depth += 1
    try:
        async with runtime.semaphore:
            runtime.queue_depth -= 1
            runtime.state = "busy"
            started = time.perf_counter()
            sentences = split_sentences(request.content)[:48]
            if runtime.embedder is not None and len(sentences) > request.sentence_count:
                vectors = await asyncio.to_thread(runtime.embedder.embed, sentences)
                summary = summarize_semantically(request.content, vectors, request.sentence_count)
                operation = "minilm_mmr_summary"
            else:
                summary = summarize_extractively(request.content, request.sentence_count)
                operation = "frequency_fallback_summary"
            processing_ms = (time.perf_counter() - started) * 1000.0
            return {
                "receipt_id": str(uuid.uuid4()),
                "task_id": request.task_id,
                "document_id": request.document_id,
                "worker_id": runtime.worker_id,
                "tier": runtime.tier,
                "operation": operation,
                "processing_ms": round(processing_ms, 3),
                "input_characters": len(request.content),
                "sentence_count": request.sentence_count,
                "policy_version": request.policy_version,
                "summary": summary,
            }
    finally:
        runtime.state = "ready"
        if runtime.queue_depth < 0:
            runtime.queue_depth = 0

