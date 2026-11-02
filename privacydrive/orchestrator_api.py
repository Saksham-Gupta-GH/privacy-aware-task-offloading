"""Local PrivacyDrive API: classify, optimize, dispatch, store, and search."""

from __future__ import annotations

import asyncio
import json
import os
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Literal, Optional

import httpx
import numpy as np
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .auth import AuthService
from .classifier import PrivacyClassifier
from .embedding_onnx import MODEL_REVISION, OnnxEmbedder
from .scheduler import PlacementOptimizer, WorkerState
from .storage import DocumentStore


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DATABASE_PATH = Path(os.environ.get("PRIVACYDRIVE_DATABASE", DATA_DIR / "privacydrive.db"))
AUTH_DATABASE_PATH = Path(
    os.environ.get("PRIVACYDRIVE_AUTH_DATABASE", DATA_DIR / "privacydrive-auth.db")
)
EDGE_URL = os.environ.get("PRIVACYDRIVE_EDGE_URL", "http://127.0.0.1:18001")
CLOUD_URL = os.environ.get("PRIVACYDRIVE_CLOUD_URL", "http://127.0.0.1:18002")
FRONTEND_DIST = ROOT / "frontend" / "dist"


class DocumentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    content: str = Field(min_length=1, max_length=1_000_000)


class ProcessOptions(BaseModel):
    latency_weight: float = Field(default=0.65, ge=0.0, le=1.0)
    deadline_ms: Optional[float] = Field(default=None, gt=0)
    scenario: str = "live"
    workload_profile: str = "actual"


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    limit: int = Field(default=5, ge=1, le=20)


class BrowserSummaryRequest(BaseModel):
    document_id: str = Field(min_length=1, max_length=100)
    document_name: str = Field(min_length=1, max_length=160)
    content: str = Field(min_length=1, max_length=1_000_000)
    selected_tier: Literal["edge", "cloud"]
    reported_sensitivity: str
    sentence_count: int = Field(default=3, ge=1, le=10, deprecated=True, description="Legacy field; structured summaries use word_budget.")
    word_budget: int = Field(default=180, ge=20, le=500)


classifier = PrivacyClassifier()
optimizer = PlacementOptimizer()
store = DocumentStore(DATABASE_PATH)
auth = AuthService(AUTH_DATABASE_PATH)
local_embedder: OnnxEmbedder | None = None


def split_passages(content: str) -> list[str]:
    paragraphs = [value.strip() for value in content.split("\n\n") if value.strip()]
    if not paragraphs:
        return [content.strip()]
    passages: list[str] = []
    for paragraph in paragraphs:
        words = paragraph.split()
        for start in range(0, len(words), 150):
            passages.append(" ".join(words[start : start + 150]))
    return passages or [content.strip()]


def apply_workload_profile(passages: list[str], profile: str) -> tuple[list[str], bool]:
    targets = {"actual": len(passages), "demo_medium": 32, "demo_heavy": 128}
    if profile not in targets or profile == "actual" or len(passages) >= targets[profile]:
        return passages, False
    target = targets[profile]
    expanded = [passages[index % len(passages)] for index in range(target)]
    return expanded, True


async def remote_health(tier: str, url: str) -> WorkerState:
    try:
        async with httpx.AsyncClient(timeout=2.5) as client:
            response = await client.get(f"{url}/health")
            response.raise_for_status()
            payload = response.json()
        return WorkerState(
            tier=tier,
            available=True,
            ready=bool(payload.get("ready")),
            queue_depth=int(payload.get("queue_depth", 0)),
            detail=payload.get("state", "ready"),
        )
    except Exception:
        return WorkerState(
            tier=tier,
            available=False,
            ready=False,
            detail="Worker offline or tunnel unavailable",
        )


async def worker_states() -> dict[str, WorkerState]:
    edge, cloud = await asyncio.gather(
        remote_health("edge", EDGE_URL), remote_health("cloud", CLOUD_URL)
    )
    return {
        "local": WorkerState(
            tier="local",
            available=True,
            ready=local_embedder is not None,
            detail="ready" if local_embedder is not None else "loading model",
        ),
        "edge": edge,
        "cloud": cloud,
    }


def seed_documents() -> None:
    if store.list_documents():
        return
    samples = [
        "public_event.txt",
        "public_contact.txt",
        "personal_contacts.txt",
        "restricted_payment.txt",
        "restricted_health.txt",
    ]
    directory = DATA_DIR / "synthetic" / "documents"
    for filename in samples:
        content = (directory / filename).read_text(encoding="utf-8")
        store.add_document(filename, content, classifier.classify(content).to_dict())


@asynccontextmanager
async def lifespan(_: FastAPI):
    global local_embedder
    local_embedder = await asyncio.to_thread(
        OnnxEmbedder, ROOT / ".model-cache", int(os.environ.get("PRIVACYDRIVE_LOCAL_THREADS", "4"))
    )
    seed_documents()
    yield


