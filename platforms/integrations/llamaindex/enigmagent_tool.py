"""
EnigmAgent Tool for LlamaIndex
================================
Provides three LlamaIndex-compatible tools:
  1. EnigmAgentGetSecretTool     — retrieve a single secret by name
  2. EnigmAgentResolveTool       — resolve all {{PLACEHOLDER}} tokens in text
  3. EnigmAgentListSecretsTool   — list stored secret names

Works with LlamaIndex ReActAgent, OpenAIAgent, and any FunctionCallingAgent.

REST API (enigmagent-mcp --mode rest --port 3737 --vault ./vault.json):
  GET  /status
  GET  /list
  POST /resolve  {"placeholder": "NAME", "origin": "https://..."}

Requirements:
    pip install llama-index
    enigmagent-mcp --mode rest --port 3737 --vault ./vault.json
"""

import re
import json
import urllib.request
import urllib.error
from llama_index.core.tools import FunctionTool


# ── Vault helpers ──────────────────────────────────────────────────────────────

_VAULT_URL = "http://127.0.0.1:3737"
_ORIGIN = "http://localhost"
_cache: dict[str, str] = {}


def configure(
    vault_url: str = "http://127.0.0.1:3737",
    origin: str = "http://localhost",
) -> None:
    """Override default vault settings."""
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


# ── Tool functions ─────────────────────────────────────────────────────────────

def get_secret(name: str) -> str:
    """
    Retrieve a secret value from the local EnigmAgent AES-256-GCM encrypted vault.

    Args:
        name: The secret name (e.g. 'OPENAI_KEY', 'GITHUB_TOKEN').

    Returns:
        The secret value as a string, or an error message if not found.
    """
    value = _fetch(name.strip())
    if value is None:
        return f'Secret "{name}" not found in the EnigmAgent vault.'
    return value


def resolve_text(text: str) -> str:
    """
    Resolve all {{PLACEHOLDER}} tokens in text using the local EnigmAgent vault.

    Args:
        text: Input string possibly containing {{SECRET_NAME}} tokens.

    Returns:
        The input string with all known placeholders replaced by their vault values.
    """
    names = list(set(re.findall(r"\{\{([A-Za-z0-9_]+)\}\}", text)))
    if not names:
        return text
    mapping = {n: v for n in names if (v := _fetch(n)) is not None}
    return re.sub(r"\{\{([A-Za-z0-9_]+)\}\}", lambda m: mapping.get(m.group(1), m.group(0)), text)


def list_secrets() -> str:
    """
    List the names of all secrets stored in the local EnigmAgent vault.

    Returns:
        Comma-separated list of secret names (values are never returned).
    """
    try:
        data = _get("/list")
        entries = data.get("entries", [])
        names = [e.get("name", str(e)) if isinstance(e, dict) else str(e) for e in entries]
        return ", ".join(names) if names else "No secrets stored."
    except Exception as e:
        return f"Vault error: {e}"


# ── LlamaIndex FunctionTool wrappers ───────────────────────────────────────────

EnigmAgentGetSecretTool = FunctionTool.from_defaults(fn=get_secret)
EnigmAgentResolveTool = FunctionTool.from_defaults(fn=resolve_text)
EnigmAgentListSecretsTool = FunctionTool.from_defaults(fn=list_secrets)

# All three tools as a list for convenience
ALL_TOOLS = [EnigmAgentGetSecretTool, EnigmAgentResolveTool, EnigmAgentListSecretsTool]


# ── Example ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    from llama_index.core.agent import ReActAgent
    from llama_index.llms.openai import OpenAI

    # Configure to point at your running vault REST API (port 3737)
    configure(vault_url="http://127.0.0.1:3737", origin="http://localhost")

    # The LLM key is retrieved from the vault — not hardcoded!
    openai_key = get_secret("OPENAI_KEY")
    llm = OpenAI(api_key=openai_key, model="gpt-4o")

    agent = ReActAgent.from_tools(ALL_TOOLS, llm=llm, verbose=True)
    response = agent.chat("List all secrets in my vault.")
    print(response)
