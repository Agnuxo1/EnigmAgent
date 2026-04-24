"""
EnigmAgent Integration for AutoGen (Microsoft)
================================================
Registers vault tools for use with AutoGen ConversableAgent and AssistantAgent.
Works with both AutoGen 0.2.x (function_map) and AutoGen 0.4+ (tool decorators).

REST API (enigmagent-mcp --mode rest --port 3737 --vault ./vault.json):
  GET  /status
  GET  /list
  POST /resolve  {"placeholder": "NAME", "origin": "https://..."}

Requirements:
    pip install pyautogen
    enigmagent-mcp --mode rest --port 3737 --vault ./vault.json
"""

import re
import json
import urllib.request
import urllib.error
from typing import Annotated

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


# ── Tool functions (AutoGen 0.4+ style with type annotations) ─────────────────

def get_secret(name: Annotated[str, "Secret name stored in EnigmAgent vault"]) -> str:
    """Retrieve a secret value from the local EnigmAgent AES-256-GCM vault."""
    v = _fetch(name.strip())
    return v if v else f'Secret "{name}" not found in vault.'


def resolve_placeholders(
    text: Annotated[str, "Text containing {{PLACEHOLDER}} tokens to resolve"]
) -> str:
    """Resolve {{PLACEHOLDER}} tokens in text using the local EnigmAgent vault."""
    names = list(set(re.findall(r"\{\{([A-Za-z0-9_]+)\}\}", text)))
    if not names:
        return text
    mapping = {n: v for n in names if (v := _fetch(n)) is not None}
    return re.sub(r"\{\{([A-Za-z0-9_]+)\}\}", lambda m: mapping.get(m.group(1), m.group(0)), text)


def list_secrets() -> str:
    """List all secret names stored in the local EnigmAgent vault (names only)."""
    try:
        data = _get("/list")
        entries = data.get("entries", [])
        names = [e.get("name", str(e)) if isinstance(e, dict) else str(e) for e in entries]
        return json.dumps(names)
    except Exception as e:
        return f"Vault error: {e}"


# ── AutoGen 0.2.x function_map ────────────────────────────────────────────────

FUNCTION_MAP = {
    "get_secret": get_secret,
    "resolve_placeholders": resolve_placeholders,
    "list_secrets": list_secrets,
}

FUNCTION_SCHEMAS = [
    {
        "name": "get_secret",
        "description": "Retrieve a secret value from the local EnigmAgent vault by name.",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Secret name (e.g. OPENAI_KEY)"}
            },
            "required": ["name"],
        },
    },
    {
        "name": "resolve_placeholders",
        "description": "Resolve {{PLACEHOLDER}} tokens in text using the EnigmAgent vault.",
        "parameters": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "Text with {{SECRET_NAME}} tokens"}
            },
            "required": ["text"],
        },
    },
    {
        "name": "list_secrets",
        "description": "List all secret names in the EnigmAgent vault (no values).",
        "parameters": {"type": "object", "properties": {}},
    },
]


# ── Example usage ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Configure to point at your running vault REST API (port 3737)
    configure(vault_url="http://127.0.0.1:3737", origin="http://localhost")

    # AutoGen 0.4+ style
    try:
        from autogen import ConversableAgent, AssistantAgent, UserProxyAgent, register_function

        assistant = AssistantAgent(
            name="VaultAssistant",
            system_message="You are an assistant with access to a local secret vault.",
            llm_config={"config_list": [{"model": "gpt-4o-mini", "api_key": get_secret("OPENAI_KEY")}]},
        )

        user_proxy = UserProxyAgent(
            name="User",
            human_input_mode="NEVER",
            max_consecutive_auto_reply=5,
        )

        register_function(get_secret, caller=assistant, executor=user_proxy, name="get_secret",
                         description="Get a secret from the vault.")
        register_function(list_secrets, caller=assistant, executor=user_proxy, name="list_secrets",
                         description="List vault secret names.")

        user_proxy.initiate_chat(assistant, message="List all secrets in my EnigmAgent vault.")

    except ImportError:
        # AutoGen 0.2.x fallback
        import autogen  # type: ignore

        config_list = [{"model": "gpt-4o-mini", "api_key": get_secret("OPENAI_KEY")}]
        assistant = autogen.AssistantAgent(
            name="VaultAssistant",
            llm_config={"config_list": config_list, "functions": FUNCTION_SCHEMAS},
        )
        user_proxy = autogen.UserProxyAgent(
            name="User",
            human_input_mode="NEVER",
            function_map=FUNCTION_MAP,
        )
        user_proxy.initiate_chat(assistant, message="List secrets in my vault.")
