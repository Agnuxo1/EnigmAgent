"""
EnigmAgent Hermes Plugin — agent-callable tools.

Two tools are exposed to the Hermes agent:

    enigmagent_vault_status  — check if the vault server is running & unlocked
    enigmagent_vault_list    — list secret names and domains (NEVER values)

Both follow the Hermes tool handler convention:
    - Accept only simple Python types (str, int, etc.)
    - Return a JSON-encoded string
    - Include "error" key on failure

These tools intentionally NEVER return actual secret values.
Secrets are injected only through the resolver's pre_tool_call hook.
"""

from __future__ import annotations

import json
import logging
from typing import Callable

from .vault_client import VaultClient, VaultError

logger = logging.getLogger(__name__)


# ── Schema constants ──────────────────────────────────────────────────────────

VAULT_STATUS_SCHEMA: dict = {
    "type": "object",
    "properties": {},
    "required": [],
    "additionalProperties": False,
}

VAULT_LIST_SCHEMA: dict = {
    "type": "object",
    "properties": {},
    "required": [],
    "additionalProperties": False,
}


# ── Tool handler factories ────────────────────────────────────────────────────


def make_vault_status_handler(client: VaultClient) -> Callable:
    """
    Return a Hermes-compatible handler for ``enigmagent_vault_status``.

    The handler checks whether the EnigmAgent server is reachable and
    whether the vault is currently unlocked.  It never returns secret values.
    """

    def vault_status_handler(task_id: str | None = None, **kwargs) -> str:
        """Check EnigmAgent vault server status."""
        try:
            status = client.get_status()
            unlocked = bool(status.get("unlocked", False))

            if unlocked:
                message = (
                    "Vault is running and UNLOCKED. "
                    "All {{PLACEHOLDER}} references in tool arguments will be "
                    "resolved automatically before execution."
                )
            else:
                message = (
                    "Vault server is running but LOCKED. "
                    "Restart the server to unlock it:\n"
                    "  enigmagent-mcp --mode rest --port 3737 "
                    "--vault ~/.enigmagent/vault.json"
                )

            return json.dumps(
                {
                    "running": True,
                    "unlocked": unlocked,
                    "message": message,
                },
                ensure_ascii=False,
            )

        except VaultError as exc:
            if exc.code == "server_unreachable":
                return json.dumps(
                    {
                        "running": False,
                        "unlocked": False,
                        "message": (
                            "EnigmAgent server is NOT running. "
                            "Start it with:\n"
                            "  enigmagent-mcp --mode rest --port 3737 "
                            "--vault ~/.enigmagent/vault.json\n\n"
                            "For setup instructions run:\n"
                            "  hermes enigmagent-setup"
                        ),
                    },
                    ensure_ascii=False,
                )
            return json.dumps({"error": exc.code, "message": str(exc)})

        except Exception as exc:  # noqa: BLE001
            logger.exception("Unexpected error in vault_status")
            return json.dumps({"error": "unexpected", "message": str(exc)})

    return vault_status_handler


def make_vault_list_handler(client: VaultClient) -> Callable:
    """
    Return a Hermes-compatible handler for ``enigmagent_vault_list``.

    Lists all secret names and domain bindings stored in the vault.
    NEVER returns secret values — only metadata.

    The agent should use this to discover available placeholder names
    before constructing tool calls that need credentials.
    """

    def vault_list_handler(task_id: str | None = None, **kwargs) -> str:
        """List available EnigmAgent secrets (names and domains only — no values)."""
        try:
            entries = client.list_secrets()

            if not entries:
                return json.dumps(
                    {
                        "count": 0,
                        "entries": [],
                        "hint": (
                            "No secrets in vault. Add one with:\n"
                            "  enigmagent add SECRET_NAME @localhost <value>\n"
                            "  enigmagent add LOGIN:github.com @localhost <password>\n"
                            "  enigmagent add DOC_report.md @localhost <document-text>"
                        ),
                    },
                    ensure_ascii=False,
                )

            # Strip values — return only metadata.
            safe_entries = [
                {
                    "name":    e.get("name"),
                    "domain":  e.get("domain"),
                    "created": e.get("created"),
                }
                for e in entries
            ]

            return json.dumps(
                {
                    "count":   len(safe_entries),
                    "entries": safe_entries,
                    "usage": (
                        "Reference secrets in tool arguments as {{NAME}}. "
                        "They will be resolved automatically before the tool runs. "
                        "Examples:\n"
                        "  {{GITHUB_TOKEN}}  →  in bash: "
                        'curl -H "Authorization: Bearer {{GITHUB_TOKEN}}" ...\n'
                        "  {{LOGIN:github.com}}  →  in forms: password field\n"
                        "  {{DOC:report.md}}  →  inlines full document text"
                    ),
                },
                ensure_ascii=False,
            )

        except VaultError as exc:
            if exc.code == "vault_locked":
                return json.dumps(
                    {
                        "error": "vault_locked",
                        "message": (
                            "Vault is locked. Restart the server to unlock:\n"
                            "  enigmagent-mcp --mode rest --port 3737 "
                            "--vault ~/.enigmagent/vault.json"
                        ),
                    }
                )
            return json.dumps({"error": exc.code, "message": str(exc)})

        except Exception as exc:  # noqa: BLE001
            logger.exception("Unexpected error in vault_list")
            return json.dumps({"error": "unexpected", "message": str(exc)})

    return vault_list_handler
