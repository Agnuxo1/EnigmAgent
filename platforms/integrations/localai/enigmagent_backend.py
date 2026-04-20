"""
EnigmAgent Backend for LocalAI
================================
A LocalAI custom "backend" that wraps any other model backend and resolves
{{PLACEHOLDER}} tokens in every request before forwarding to the model.

LocalAI supports custom backends via gRPC. This file implements the
LocalAI Backend protobuf service with placeholder resolution.

Requirements:
    pip install grpcio grpcio-tools httpx
    git clone https://github.com/mudler/LocalAI  # for proto files
    enigmagent serve --port 39517

Build:
    python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. \
        backend.proto  # path from LocalAI repo
    python enigmagent_backend.py --port 50051

Usage in LocalAI config (models/enigmagent.yaml):
    backend: enigmagent
    model: llama3
    parameters:
      temperature: 0.7
"""

import re
import httpx
import grpc
import json
from concurrent import futures
import sys
import os

# ── Vault helpers ──────────────────────────────────────────────────────────────

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


# ── LocalAI OpenAI-compatible middleware ───────────────────────────────────────
# For LocalAI setups that use the REST API rather than gRPC backends,
# use this as a proxy middleware between your client and LocalAI.

from http.server import HTTPServer, BaseHTTPRequestHandler


class EnigmAgentProxy(BaseHTTPRequestHandler):
    """
    HTTP proxy that intercepts OpenAI-format requests, resolves placeholders,
    and forwards to LocalAI.

    Configure LocalAI_URL to point to your LocalAI instance.
    Point your OpenAI client to this proxy instead.
    """

    LOCALAI_URL = os.environ.get("LOCALAI_URL", "http://127.0.0.1:8080")

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        try:
            data = json.loads(body)
            # Resolve in messages
            if "messages" in data:
                for msg in data["messages"]:
                    if isinstance(msg.get("content"), str):
                        msg["content"] = _resolve(msg["content"])
            # Resolve in prompt (completions API)
            if isinstance(data.get("prompt"), str):
                data["prompt"] = _resolve(data["prompt"])
            body = json.dumps(data).encode()
        except (json.JSONDecodeError, KeyError):
            pass

        # Forward to LocalAI
        target = f"{self.LOCALAI_URL}{self.path}"
        forward_headers = {
            k: v for k, v in self.headers.items()
            if k.lower() not in ("host", "content-length")
        }
        forward_headers["Content-Length"] = str(len(body))

        with httpx.Client(timeout=120.0) as c:
            resp = c.request(
                self.command,
                target,
                content=body,
                headers=forward_headers,
            )

        self.send_response(resp.status_code)
        for k, v in resp.headers.items():
            if k.lower() not in ("transfer-encoding",):
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(resp.content)

    def log_message(self, format, *args):
        pass  # suppress default logging


def run_proxy(port: int = 39520):
    server = HTTPServer(("127.0.0.1", port), EnigmAgentProxy)
    print(f"[EnigmAgent] LocalAI proxy running on http://127.0.0.1:{port}")
    print(f"[EnigmAgent] Forwarding to {EnigmAgentProxy.LOCALAI_URL}")
    print(f"[EnigmAgent] Vault: {_VAULT_URL}")
    server.serve_forever()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 39520
    run_proxy(port)
