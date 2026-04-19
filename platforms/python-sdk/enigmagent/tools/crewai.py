"""
enigmagent.tools.crewai — CrewAI tool integrations.

Compatible with crewai >= 0.5.0.

Install:
    pip install enigmagent[crewai]

Usage:
    from enigmagent.tools.crewai import get_enigmagent_tools
    from crewai import Agent, Task, Crew

    vault_tools = get_enigmagent_tools()
    agent = Agent(role="DevOps", tools=vault_tools, ...)
"""

from __future__ import annotations

from typing import Any, Optional, Type

from ..client import VaultClient, VaultError, get_client

try:
    from crewai.tools import BaseTool
    from pydantic import BaseModel
except ImportError as exc:
    raise ImportError(
        "crewai is required for enigmagent.tools.crewai.\n"
        "Install with: pip install enigmagent[crewai]"
    ) from exc


class _EmptyInput(BaseModel):
    pass


class EnigmAgentVaultStatusTool(BaseTool):
    name: str = "enigmagent_vault_status"
    description: str = (
        "Check whether the EnigmAgent vault server is running and unlocked. "
        "Always call this before any task involving API keys or passwords."
    )
    args_schema: Type[BaseModel] = _EmptyInput

    _client: Optional[VaultClient] = None

    def __init__(self, client: Optional[VaultClient] = None, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._client = client or get_client()

    def _run(self, **kwargs: Any) -> str:
        try:
            status = (self._client or get_client()).get_status()
            if status.unlocked:
                return "Vault RUNNING and UNLOCKED — {{PLACEHOLDER}} references will resolve."
            return "Vault LOCKED — restart: enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json"
        except VaultError as exc:
            return f"Vault error ({exc.code}): {exc}"


class EnigmAgentVaultListTool(BaseTool):
    name: str = "enigmagent_vault_list"
    description: str = (
        "List all secrets in the EnigmAgent vault — names and domains only, never values. "
        "Use the exact name as {{PLACEHOLDER}} in tool arguments."
    )
    args_schema: Type[BaseModel] = _EmptyInput

    _client: Optional[VaultClient] = None

    def __init__(self, client: Optional[VaultClient] = None, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._client = client or get_client()

    def _run(self, **kwargs: Any) -> str:
        try:
            entries = (self._client or get_client()).list_secrets()
            if not entries:
                return "No secrets in vault. Add: enigmagent add NAME @localhost value"
            lines = [f"  {e.name:<32} {'@' + e.domain if e.domain else '(unbound)'}" for e in entries]
            return f"{len(entries)} secret(s):\n" + "\n".join(lines)
        except VaultError as exc:
            return f"Vault error ({exc.code}): {exc}"


def get_enigmagent_tools(client: Optional[VaultClient] = None) -> list[BaseTool]:
    """Return all EnigmAgent tools for CrewAI agents."""
    c = client or get_client()
    return [EnigmAgentVaultStatusTool(client=c), EnigmAgentVaultListTool(client=c)]
