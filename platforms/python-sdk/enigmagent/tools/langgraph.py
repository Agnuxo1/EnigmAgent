"""
enigmagent.tools.langgraph — LangGraph tool node integration.

Compatible with langgraph >= 0.1.0 and langchain-core >= 0.1.0.

Install:
    pip install enigmagent[langgraph]

Usage:
    from enigmagent.tools.langgraph import get_enigmagent_tools
    from langgraph.prebuilt import create_react_agent
    from langchain_openai import ChatOpenAI

    tools = get_enigmagent_tools()
    graph = create_react_agent(ChatOpenAI(model="gpt-4o"), tools)
    result = graph.invoke({"messages": [("human", "Check vault and list secrets.")]})
"""

from __future__ import annotations

import json
from typing import Optional

from ..client import VaultClient, VaultError, get_client

# LangGraph uses langchain-core tools — same BaseTool base class
try:
    from langchain_core.tools import BaseTool, ToolException
    from pydantic import BaseModel
except ImportError as exc:
    raise ImportError(
        "langchain-core is required for enigmagent.tools.langgraph.\n"
        "Install with: pip install enigmagent[langgraph]"
    ) from exc


class _NoInput(BaseModel):
    """Empty input schema."""


class EnigmAgentVaultStatusTool(BaseTool):
    """
    LangGraph-compatible tool that checks EnigmAgent vault server status.
    Use this as the first node in any LangGraph workflow that requires credentials.
    """

    name: str = "enigmagent_vault_status"
    description: str = (
        "Check whether the EnigmAgent vault server is running and the vault is "
        "unlocked. Call this before any task that requires API keys, passwords, "
        "or other secrets."
    )
    args_schema: type[BaseModel] = _NoInput
    _vault: VaultClient

    def __init__(self, client: Optional[VaultClient] = None, **kwargs) -> None:
        super().__init__(**kwargs)
        object.__setattr__(self, "_vault", client or get_client())

    def _run(self, **kwargs) -> str:
        try:
            status = self._vault.get_status()
            if status.unlocked:
                return json.dumps({
                    "running": True,
                    "unlocked": True,
                    "message": "Vault RUNNING and UNLOCKED. {{PLACEHOLDER}} references will resolve.",
                })
            return json.dumps({
                "running": True,
                "unlocked": False,
                "message": "Vault LOCKED — restart: enigmagent-mcp --mode rest --port 3737",
            })
        except VaultError as exc:
            raise ToolException(f"EnigmAgent vault error ({exc.code}): {exc}") from exc


class EnigmAgentVaultListTool(BaseTool):
    """
    LangGraph-compatible tool that lists available secrets in the EnigmAgent vault.
    Returns names and domains only — never actual values.
    """

    name: str = "enigmagent_vault_list"
    description: str = (
        "List all secrets stored in the EnigmAgent vault by name and domain. "
        "Never returns actual values. Use the exact name as a {{PLACEHOLDER}} "
        "reference in downstream tool calls or LLM prompts."
    )
    args_schema: type[BaseModel] = _NoInput
    _vault: VaultClient

    def __init__(self, client: Optional[VaultClient] = None, **kwargs) -> None:
        super().__init__(**kwargs)
        object.__setattr__(self, "_vault", client or get_client())

    def _run(self, **kwargs) -> str:
        try:
            entries = self._vault.list_secrets()
            return json.dumps({
                "count":   len(entries),
                "entries": [{"name": e.name, "domain": e.domain} for e in entries],
            })
        except VaultError as exc:
            raise ToolException(f"EnigmAgent vault error ({exc.code}): {exc}") from exc


def get_enigmagent_tools(
    client: Optional[VaultClient] = None,
    host: str = "127.0.0.1",
    port: int = 3737,
) -> list[BaseTool]:
    """
    Return EnigmAgent tools for use with LangGraph agents.

    These are standard langchain-core BaseTool instances and are fully compatible
    with ``create_react_agent``, ``create_tool_node``, and any LangGraph workflow.

    Args:
        client: Optional pre-configured VaultClient (uses module default if None).
        host:   Vault server host (ignored if client is provided).
        port:   Vault server port (ignored if client is provided).
    """
    c = client or get_client()
    return [
        EnigmAgentVaultStatusTool(client=c),
        EnigmAgentVaultListTool(client=c),
    ]
