"""
enigmagent.tools.semantic_kernel — Microsoft Semantic Kernel plugin.

Compatible with semantic-kernel >= 1.0.0.

Install:
    pip install enigmagent[semantic-kernel]

Usage:
    from enigmagent.tools.semantic_kernel import EnigmAgentPlugin
    from semantic_kernel import Kernel

    kernel = Kernel()
    kernel.add_plugin(EnigmAgentPlugin(), plugin_name="enigmagent")
"""

from __future__ import annotations

import json
from typing import Annotated, Optional

from ..client import VaultClient, VaultError, get_client

try:
    from semantic_kernel.functions import kernel_function
except ImportError as exc:
    raise ImportError(
        "semantic-kernel is required for enigmagent.tools.semantic_kernel.\n"
        "Install with: pip install enigmagent[semantic-kernel]"
    ) from exc


class EnigmAgentPlugin:
    """
    Semantic Kernel plugin for EnigmAgent vault operations.

    Register with:
        kernel.add_plugin(EnigmAgentPlugin(), plugin_name="enigmagent")

    Then use as:
        {{enigmagent.vault_status}}
        {{enigmagent.vault_list}}
    """

    def __init__(self, client: Optional[VaultClient] = None) -> None:
        self._client = client or get_client()

    @kernel_function(
        description=(
            "Check whether the EnigmAgent vault server is running and the vault is unlocked. "
            "Call this before any task that needs API keys or passwords."
        ),
        name="vault_status",
    )
    def vault_status(self) -> Annotated[str, "Vault status message"]:
        try:
            status = self._client.get_status()
            if status.unlocked:
                return "EnigmAgent vault is RUNNING and UNLOCKED. {{PLACEHOLDER}} references will resolve."
            return "Vault server running but LOCKED — restart enigmagent-mcp."
        except VaultError as exc:
            return f"Vault error ({exc.code}): {exc}"

    @kernel_function(
        description=(
            "List all secrets in the EnigmAgent vault by name and domain binding. "
            "Never returns values. Use the exact name as {{PLACEHOLDER}} in your prompts."
        ),
        name="vault_list",
    )
    def vault_list(self) -> Annotated[str, "JSON list of vault secret names"]:
        try:
            entries = self._client.list_secrets()
            return json.dumps({
                "count":   len(entries),
                "entries": [{"name": e.name, "domain": e.domain} for e in entries],
            })
        except VaultError as exc:
            return json.dumps({"error": exc.code, "message": str(exc)})
