"""
enigmagent.tools.anthropic_sdk — Anthropic Python SDK tool integration.

Compatible with anthropic >= 0.20.0.

Install:
    pip install enigmagent[anthropic]

Usage:
    from enigmagent.tools.anthropic_sdk import get_enigmagent_tool_schemas, handle_tool_call
    import anthropic

    client_ai = anthropic.Anthropic()
    schemas = get_enigmagent_tool_schemas()

    response = client_ai.messages.create(
        model="claude-opus-4-5",
        max_tokens=1024,
        tools=schemas,
        messages=[{"role": "user", "content": "Check the vault and list secrets."}],
    )

    for block in response.content:
        if block.type == "tool_use":
            result = handle_tool_call(block.name, block.input)
            print(result)

Full agentic loop example::

    from enigmagent.tools.anthropic_sdk import run_enigmagent_loop
    run_enigmagent_loop("List available vault secrets.")
"""

from __future__ import annotations

import json
from typing import Any, Optional

from ..client import VaultClient, VaultError, get_client

try:
    import anthropic as _anthropic
except ImportError as exc:
    raise ImportError(
        "anthropic is required for enigmagent.tools.anthropic_sdk.\n"
        "Install with: pip install enigmagent[anthropic]"
    ) from exc


# ---------------------------------------------------------------------------
# Tool schemas (Anthropic tool format)
# ---------------------------------------------------------------------------

_VAULT_STATUS_SCHEMA: dict[str, Any] = {
    "name": "enigmagent_vault_status",
    "description": (
        "Check whether the EnigmAgent vault server is running and the vault is "
        "unlocked. Call this before any task that requires API keys, passwords, "
        "or other secrets stored as {{PLACEHOLDER}} references."
    ),
    "input_schema": {
        "type": "object",
        "properties": {},
        "required": [],
    },
}

_VAULT_LIST_SCHEMA: dict[str, Any] = {
    "name": "enigmagent_vault_list",
    "description": (
        "List all secrets in the EnigmAgent vault by name and domain binding. "
        "Never returns actual secret values. Use the exact name as {{PLACEHOLDER}} "
        "in subsequent tool calls or prompt content."
    ),
    "input_schema": {
        "type": "object",
        "properties": {},
        "required": [],
    },
}


def get_enigmagent_tool_schemas() -> list[dict[str, Any]]:
    """
    Return Anthropic-format tool schema dicts for EnigmAgent vault tools.

    Pass the returned list directly to ``client.messages.create(tools=...)``.
    """
    return [_VAULT_STATUS_SCHEMA, _VAULT_LIST_SCHEMA]


# ---------------------------------------------------------------------------
# Tool handler
# ---------------------------------------------------------------------------

def handle_tool_call(
    tool_name: str,
    tool_input: dict[str, Any],
    client: Optional[VaultClient] = None,
) -> str:
    """
    Dispatch an Anthropic tool_use block to the appropriate EnigmAgent handler.

    Args:
        tool_name:  ``block.name`` from the Anthropic response.
        tool_input: ``block.input`` from the Anthropic response.
        client:     Optional VaultClient (uses module default if None).

    Returns:
        A JSON string suitable for passing back as a ``tool_result`` message.
    """
    vault = client or get_client()

    if tool_name == "enigmagent_vault_status":
        try:
            status = vault.get_status()
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
            return json.dumps({"error": exc.code, "message": str(exc)})

    if tool_name == "enigmagent_vault_list":
        try:
            entries = vault.list_secrets()
            return json.dumps({
                "count":   len(entries),
                "entries": [{"name": e.name, "domain": e.domain} for e in entries],
            })
        except VaultError as exc:
            return json.dumps({"error": exc.code, "message": str(exc)})

    return json.dumps({"error": "UNKNOWN_TOOL", "message": f"Unknown tool: {tool_name}"})


# ---------------------------------------------------------------------------
# Convenience: agentic loop
# ---------------------------------------------------------------------------

def run_enigmagent_loop(
    user_message: str,
    model: str = "claude-opus-4-5",
    max_tokens: int = 1024,
    client: Optional[VaultClient] = None,
    anthropic_client: Optional[_anthropic.Anthropic] = None,
) -> str:
    """
    Run a simple Anthropic agentic loop with EnigmAgent tools.

    The loop continues until the model stops requesting tool calls
    and returns a final text response.

    Args:
        user_message:      The user's initial prompt.
        model:             Anthropic model ID.
        max_tokens:        Max tokens per response.
        client:            Optional VaultClient (uses module default if None).
        anthropic_client:  Optional Anthropic client (creates a new one if None).

    Returns:
        The final text response from the model.
    """
    ai = anthropic_client or _anthropic.Anthropic()
    vault = client or get_client()
    schemas = get_enigmagent_tool_schemas()
    messages: list[dict[str, Any]] = [{"role": "user", "content": user_message}]

    while True:
        response = ai.messages.create(
            model=model,
            max_tokens=max_tokens,
            tools=schemas,
            messages=messages,
        )

        # Collect tool calls
        tool_calls = [b for b in response.content if b.type == "tool_use"]
        text_blocks = [b for b in response.content if b.type == "text"]

        if not tool_calls:
            # Final response
            return " ".join(b.text for b in text_blocks)

        # Append assistant message
        messages.append({"role": "assistant", "content": response.content})

        # Execute tools and append results
        tool_results = []
        for block in tool_calls:
            result_text = handle_tool_call(block.name, block.input, vault)
            tool_results.append({
                "type":        "tool_result",
                "tool_use_id": block.id,
                "content":     result_text,
            })

        messages.append({"role": "user", "content": tool_results})
