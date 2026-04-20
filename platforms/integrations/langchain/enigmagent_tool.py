"""
EnigmAgent Tools for LangChain
================================
Three LangChain-compatible tools:
  - EnigmAgentGetSecret    — retrieve one secret by name
  - EnigmAgentResolve      — resolve {{PLACEHOLDER}} tokens in a string
  - EnigmAgentListSecrets  — list stored secret names

Also exports EnigmAgentCallbackHandler — a LangChain callback that auto-
resolves placeholders in every LLM call transparently.

Requirements:
    pip install langchain httpx
    enigmagent serve --port 39517
"""

import re
import httpx
from typing import Any, Type
from langchain.tools import BaseTool
from langchain.callbacks.base import BaseCallbackHandler
from langchain_core.messages import BaseMessage
from pydantic import BaseModel, Field


# ── Settings ───────────────────────────────────────────────────────────────────

class _Settings:
    vault_url: str = "http://127.0.0.1:39517"
    vault_token: str = ""
    cache: dict[str, str] = {}

_cfg = _Settings()


def configure(vault_url: str = "http://127.0.0.1:39517", vault_token: str = "") -> None:
    _cfg.vault_url = vault_url.rstrip("/")
    _cfg.vault_token = vault_token
    _cfg.cache.clear()


def _fetch(name: str) -> str | None:
    if name in _cfg.cache:
        return _cfg.cache[name]
    headers: dict[str, str] = {}
    if _cfg.vault_token:
        headers["Authorization"] = f"Bearer {_cfg.vault_token}"
    try:
        with httpx.Client(timeout=3.0) as c:
            r = c.get(f"{_cfg.vault_url}/secret/{name}", headers=headers)
            r.raise_for_status()
            value = r.json().get("value")
            if value:
                _cfg.cache[name] = value
            return value
    except Exception:
        return None


def _resolve(text: str) -> str:
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
        return _resolve(text)

    async def _arun(self, text: str) -> str:
        return self._run(text)


class EnigmAgentListSecrets(BaseTool):
    name: str = "enigmagent_list_secrets"
    description: str = (
        "List all secret names stored in the local EnigmAgent vault. "
        "Values are never returned — names only."
    )

    def _run(self, _: str = "") -> str:
        headers: dict[str, str] = {}
        if _cfg.vault_token:
            headers["Authorization"] = f"Bearer {_cfg.vault_token}"
        try:
            with httpx.Client(timeout=3.0) as c:
                r = c.get(f"{_cfg.vault_url}/secrets", headers=headers)
                r.raise_for_status()
                secrets = r.json().get("secrets", [])
                names = [s.get("name", s) if isinstance(s, dict) else s for s in secrets]
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
            prompts[i] = _resolve(p)

    def on_chat_model_start(
        self, serialized: dict, messages: list[list[BaseMessage]], **kwargs: Any
    ) -> None:
        for batch in messages:
            for msg in batch:
                if hasattr(msg, "content") and isinstance(msg.content, str):
                    msg.content = _resolve(msg.content)


# ── Example ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    from langchain_openai import ChatOpenAI
    from langchain.agents import AgentExecutor, create_react_agent
    from langchain import hub

    key = _fetch("OPENAI_KEY") or "your-key-here"
    llm = ChatOpenAI(api_key=key, model="gpt-4o-mini")
    prompt = hub.pull("hwchase17/react")
    agent = create_react_agent(llm, ALL_TOOLS, prompt)
    executor = AgentExecutor(agent=agent, tools=ALL_TOOLS, verbose=True)
    print(executor.invoke({"input": "List all secrets in my EnigmAgent vault."}))
