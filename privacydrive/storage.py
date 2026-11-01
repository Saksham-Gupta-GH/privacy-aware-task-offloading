"""Local-only SQLite persistence for documents, embeddings, and sanitized receipts."""

from __future__ import annotations

import json
import sqlite3
import threading
import time
import uuid
from pathlib import Path
from typing import Any


class DocumentStore:
    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    content TEXT NOT NULL,
                    sensitivity TEXT NOT NULL,
                    classification_json TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    processed INTEGER NOT NULL DEFAULT 0,
                    selected_tier TEXT
                );
                CREATE TABLE IF NOT EXISTS embeddings (
                    document_id TEXT PRIMARY KEY,
                    vectors_json TEXT NOT NULL,
                    passages_json TEXT NOT NULL,
                    FOREIGN KEY(document_id) REFERENCES documents(id)
                );
                CREATE TABLE IF NOT EXISTS task_history (
                    id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL,
                    sensitivity TEXT NOT NULL,
                    selected_tier TEXT,
                    actual_latency_ms REAL,
                    policy_version TEXT NOT NULL,
                    scenario TEXT NOT NULL,
                    receipt_json TEXT,
                    decision_json TEXT NOT NULL,
                    created_at REAL NOT NULL
                );
                """
            )

    def add_document(self, name: str, content: str, classification: dict[str, Any]) -> dict[str, Any]:
        document_id = str(uuid.uuid4())
        created_at = time.time()
        with self.lock, self._connect() as connection:
            connection.execute(
                "INSERT INTO documents VALUES (?, ?, ?, ?, ?, ?, 0, NULL)",
                (
                    document_id,
                    name,
                    content,
                    classification["sensitivity"],
                    json.dumps(classification),
                    created_at,
                ),
            )
        return self.get_document(document_id)

    def list_documents(self) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT id, name, sensitivity, classification_json, created_at, processed, selected_tier "
                "FROM documents ORDER BY created_at DESC"
            ).fetchall()
        return [self._document_summary(row) for row in rows]

    def get_document(self, document_id: str) -> dict[str, Any]:
        with self._connect() as connection:
            row = connection.execute("SELECT * FROM documents WHERE id = ?", (document_id,)).fetchone()
        if row is None:
            raise KeyError(document_id)
        value = self._document_summary(row)
        value["content"] = row["content"]
        return value

    def save_processing(
        self,
        document_id: str,
        passages: list[str],
        vectors: list[list[float]],
        selected_tier: str,
    ) -> None:
        with self.lock, self._connect() as connection:
            connection.execute(
                "INSERT OR REPLACE INTO embeddings VALUES (?, ?, ?)",
                (document_id, json.dumps(vectors), json.dumps(passages)),
            )
            connection.execute(
                "UPDATE documents SET processed = 1, selected_tier = ? WHERE id = ?",
                (selected_tier, document_id),
            )

    def indexed_documents(self) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT d.id, d.name, d.sensitivity, e.vectors_json, e.passages_json "
                "FROM documents d JOIN embeddings e ON d.id = e.document_id"
            ).fetchall()
        return [
            {
                "id": row["id"],
                "name": row["name"],
                "sensitivity": row["sensitivity"],
                "vectors": json.loads(row["vectors_json"]),
                "passages": json.loads(row["passages_json"]),
            }
            for row in rows
        ]

    def add_history(self, record: dict[str, Any]) -> None:
        with self.lock, self._connect() as connection:
            connection.execute(
                "INSERT INTO task_history VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    record["id"],
                    record["document_id"],
                    record["sensitivity"],
                    record.get("selected_tier"),
                    record.get("actual_latency_ms"),
                    record["policy_version"],
                    record["scenario"],
                    json.dumps(record.get("receipt")),
                    json.dumps(record["decision"]),
                    record["created_at"],
                ),
            )

    def history(self, limit: int = 30) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM task_history ORDER BY created_at DESC LIMIT ?", (limit,)
            ).fetchall()
        return [
            {
                **dict(row),
                "receipt": json.loads(row["receipt_json"]) if row["receipt_json"] else None,
                "decision": json.loads(row["decision_json"]),
            }
            for row in rows
        ]

    @staticmethod
    def _document_summary(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "name": row["name"],
            "sensitivity": row["sensitivity"],
            "classification": json.loads(row["classification_json"]),
            "created_at": row["created_at"],
            "processed": bool(row["processed"]),
            "selected_tier": row["selected_tier"],
        }
