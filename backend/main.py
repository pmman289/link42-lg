import asyncio
import hashlib
import json
import os
import ipaddress
import re
import secrets
import socket
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit

import httpx
from fastapi import Cookie, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.getenv("LG_DATA_DIR") or ROOT / "data")
CONFIG_DIR = Path(os.getenv("LG_CONFIG_DIR") or ROOT / "config")
DB_PATH = Path(os.getenv("LG_DB_PATH") or DATA_DIR / "looking-glass.sqlite3")
DIST_DIR = ROOT / "dist"
API_PATH = "/third-party-api/looking-glass/v1"
SESSION_COOKIE = "lg_admin_session"
QUERY_CLIENT_COOKIE = "lg_query_client"
SESSION_TTL_SECONDS = 60 * 60 * 12
COOKIE_SECURE_MODE = os.getenv("LG_COOKIE_SECURE", "auto").strip().lower()
NODE_CONCURRENCY_LIMIT = max(1, int(os.getenv("LG_NODE_CONCURRENCY_LIMIT", "2")))
MAX_REQUEST_BODY_BYTES = max(1024, int(os.getenv("LG_MAX_REQUEST_BODY_BYTES", str(1024 * 1024))))
API_ALLOWED_HOSTS = {
    host.strip().lower().rstrip(".")
    for host in os.getenv("LG_API_ALLOWED_HOSTS", "").split(",")
    if host.strip()
}
LOCAL_QUERY_DEADLINE_SECONDS = 90
TERMINAL_QUERY_STATUSES = {"succeeded", "failed", "expired", "cancelled"}
DOMAIN_RE = re.compile(
    r"^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$"
)
PROTOCOL_NAME_RE = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,63}$")
RESOURCE_ID_RE = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,127}$")
COOKIE_TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{20,128}$")


def load_admin_password() -> str:
    password = os.getenv("LG_ADMIN_PASSWORD")
    if password is None:
        raise RuntimeError("LG_ADMIN_PASSWORD is required and must be at least 12 characters")
    if len(password) < 12 or len(password) > 256 or len(set(password)) < 6:
        raise RuntimeError("LG_ADMIN_PASSWORD must be 12-256 characters and sufficiently varied")
    if password.lower() in {"link42", "password", "change-me", "changeme", "admin123456"}:
        raise RuntimeError("LG_ADMIN_PASSWORD must not be a common default password")
    return password


ADMIN_PASSWORD = load_admin_password()


class LoginBody(BaseModel):
    password: str = Field(min_length=1, max_length=256)


class SettingsBody(BaseModel):
    title: str = Field(default="Link42 Looking Glass", max_length=120)
    apiBase: str = Field(default="", max_length=2048)
    apiToken: str | None = Field(default=None, max_length=4096)
    clearApiToken: bool = False
    publicNodeRefs: list[str] = Field(default_factory=list, max_length=500)
    nodeOverrides: dict[str, dict[str, str]] = Field(default_factory=dict)
    publicProtocols: dict[str, list[str]] = Field(default_factory=dict)


class RouteLookupBody(BaseModel):
    ip: str

    @field_validator("ip")
    @classmethod
    def validate_ip(cls, value: str) -> str:
        try:
            return str(ipaddress.ip_address((value or "").strip()))
        except ValueError as exc:
            raise ValueError("ip must be a valid IPv4 or IPv6 address") from exc


class OriginAsRouteLookupBody(BaseModel):
    asn: int = Field(ge=1, le=4294967295)


class PingBody(BaseModel):
    target: str
    count: int = Field(default=4, ge=1, le=10)
    per_probe_timeout_seconds: int = Field(default=2, ge=1, le=10)

    @field_validator("target")
    @classmethod
    def validate_target(cls, value: str) -> str:
        return normalize_diagnostic_target(value)


class TracerouteBody(BaseModel):
    target: str
    max_hops: int = Field(default=30, ge=1, le=64)
    wait_seconds: int = Field(default=3, ge=1, le=10)
    queries: int = Field(default=3, ge=1, le=5)

    @field_validator("target")
    @classmethod
    def validate_target(cls, value: str) -> str:
        return normalize_diagnostic_target(value)


class ProtocolDetailBody(BaseModel):
    protocol_name: str

    @field_validator("protocol_name")
    @classmethod
    def validate_protocol_name(cls, value: str) -> str:
        return normalize_protocol_name(value)


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    return db