app = FastAPI(title="PrivacyDrive", version="1.0.0", lifespan=lifespan)
app.include_router(auth.router)
configured_origins = [
    value.strip()
    for value in os.environ.get("PRIVACYDRIVE_CORS_ORIGINS", "").split(",")
    if value.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        *configured_origins,
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/status")
async def status() -> dict[str, Any]:
    states = await worker_states()
    return {
        "project": "PrivacyDrive",
        "policy_version": classifier.policy["version"],
        "calibration_version": optimizer.calibration["version"],
        "model_revision": MODEL_REVISION,
        "workers": {tier: state.__dict__ for tier, state in states.items()},
    }


@app.get("/api/documents")
async def documents() -> list[dict[str, Any]]:
    return store.list_documents()


@app.post("/api/documents")
async def add_document(request: DocumentCreate) -> dict[str, Any]:
    result = classifier.classify(request.content)
    return store.add_document(request.name, request.content, result.to_dict())


@app.get("/api/documents/{document_id}")
async def get_document(document_id: str) -> dict[str, Any]:
    try:
        return store.get_document(document_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Document not found") from error


@app.post("/api/documents/{document_id}/process")
async def process_document(document_id: str, options: ProcessOptions) -> dict[str, Any]:
    global local_embedder
    try:
        document = store.get_document(document_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Document not found") from error
    classification = document["classification"]
    passages, simulated_workload = apply_workload_profile(
        split_passages(document["content"]), options.workload_profile
    )
    states = await worker_states()
    decision = optimizer.decide(
        allowed_destinations=classification["allowed_destinations"],
        worker_states=states,
        input_bytes=len(document["content"].encode("utf-8")),
        passage_count=len(passages),
        latency_weight=options.latency_weight,
        deadline_ms=options.deadline_ms,
        scenario=options.scenario,
    )
    task_id = str(uuid.uuid4())
    history_id = str(uuid.uuid4())
    started = time.perf_counter()
    receipt: dict[str, Any] | None = None
    if decision.selected_tier is not None:
        if decision.selected_tier == "local":
            if local_embedder is None:
                raise HTTPException(status_code=503, detail="Local model is not ready")
            vectors = await asyncio.to_thread(local_embedder.embed, passages)
            processing_ms = (time.perf_counter() - started) * 1000.0
            receipt = {
                "receipt_id": str(uuid.uuid4()),
                "task_id": task_id,
                "document_id": document_id,
                "worker_id": "local-m1-client",
                "tier": "local",
                "processing_ms": round(processing_ms, 3),
                "passage_count": len(passages),
                "vector_dimensions": int(vectors.shape[1]),
                "model_revision": MODEL_REVISION,
                "vectors": vectors.tolist(),
            }
        else:
            target = EDGE_URL if decision.selected_tier == "edge" else CLOUD_URL
            try:
                async with httpx.AsyncClient(timeout=180.0) as client:
                    response = await client.post(
                        f"{target}/embed",
                        json={
                            "task_id": task_id,
                            "document_id": document_id,
                            "passages": passages,
                            "privacy_label": classification["sensitivity"],
                            "policy_version": classification["policy_version"],
                        },
                    )
                    response.raise_for_status()
                    receipt = response.json()
            except Exception as error:
                raise HTTPException(
                    status_code=502,
                    detail=f"Selected {decision.selected_tier} worker failed during execution",
                ) from error
        assert receipt is not None
        vectors = receipt.pop("vectors")
        store.save_processing(document_id, passages, vectors, decision.selected_tier)

    actual_latency_ms = (time.perf_counter() - started) * 1000.0
    record = {
        "id": history_id,
        "document_id": document_id,
        "sensitivity": classification["sensitivity"],
        "selected_tier": decision.selected_tier,
        "actual_latency_ms": round(actual_latency_ms, 3) if receipt else None,
        "policy_version": classification["policy_version"],
        "scenario": options.scenario,
        "receipt": receipt,
        "decision": decision.to_dict(),
        "created_at": time.time(),
    }
    store.add_history(record)
    return {
        "document": {key: value for key, value in document.items() if key != "content"},
        "decision": decision.to_dict(),
        "receipt": receipt,
        "actual_latency_ms": record["actual_latency_ms"],
        "passage_count": len(passages),
        "simulated_workload": simulated_workload,
        "workload_profile": options.workload_profile,
    }


@app.post("/api/search")
async def search(request: SearchRequest) -> dict[str, Any]:
    if local_embedder is None:
        raise HTTPException(status_code=503, detail="Local model is not ready")
    indexed = store.indexed_documents()
    query_vector = (await asyncio.to_thread(local_embedder.embed, [request.query]))[0]
    results: list[dict[str, Any]] = []
    for document in indexed:
        vectors = np.asarray(document["vectors"], dtype=np.float32)
        similarities = vectors @ query_vector
        best_index = int(np.argmax(similarities))
        results.append(
            {
                "id": document["id"],
                "name": document["name"],
                "sensitivity": document["sensitivity"],
                "score": round(float(similarities[best_index]), 4),
                "matching_passage": document["passages"][best_index][:240],
            }
        )
    results.sort(key=lambda item: item["score"], reverse=True)
    return {
        "query_processed_at": "local",
        "index_location": "local",
        "results": results[: request.limit],
    }


@app.post("/api/browser/summarize")
async def browser_summarize(
    request: BrowserSummaryRequest,
    _user: dict[str, Any] = Depends(auth.require_user),
) -> dict[str, Any]:
    """Recheck browser classification, then execute only on a permitted remote tier."""
    verified = classifier.classify(request.content)
    if verified.sensitivity != request.reported_sensitivity:
        raise HTTPException(
            status_code=409,
            detail="Browser and control-plane privacy labels differ; task kept local.",
        )
    if request.selected_tier not in verified.allowed_destinations:
        raise HTTPException(
            status_code=403,
            detail=f"Privacy policy blocks {request.selected_tier} for {verified.sensitivity} data.",
        )
    states = await worker_states()
    selected_state = states[request.selected_tier]
    if not selected_state.available or not selected_state.ready:
        raise HTTPException(status_code=503, detail=f"{request.selected_tier.title()} worker is unavailable")

    task_id = str(uuid.uuid4())
    target = EDGE_URL if request.selected_tier == "edge" else CLOUD_URL
    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{target}/summarize",
                json={
                    "task_id": task_id,
                    "document_id": request.document_id,
                    "content": request.content,
                    "sentence_count": request.sentence_count,
                    "word_budget": request.word_budget,
                    "privacy_label": verified.sensitivity,
                    "policy_version": verified.policy_version,
                },
            )
            response.raise_for_status()
            receipt = response.json()
    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"Selected {request.selected_tier} worker failed during summarization",
        ) from error
    summary = receipt.pop("summary")
    return {
        "summary": summary,
        "selected_tier": request.selected_tier,
        "verified_sensitivity": verified.sensitivity,
        "policy_version": verified.policy_version,
        "actual_latency_ms": round((time.perf_counter() - started) * 1000.0, 3),
        "receipt": receipt,
    }


@app.get("/api/history")
async def history() -> list[dict[str, Any]]:
    return store.history()


@app.get("/api/experiments")
async def experiments() -> dict[str, Any]:
    scenario = "client_busy"
    states = {
        tier: WorkerState(tier=tier, available=True, ready=True)
        for tier in ("local", "edge", "cloud")
    }
    documents = store.list_documents()
    methods = {
        "privacy_aware": {"latency": [], "energy": [], "violations": 0},
        "always_local": {"latency": [], "energy": [], "violations": 0},
        "always_cloud": {"latency": [], "energy": [], "violations": 0},
        "latency_only": {"latency": [], "energy": [], "violations": 0},
    }
    for document in documents:
        allowed = document["classification"]["allowed_destinations"]
        estimates = optimizer.decide(
            allowed_destinations=["local", "edge", "cloud"],
            worker_states=states,
            input_bytes=4096,
            passage_count=32,
            latency_weight=0.65,
            scenario=scenario,
        )
        by_tier = {item.tier: item for item in estimates.candidates if item.predicted_latency_ms}
        proposed = optimizer.decide(
            allowed_destinations=allowed,
            worker_states=states,
            input_bytes=4096,
            passage_count=32,
            latency_weight=0.65,
            scenario=scenario,
        )
        proposed_item = next((item for item in proposed.candidates if item.selected), None)
        selections = {
            "privacy_aware": proposed_item,
            "always_local": by_tier.get("local"),
            "always_cloud": by_tier.get("cloud"),
            "latency_only": min(
                by_tier.values(), key=lambda item: item.predicted_latency_ms or float("inf")
            ) if by_tier else None,
        }
        for method, item in selections.items():
            if item is None:
                continue
            methods[method]["latency"].append(item.predicted_latency_ms)
            methods[method]["energy"].append(item.estimated_device_energy_j)
            if item.tier not in allowed:
                methods[method]["violations"] += 1
    output = []
    for name, values in methods.items():
        count = len(values["latency"])
        output.append(
            {
                "method": name,
                "average_predicted_latency_ms": round(sum(values["latency"]) / count, 2) if count else None,
                "average_estimated_device_energy_j": round(sum(values["energy"]) / count, 4) if count else None,
                "policy_violations": values["violations"],
                "tasks": len(documents),
            }
        )
    return {
        "mode": "simulation using calibrated parameters + client-busy queue scenario",
        "scenario": scenario,
        "results": output,
    }


if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    async def frontend(path: str):
        requested = FRONTEND_DIST / path
        if path and requested.is_file():
            return FileResponse(requested)
        return FileResponse(FRONTEND_DIST / "index.html")
