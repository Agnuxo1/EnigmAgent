"""
EnigmAgent Integration for AutoGen (Microsoft)
================================================
Registers vault tools for use with AutoGen ConversableAgent and AssistantAgent.
Works with both AutoGen 0.2.x (function_map) and AutoGen 0.4+ (tool decorators).

Requirements:
    pip install pyautogen httpx
    enigmagent serve --port 39517
"""

import re
import json
import httpx
from typing import Annotated

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
    headers: dict[str, str] = {}
    if _VAULT_TOKEN:
        headers["Authorization"] = f"Bearer {_VAULT_TOKEN}"
    try:
        with httpx.Client(timeout=3.0) as c:
            r = c.get(f"{_VAULT_URL}/secrets", headers=headers)
            r.raise_for_status()
            secrets = r.json().get("secrets", [])
            names = [s.get("name", s) if isinstance(s, dict) else s for s in secrets]
            return json.dumps(names)
    except Exception as e:
        return f"Vault error: {e}"


# ── AutoGen 0.2.x function_map ────────────────────────────────────────────────

# Function schemas for AutoGen 0.2 OpenAI function calling format
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
