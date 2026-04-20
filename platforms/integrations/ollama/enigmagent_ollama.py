"""
EnigmAgent × Ollama Integration
=================================
A wrapper around the Ollama Python client that resolves {{PLACEHOLDER}}
tokens using the local EnigmAgent vault before sending to Ollama models.

Usage:
    from enigmagent_ollama import OllamaWithVault

    client = OllamaWithVault()
    response = client.chat(
        model="llama3",
        messages=[{"role": "user", "content": "Use key {{OPENAI_KEY}} to..."}]
    )

Requirements:
    pip install ollama httpx
    enigmagent serve --port 39517
"""

import re
import httpx
from typing import Any, Iterator
from ollama import Client, AsyncClient


# ── Vault helpers ──────────────────────────────────────────────────────────────

_cache: dict[str, str] = {}

def _fetch_sync(name: str, vault_url: str, vault_token: str) -> str | None:
    if name in _cache:
        return _cache[name]
    url = f"{vault_url.rstrip('/')}/secret/{name}"
    headers: dict[str, str] = {}
    if vault_token:
        headers["Authorization"] = f"Bearer {vault_token}"
    try:
        with httpx.Client(timeout=3.0) as c:
            r = c.get(url, headers=headers)
            r.raise_for_status()
            value = r.json().get("value")
            if value:
                _cache[name] = value
            return value
    except Exception:
        return None


async def _fetch_async(name: str, vault_url: str, vault_token: str) -> str | None:
    if name in _cache:
        return _cache[name]
    url = f"{vault_url.rstrip('/')}/secret/{name}"
    headers: dict[str, str] = {}
    if vault_token:
        headers["Authorization"] = f"Bearer {vault_token}"
    try:
        async with httpx.AsyncClient(timeout=3.0) as c:
            r = await c.get(url, headers=headers)
            r.raise_for_status()
            value = r.json().get("value")
            if value:
                _cache[name] = value
            return value
    except Exception:
        return None


def _resolve_sync(text: str, vault_url: str, vault_token: str) -> str:
    names = list(set(re.findall(r"\{\{([A-Za-z0-9_]+)\}\}", text)))
    if not names:
        return text
    mapping = {n: v for n in names if (v := _fetch_sync(n, vault_url, vault_token))}
    return re.sub(r"\{\{([A-Za-z0-9_]+)\}\}", lambda m: mapping.get(m.group(1), m.group(0)), text)


async def _resolve_async(text: str, vault_url: str, vault_token: str) -> str:
    import asyncio
    names = list(set(re.findall(r"\{\{([A-Za-z0-9_]+)\}\}", text)))
    if not names:
        return text
    values = await asyncio.gather(*[_fetch_async(n, vault_url, vault_token) for n in names])
    mapping = {n: v for n, v in zip(names, values) if v}
    return re.sub(r"\{\{([A-Za-z0-9_]+)\}\}", lambda m: mapping.get(m.group(1), m.group(0)), text)


def _resolve_messages(messages: list[dict], vault_url: str, vault_token: str) -> list[dict]:
    resolved = []
    for msg in messages:
        if isinstance(msg.get("content"), str):
            msg = {**msg, "content": _resolve_sync(msg["content"], vault_url, vault_token)}
        resolved.append(msg)
    return resolved


# ── Synchronous wrapper ────────────────────────────────────────────────────────

class OllamaWithVault(Client):
    """
    Drop-in replacement for ollama.Client with EnigmAgent vault resolution.
    All {{PLACEHOLDER}} tokens in messages are resolved before sending.
    """

    def __init__(
        self,
        host: str = "http://127.0.0.1:11434",
        vault_url: str = "http://127.0.0.1:39517",
        vault_token: str = "",
        **kwargs,
    ):
        super().__init__(host=host, **kwargs)
        self._vault_url = vault_url
        self._vault_token = vault_token

    def chat(self, model: str, messages: list[dict], **kwargs) -> Any:
        messages = _resolve_messages(messages, self._vault_url, self._vault_token)
        return super().chat(model=model, messages=messages, **kwargs)

    def generate(self, model: str, prompt: str, **kwargs) -> Any:
        prompt = _resolve_sync(prompt, self._vault_url, self._vault_token)
        return super().generate(model=model, prompt=prompt, **kwargs)


# ── Async wrapper ──────────────────────────────────────────────────────────────

class AsyncOllamaWithVault(AsyncClient):
    """Async variant — resolves placeholders before calling Ollama."""

    def __init__(
        self,
        host: str = "http://127.0.0.1:11434",
        vault_url: str = "http://127.0.0.1:39517",
        vault_token: str = "",
        **kwargs,
    ):
        super().__init__(host=host, **kwargs)
        self._vault_url = vault_url
        self._vault_token = vault_token

    async def chat(self, model: str, messages: list[dict], **kwargs) -> Any:
        import asyncio
        resolved = []
        for msg in messages:
            if isinstance(msg.get("content"), str):
                content = await _resolve_async(msg["content"], self._vault_url, self._vault_token)
                msg = {**msg, "content": content}
            resolved.append(msg)
        return await super().chat(model=model, messages=resolved, **kwargs)

    async def generate(self, model: str, prompt: str, **kwargs) -> Any:
        prompt = await _resolve_async(prompt, self._vault_url, self._vault_token)
        return await super().generate(model=model, prompt=prompt, **kwargs)


# ── Example ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    client = OllamaWithVault()
    resp = client.chat(
        model="llama3",
        messages=[
            {"role": "user", "content": "What can I do with the OpenAI key {{OPENAI_KEY}}?"}
        ],
    )
    print(resp["message"]["content"])
