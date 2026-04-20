"""
EnigmAgent Tool for LlamaIndex
================================
Provides two LlamaIndex-compatible tools:
  1. EnigmAgentGetSecretTool  — retrieve a single secret by name
  2. EnigmAgentResolveTool    — resolve all {{PLACEHOLDER}} tokens in text

Works with LlamaIndex ReActAgent, OpenAIAgent, and any FunctionCallingAgent.

Requirements:
    pip install llama-index httpx
    enigmagent serve --port 39517
"""

import re
import httpx
from llama_index.core.tools import FunctionTool


# ── Vault helpers ──────────────────────────────────────────────────────────────

_VAULT_URL = "http://127.0.0.1:39517"
_VAULT_TOKEN = ""
_cache: dict[str, str] = {}


def configure(vault_url: str = "http://127.0.0.1:39517", vault_token: str = "") -> None:
    """Override default vault settings."""
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
    headers: dict[str, str] = {}
    if _VAULT_TOKEN:
        headers["Authorization"] = f"Bearer {_VAULT_TOKEN}"
    try:
        with httpx.Client(timeout=3.0) as c:
            r = c.get(f"{_VAULT_URL}/secrets", headers=headers)
            r.raise_for_status()
            secrets = r.json().get("secrets", [])
            names = [s.get("name", s) if isinstance(s, dict) else s for s in secrets]
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

    # The LLM key is retrieved from the vault — not hardcoded!
    openai_key = get_secret("OPENAI_KEY")
    llm = OpenAI(api_key=openai_key, model="gpt-4o")

    agent = ReActAgent.from_tools(ALL_TOOLS, llm=llm, verbose=True)
    response = agent.chat("List all secrets in my vault.")
    print(response)