def init_db() -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with connect() as db:
        db.executescript(
            """
            create table if not exists settings (
              id integer primary key check (id = 1),
              title text not null,
              api_base text not null,
              api_token text not null,
              public_node_refs text not null,
              node_overrides text not null default '{}',
              public_protocols text not null default '{}'
            );
            create table if not exists sessions (
              session_id text primary key,
              created_at integer not null
            );
            drop table if exists query_owners;
            create table if not exists query_access (
              query_id text not null,
              owner_hash text not null,
              node_ref text not null,
              created_at integer not null,
              primary key (query_id, owner_hash)
            );
            create table if not exists query_slots (
              slot_id text primary key,
              node_ref text not null,
              query_id text,
              created_at integer not null,
              deadline_at integer not null,
              active integer not null
            );
            create table if not exists login_failures (
              client_hash text primary key,
              failures integer not null,
              window_started integer not null,
              blocked_until integer not null,
              updated_at integer not null
            );
            """
        )
        columns = {row["name"] for row in db.execute("pragma table_info(settings)").fetchall()}
        if "node_overrides" not in columns:
            db.execute("alter table settings add column node_overrides text not null default '{}'")
        if "public_protocols" not in columns:
            db.execute("alter table settings add column public_protocols text not null default '{}'")
        row = db.execute("select id from settings where id = 1").fetchone()
        if row is None:
            db.execute(
                "insert into settings (id, title, api_base, api_token, public_node_refs, node_overrides, public_protocols) values (1, ?, ?, ?, ?, ?, ?)",
                (
                    "Link42 Looking Glass",
                    os.getenv("LG_API_BASE") or "",
                    os.getenv("LG_API_TOKEN") or "",
                    "[]",
                    "{}",
                    "{}",
                ),
            )
        db.execute("delete from sessions where created_at < ?", (int(time.time()) - SESSION_TTL_SECONDS,))
        db.execute("delete from query_access where created_at < ?", (int(time.time()) - 60 * 60,))
        db.execute("delete from query_slots where active = 0 or deadline_at < ?", (int(time.time()),))
        db.execute("delete from login_failures where updated_at < ?", (int(time.time()) - 60 * 60 * 24,))


def get_settings() -> dict[str, Any]:
    with connect() as db:
        row = db.execute("select * from settings where id = 1").fetchone()
    refs = []
    overrides = {}
    protocols = {}
    try:
        refs = json.loads(row["public_node_refs"] or "[]")
    except json.JSONDecodeError:
        refs = []
    try:
        overrides = json.loads(row["node_overrides"] or "{}")
    except (KeyError, json.JSONDecodeError):
        overrides = {}
    try:
        protocols = json.loads(row["public_protocols"] or "{}")
    except (KeyError, json.JSONDecodeError):
        protocols = {}
    return {
        "title": row["title"],
        "apiBase": row["api_base"],
        "apiToken": row["api_token"],
        "publicNodeRefs": refs if isinstance(refs, list) else [],
        "nodeOverrides": overrides if isinstance(overrides, dict) else {},
        "publicProtocols": protocols if isinstance(protocols, dict) else {},
    }


def save_settings(settings: dict[str, Any]) -> None:
    with connect() as db:
        db.execute(
            """
            update settings
            set title = ?, api_base = ?, api_token = ?, public_node_refs = ?, node_overrides = ?, public_protocols = ?
            where id = 1
            """,
            (
                settings["title"],
                settings["apiBase"],
                settings["apiToken"],
                json.dumps(settings["publicNodeRefs"], ensure_ascii=False),
                json.dumps(settings["nodeOverrides"], ensure_ascii=False),
                json.dumps(settings["publicProtocols"], ensure_ascii=False),
            ),
        )


def normalize_api_base(value: str) -> str:
    trimmed = (value or "").strip().rstrip("/")
    if not trimmed:
        return ""
    parsed = urlsplit(trimmed)
    if parsed.scheme.lower() != "https":
        raise ValueError("API Base must use HTTPS")
    if not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("API Base must be an HTTPS origin without credentials, query, or fragment")
    try:
        port = parsed.port
    except ValueError as exc:
        raise ValueError("API Base has an invalid port") from exc
    host = parsed.hostname.encode("idna").decode("ascii").lower().rstrip(".")
    netloc = f"[{host}]" if ":" in host else host
    if port and port != 443:
        netloc = f"{netloc}:{port}"
    path = parsed.path.rstrip("/")
    if path and path != API_PATH:
        raise ValueError(f"API Base path must be empty or {API_PATH}")
    return urlunsplit(("https", netloc, API_PATH, "", ""))


def api_host_is_allowed(host: str) -> bool:
    if not API_ALLOWED_HOSTS:
        return True
    return any(
        host == pattern
        or (pattern.startswith("*.") and host.endswith(pattern[1:]) and host != pattern[2:])
        for pattern in API_ALLOWED_HOSTS
    )


