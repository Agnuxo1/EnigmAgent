"""
EnigmAgent Tools for CrewAI
=============================
Three CrewAI-compatible tools agents can use:
  - EnigmAgentGetSecretTool   — retrieve one secret
  - EnigmAgentResolveTool     — resolve {{PLACEHOLDER}} tokens in text
  - EnigmAgentListSecretsTool — list stored names

Requirements:
    pip install crewai httpx
    enigmagent serve --port 39517
"""

import re
import httpx
from crewai.tools import BaseTool
from pydantic import BaseModel, Field


# ── Vault helpers ──────────────────────────────────────────────────────────────

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


# ── Input schemas ──────────────────────────────────────────────────────────────

class _GetInput(BaseModel):
    name: str = Field(description="Secret name in the EnigmAgent vault.")


class _ResolveInput(BaseModel):
    text: str = Field(description="Text with {{PLACEHOLDER}} tokens to resolve.")


# ── Tools ──────────────────────────────────────────────────────────────────────

class EnigmAgentGetSecretTool(BaseTool):
    name: str = "enigmagent_get_secret"
    description: str = (
        "Retrieve a secret value from the local EnigmAgent AES-256-GCM encrypted vault. "
        "Input: secret name (e.g. OPENAI_KEY). Output: secret value."
    )
    args_schema: type[BaseModel] = _GetInput

    def _run(self, name: str) -> str:
        v = _fetch(name.strip())
        return v or f'Secret "{name}" not found.'


class EnigmAgentResolveTool(BaseTool):
    name: str = "enigmagent_resolve_placeholders"
    description: str = (
        "Resolve all {{PLACEHOLDER}} tokens in a string using the local EnigmAgent vault. "
        "Input: text with {{SECRET_NAME}} tokens. Output: resolved text."
    )
    args_schema: type[BaseModel] = _ResolveInput

    def _run(self, text: str) -> str:
        return _resolve(text)


class EnigmAgentListSecretsTool(BaseTool):
    name: str = "enigmagent_list_secrets"
    description: str = (
        "List all secret names stored in the local EnigmAgent vault (names only, no values)."
    )

    def _run(self) -> str:
        headers: dict[str, str] = {}
        if _VAULT_TOKEN:
            headers["Authorization"] = f"Bearer {_VAULT_TOKEN}"
        try:
            with httpx.Client(timeout=3.0) as c:
                r = c.get(f"{_VAULT_URL}/secrets", headers=headers)
                r.raise_for_status()
                secrets = r.json().get("secrets", [])
                names = [s.get("name", s) if isinstance(s, dict) else s for s in secrets]
                return ", ".join(names) or "No secrets stored."
        except Exception as e:
            return f"Vault error: {e}"


ALL_TOOLS = [EnigmAgentGetSecretTool(), EnigmAgentResolveTool(), EnigmAgentListSecretsTool()]


# ── Example ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    from crewai import Agent, Task, Crew

    vault_agent = Agent(
        role="Credential Manager",
        goal="Retrieve and manage secrets from the EnigmAgent vault for the team.",
        backstory="Expert at securely fetching credentials without exposing them.",
        tools=ALL_TOOLS,
        verbose=True,
    )

    task = Task(
        description="List all available secrets and retrieve the OPENAI_KEY.",
        expected_output="Names of all secrets and the value of OPENAI_KEY.",
        agent=vault_agent,
    )

    crew = Crew(agents=[vault_agent], tasks=[task], verbose=True)
    result = crew.kickoff()
    print(result)
