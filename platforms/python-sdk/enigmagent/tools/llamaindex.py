"""
enigmagent.tools.llamaindex — LlamaIndex tool integrations.

Compatible with llama-index-core >= 0.10.0.

Install:
    pip install enigmagent[llamaindex]

Usage:
    from enigmagent.tools.llamaindex import get_enigmagent_tools
    from llama_index.core.agent import ReActAgent

    tools  = get_enigmagent_tools()
    agent  = ReActAgent.from_tools(tools, llm=llm, verbose=True)
"""

from __future__ import annotations

import json
from typing import Any, Optional

from ..client import VaultClient, VaultError, get_client

try:
    from llama_index.core.tools import FunctionTool
except ImportError as exc:
    raise ImportError(
        "llama-index-core is required for enigmagent.tools.llamaindex.\n"
        "Install with: pip install enigmagent[llamaindex]"
    ) from exc


def _vault_status() -> str:
    """Check whether the EnigmAgent vault server is running and unlocked."""
    try:
        status = get_client().get_status()
        if status.unlocked:
            return "Vault RUNNING and UNLOCKED — {{PLACEHOLDER}} references will be resolved."
        return "Vault server running but LOCKED — restart enigmagent-mcp to unlock."
    except VaultError as exc:
        return f"Vault error ({exc.code}): {exc}"


def _vault_list() -> str:
    """
    List all secrets in the EnigmAgent vault by name and domain.
    Never returns actual values. Use names as {{PLACEHOLDER}} references.
    """
    try:
        entries = get_client().list_secrets()
        if not entries:
            return "No secrets in vault."
        return json.dumps({
            "count":   len(entries),
            "entries": [{"name": e.name, "domain": e.domain} for e in entries],
        })
    except VaultError as exc:
        return f"Vault error ({exc.code}): {exc}"


def get_enigmagent_tools(client: Optional[VaultClient] = None) -> list[FunctionTool]:
    """Return EnigmAgent FunctionTools for LlamaIndex agents."""
    if client is not None:
        import enigmagent.client as _c
        _c._default_client = client
    return [
        FunctionTool.from_defaults(
            fn=_vault_status,
            name="enigmagent_vault_status",
            description=_vault_status.__doc__ or "",
        ),
        FunctionTool.from_defaults(
            fn=_vault_list,
            name="enigmagent_vault_list",
            description=_vault_list.__doc__ or "",
        ),
    ]