async def validate_api_base(value: str, *, allow_empty: bool = False) -> str:
    try:
        normalized = normalize_api_base(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_api_base", "message": str(exc)},
        ) from exc
    if not normalized:
        if allow_empty:
            return ""
        raise HTTPException(status_code=409, detail={"code": "api_not_configured", "message": "Looking Glass API is not configured"})
    parsed = urlsplit(normalized)
    host = parsed.hostname or ""
    if not api_host_is_allowed(host):
        raise HTTPException(status_code=400, detail={"code": "api_host_not_allowed", "message": "API Base host is not trusted"})
    try:
        addresses = await asyncio.to_thread(socket.getaddrinfo, host, parsed.port or 443, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise HTTPException(status_code=400, detail={"code": "api_host_unresolvable", "message": "API Base host could not be resolved"}) from exc
    resolved = {item[4][0] for item in addresses}
    if not resolved or any(not ipaddress.ip_address(address).is_global for address in resolved):
        raise HTTPException(
            status_code=400,
            detail={"code": "unsafe_api_host", "message": "API Base must resolve only to public IP addresses"},
        )
    return normalized


def normalize_protocol_name(value: str) -> str:
    protocol_name = (value or "").strip()
    if PROTOCOL_NAME_RE.fullmatch(protocol_name):
        return protocol_name
    raise ValueError("protocol_name must use 1-64 characters: letters, numbers, _, ., :, -")


def normalize_diagnostic_target(value: str) -> str:
    target = (value or "").strip().rstrip(".")
    if not target or len(target) > 253:
        raise ValueError("target must be an IP address or hostname")
    try:
        return str(ipaddress.ip_address(target))
    except ValueError:
        pass
    if not DOMAIN_RE.fullmatch(target):
        raise ValueError("target must be an IP address or hostname")
    return target.lower()


def public_settings(settings: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": settings["title"],
        "configured": bool(settings["apiBase"] and settings["apiToken"]),
    }


def admin_settings(settings: dict[str, Any]) -> dict[str, Any]:
    token = settings["apiToken"]
    return {
        "title": settings["title"],
        "apiBase": settings["apiBase"],
        "configured": bool(settings["apiBase"] and token),
        "apiTokenSet": bool(token),
        "apiTokenPreview": f"{token[:10]}...{token[-4:]}" if len(token) > 14 else ("set" if token else ""),
        "publicNodeRefs": settings["publicNodeRefs"],
        "nodeOverrides": settings["nodeOverrides"],
        "publicProtocols": settings["publicProtocols"],
    }


def is_admin(session_id: str | None) -> bool:
    if not session_id:
        return False
    cutoff = int(time.time()) - SESSION_TTL_SECONDS
    with connect() as db:
        row = db.execute(
            "select created_at from sessions where session_id = ? and created_at >= ?",
            (session_id, cutoff),
        ).fetchone()
        if row is None:
            db.execute("delete from sessions where session_id = ?", (session_id,))
    return row is not None


def require_admin(session_id: str | None) -> None:
    if not is_admin(session_id):
        raise HTTPException(status_code=401, detail={"code": "not_authenticated", "message": "Admin login required"})


def use_secure_cookie(request: Request) -> bool:
    if COOKIE_SECURE_MODE in {"1", "true", "yes", "on"}:
        return True
    if COOKIE_SECURE_MODE in {"0", "false", "no", "off"}:
        return False
    return request.url.scheme == "https"


def set_private_cookie(response: Response, request: Request, name: str, value: str, max_age: int) -> None:
    response.set_cookie(
        name,
        value,
        httponly=True,
        samesite="lax",
        secure=use_secure_cookie(request),
        max_age=max_age,
        path="/",
    )


def client_hash(request: Request) -> str:
    host = request.client.host if request.client else "unknown"
    return hashlib.sha256(host.encode("utf-8")).hexdigest()


def query_owner_hash(client_id: str) -> str:
    return hashlib.sha256(client_id.encode("ascii")).hexdigest()


def get_or_create_query_client(client_id: str | None) -> tuple[str, bool]:
    if client_id and COOKIE_TOKEN_RE.fullmatch(client_id):
        return client_id, False
    return secrets.token_urlsafe(32), True


def validate_resource_id(value: str, kind: str) -> str:
    if RESOURCE_ID_RE.fullmatch(value or ""):
        return value
    raise HTTPException(status_code=400, detail={"code": f"invalid_{kind}", "message": f"Invalid {kind.replace('_', ' ')}"})


def login_retry_after(request: Request) -> int:
    now = int(time.time())
    key = client_hash(request)
    with connect() as db:
        row = db.execute(
            "select blocked_until from login_failures where client_hash = ?",
            (key,),
        ).fetchone()
    return max(0, int(row["blocked_until"]) - now) if row else 0


def record_login_failure(request: Request) -> int:
    now = int(time.time())
    key = client_hash(request)
    with connect() as db:
        db.execute("begin immediate")
        row = db.execute(
            "select failures, window_started from login_failures where client_hash = ?",
            (key,),
        ).fetchone()
        if row is None or int(row["window_started"]) < now - 15 * 60:
            failures = 1
            window_started = now
        else:
            failures = int(row["failures"]) + 1
            window_started = int(row["window_started"])
        delay = min(15 * 60, 60 * (2 ** min(failures - 5, 4))) if failures >= 5 else 0
        blocked_until = now + delay
        db.execute(
            """
            insert into login_failures (client_hash, failures, window_started, blocked_until, updated_at)
            values (?, ?, ?, ?, ?)
            on conflict(client_hash) do update set
              failures = excluded.failures,
              window_started = excluded.window_started,
              blocked_until = excluded.blocked_until,
              updated_at = excluded.updated_at
            """,
            (key, failures, window_started, blocked_until, now),
        )
    return delay


def clear_login_failures(request: Request) -> None:
    with connect() as db:
        db.execute("delete from login_failures where client_hash = ?", (client_hash(request),))


def clean_node_overrides(value: dict[str, dict[str, str]]) -> dict[str, dict[str, str]]:
    cleaned: dict[str, dict[str, str]] = {}
    for node_ref, raw_override in value.items():
        if not isinstance(raw_override, dict):
            continue
        name = str(raw_override.get("name", "")).strip()
        icon = str(raw_override.get("icon", "")).strip()
        next_override = {}
        if name:
            next_override["name"] = name[:80]
        if icon:
            next_override["icon"] = icon[:16]
        if next_override:
            cleaned[str(node_ref)] = next_override
    return cleaned


def clean_public_protocols(value: dict[str, list[str]]) -> dict[str, list[str]]:
    cleaned: dict[str, list[str]] = {}
    for node_ref, raw_names in value.items():
        if not isinstance(raw_names, list):
            continue
        names = []
        seen = set()
        for raw_name in raw_names:
            try:
                name = normalize_protocol_name(str(raw_name))
            except ValueError:
                continue
            if name not in seen:
                names.append(name)
                seen.add(name)
        if names:
            cleaned[str(node_ref)] = names
    return cleaned


def public_protocol_blacklist(settings: dict[str, Any], node_ref: str) -> set[str]:
    names = settings.get("publicProtocols", {}).get(node_ref, [])
    return {str(name) for name in names if isinstance(name, str)}


def filter_protocol_stdout(stdout: str, blocked_protocols: set[str]) -> str:
    if not stdout:
        return stdout
    lines = stdout.splitlines()
    filtered = []
    for line in lines:
        stripped = line.strip()
        first = stripped.split(None, 1)[0] if stripped else ""
        if not stripped or line.startswith("BIRD ") or first in {"Name", "bird>"}:
            filtered.append(line)
            continue
        if first not in blocked_protocols:
            filtered.append(line)
    return "\n".join(filtered) + ("\n" if stdout.endswith("\n") and filtered else "")


def sanitize_query_payload(payload: dict[str, Any], settings: dict[str, Any], admin: bool) -> dict[str, Any]:
    if admin:
        return payload
    operation = payload.get("operation")
    node_ref = str(payload.get("node_ref") or "")
    blocked = public_protocol_blacklist(settings, node_ref)
    if operation == "bird.protocol_detail":
        protocol_name = str((payload.get("request") or {}).get("protocol_name") or "")
        if protocol_name in blocked:
            raise HTTPException(status_code=404, detail={"code": "query_not_found", "message": "Query not found"})
    if operation == "bird.protocols":
        result = payload.get("result")
        if isinstance(result, dict) and isinstance(result.get("stdout"), str):
            payload = {**payload, "result": {**result, "stdout": filter_protocol_stdout(result["stdout"], blocked)}}
    return payload


def present_node(node: dict[str, Any], settings: dict[str, Any], admin: bool) -> dict[str, Any]:
    node_ref = str(node.get("node_ref", ""))
    override = settings["nodeOverrides"].get(node_ref, {})
    presented = dict(node)
    presented["raw_name"] = node.get("raw_name") or node.get("name") or node_ref
    if isinstance(override, dict):
        name = str(override.get("name", "")).strip()
        icon = str(override.get("icon", "")).strip()
        if name:
            presented["name"] = name
        if icon:
            presented["icon"] = icon
    if admin:
        return presented
    return {key: value for key, value in presented.items() if key != "ips"}


async def link42_request(path: str, *, method: str = "GET", json_body: Any = None) -> tuple[dict[str, Any], httpx.Response]:
    settings = get_settings()
    if not settings["apiBase"] or not settings["apiToken"]:
        raise HTTPException(status_code=409, detail={"code": "api_not_configured", "message": "Looking Glass API is not configured"})
    base = await validate_api_base(settings["apiBase"])
    async with httpx.AsyncClient(timeout=25.0) as client:
        response = await client.request(
            method,
            f"{base}{path}",
            headers={
                "Accept": "application/json",
                "Authorization": f"Bearer {settings['apiToken']}",
                **({"Content-Type": "application/json"} if json_body is not None else {}),
            },
            json=json_body,
        )
    try:
        payload = response.json()
    except ValueError:
        payload = {}
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=payload.get("error") or payload or {"message": response.text})
    return payload, response


