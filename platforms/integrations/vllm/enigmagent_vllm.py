"""
EnigmAgent Integration for vLLM
=================================
Two integration patterns:

1. Middleware wrapper — resolve placeholders before calling vLLM's
   OpenAI-compatible REST API (simplest, no vLLM code changes).

2. vLLM plugin / chat template preprocessor — resolve at the engine level.

Requirements:
    pip install httpx
    enigmagent serve --port 39517
    vllm serve meta-llama/Meta-Llama-3-8B-Instruct --port 8000
"""

import re
import httpx
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
import os
import sys

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


def resolve(text: str) -> str:
    names = list(set(re.findall(r"\{\{([A-Za-z0-9_]+)\}\}", text)))
    if not names:
        return text
    mapping = {n: v for n in names if (v := _fetch(n)) is not None}
    return re.sub(r"\{\{([A-Za-z0-9_]+)\}\}", lambda m: mapping.get(m.group(1), m.group(0)), text)


# ── Pattern 1: HTTP Proxy Middleware ──────────────────────────────────────────

class VLLMProxyHandler(BaseHTTPRequestHandler):
    """
    Intercepts OpenAI-format POST requests, resolves EnigmAgent placeholders,
    and forwards to vLLM.

    Usage:
        VLLM_URL=http://localhost:8000 python enigmagent_vllm.py --proxy 8001
    """

    VLLM_URL = os.environ.get("VLLM_URL", "http://localhost:8000")

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        try:
            data = json.loads(body)
            if "messages" in data:
                for msg in data["messages"]:
                    if isinstance(msg.get("content"), str):
                        msg["content"] = resolve(msg["content"])
            if isinstance(data.get("prompt"), str):
                data["prompt"] = resolve(data["prompt"])
            body = json.dumps(data).encode()
        except (json.JSONDecodeError, KeyError):
            pass

        forward_headers = {
            k: v for k, v in self.headers.items()
            if k.lower() not in ("host", "content-length")
        }
        forward_headers["Content-Length"] = str(len(body))

        with httpx.Client(timeout=300.0) as c:
            resp = c.request(
                self.command, f"{self.VLLM_URL}{self.path}",
                content=body, headers=forward_headers,
            )

        self.send_response(resp.status_code)
        for k, v in resp.headers.items():
            if k.lower() not in ("transfer-encoding",):
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(resp.content)

    def log_message(self, *args):
        pass


# ── Pattern 2: Python client wrapper ─────────────────────────────────────────

class VLLMWithVault:
    """
    Wrapper around the openai package configured for vLLM.
    Resolves {{PLACEHOLDER}} tokens before each call.

    Usage:
        from enigmagent_vllm import VLLMWithVault
        client = VLLMWithVault(model="meta-llama/Meta-Llama-3-8B-Instruct")
        response = client.complete("Use key {{OPENAI_KEY}} to ...")
    """

    def __init__(
        self,
        model: str = "meta-llama/Meta-Llama-3-8B-Instruct",
        vllm_url: str = "http://localhost:8000/v1",
    ):
        from openai import OpenAI
        self.client = OpenAI(base_url=vllm_url, api_key="vllm")
        self.model = model

    def complete(self, prompt: str, **kwargs) -> str:
        prompt = resolve(prompt)
        resp = self.client.completions.create(model=self.model, prompt=prompt, **kwargs)
        return resp.choices[0].text

    def chat(self, messages: list[dict], **kwargs):
        messages = [
            {**m, "content": resolve(m["content"])} if isinstance(m.get("content"), str) else m
            for m in messages
        ]
        return self.client.chat.completions.create(model=self.model, messages=messages, **kwargs)


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="EnigmAgent vLLM proxy")
    parser.add_argument("--proxy", type=int, default=8001, help="Proxy listen port")
    args = parser.parse_args()

    server = HTTPServer(("127.0.0.1", args.proxy), VLLMProxyHandler)
    print(f"[EnigmAgent] vLLM proxy on http://127.0.0.1:{args.proxy}")
    print(f"[EnigmAgent] Forwarding to {VLLMProxyHandler.VLLM_URL}")
    server.serve_forever()
