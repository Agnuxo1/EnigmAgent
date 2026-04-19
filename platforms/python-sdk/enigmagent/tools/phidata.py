"""
enigmagent.tools.phidata — Phidata (Agno) toolkit integration.

Compatible with phidata >= 2.0.0 / agno >= 1.0.0.

Install:
    pip install enigmagent[phidata]

Usage:
    from enigmagent.tools.phidata import EnigmAgentToolkit
    from phi.agent import Agent

    agent = Agent(tools=[EnigmAgentToolkit()], ...)
"""

from __future__ import annotations

import json
from typing import Optional

from ..client import VaultClient, VaultError, get_client

try:
    # Support both phi (old) and agno (new) package names
    try:
        from phi.tools import Toolkit
    except ImportError:
        from agno.tools import Toolkit  # type: ignore
except ImportError as exc:
    raise ImportError(
        "phidata (phi) or agno is required for enigmagent.tools.phidata.\n"
        "Install with: pip install enigmagent[phidata]"
    ) from exc


class EnigmAgentToolkit(Toolkit):
    """
    Phidata/Agno toolkit providing EnigmAgent vault operations.

    Usage::

        from enigmagent.tools.phidata import EnigmAgentToolkit
        from phi.agent import Agent

        agent = Agent(tools=[EnigmAgentToolkit()], show_tool_calls=True)
        agent.print_response("Check if the vault is ready and list available secrets.")
    """

    def __init__(self, client: Optional[VaultClient] = None) -> None:
        super().__init__(name="enigmagent")
        self._vault = client or get_client()
        self.register(self.vault_status)
        self.register(self.vault_list)

    def vault_status(self) -> str:
        """
        Check whether the EnigmAgent vault server is running and unlocked.
        Returns a status message. Call before any task requiring credentials.
        """
        try:
            status = self._vault.get_status()
            if status.unlocked:
                return json.dumps({"running": True, "unlocked": True,
                                   "message": "Vault RUNNING and UNLOCKED."})
            return json.dumps({"running": True, "unlocked": False,
                               "message": "Vault LOCKED — restart the server."})
        except VaultError as exc:
            return json.dumps({"running": False, "unlocked": False,
                               "error": exc.code, "message": str(exc)})

    def vault_list(self) -> str:
        """
        List all secrets in the EnigmAgent vault — names and domains, never values.
        Use the exact name as a {{PLACEHOLDER}} reference in tool calls.
        """
        try:
            entries = self._vault.list_secrets()
            return json.dumps({
                "count":   len(entries),
                "entries": [{"name": e.name, "domain": e.domain} for e in entries],
            })
        except VaultError as exc:
            return json.dumps({"error": exc.code, "message": str(exc)})
