"""
EnigmAgent Tool for Open WebUI
================================
Resolves {{PLACEHOLDER}} references in prompts using the local EnigmAgent vault.

Installation:
  1. Copy this file to your Open WebUI tools directory.
  2. Enable the tool in Admin > Tools.
  3. Make sure the EnigmAgent vault REST API is running:
       enigmagent serve --port 39517

Usage in prompts:
  Use {{SECRET_NAME}} anywhere in your prompt — EnigmAgent replaces them
  with the real values before sending to the LLM.

The LLM receives resolved values only at runtime; secrets are never
stored in Open WebUI or sent to the model as plain text in history.
"""

import re
import json
import urllib.request
import urllib.error
from typing import Callable, Any
from pydantic import BaseModel, Field


class Tools:
    class Valves(BaseModel):
        vault_url: str = Field(
            default="http://127.0.0.1:39517",
            description="Base URL of the EnigmAgent vault REST API.",
        )
        vault_token: str = Field(
            default="",
            description="Vault unlock token (leave empty if the vault auto-unlocks on localhost).",
        )
        resolve_in_system: bool = Field(
            default=True,
            description="Also resolve placeholders found in the system prompt.",
        )

    def __init__(self):
        self.valves = self.Valves()

    # ------------------------------------------------------------------
    # Public helpers (called by Open WebUI pipeline)
    # ------------------------------------------------------------------

    def resolve_placeholders(self, text: str) -> str:
        """
        Replace every {{NAME}} in *text* with the vault value for NAME.
        Unknown placeholders are left unchanged.
        """
        placeholders = re.findall(r"\{\{([A-Za-z0-9_]+)\}\}", text)
        if not placeholders:
            return text

        resolved: dict[str, str] = {}
        for name in set(placeholders):
            value = self._fetch_secret(name)
            if value is not None:
                resolved[name] = value

        def replacer(m: re.Match) -> str:
            return resolved.get(m.group(1), m.group(0))

        return re.sub(r"\{\{([A-Za-z0-9_]+)\}\}", replacer, text)

    # ------------------------------------------------------------------
    # Open WebUI tool entry-point
    # ------------------------------------------------------------------

    def resolve(
        self,
        prompt: str,
        __user__: dict = {},
        __event_emitter__: Callable[[dict], Any] | None = None,
    ) -> str:
        """
        Resolve {{PLACEHOLDER}} tokens in *prompt* and return the result.

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

    # ------------------------------------------------------------------
    # Private
    # ------------------------------------------------------------------

    def _fetch_secret(self, name: str) -> str | None:
        """Call the local vault REST API and return the plaintext value."""
        url = f"{self.valves.vault_url.rstrip('/')}/secret/{name}"
        headers = {"Content-Type": "application/json"}
        if self.valves.vault_token:
            headers["Authorization"] = f"Bearer {self.valves.vault_token}"

        req = urllib.request.Request(url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = json.loads(resp.read().decode())
                return data.get("value")
        except (urllib.error.URLError, json.JSONDecodeError, KeyError):
            return None
