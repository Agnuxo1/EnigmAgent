"""
EnigmAgent Tools for LangChain
================================
Three LangChain-compatible tools:
  - EnigmAgentGetSecret    — retrieve one secret by name
  - EnigmAgentResolve      — resolve {{PLACEHOLDER}} tokens in a string
  - EnigmAgentListSecrets  — list stored secret names

Also exports EnigmAgentCallbackHandler — a LangChain callback that auto-
resolves placeholders in every LLM call transparently.

REST API (enigmagent-mcp --mode rest --port 3737 --vault ./vault.json):
  GET  /status                                      — vault health check
  GET  /list                                        — list secret names
  POST /resolve  {"placeholder": "NAME", "origin": "https://..."}  — resolve

Requirements:
    pip install langchain httpx
    enigmagent-mcp --mode rest --port 3737 --vault ./vault.json
"""

import re
import json
import urllib.request
import urllib.error
from typing import Any, Type
from langchain.tools import BaseTool
from langchain.callbacks.base import BaseCallbackHandler
from langchain_core.messages import BaseMessage
from pydantic import BaseModel, Field


# ── Settings ───────────────────────────────────────────────────────────────────

class _Settings:
    vault_url: str = "http://127.0.0.1:3737"
    origin: str = "http://localhost"
    cache: dict = {}

_cfg = _Settings()


def configure(
    vault_url: str = "http://127.0.0.1:3737",
    origin: str = "http://localhost",
) -> None:
    """Configure the vault connection. Call once before using any tools."""
    _cfg.vault_url = vault_url.rstrip("/")
    _cfg.origin = origin
    _cfg.cache.clear()


def _post(path: str, payload: dict) -> dict:
    url = f"{_cfg.vault_url}{path}"
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        try:
            body = json.loads(exc.read().decode())
        except Exception:
            body = {}
        raise RuntimeError(body.get("message", str(exc))) from exc
    except (urllib.error.URLError, OSError) as exc:
        raise RuntimeError(
            f"EnigmAgent server unreachable at {_cfg.vault_url}. "
            "Start with: enigmagent-mcp --mode rest --port 3737 --vault ./vault.json"
        ) from exc


def _get(path: str) -> dict:
    url = f"{_cfg.vault_url}{path}"
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        try:
            body = json.loads(exc.read().decode())
        except Exception:
            body = {}
        raise RuntimeError(body.get("message", str(exc))) from exc
    except (urllib.error.URLError, OSError) as exc:
        raise RuntimeError(
            f"EnigmAgent server unreachable at {_cfg.vault_url}."
        ) from exc


def _fetch(name: str) -> str | None:
    """Resolve a single secret by name via POST /resolve."""
    if name in _cfg.cache:
        return _cfg.cache[name]
    try:
        data = _post("/resolve", {"placeholder": name, "origin": _cfg.origin})
        value = data.get("value")
        if value:
            _cfg.cache[name] = value
        return value
    except Exception:
        return None


def _resolve_text(text: str) -> str:
    """Replace all {{PLACEHOLDER}} tokens in text."""
    names = list(set(re.findall(r"\{\{([A-Za-z0-9_]+)\}\}", text)))
    if not names:
        return text
    mapping = {n: v for n in names if (v := _fetch(n)) is not None}
    return re.sub(r"\{\{([A-Za-z0-9_]+)\}\}", lambda m: mapping.get(m.group(1), m.group(0)), text)


# ── Tool input schemas ─────────────────────────────────────────────────────────

class _GetSecretInput(BaseModel):
    name: str = Field(description="Secret name in the vault (e.g. OPENAI_KEY).")


class _ResolveInput(BaseModel):
    text: str = Field(description="Text with {{PLACEHOLDER}} tokens to resolve.")


# ── LangChain Tools ────────────────────────────────────────────────────────────

class EnigmAgentGetSecret(BaseTool):
    name: str = "enigmagent_get_secret"
    description: str = (
        "Retrieve a secret value from the local EnigmAgent AES-256-GCM encrypted vault. "
        "Input: secret name. Output: secret value."
    )
    args_schema: Type[BaseModel] = _GetSecretInput

    def _run(self, name: str) -> str:
        v = _fetch(name.strip())
        return v if v else f'Secret "{name}" not found.'

    async def _arun(self, name: str) -> str:
        return self._run(name)


class EnigmAgentResolve(BaseTool):
    name: str = "enigmagent_resolve"
    description: str = (
        "Resolve all {{PLACEHOLDER}} tokens in a string using the local EnigmAgent vault. "
        "Input: text with {{SECRET_NAME}} tokens. Output: resolved text."
    )
    args_schema: Type[BaseModel] = _ResolveInput

    def _run(self, text: str) -> str:
        return _resolve_text(text)

    async def _arun(self, text: str) -> str:
        return self._run(text)


class EnigmAgentListSecrets(BaseTool):
    name: str = "enigmagent_list_secrets"
    description: str = (
        "List all secret names stored in the local EnigmAgent vault. "
        "Values are never returned — names only."
    )

    def _run(self, _: str = "") -> str:
        try:
            data = _get("/list")
            entries = data.get("entries", [])
            names = [e.get("name", str(e)) if isinstance(e, dict) else str(e) for e in entries]
            return ", ".join(names) if names else "No secrets stored."
        except Exception as e:
            return f"Vault error: {e}"

    async def _arun(self, _: str = "") -> str:
        return self._run()


# Convenience list
ALL_TOOLS = [EnigmAgentGetSecret(), EnigmAgentResolve(), EnigmAgentListSecrets()]


# ── Callback handler (transparent auto-resolution) ────────────────────────────

class EnigmAgentCallbackHandler(BaseCallbackHandler):
    """
    LangChain callback that resolves {{PLACEHOLDER}} tokens in every LLM input.
    Attach to any LLM or chain — no code changes needed.

    Usage:
        from enigmagent_tool import EnigmAgentCallbackHandler
        llm = ChatOpenAI(callbacks=[EnigmAgentCallbackHandler()])
    """

    def on_llm_start(self, serialized: dict, prompts: list[str], **kwargs: Any) -> None:
        for i, p in enumerate(prompts):
            prompts[i] = _resolve_text(p)

    def on_chat_model_start(
        self, serialized: dict, messages: list[list[BaseMessage]], **kwargs: Any
    ) -> None:
        for batch in messages:
            for msg in batch:
                if hasattr(msg, "content") and isinstance(msg.content, str):
                    msg.content = _resolve_text(msg.content)


# ── Example ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    from langchain_openai import ChatOpenAI
    from langchain.agents import AgentExecutor, create_react_agent
    from langchain import hub

    # Configure to point at your running vault REST API (port 3737)
    configure(vault_url="http://127.0.0.1:3737", origin="http://localhost")

    key = _fetch("OPENAI_KEY") or "your-key-here"
    llm = ChatOpenAI(api_key=key, model="gpt-4o-mini")
    prompt = hub.pull("hwchase17/react")
    agent = create_react_agent(llm, ALL_TOOLS, prompt)
    executor = AgentExecutor(agent=agent, tools=ALL_TOOLS, verbose=True)
    print(executor.invoke({"input": "List all secrets in my EnigmAgent vault."}))
