"""
EnigmAgent Integration for PrivateGPT
=======================================
Wraps PrivateGPT's client API to resolve {{PLACEHOLDER}} tokens
before sending queries to the local PrivateGPT server.

Requirements:
    pip install httpx
    PrivateGPT server running on http://localhost:8001
    enigmagent serve --port 39517

Usage:
    from enigmagent_privategpt import PrivateGPTWithVault
    client = PrivateGPTWithVault()
    response = client.completions("Use key {{OPENAI_KEY}} to call the API.")
"""

import re
import httpx
import os
import json

_VAULT_URL = os.environ.get("ENIGMAGENT_URL", "http://127.0.0.1:39517").rstrip("/")
_VAULT_TOKEN = os.environ.get("ENIGMAGENT_TOKEN", "")
_PRIVATEGPT_URL = os.environ.get("PRIVATEGPT_URL", "http://localhost:8001")
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


class PrivateGPTWithVault:
    """
    Thin wrapper around the PrivateGPT REST API with EnigmAgent integration.
    Resolves {{PLACEHOLDER}} tokens before sending to PrivateGPT.
    """

    def __init__(
        self,
        privategpt_url: str = _PRIVATEGPT_URL,
        vault_url: str = _VAULT_URL,
        vault_token: str = _VAULT_TOKEN,
    ):
        self.base = privategpt_url.rstrip("/")
        global _VAULT_URL, _VAULT_TOKEN
        _VAULT_URL = vault_url.rstrip("/")
        _VAULT_TOKEN = vault_token

    def completions(self, prompt: str, use_context: bool = True, **kwargs) -> dict:
        """Send a completion request with placeholder resolution."""
        prompt = resolve(prompt)
        with httpx.Client(timeout=120.0) as c:
            r = c.post(
                f"{self.base}/v1/completions",
                json={"prompt": prompt, "use_context": use_context, **kwargs},
            )
            r.raise_for_status()
            return r.json()

    def chat_completions(self, messages: list[dict], use_context: bool = True, **kwargs) -> dict:
        """Send a chat completion request with placeholder resolution."""
        messages = [
            {**m, "content": resolve(m["content"])} if isinstance(m.get("content"), str) else m
            for m in messages
        ]
        with httpx.Client(timeout=120.0) as c:
            r = c.post(
                f"{self.base}/v1/chat/completions",
                json={"messages": messages, "use_context": use_context, **kwargs},
            )
            r.raise_for_status()
            return r.json()


if __name__ == "__main__":
    client = PrivateGPTWithVault()
    result = client.completions("My GitHub token is {{GITHUB_TOKEN}}. List 3 API endpoints I can call.")
    print(result["choices"][0]["message"]["content"])
