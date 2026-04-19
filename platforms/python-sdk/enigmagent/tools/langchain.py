"""
enigmagent.tools.langchain — LangChain tool integrations.

Provides BaseTool subclasses compatible with LangChain v0.1+ and v0.2+.

Install:
    pip install enigmagent[langchain]

Usage:
    from enigmagent.tools.langchain import (
        EnigmAgentVaultStatusTool,
        EnigmAgentVaultListTool,
        get_enigmagent_tools,
    )
    from langchain.agents import AgentExecutor, create_tool_calling_agent

    tools = get_enigmagent_tools()
    # Pass to any LangChain agent / chain
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any, Optional, Type

from ..client import VaultClient, VaultError, get_client

try:
    from langchain_core.tools import BaseTool, ToolException
    from pydantic import BaseModel, Field
except ImportError as exc:
    raise ImportError(
        "langchain-core is required for enigmagent.tools.langchain.\n"
        "Install with: pip install enigmagent[langchain]"
    ) from exc


# ── Input schemas ──────────────────────────────────────────────────────────────

class _EmptyInput(BaseModel):
    pass


# ── vault_status ───────────────────────────────────────────────────────────────

class EnigmAgentVaultStatusTool(BaseTool):
    """
    Check whether the EnigmAgent vault server is running and unlocked.
    Call this before any task that requires credentials.
    """

    name: str = "enigmagent_vault_status"
    description: str = (
        "Check whether the EnigmAgent vault server is running and the vault is unlocked. "
        "Call this before any task that needs API keys or passwords to confirm that "
        "{{PLACEHOLDER}} references will resolve correctly. "
        "Returns running (bool), unlocked (bool), and a human-readable message."
    )
    args_schema: Type[BaseModel] = _EmptyInput

    _client: VaultClient = None  # type: ignore[assignment]

    def __init__(self, client: Optional[VaultClient] = None, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        object.__setattr__(self, "_client", client or get_client())

    def _run(self, **kwargs: Any) -> str:  # type: ignore[override]
        try:
            status = self._client.get_status()
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


# ── vault_list ─────────────────────────────────────────────────────────────────

class EnigmAgentVaultListTool(BaseTool):
    """List available secrets in the EnigmAgent vault (names only — never values)."""

    name: str = "enigmagent_vault_list"
    description: str = (
        "List all secrets stored in the EnigmAgent vault by name and domain binding. "
        "NEVER returns actual secret values — only metadata. "
        "Use the 'name' field as your {{PLACEHOLDER}} reference in tool arguments. "
        "Example: if 'GITHUB_TOKEN' is listed, use {{GITHUB_TOKEN}} in bash commands."
    )
    args_schema: Type[BaseModel] = _EmptyInput

    _client: VaultClient = None  # type: ignore[assignment]

    def __init__(self, client: Optional[VaultClient] = None, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        object.__setattr__(self, "_client", client or get_client())

    def _run(self, **kwargs: Any) -> str:  # type: ignore[override]
        try:
            entries = self._client.list_secrets()
            return json.dumps({
                "count":   len(entries),
                "entries": [{"name": e.name, "domain": e.domain} for e in entries],
            })
        except VaultError as exc:
            raise ToolException(f"EnigmAgent vault error ({exc.code}): {exc}") from exc


# ── Factory ────────────────────────────────────────────────────────────────────

def get_enigmagent_tools(
    client: Optional[VaultClient] = None,
    *,
    host: str = "127.0.0.1",
    port: int = 3737,
) -> list[BaseTool]:
    """
    Return all EnigmAgent tools ready for use with any LangChain agent.

    Args:
        client:  Optional pre-configured VaultClient.
        host:    Vault API host (used only if client is not provided).
        port:    Vault API port (used only if client is not provided).

    Example::

        from enigmagent.tools.langchain import get_enigmagent_tools
        from langchain_openai import ChatOpenAI
        from langchain.agents import AgentExecutor, create_tool_calling_agent

        llm   = ChatOpenAI(model="gpt-4o")
        tools = get_enigmagent_tools()
        agent = create_tool_calling_agent(llm, tools, prompt)
        executor = AgentExecutor(agent=agent, tools=tools)
    """
    c = client or VaultClient(host=host, port=port)
    return [
        EnigmAgentVaultStatusTool(client=c),
        EnigmAgentVaultListTool(client=c),
    ]
