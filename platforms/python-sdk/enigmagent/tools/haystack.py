"""
enigmagent.tools.haystack — Haystack (deepset) component integrations.

Compatible with haystack-ai >= 2.0.0.

Install:
    pip install enigmagent[haystack]

Usage:
    from enigmagent.tools.haystack import EnigmAgentVaultStatus, EnigmAgentVaultList
    from haystack import Pipeline

    pipe = Pipeline()
    pipe.add_component("vault_check", EnigmAgentVaultStatus())
"""

from __future__ import annotations

from typing import Any, Optional

from ..client import VaultClient, VaultError, get_client

try:
    from haystack import component, default_to_dict, default_from_dict
except ImportError as exc:
    raise ImportError(
        "haystack-ai is required for enigmagent.tools.haystack.\n"
        "Install with: pip install enigmagent[haystack]"
    ) from exc


@component
class EnigmAgentVaultStatus:
    """
    Haystack component that checks the EnigmAgent vault server status.
    Use as the first component in any pipeline that needs credentials.
    """

    def __init__(self, host: str = "127.0.0.1", port: int = 3737) -> None:
        self._client = VaultClient(host=host, port=port)
        self.host = host
        self.port = port

    @component.output_types(running=bool, unlocked=bool, message=str)
    def run(self) -> dict:
        """Check vault server status."""
        try:
            status = self._client.get_status()
            msg = (
                "Vault RUNNING and UNLOCKED."
                if status.unlocked
                else "Vault LOCKED — restart enigmagent-mcp."
            )
            return {"running": True, "unlocked": status.unlocked, "message": msg}
        except VaultError as exc:
            return {"running": False, "unlocked": False,
                    "message": f"Server unreachable: {exc}"}

    def to_dict(self) -> dict:
        return default_to_dict(self, host=self.host, port=self.port)

    @classmethod
    def from_dict(cls, data: dict) -> "EnigmAgentVaultStatus":
        return default_from_dict(cls, data)


@component
class EnigmAgentVaultList:
    """
    Haystack component that lists available secrets in the EnigmAgent vault.
    Returns names and domains — never actual values.
    """

    def __init__(self, host: str = "127.0.0.1", port: int = 3737) -> None:
        self._client = VaultClient(host=host, port=port)
        self.host = host
        self.port = port

    @component.output_types(count=int, entries=list, error=Optional[str])
    def run(self) -> dict:
        """List vault secrets (no values)."""
        try:
            entries = self._client.list_secrets()
            return {
                "count":   len(entries),
                "entries": [{"name": e.name, "domain": e.domain} for e in entries],
                "error":   None,
            }
        except VaultError as exc:
            return {"count": 0, "entries": [], "error": str(exc)}

    def to_dict(self) -> dict:
        return default_to_dict(self, host=self.host, port=self.port)

    @classmethod
    def from_dict(cls, data: dict) -> "EnigmAgentVaultList":
        return default_from_dict(cls, data)
