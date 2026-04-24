"""
EnigmAgent Tools for CrewAI
=============================
Three CrewAI-compatible tools agents can use:
  - EnigmAgentGetSecretTool   — retrieve one secret
  - EnigmAgentResolveTool     — resolve {{PLACEHOLDER}} tokens in text
  - EnigmAgentListSecretsTool — list stored names

REST API (enigmagent-mcp --mode rest --port 3737 --vault ./vault.json):
  GET  /status
  GET  /list
  POST /resolve  {"placeholder": "NAME", "origin": "https://..."}

Requirements:
    pip install crewai
    enigmagent-mcp --mode rest --port 3737 --vault ./vault.json
"""

import re
import json
import urllib.request
import urllib.error
from crewai.tools import BaseTool
from pydantic import BaseModel, Field


# ── Vault helpers ──────────────────────────────────────────────────────────────

_VAULT_URL = "http://127.0.0.1:3737"
_ORIGIN = "http://localhost"
_cache: dict[str, str] = {}


def configure(
    vault_url: str = "http://127.0.0.1:3737",
    origin: str = "http://localhost",
) -> None:
    global _VAULT_URL, _ORIGIN
    _VAULT_URL = vault_url.rstrip("/")
    _ORIGIN = origin
    _cache.clear()


def _post(path: str, payload: dict) -> dict:
    url = f"{_VAULT_URL}{path}"
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
            f"EnigmAgent server unreachable at {_VAULT_URL}. "
            "Start with: enigmagent-mcp --mode rest --port 3737 --vault ./vault.json"
        ) from exc


def _get(path: str) -> dict:
    url = f"{_VAULT_URL}{path}"
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            return json.loads(resp.read().decode())
    except (urllib.error.URLError, OSError) as exc:
        raise RuntimeError(f"EnigmAgent server unreachable at {_VAULT_URL}.") from exc


def _fetch(name: str) -> str | None:
    if name in _cache:
        return _cache[name]
    try:
        data = _post("/resolve", {"placeholder": name, "origin": _ORIGIN})
        value = data.get("value")
        if value:
            _cache[name] = value
        return value
    except Exception:
        return None


def _resolve_text(text: str) -> str:
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
        return _resolve_text(text)


class EnigmAgentListSecretsTool(BaseTool):
    name: str = "enigmagent_list_secrets"
    description: str = (
        "List all secret names stored in the local EnigmAgent vault (names only, no values)."
    )

    def _run(self, _: str = "") -> str:
        try:
            data = _get("/list")
            entries = data.get("entries", [])
            names = [e.get("name", str(e)) if isinstance(e, dict) else str(e) for e in entries]
            return ", ".join(names) or "No secrets stored."
        except Exception as e:
            return f"Vault error: {e}"


ALL_TOOLS = [EnigmAgentGetSecretTool(), EnigmAgentResolveTool(), EnigmAgentListSecretsTool()]


# ── Example ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    from crewai import Agent, Task, Crew

    # Configure to point at your running vault REST API (port 3737)
    configure(vault_url="http://127.0.0.1:3737", origin="http://localhost")

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
