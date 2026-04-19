"""
enigmagent.tools.smolagents — HuggingFace SmolAgents tool integrations.

Compatible with smolagents >= 1.0.0.

Install:
    pip install enigmagent[smolagents]

Usage:
    from enigmagent.tools.smolagents import get_enigmagent_tools
    from smolagents import CodeAgent, HfApiModel

    tools = get_enigmagent_tools()
    agent = CodeAgent(tools=tools, model=HfApiModel())
"""

from __future__ import annotations

import json
from typing import Optional

from ..client import VaultClient, VaultError, get_client

try:
    from smolagents import Tool
except ImportError as exc:
    raise ImportError(
        "smolagents is required for enigmagent.tools.smolagents.\n"
        "Install with: pip install enigmagent[smolagents]"
    ) from exc


class EnigmAgentVaultStatusTool(Tool):
    name        = "enigmagent_vault_status"
    description = (
        "Check whether the EnigmAgent vault server is running and the vault is unlocked. "
        "Call this before any task requiring API keys, passwords, or private documents."
    )
    inputs: dict = {}
    output_type = "string"

    def __init__(self, client: Optional[VaultClient] = None) -> None:
        super().__init__()
        self._vault = client or get_client()

    def forward(self) -> str:
        try:
            status = self._vault.get_status()
            if status.unlocked:
                return "Vault RUNNING and UNLOCKED — {{PLACEHOLDER}} references will resolve."
            return "Vault LOCKED — restart: enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json"
        except VaultError as exc:
            return f"Error ({exc.code}): {exc}"


class EnigmAgentVaultListTool(Tool):
    name        = "enigmagent_vault_list"
    description = (
        "List all secrets in the EnigmAgent vault by name and domain. "
        "Never returns actual values. Use names as {{PLACEHOLDER}} in code/commands."
    )
    inputs: dict = {}
    output_type = "string"

    def __init__(self, client: Optional[VaultClient] = None) -> None:
        super().__init__()
        self._vault = client or get_client()

    def forward(self) -> str:
        try:
            entries = self._vault.list_secrets()
            if not entries:
                return "No secrets in vault."
            return json.dumps({
                "count":   len(entries),
                "entries": [{"name": e.name, "domain": e.domain} for e in entries],
            })
        except VaultError as exc:
            return f"Error ({exc.code}): {exc}"


def get_enigmagent_tools(client: Optional[VaultClient] = None) -> list[Tool]:
    """Return EnigmAgent tools for SmolAgents agents."""
    c = client or get_client()
    return [EnigmAgentVaultStatusTool(c), EnigmAgentVaultListTool(c)]