def store_query_owner(query_id: str, node_ref: str, owner_hash: str) -> None:
    with connect() as db:
        db.execute("delete from query_access where created_at < ?", (int(time.time()) - 60 * 60,))
        db.execute(
            "insert or replace into query_access (query_id, owner_hash, node_ref, created_at) values (?, ?, ?, ?)",
            (query_id, owner_hash, node_ref, int(time.time())),
        )


def get_query_owner(query_id: str, owner_hash: str | None, admin: bool) -> str | None:
    with connect() as db:
        if admin:
            row = db.execute(
                "select node_ref from query_access where query_id = ? order by created_at desc limit 1",
                (query_id,),
            ).fetchone()
        elif owner_hash:
            row = db.execute(
                "select node_ref from query_access where query_id = ? and owner_hash = ?",
                (query_id, owner_hash),
            ).fetchone()
        else:
            row = None
    return row["node_ref"] if row else None


def cleanup_query_slots(db: sqlite3.Connection) -> None:
    db.execute("delete from query_slots where active = 0 or deadline_at < ?", (int(time.time()),))


def acquire_node_slot(node_ref: str) -> str:
    db = connect()
    try:
        db.execute("begin immediate")
        cleanup_query_slots(db)
        row = db.execute(
            "select count(*) as total from query_slots where node_ref = ? and active = 1",
            (node_ref,),
        ).fetchone()
        if int(row["total"] or 0) >= NODE_CONCURRENCY_LIMIT:
            db.rollback()
            raise HTTPException(
                status_code=429,
                detail={"code": "query_queue_full", "message": "Node query concurrency limit reached"},
            )
        slot_id = secrets.token_urlsafe(18)
        now = int(time.time())
        db.execute(
            "insert into query_slots (slot_id, node_ref, query_id, created_at, deadline_at, active) values (?, ?, null, ?, ?, 1)",
            (slot_id, node_ref, now, now + LOCAL_QUERY_DEADLINE_SECONDS),
        )
        db.commit()
        return slot_id
    except Exception:
        if db.in_transaction:
            db.rollback()
        raise
    finally:
        db.close()


