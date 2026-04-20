"""
EnigmAgent Integration for GPT4All
=====================================
Wraps the GPT4All Python client to resolve {{PLACEHOLDER}} tokens
from the local EnigmAgent vault before sending to local models.

Requirements:
    pip install gpt4all httpx
    enigmagent serve --port 39517

Usage:
    from enigmagent_gpt4all import GPT4AllWithVault
    model = GPT4AllWithVault("Meta-Llama-3-8B-Instruct.Q4_0.gguf")
    response = model.generate("Use key {{OPENAI_KEY}} to summarize this.")
"""

import re
import httpx
from gpt4all import GPT4All

_VAULT_URL = "http://127.0.0.1:39517"
_VAULT_TOKEN = ""
_cache: dict[str, str] = {}


def configure(vault_url: str = "http://127.0.0.1:39517", vault_token: str = "") -> None:
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


def _resolve(text: str) -> str:
    names = list(set(re.findall(r"\{\{([A-Za-z0-9_]+)\}\}", text)))
    if not names:
        return text
    mapping = {n: v for n in names if (v := _fetch(n)) is not None}
    return re.sub(r"\{\{([A-Za-z0-9_]+)\}\}", lambda m: mapping.get(m.group(1), m.group(0)), text)


class GPT4AllWithVault(GPT4All):
    """
    Drop-in replacement for GPT4All with EnigmAgent vault resolution.
    All {{PLACEHOLDER}} tokens are resolved before inference.
    """

    def generate(self, prompt: str, *args, **kwargs) -> str:
        prompt = _resolve(prompt)
        return super().generate(prompt, *args, **kwargs)

    def chat_completion(self, messages: list[dict], *args, **kwargs):
        messages = [
            {**m, "content": _resolve(m["content"])} if isinstance(m.get("content"), str) else m
            for m in messages
        ]
        return super().chat_completion(messages, *args, **kwargs)


# ── Example ────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    model = GPT4AllWithVault("Meta-Llama-3-8B-Instruct.Q4_0.gguf")
    with model.chat_session():
        response = model.generate("My GitHub token is {{GITHUB_TOKEN}}. What can I use it for?")
        print(response)
