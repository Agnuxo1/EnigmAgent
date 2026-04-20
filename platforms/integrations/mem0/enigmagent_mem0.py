"""
EnigmAgent Integration for Mem0
=================================
Hooks into Mem0's memory pipeline to resolve {{PLACEHOLDER}} tokens
before they are stored as memories or used in LLM calls.

Two integration modes:
  1. Standalone resolver — call resolve() before adding to Mem0
  2. Wrapped Mem0 client — automatic resolution on add/search/chat

Requirements:
    pip install mem0ai httpx
    enigmagent serve --port 39517
"""

import re
import httpx
import os
from mem0 import Memory, MemoryClient

_VAULT_URL = os.environ.get("ENIGMAGENT_URL", "http://127.0.0.1:39517").rstrip("/")
_VAULT_TOKEN = os.environ.get("ENIGMAGENT_TOKEN", "")
_cache: dict[str, str] = {}


def configure(vault_url: str, vault_token: str = "") -> None:
    global _VAULT_URL, _VAULT_TOKEN
    _VAULT_URL = vault_url.rstrip("/")
    _VAULT_TOKEN = vault_token
    _cache.clear()


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
    """Resolve {{PLACEHOLDER}} tokens in text using the vault."""
    names = list(set(re.findall(r"\{\{([A-Za-z0-9_]+)\}\}", text)))
    if not names:
        return text
    mapping = {n: v for n in names if (v := _fetch(n)) is not None}
    return re.sub(r"\{\{([A-Za-z0-9_]+)\}\}", lambda m: mapping.get(m.group(1), m.group(0)), text)


def resolve_messages(messages: list[dict]) -> list[dict]:
    """Resolve placeholders in a list of message dicts."""
    return [
        {**m, "content": resolve(m["content"])} if isinstance(m.get("content"), str) else m
        for m in messages
    ]


class Mem0WithVault:
    """
    Wrapper around Mem0 Memory that resolves {{PLACEHOLDER}} tokens
    before storing or querying memories.
    """

    def __init__(self, config: dict | None = None):
        self._mem = Memory.from_config(config) if config else Memory()

    def add(self, messages: list[dict] | str, user_id: str, **kwargs):
        if isinstance(messages, str):
            messages = resolve(messages)
        else:
            messages = resolve_messages(messages)
        return self._mem.add(messages, user_id=user_id, **kwargs)

    def search(self, query: str, user_id: str, **kwargs):
        query = resolve(query)
        return self._mem.search(query, user_id=user_id, **kwargs)

    def get_all(self, user_id: str, **kwargs):
        return self._mem.get_all(user_id=user_id, **kwargs)


# ── Example ────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    mem = Mem0WithVault()
    mem.add(
        [{"role": "user", "content": "My OpenAI key is {{OPENAI_KEY}}"}],
        user_id="demo",
    )
    results = mem.search("API keys", user_id="demo")
    print(results)