def bind_node_slot(slot_id: str, query_id: str, deadline_at: int | None) -> None:
    deadline = deadline_at if deadline_at and deadline_at > int(time.time()) else int(time.time()) + LOCAL_QUERY_DEADLINE_SECONDS
    with connect() as db:
        db.execute(
            "update query_slots set query_id = ?, deadline_at = ? where slot_id = ?",
            (query_id, deadline, slot_id),
        )


def release_node_slot(slot_id: str) -> None:
    with connect() as db:
        db.execute("delete from query_slots where slot_id = ?", (slot_id,))


def release_query_slot(query_id: str) -> None:
    with connect() as db:
        db.execute("delete from query_slots where query_id = ?", (query_id,))


class RequestBodyLimitMiddleware:
    def __init__(self, app: Any, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = {key.lower(): value for key, value in scope.get("headers", [])}
        content_length = headers.get(b"content-length")
        if content_length:
            try:
                if int(content_length) < 0 or int(content_length) > self.max_bytes:
                    await self.reject(scope, receive, send)
                    return
            except ValueError:
                await self.reject(scope, receive, send)
                return

        messages = []
        received = 0
        while True:
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    await self.reject(scope, receive, send)
                    return
            messages.append(message)
            if message["type"] == "http.disconnect" or not message.get("more_body", False):
                break

        message_index = 0

        async def replay_receive() -> dict[str, Any]:
            nonlocal message_index
            if message_index < len(messages):
                message = messages[message_index]
                message_index += 1
                return message
            return {"type": "http.request", "body": b"", "more_body": False}

        await self.app(scope, replay_receive, send)

    @staticmethod
    async def reject(scope: dict[str, Any], receive: Any, send: Any) -> None:
        response = JSONResponse(
            status_code=413,
            content={"detail": {"code": "request_too_large", "message": "Request body is too large"}},
        )
        await response(scope, receive, send)


class FixedWindowRateLimiter:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.windows: dict[tuple[str, str], tuple[int, int]] = {}

    def check(self, scope: str, subject: str, limit: int, window_seconds: int = 60) -> int:
        now = int(time.time())
        window = now // window_seconds
        key = (scope, subject)
        with self.lock:
            previous_window, count = self.windows.get(key, (window, 0))
            if previous_window != window:
                count = 0
            count += 1
            self.windows[key] = (window, count)
            if len(self.windows) > 10000:
                self.windows = {
                    item_key: item_value
                    for item_key, item_value in self.windows.items()
                    if item_value[0] >= window - 1
                }
        return max(0, (window + 1) * window_seconds - now) if count > limit else 0


RATE_LIMITER = FixedWindowRateLimiter()


init_db()
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(RequestBodyLimitMiddleware, max_bytes=MAX_REQUEST_BODY_BYTES)


@app.middleware("http")
async def security_and_rate_limit(request: Request, call_next: Any):
    if request.url.path.startswith("/api/"):
        subject = client_hash(request)
        limits = [("api", 300)]
        if request.url.path == "/api/auth/login":
            limits.append(("login", 30))
        elif request.url.path == "/api/nodes":
            limits.append(("nodes", 60))
        elif request.url.path.startswith("/api/as/"):
            limits.append(("asn", 30))
        elif request.method == "POST" and request.url.path.startswith("/api/nodes/"):
            limits.append(("query-submit", 30))
        elif request.url.path.startswith("/api/queries/"):
            limits.append(("query-poll", 180))
        for scope, limit in limits:
            retry_after = RATE_LIMITER.check(scope, subject, limit)
            if retry_after:
                response = JSONResponse(
                    status_code=429,
                    content={"detail": {"code": "rate_limited", "message": "Too many requests"}},
                    headers={"Retry-After": str(retry_after)},
                )
                break
        else:
            response = await call_next(request)
    else:
        response = await call_next(request)

    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    response.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; "
        "base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    )
    if request.url.path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "no-store")
    if request.url.scheme == "https":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000")
    return response


