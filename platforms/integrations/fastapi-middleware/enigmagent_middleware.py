"""
EnigmAgent FastAPI Middleware
================================
Drop-in middleware for any FastAPI or Starlette app that serves
an OpenAI-compatible chat endpoint.

Resolves {{PLACEHOLDER}} tokens in request bodies before they reach
your endpoint — works with LangServe, FastAPI + LangChain, custom LLM APIs, etc.

Requirements:
    pip install fastapi starlette httpx
    enigmagent serve --port 39517

Usage:
    from fastapi import FastAPI
    from enigmagent_middleware import EnigmAgentMiddleware

    app = FastAPI()
    app.add_middleware(EnigmAgentMiddleware)
"""

import re
import json
import httpx
import os
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp

_VAULT_URL = os.environ.get("ENIGMAGENT_URL", "http://127.0.0.1:39517").rstrip("/")
_VAULT_TOKEN = os.environ.get("ENIGMAGENT_TOKEN", "")
_cache: dict[str, str] = {}


def _fetch(name: str) -> str | None:
    if name in _cache:
        return _cache[name]
    headers: dict[str, str] = {}
    if _VAULT_TOKEN:
        headers["Authorization"] = f"Bearer {_VAULT_TOKEN}"
    try:
        with httpx.Client(timeout=3.0) as c:
            r = c.get(f"{_VAULT_URL}/secret/{name}", headers=headers)
            r.raise_for_status()
            value = r.json().get("value")
            if value:
                _cache[name] = value
            return value
    except Exception:
        return None


def _resolve(text: str) -> str:
    names = list(set(re.findall(r"\{\{([A-Za-z0-9_]+)\}\}", text)))
    if not names:
        return text
    mapping = {n: v for n in names if (v := _fetch(n)) is not None}
    return re.sub(r"\{\{([A-Za-z0-9_]+)\}\}", lambda m: mapping.get(m.group(1), m.group(0)), text)


def _resolve_body(data: dict) -> dict:
    """Recursively resolve placeholders in an OpenAI-format request body."""
    if "messages" in data:
        resolved_messages = []
        for msg in data["messages"]:
            if isinstance(msg.get("content"), str):
                msg = {**msg, "content": _resolve(msg["content"])}
            resolved_messages.append(msg)
        data = {**data, "messages": resolved_messages}
    if isinstance(data.get("prompt"), str):
        data = {**data, "prompt": _resolve(data["prompt"])}
    if isinstance(data.get("input"), str):
        data = {**data, "input": _resolve(data["input"])}
    return data


class EnigmAgentMiddleware(BaseHTTPMiddleware):
    """
    Starlette/FastAPI middleware that resolves {{PLACEHOLDER}} tokens
    in JSON request bodies before they reach your endpoint.

    Intercepts POST requests with Content-Type: application/json.
    All other requests pass through unchanged.

    Add to your FastAPI app:
        app.add_middleware(EnigmAgentMiddleware)

    Or with custom vault settings:
        app.add_middleware(
            EnigmAgentMiddleware,
            vault_url="http://127.0.0.1:39517",
            vault_token="",
        )
    """

    def __init__(
        self,
        app: ASGIApp,
        vault_url: str = _VAULT_URL,
        vault_token: str = _VAULT_TOKEN,
        paths: list[str] | None = None,  # None = all POST paths
    ):
        super().__init__(app)
        global _VAULT_URL, _VAULT_TOKEN
        _VAULT_URL = vault_url.rstrip("/")
        _VAULT_TOKEN = vault_token
        _cache.clear()
        self._paths = paths

    async def dispatch(self, request: Request, call_next):
        if request.method != "POST":
            return await call_next(request)
        if self._paths and request.url.path not in self._paths:
            return await call_next(request)
        ct = request.headers.get("content-type", "")
        if "application/json" not in ct:
            return await call_next(request)

        # Read and resolve body
        body = await request.body()
        try:
            data = json.loads(body)
            data = _resolve_body(data)
            body = json.dumps(data).encode()
        except (json.JSONDecodeError, Exception):
            pass  # pass through unmodified on error

        # Rebuild request with resolved body
        async def receive():
            return {"type": "http.request", "body": body, "more_body": False}

        request = Request(request.scope, receive)
        return await call_next(request)


# ── Example ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    import uvicorn

    app = FastAPI(title="EnigmAgent Middleware Demo")
    app.add_middleware(EnigmAgentMiddleware)

    @app.post("/v1/chat/completions")
    async def chat(body: dict):
        # By the time we get here, {{PLACEHOLDER}} tokens are resolved
        messages = body.get("messages", [])
        return JSONResponse({"resolved_messages": messages})

    uvicorn.run(app, port=8080)
