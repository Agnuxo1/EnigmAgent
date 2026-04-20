"""
EnigmAgent Integration for h2oGPT
====================================
Resolves {{PLACEHOLDER}} tokens before sending queries to h2oGPT's
OpenAI-compatible REST API.

Requirements:
    pip install httpx
    h2oGPT server running on http://localhost:5000
    enigmagent serve --port 39517

Usage:
    from enigmagent_h2ogpt import H2oGPTWithVault
    client = H2oGPTWithVault()
    response = client.chat("Use key {{OPENAI_KEY}} to summarize this.")
"""

import re
import httpx
import os
import json

_VAULT_URL = os.environ.get("ENIGMAGENT_URL", "http://127.0.0.1:39517").rstrip("/")
_VAULT_TOKEN = os.environ.get("ENIGMAGENT_TOKEN", "")
_H2OGPT_URL = os.environ.get("H2OGPT_URL", "http://localhost:5000")
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


class H2oGPTWithVault:
    """Wrap h2oGPT client with EnigmAgent placeholder resolution."""

    def __init__(self, h2ogpt_url: str = _H2OGPT_URL):
        self.base = h2ogpt_url.rstrip("/")

    def chat(self, instruction: str, **kwargs) -> str:
        instruction = resolve(instruction)
        with httpx.Client(timeout=120.0) as c:
            r = c.post(
                f"{self.base}/v1/chat/completions",
                json={"messages": [{"role": "user", "content": instruction}], **kwargs},
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]

    def query(self, instruction: str, **kwargs) -> dict:
        instruction = resolve(instruction)
        with httpx.Client(timeout=120.0) as c:
            r = c.post(
                f"{self.base}/api/v1/query",
                json={"instruction": instruction, **kwargs},
            )
            r.raise_for_status()
            return r.json()
