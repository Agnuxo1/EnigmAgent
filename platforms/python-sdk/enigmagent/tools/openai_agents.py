"""
enigmagent.tools.openai_agents — OpenAI Agents SDK tool integration.

Compatible with openai-agents >= 0.1.0.

Install:
    pip install enigmagent[openai-agents]

Usage:
    from enigmagent.tools.openai_agents import get_enigmagent_tools
    from agents import Agent, Runner

    tools = get_enigmagent_tools()
    agent = Agent(
        name="VaultAgent",
        instructions="You are a helpful assistant. Always check vault status first.",
        tools=tools,
    )
    result = Runner.run_sync(agent, "List available secrets.")
    print(result.final_output)
"""

from __future__ import annotations

import json
from typing import Optional

from ..client import VaultClient, VaultError, get_client

try:
    from agents import function_tool
except ImportError as exc:
    raise ImportError(
        "openai-agents is required for enigmagent.tools.openai_agents.\n"
        "Install with: pip install enigmagent[openai-agents]"
    ) from exc


def _make_vault_status_fn(vault: VaultClient):
    @function_tool
    def enigmagent_vault_status() -> str:
        """
        Check whether the EnigmAgent vault server is running and the vault is unlocked.
        Call this before any task that requires API keys, passwords, or secrets stored
        as {{PLACEHOLDER}} references.
        """
        try:
            status = vault.get_status()
            if status.unlocked:
                return (
                    "EnigmAgent vault is RUNNING and UNLOCKED. "
                    "{{PLACEHOLDER}} references will be resolved automatically."
                )
            return (
                "Vault server is running but LOCKED. "
                "Restart with: enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json"
            )
        except VaultError as exc:
            return f"Error connecting to vault ({exc.code}): {exc}"

    return enigmagent_vault_status


def _make_vault_list_fn(vault: VaultClient):
    @function_tool
    def enigmagent_vault_list() -> str:
        """
        List all secrets stored in the EnigmAgent vault by name and domain binding.
        Never returns actual secret values — only names and domains.
        Use the exact name as {{PLACEHOLDER}} in downstream calls.
        """
        try:
            entries = vault.list_secrets()
            if not entries:
                return "The vault is empty — no secrets stored yet."
            return json.dumps({
                "count":   len(entries),
                "entries": [{"name": e.name, "domain": e.domain} for e in entries],
            })
        except VaultError as exc:
            return f"Error connecting to vault ({exc.code}): {exc}"

    return enigmagent_vault_list


def get_enigmagent_tools(client: Optional[VaultClient] = None) -> list:
    """
    Return EnigmAgent tools for the OpenAI Agents SDK.

    Returns a list of ``@function_tool`` decorated callables that can be passed
    directly to ``Agent(tools=[...])``.

    Args:
        client: Optional pre-configured VaultClient (uses module default if None).
    """
    vault = client or get_client()
    return [
        _make_vault_status_fn(vault),
        _make_vault_list_fn(vault),
    ]