@app.get("/api/session")
async def session(lg_admin_session: str | None = Cookie(default=None)):
    settings = get_settings()
    admin = is_admin(lg_admin_session)
    return {"isAdmin": admin, "settings": admin_settings(settings) if admin else public_settings(settings)}


@app.post("/api/auth/login")
async def login(body: LoginBody, request: Request, response: Response):
    retry_after = login_retry_after(request)
    if retry_after:
        raise HTTPException(
            status_code=429,
            detail={"code": "login_blocked", "message": "Too many failed login attempts"},
            headers={"Retry-After": str(retry_after)},
        )
    if not secrets.compare_digest(body.password.encode("utf-8"), ADMIN_PASSWORD.encode("utf-8")):
        retry_after = record_login_failure(request)
        if retry_after:
            raise HTTPException(
                status_code=429,
                detail={"code": "login_blocked", "message": "Too many failed login attempts"},
                headers={"Retry-After": str(retry_after)},
            )
        raise HTTPException(status_code=401, detail={"code": "invalid_password", "message": "Invalid password"})
    clear_login_failures(request)
    session_id = secrets.token_urlsafe(32)
    with connect() as db:
        db.execute("insert into sessions (session_id, created_at) values (?, ?)", (session_id, int(time.time())))
    set_private_cookie(response, request, SESSION_COOKIE, session_id, SESSION_TTL_SECONDS)
    return {"ok": True}


@app.post("/api/auth/logout")
async def logout(request: Request, response: Response, lg_admin_session: str | None = Cookie(default=None)):
    if lg_admin_session:
        with connect() as db:
            db.execute("delete from sessions where session_id = ?", (lg_admin_session,))
    response.delete_cookie(SESSION_COOKIE, path="/", secure=use_secure_cookie(request), httponly=True, samesite="lax")
    return {"ok": True}


@app.get("/api/admin/settings")
async def read_admin_settings(lg_admin_session: str | None = Cookie(default=None)):
    require_admin(lg_admin_session)
    return admin_settings(get_settings())


