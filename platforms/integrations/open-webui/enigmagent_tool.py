"""
title: EnigmAgent Secret Resolver
author: Francisco Angulo de Lafuente
author_url: https://github.com/agnuxo1
funding_url: https://github.com/agnuxo1/EnigmAgent
version: 1.0.0
license: MIT
description: Resolve {{PLACEHOLDER}} references from the EnigmAgent vault for AI agents. Secrets stay local — the LLM never sees real API keys in plaintext.
requirements: requests
"""

import re
import json
import urllib.request
import urllib.error
from typing import Callable, Any
from pydantic import BaseModel, Field


class Tools:
    """
    Open WebUI tool — resolves {{PLACEHOLDER}} tokens in prompts using the local
    EnigmAgent AES-256-GCM encrypted vault.

    REST API required:
        enigmagent-mcp --mode rest --port 3737 --vault ./vault.json

    Endpoints used:
        GET  /status
        GET  /list
        POST /resolve  {"placeholder": "NAME", "origin": "https://..."}
    """

    class Valves(BaseModel):
        vault_url: str = Field(
            default="http://127.0.0.1:3737",
            description="Base URL of the EnigmAgent vault REST API (default: http://127.0.0.1:3737).",
        )
        origin: str = Field(
            default="http://localhost",
            description="Origin sent to the vault for domain-binding checks.",
        )
        resolve_in_system: bool = Field(
            default=True,
            description="Also resolve placeholders found in the system prompt.",
        )

    def __init__(self):
        self.valves = self.Valves()

    # ── Public tools (called by Open WebUI) ────────────────────────────────────

    def resolve_secret(self, placeholder: str, origin: str = "https://localhost") -> str:
        """
        Resolve a {{PLACEHOLDER}} reference from the EnigmAgent vault.

        Args:
            placeholder: Secret name without braces (e.g. OPENAI_KEY).
            origin: Requesting origin URL for domain-binding validation.

        Returns:
            The decrypted secret value, or an error message.
        """
        value = self._resolve_one(placeholder.strip(), origin or self.valves.origin)
        if value is None:
            return f'Secret "{placeholder}" not found in the EnigmAgent vault.'
        return value

    def list_secrets(self) -> list:
        """
        List all secret names available in the vault.

        Returns:
            List of secret names (values are never returned).
        """
        url = f"{self.valves.vault_url.rstrip('/')}/list"
        try:
            with urllib.request.urlopen(url, timeout=5) as resp:
                data = json.loads(resp.read().decode())
                entries = data.get("entries", [])
                return [e.get("name", str(e)) if isinstance(e, dict) else str(e) for e in entries]
        except Exception as e:
            return [f"Vault error: {e}"]

    # ── Pipeline hook (auto-resolves placeholders in every message) ────────────

    def resolve(
        self,
        prompt: str,
        __user__: dict = {},
        __event_emitter__: Callable[[dict], Any] | None = None,
    ) -> str:
        """
        Resolve all {{PLACEHOLDER}} tokens in *prompt* and return the result.

        Open WebUI calls this when the user's message contains a tool call
        or when the tool is set to run automatically on every message.
        """
        result = self.resolve_placeholders(prompt)
        changed = result != prompt

        if __event_emitter__ and changed:
            names = re.findall(r"\{\{([A-Za-z0-9_]+)\}\}", prompt)
            __event_emitter__(
                {
                    "type": "status",
                    "data": {
                        "description": f"EnigmAgent resolved {len(set(names))} secret(s).",
                        "done": True,
                    },
                }
            )

        return result

    # ── Private helpers ────────────────────────────────────────────────────────

    def resolve_placeholders(self, text: str) -> str:
        """Replace every {{NAME}} in *text* with the vault value for NAME."""
        placeholders = list(set(re.findall(r"\{\{([A-Za-z0-9_]+)\}\}", text)))
        if not placeholders:
            return text

        origin = self.valves.origin
        resolved: dict[str, str] = {}
        for name in placeholders:
            value = self._resolve_one(name, origin)
            if value is not None:
                resolved[name] = value

        return re.sub(
            r"\{\{([A-Za-z0-9_]+)\}\}",
            lambda m: resolved.get(m.group(1), m.group(0)),
            text,
        )

    def _resolve_one(self, name: str, origin: str) -> str | None:
        """Call POST /resolve on the EnigmAgent REST API."""
        base = self.valves.vault_url.rstrip("/")
        url = f"{base}/resolve"
        payload = json.dumps({"placeholder": name, "origin": origin}).encode()
        req = urllib.request.Request(
            url, data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode())
                return data.get("value")
        except (urllib.error.URLError, json.JSONDecodeError, KeyError):
            return None
