"""Lightweight public gateway for PrivacyDrive.

Designed to run on the Azure cloud VM with a minimal memory footprint.
Does NOT import numpy, onnxruntime, transformers, or torch.
Enforces hard privacy policy, reclassifies inputs, checks worker health,
and proxies permitted requests without persisting document content. A small SQLite
database stores accounts and hashed sessions only.
"""

from __future__ import annotations

import asyncio
import os
import time
import uuid
from collections import defaultdict
from pathlib import Path
from typing import Any, Literal

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .auth import AuthService
from .classifier import PrivacyClassifier


ROOT = Path(__file__).resolve().parents[1]
EDGE_URL = os.environ.get("PRIVACYDRIVE_EDGE_URL", "http://127.0.0.1:18001")
CLOUD_URL = os.environ.get("PRIVACYDRIVE_CLOUD_URL", "http://127.0.0.1:8001")
AUTH_DATABASE_PATH = Path(
    os.environ.get("PRIVACYDRIVE_AUTH_DATABASE", ROOT / "data" / "privacydrive-auth.db")
)
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "PRIVACYDRIVE_ALLOWED_ORIGINS",
        "https://privacy-aware-task-offloading.vercel.app,http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000",
    ).split(",")
    if origin.strip()
]

# Simple in-memory rate limiter: max requests per minute per IP
RATE_LIMIT_MAX = int(os.environ.get("PRIVACYDRIVE_RATE_LIMIT", "60"))
RATE_LIMIT_WINDOW = 60.0
_request_records: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(client_ip: str) -> None:
    now = time.time()
    history = _request_records[client_ip]
    # Prune timestamps older than window
    while history and history[0] < now - RATE_LIMIT_WINDOW:
        history.pop(0)
    if len(history) >= RATE_LIMIT_MAX:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Maximum {RATE_LIMIT_MAX} requests per minute.",
        )
    history.append(now)


class BrowserSummaryRequest(BaseModel):
    document_id: str = Field(min_length=1, max_length=100)
    document_name: str = Field(min_length=1, max_length=160)
    content: str = Field(min_length=1, max_length=1_000_000)
    selected_tier: Literal["edge", "cloud"]
    reported_sensitivity: str
    sentence_count: int = Field(default=3, ge=1, le=10, deprecated=True, description="Legacy field; structured summaries use word_budget.")
    word_budget: int = Field(default=180, ge=20, le=500)


classifier = PrivacyClassifier()
auth = AuthService(AUTH_DATABASE_PATH)
app = FastAPI(title="PrivacyDrive Public Gateway", version="1.0.0")
app.include_router(auth.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if "*" not in ALLOWED_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


async def check_worker_health(tier: str, url: str) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(f"{url}/health")
            response.raise_for_status()
            payload = response.json()
        return {
            "tier": tier,
            "available": True,
            "ready": bool(payload.get("ready")),
            "queue_depth": int(payload.get("queue_depth", 0)),
            "detail": payload.get("state", "ready"),
        }
    except Exception:
        return {
            "tier": tier,
            "available": False,
            "ready": False,
            "queue_depth": 0,
            "detail": "Worker offline or tunnel unavailable",
        }


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "privacydrive-public-gateway"}


@app.get("/api/status")
async def status() -> dict[str, Any]:
    cloud_state, edge_state = await asyncio.gather(
        check_worker_health("cloud", CLOUD_URL),
        check_worker_health("edge", EDGE_URL),
    )
    return {
        "workers": {
            "local": {
                "tier": "local",
                "available": True,
                "ready": True,
                "queue_depth": 0,
                "detail": "Browser ready",
            },
            "edge": edge_state,
            "cloud": cloud_state,
        }
    }


@app.post("/api/browser/summarize")
async def browser_summarize(
    request: BrowserSummaryRequest,
    req: Request,
    _user: dict[str, Any] = Depends(auth.require_user),
) -> dict[str, Any]:
    client_ip = req.client.host if req.client else "unknown"
    check_rate_limit(client_ip)

    # 1. Independent privacy reclassification on the gateway
    verified = classifier.classify(request.content)
    if verified.sensitivity != request.reported_sensitivity:
        raise HTTPException(
            status_code=409,
            detail="Browser and gateway privacy labels differ; task kept local.",
        )

    # 2. Hard destination policy enforcement
    if request.selected_tier not in verified.allowed_destinations:
        raise HTTPException(
            status_code=403,
            detail=f"Privacy policy blocks {request.selected_tier} for {verified.sensitivity} data.",
        )

    # 3. Check worker availability
    target_url = EDGE_URL if request.selected_tier == "edge" else CLOUD_URL
    worker_health = await check_worker_health(request.selected_tier, target_url)
    if not worker_health["available"] or not worker_health["ready"]:
        raise HTTPException(
            status_code=503,
            detail=f"{request.selected_tier.title()} worker is unavailable",
        )

    # 4. Proxy summarization to the target worker without persisting the content
    task_id = str(uuid.uuid4())
    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{target_url}/summarize",
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

