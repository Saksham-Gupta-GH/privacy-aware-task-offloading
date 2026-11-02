"""Account authentication for PrivacyDrive without storing document content."""

from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
import sqlite3
import threading
import time
import uuid
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field, field_validator


SESSION_LIFETIME_SECONDS = 7 * 24 * 60 * 60


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def valid_name(cls, value: str) -> str:
        clean = " ".join(value.strip().split())
        if len(clean) < 2:
            raise ValueError("Enter your name")
        return clean

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", normalized):
            raise ValueError("Enter a valid email address")
        return normalized


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: str) -> str:
        return RegisterRequest.valid_email(value)


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii")


def _decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value.encode("ascii"))


def _hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=16384, r=8, p=1, dklen=64)
    return f"scrypt$16384$8$1${_encode(salt)}${_encode(digest)}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, n, r, p, salt, expected = stored.split("$", 5)
        if algorithm != "scrypt":
            return False
        actual = hashlib.scrypt(
            password.encode("utf-8"),
            salt=_decode(salt),
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(_decode(expected)),
        )
        return hmac.compare_digest(actual, _decode(expected))
    except (ValueError, TypeError):
        return False


def _token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


DUMMY_PASSWORD_HASH = _hash_password("privacydrive-invalid-password")


class AuthStore:
    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'user',
                    status TEXT NOT NULL DEFAULT 'active',
                    created_at REAL NOT NULL,
                    last_login_at REAL
                );
                CREATE TABLE IF NOT EXISTS sessions (
                    token_hash TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    expires_at REAL NOT NULL,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id);
                CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at);
                """
            )

    @staticmethod
    def _public_user(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "role": row["role"],
            "created_at": row["created_at"],
        }

    def register(self, name: str, email: str, password: str) -> dict[str, Any]:
        user_id = str(uuid.uuid4())
        normalized_email = email.strip().lower()
        clean_name = " ".join(name.strip().split())
        now = time.time()
        try:
            with self.lock, self._connect() as connection:
                connection.execute(
                    "INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
                    (user_id, clean_name, normalized_email, _hash_password(password), now),
                )
                row = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        except sqlite3.IntegrityError as error:
            raise ValueError("An account with this email already exists") from error
        assert row is not None
        return self._public_user(row)

    def authenticate(self, email: str, password: str) -> dict[str, Any] | None:
        normalized_email = email.strip().lower()
        with self.lock, self._connect() as connection:
            row = connection.execute("SELECT * FROM users WHERE email = ?", (normalized_email,)).fetchone()
            password_hash = row["password_hash"] if row is not None else DUMMY_PASSWORD_HASH
            password_matches = _verify_password(password, password_hash)
            if row is None or row["status"] != "active" or not password_matches:
                return None
            connection.execute("UPDATE users SET last_login_at = ? WHERE id = ?", (time.time(), row["id"]))
        return self._public_user(row)

    def create_session(self, user_id: str) -> str:
        token = secrets.token_urlsafe(48)
        now = time.time()
        with self.lock, self._connect() as connection:
            connection.execute("DELETE FROM sessions WHERE expires_at <= ?", (now,))
            connection.execute(
                "INSERT INTO sessions VALUES (?, ?, ?, ?)",
                (_token_digest(token), user_id, now, now + SESSION_LIFETIME_SECONDS),
            )
        return token

    def user_for_token(self, token: str) -> dict[str, Any] | None:
        now = time.time()
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT users.* FROM sessions
                JOIN users ON users.id = sessions.user_id
                WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND users.status = 'active'
                """,
                (_token_digest(token), now),
            ).fetchone()
        return self._public_user(row) if row is not None else None

    def delete_session(self, token: str) -> None:
        with self.lock, self._connect() as connection:
            connection.execute("DELETE FROM sessions WHERE token_hash = ?", (_token_digest(token),))


class AuthService:
    def __init__(self, database_path: str | Path) -> None:
        self.store = AuthStore(database_path)
        self.router = APIRouter(prefix="/api/auth", tags=["authentication"])
        self.router.add_api_route("/register", self.register, methods=["POST"], status_code=201)
        self.router.add_api_route("/login", self.login, methods=["POST"])
        self.router.add_api_route("/me", self.me, methods=["GET"])
        self.router.add_api_route("/logout", self.logout, methods=["POST"], status_code=204)

    @staticmethod
    def _bearer_token(authorization: str | None) -> str:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in required")
        token = authorization.removeprefix("Bearer ").strip()
        if not token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in required")
        return token

    async def require_user(
        self,
        authorization: Annotated[str | None, Header()] = None,
    ) -> dict[str, Any]:
        token = self._bearer_token(authorization)
        user = self.store.user_for_token(token)
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
        return user

    async def register(self, request: RegisterRequest) -> dict[str, Any]:
        try:
            user = self.store.register(request.name, request.email, request.password)
        except ValueError as error:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
        token = self.store.create_session(user["id"])
        return {"token": token, "user": user}

    async def login(self, request: LoginRequest) -> dict[str, Any]:
        user = self.store.authenticate(request.email, request.password)
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
        token = self.store.create_session(user["id"])
        return {"token": token, "user": user}

    async def me(
        self,
        authorization: Annotated[str | None, Header()] = None,
    ) -> dict[str, Any]:
        return await self.require_user(authorization)

    async def logout(
        self,
        authorization: Annotated[str | None, Header()] = None,
    ) -> None:
        token = self._bearer_token(authorization)
        self.store.delete_session(token)