@app.put("/api/admin/settings")
async def update_admin_settings(body: SettingsBody, lg_admin_session: str | None = Cookie(default=None)):
    require_admin(lg_admin_session)
    current = get_settings()
    try:
        current_api_base = normalize_api_base(current["apiBase"])
    except ValueError:
        current_api_base = ""
    api_base = await validate_api_base(body.apiBase, allow_empty=True)
    if api_base and current_api_base and not API_ALLOWED_HOSTS:
        current_host = (urlsplit(current_api_base).hostname or "").lower()
        next_host = (urlsplit(api_base).hostname or "").lower()
        if next_host != current_host:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "api_host_not_allowed",
                    "message": "Changing the API host requires LG_API_ALLOWED_HOSTS to include the new host",
                },
            )
    source_changed = api_base != current_api_base
    token = ""
    if body.clearApiToken:
        token = ""
    elif body.apiToken:
        token = body.apiToken.strip()
    elif source_changed:
        token = ""
    else:
        token = current["apiToken"]
    next_settings = {
        "title": body.title.strip() or "Link42 Looking Glass",
        "apiBase": api_base,
        "apiToken": token,
        "publicNodeRefs": [str(ref) for ref in body.publicNodeRefs if RESOURCE_ID_RE.fullmatch(str(ref))],
        "nodeOverrides": clean_node_overrides(body.nodeOverrides),
        "publicProtocols": clean_public_protocols(body.publicProtocols),
    }
    save_settings(next_settings)
    return admin_settings(next_settings)


@app.get("/api/nodes")
async def nodes(limit: int = 100, lg_admin_session: str | None = Cookie(default=None)):
    payload, _ = await link42_request(f"/nodes?limit={max(1, min(limit, 500))}")
    settings = get_settings()
    admin = is_admin(lg_admin_session)
    items = payload.get("items") if isinstance(payload.get("items"), list) else []
    if not admin:
        items = [node for node in items if node.get("node_ref") in settings["publicNodeRefs"]]
    return {"items": [present_node(node, settings, admin) for node in items], "next_cursor": payload.get("next_cursor")}


async def submit_node_query(
    node_ref: str,
    upstream_path: str,
    json_body: dict[str, Any] | None,
    response: Response,
    lg_admin_session: str | None,
    query_client_id: str | None,
    request: Request,
):
    node_ref = validate_resource_id(node_ref, "node_ref")
    settings = get_settings()
    if not is_admin(lg_admin_session) and node_ref not in settings["publicNodeRefs"]:
        raise HTTPException(status_code=404, detail={"code": "node_not_found", "message": "Node not found"})
    slot_id = acquire_node_slot(node_ref)
    try:
        payload, upstream = await link42_request(f"/nodes/{node_ref}{upstream_path}", method="POST", json_body=json_body)
    except Exception:
        release_node_slot(slot_id)
        raise
    query_id = str(payload.get("query_id") or "")
    if query_id:
        if not RESOURCE_ID_RE.fullmatch(query_id):
            release_node_slot(slot_id)
            raise HTTPException(status_code=502, detail={"code": "invalid_upstream_response", "message": "Upstream returned an invalid query ID"})
        client_id, cookie_created = get_or_create_query_client(query_client_id)
        store_query_owner(query_id, node_ref, query_owner_hash(client_id))
        bind_node_slot(slot_id, query_id, payload.get("deadline_at"))
        if cookie_created:
            set_private_cookie(response, request, QUERY_CLIENT_COOKIE, client_id, 60 * 60 * 2)
    else:
        release_node_slot(slot_id)
    if upstream.headers.get("Retry-After"):
        response.headers["Retry-After"] = upstream.headers["Retry-After"]
    response.status_code = upstream.status_code
    return payload


@app.post("/api/nodes/{node_ref}/bird/routes:lookup")
async def route_lookup(node_ref: str, body: RouteLookupBody, request: Request, response: Response, lg_admin_session: str | None = Cookie(default=None), lg_query_client: str | None = Cookie(default=None)):
    return await submit_node_query(
        node_ref,
        "/bird/routes:lookup",
        {"ip": body.ip},
        response,
        lg_admin_session,
        lg_query_client,
        request,
    )


@app.post("/api/nodes/{node_ref}/bird/routes:lookup-origin-as")
async def route_lookup_origin_as(node_ref: str, body: OriginAsRouteLookupBody, request: Request, response: Response, lg_admin_session: str | None = Cookie(default=None), lg_query_client: str | None = Cookie(default=None)):
    return await submit_node_query(
        node_ref,
        "/bird/routes:lookup-origin-as",
        body.model_dump(),
        response,
        lg_admin_session,
        lg_query_client,
        request,
    )


@app.post("/api/nodes/{node_ref}/bird/protocols:lookup")
async def bird_protocols(node_ref: str, request: Request, response: Response, lg_admin_session: str | None = Cookie(default=None), lg_query_client: str | None = Cookie(default=None)):
    return await submit_node_query(
        node_ref,
        "/bird/protocols:lookup",
        None,
        response,
        lg_admin_session,
        lg_query_client,
        request,
    )


