"""
EnigmAgent — Encrypted Vault Plugin for Hermes Agent
=====================================================

Provides an encrypted local vault so Hermes agents can use API keys,
passwords, and private documents without those values ever appearing
in the LLM's context.

How it works
------------
1. The agent writes ``{{GITHUB_TOKEN}}`` in a tool argument.
2. This plugin's ``pre_tool_call`` hook intercepts the call.
3. The hook resolves ``{{GITHUB_TOKEN}}`` from the local EnigmAgent vault.
4. The real token is injected into the argument **in-place**.
5. The tool executes with the real value.
6. The LLM only receives the tool's output — never the token.

Placeholder syntax
------------------
    {{SECRET_NAME}}          Plain secret by name
    {{LOGIN:domain.com}}     Login credential bound to a domain
    {{DOC:filename.md}}      Full text of a stored document

Tools registered
----------------
    enigmagent_vault_status   Check if vault is running and unlocked
    enigmagent_vault_list     List available secrets (names only, no values)

Hooks registered
----------------
    pre_tool_call             Resolves {{PLACEHOLDER}} before tool execution

Configuration
-------------
Place in ``~/.hermes/plugins/enigmagent/`` and set in
``~/.hermes/config.yaml``:

    plugins:
      enigmagent:
        port: 3737           # default
        host: 127.0.0.1      # default
        strict_mode: false   # set true to block calls with unresolvable secrets
        timeout_s: 5         # request timeout

Or via environment variables (override config):
    ENIGMAGENT_PORT
    ENIGMAGENT_HOST
    ENIGMAGENT_STRICT=true
    ENIGMAGENT_TIMEOUT_S

External process
----------------
The vault server must be running before Hermes starts:

    enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json

See README.md for the full setup guide.
"""

from __future__ import annotations

import logging
import os

from .vault_client import VaultClient
from .resolver import make_pre_tool_call_hook
from .tools import (
    make_vault_status_handler,
    make_vault_list_handler,
    VAULT_STATUS_SCHEMA,
    VAULT_LIST_SCHEMA,
)

logger = logging.getLogger(__name__)

__version__ = "0.2.0"
__all__ = ["register"]


# ── Plugin registration ───────────────────────────────────────────────────────


def register(ctx) -> None:
    """
    Hermes plugin entry point.

    Called automatically by the Hermes plugin loader when the plugin is
    discovered at ``~/.hermes/plugins/enigmagent/``.

    Args:
        ctx:  PluginContext provided by Hermes — facade for registering
              tools, hooks, CLI commands, and slash commands.
    """
    # ── Read configuration ────────────────────────────────────────────────────

    # Prefer environment variables, fall back to plugin config passed by Hermes.
    cfg = getattr(ctx, "config", {}) or {}

    host        = os.environ.get("ENIGMAGENT_HOST",      cfg.get("host",        "127.0.0.1"))
    port        = int(os.environ.get("ENIGMAGENT_PORT",  cfg.get("port",        3737)))
    timeout_s   = float(os.environ.get("ENIGMAGENT_TIMEOUT_S", cfg.get("timeout_s", 5.0)))
    strict_mode = os.environ.get("ENIGMAGENT_STRICT", str(cfg.get("strict_mode", False))).lower() == "true"

    logger.info(
        "[EnigmAgent] loading plugin v%s — vault at http://%s:%d (strict=%s)",
        __version__,
        host,
        port,
        strict_mode,
    )

    # ── Create vault client ───────────────────────────────────────────────────

    client = VaultClient(host=host, port=port, timeout_s=timeout_s)

    # ── Register pre_tool_call hook ───────────────────────────────────────────
    #
    # This is the core of the integration: every tool call passes through this
    # hook, which resolves {{PLACEHOLDER}} patterns before the tool executes.
    # The LLM never sees the real secret values.

    ctx.register_hook(
        "pre_tool_call",
        make_pre_tool_call_hook(client, strict_mode=strict_mode),
    )

    # ── Register vault inspection tools ──────────────────────────────────────
    #
    # These tools let the agent check vault readiness and discover available
    # secret names.  They NEVER return actual secret values.

    ctx.register_tool(
        name="enigmagent_vault_status",
        toolset="enigmagent",
        schema=VAULT_STATUS_SCHEMA,
        handler=make_vault_status_handler(client),
        description=(
            "Check whether the EnigmAgent vault server is running and the vault "
            "is unlocked. Call this before any task that requires credentials to "
            "ensure secrets will be resolved correctly."
        ),
        emoji="🔐",
    )

    ctx.register_tool(
        name="enigmagent_vault_list",
        toolset="enigmagent",
        schema=VAULT_LIST_SCHEMA,
        handler=make_vault_list_handler(client),
        description=(
            "List all secret names and domain bindings stored in the EnigmAgent "
            "vault. Never returns actual values. Use the names shown here as "
            "{{PLACEHOLDER}} references in tool arguments — they will be resolved "
            "automatically at execution time."
        ),
        emoji="🗂️",
    )

    logger.info("[EnigmAgent] plugin registered successfully.")
