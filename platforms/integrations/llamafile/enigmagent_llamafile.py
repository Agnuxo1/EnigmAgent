"""
EnigmAgent × llamafile Python wrapper
=======================================
Resolves {{PLACEHOLDER}} tokens before calling the llamafile HTTP server
(llamafile --server mode, compatible with OpenAI API).

Usage:
    from enigmagent_llamafile import LlamafileWithVault
    llm = LlamafileWithVault()
    print(llm.complete("My token is {{GITHUB_TOKEN}}, what can I do?"))

Requirements:
    pip install httpx
    ./llama3.llamafile --server --port 8080
    enigmagent serve --port 39517
"""

import re
import httpx
import os

_VAULT_URL = os.environ.get("ENIGMAGENT_URL", "http://127.0.0.1:39517").rstrip("/")
_VAULT_TOKEN = os.environ.get("ENIGMAGENT_TOKEN", "")
_LLAMAFILE_URL = os.environ.get("LLAMAFILE_URL", "http://127.0.0.1:8080")
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


class LlamafileWithVault:
    def __init__(
        self,
        llamafile_url: str = _LLAMAFILE_URL,
        vault_url: str = _VAULT_URL,
        vault_token: str = _VAULT_TOKEN,
    ):
        self.base = llamafile_url.rstrip("/")

    def complete(self, prompt: str, **kwargs) -> str:
        prompt = resolve(prompt)
        with httpx.Client(timeout=120.0) as c:
            r = c.post(
                f"{self.base}/completion",
                json={"prompt": prompt, **kwargs},
            )
            r.raise_for_status()
            return r.json().get("content", "")

    def chat(self, messages: list[dict], **kwargs) -> dict:
        messages = [
            {**m, "content": resolve(m["content"])} if isinstance(m.get("content"), str) else m
            for m in messages
        ]
        with httpx.Client(timeout=120.0) as c:
            r = c.post(
                f"{self.base}/v1/chat/completions",
                json={"messages": messages, **kwargs},
            )
            r.raise_for_status()
            return r.json()


if __name__ == "__main__":
    llm = LlamafileWithVault()
    print(llm.complete("My GitHub token is {{GITHUB_TOKEN}}. Give me 3 API ideas."))