@app.post("/api/nodes/{node_ref}/bird/protocols:lookup-detail")
async def bird_protocol_detail(node_ref: str, body: ProtocolDetailBody, request: Request, response: Response, lg_admin_session: str | None = Cookie(default=None), lg_query_client: str | None = Cookie(default=None)):
    settings = get_settings()
    if not is_admin(lg_admin_session) and body.protocol_name in public_protocol_blacklist(settings, node_ref):
        raise HTTPException(status_code=404, detail={"code": "protocol_not_found", "message": "Protocol not found"})
    return await submit_node_query(
        node_ref,
        "/bird/protocols:lookup-detail",
        body.model_dump(),
        response,
        lg_admin_session,
        lg_query_client,
        request,
    )


@app.post("/api/nodes/{node_ref}/ping")
async def ping(node_ref: str, body: PingBody, request: Request, response: Response, lg_admin_session: str | None = Cookie(default=None), lg_query_client: str | None = Cookie(default=None)):
    return await submit_node_query(
        node_ref,
        "/ping",
        body.model_dump(),
        response,
        lg_admin_session,
        lg_query_client,
        request,
    )


@app.post("/api/nodes/{node_ref}/traceroute")
async def traceroute(node_ref: str, body: TracerouteBody, request: Request, response: Response, lg_admin_session: str | None = Cookie(default=None), lg_query_client: str | None = Cookie(default=None)):
    return await submit_node_query(
        node_ref,
        "/traceroute",
        body.model_dump(),
        response,
        lg_admin_session,
        lg_query_client,
        request,
    )


@app.get("/api/queries/{query_id}")
async def query(query_id: str, response: Response, lg_admin_session: str | None = Cookie(default=None), lg_query_client: str | None = Cookie(default=None)):
    query_id = validate_resource_id(query_id, "query_id")
    admin = is_admin(lg_admin_session)
    owner_hash = query_owner_hash(lg_query_client) if lg_query_client and COOKIE_TOKEN_RE.fullmatch(lg_query_client) else None
    node_ref = get_query_owner(query_id, owner_hash, admin)
    settings = get_settings()
    if not node_ref or (not admin and node_ref not in settings["publicNodeRefs"]):
        raise HTTPException(status_code=404, detail={"code": "query_not_found", "message": "Query not found"})
    try:
        payload, upstream = await link42_request(f"/queries/{query_id}")
    except HTTPException as exc:
        if exc.status_code in {404, 410}:
            release_query_slot(query_id)
        raise
    if upstream.headers.get("Retry-After"):
        response.headers["Retry-After"] = upstream.headers["Retry-After"]
    if payload.get("status") in TERMINAL_QUERY_STATUSES:
        release_query_slot(query_id)
    return sanitize_query_payload(payload, settings, admin)


@app.get("/api/as/{asn}")
async def as_name(asn: str):
    clean = asn.upper().removeprefix("AS")
    if not clean.isdigit() or len(clean) > 10:
        raise HTTPException(status_code=400, detail={"code": "invalid_asn", "message": "Invalid ASN"})
    async with httpx.AsyncClient(timeout=10.0) as client:
        if clean.startswith("424242"):
            response = await client.get(f"https://explorer.burble.com/api/registry/aut-num/AS{clean}")
            payload = response.json()
            obj = payload.get(f"aut-num/AS{clean}", {})
            attrs = obj.get("Attributes") if isinstance(obj.get("Attributes"), list) else []
            name = next((value for key, value in attrs if key == "as-name"), "") or next((value for key, value in attrs if key == "descr"), "")
            return {"asn": clean, "name": name}
        response = await client.get(f"https://stat.ripe.net/data/as-overview/data.json?resource=AS{clean}")
        payload = response.json()
        return {"asn": clean, "name": payload.get("data", {}).get("holder", "")}


if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")


@app.get("/favicon.svg")
async def favicon():
    icon = DIST_DIR / "favicon.svg"
    if icon.exists():
        return FileResponse(icon)
    raise HTTPException(status_code=404, detail="favicon not found")


@app.get("/docs", include_in_schema=False)
@app.get("/redoc", include_in_schema=False)
@app.get("/openapi.json", include_in_schema=False)
async def disabled_api_documentation():
    raise HTTPException(status_code=404, detail="Not found")


@app.get("/{path:path}")
async def frontend(path: str):
    index = DIST_DIR / "index.html"
    if index.exists():
        return FileResponse(index)
    raise HTTPException(status_code=404, detail="Frontend is not built. Run npm run build.")
