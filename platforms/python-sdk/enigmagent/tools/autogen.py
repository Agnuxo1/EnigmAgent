"""
enigmagent.tools.autogen — Microsoft AutoGen tool integrations.

Compatible with autogen-core >= 0.4.0 and autogen-agentchat >= 0.4.0.

Install:
    pip install enigmagent[autogen]

Usage:
    from enigmagent.tools.autogen import get_enigmagent_tools
    from autogen_agentchat.agents import AssistantAgent

    tools = get_enigmagent_tools()
    agent = AssistantAgent("dev", tools=tools, model_client=...)
"""

from __future__ import annotations

import json
from typing import Any, Optional

from ..client import VaultClient, VaultError, get_client


# ── Pure function tools (AutoGen accepts plain Python functions) ───────────────

def enigmagent_vault_status() -> str:
    """
    Check whether the EnigmAgent vault server is running and unlocked.
    Call this before any task that needs API keys or credentials.
    Returns a status message.
    """
    try:
        client = get_client()
        status = client.get_status()
        if status.unlocked:
            return json.dumps({"running": True, "unlocked": True,
                               "message": "Vault is running and UNLOCKED."})
        return json.dumps({"running": True, "unlocked": False,
                           "message": "Vault LOCKED — restart the vault server."})
    except VaultError as exc:
        return json.dumps({"running": False, "unlocked": False, "error": exc.code, "message": str(exc)})


def enigmagent_vault_list() -> str:
    """
    List all secrets in the EnigmAgent vault by name and domain.
    Never returns actual secret values. Use the names as {{PLACEHOLDER}} references.
    """
    try:
        client = get_client()
        entries = client.list_secrets()
        return json.dumps({
            "count":   len(entries),
            "entries": [{"name": e.name, "domain": e.domain} for e in entries],
        })
    except VaultError as exc:
        return json.dumps({"error": exc.code, "message": str(exc)})


# ── FunctionTool wrappers (autogen-core style) ─────────────────────────────────

def get_enigmagent_tools(client: Optional[VaultClient] = None) -> list:
    """
    Return EnigmAgent tools compatible with AutoGen agents.

    Works with both:
    - ``autogen_core.tools.FunctionTool``
    - ``autogen_agentchat`` tool lists (plain callables)

    Args:
        client:  Optional pre-configured VaultClient. If provided, overrides
                 the module-level default client.

    Example (autogen-agentchat)::

        from enigmagent.tools.autogen import get_enigmagent_tools
        from autogen_agentchat.agents import AssistantAgent
        from autogen_ext.models.openai import OpenAIChatCompletionClient

        tools = get_enigmagent_tools()
        agent = AssistantAgent(
            "assistant",
            tools=tools,
            model_client=OpenAIChatCompletionClient(model="gpt-4o"),
        )

    Example (autogen-core FunctionTool)::

        from autogen_core.tools import FunctionTool
        from enigmagent.tools.autogen import enigmagent_vault_status, enigmagent_vault_list

        tools = [
            FunctionTool(enigmagent_vault_status, description=enigmagent_vault_status.__doc__),
            FunctionTool(enigmagent_vault_list,   description=enigmagent_vault_list.__doc__),
        ]
    """
    if client is not None:
        import enigmagent.client as _c
        _c._default_client = client

    # Try to return FunctionTool objects if autogen_core is available.
    try:
        from autogen_core.tools import FunctionTool  # type: ignore
        return [
            FunctionTool(enigmagent_vault_status, description=enigmagent_vault_status.__doc__ or ""),
            FunctionTool(enigmagent_vault_list,   description=enigmagent_vault_list.__doc__ or ""),
        ]
    except ImportError:
        # Fall back to raw callables (autogen-agentchat accepts these too).
        return [enigmagent_vault_status, enigmagent_vault_list]
