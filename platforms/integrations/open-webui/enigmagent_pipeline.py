"""
EnigmAgent Pipeline for Open WebUI (Filter)
=============================================
Transparently resolves {{PLACEHOLDER}} tokens in every message before
it reaches the LLM — no manual tool calls required.

Installation (Open WebUI < 0.4 / Pipelines server):
  1. Start the Pipelines server (https://github.com/open-webui/pipelines).
  2. Upload this file via Admin > Pipelines > Upload.
  3. Set ENIGMAGENT_VAULT_URL env var or configure via the Valves UI.
  4. Enable the pipeline for the models you want.
"""

from typing import Iterator, Generator
from pydantic import BaseModel, Field
import re
import json
import urllib.request
import urllib.error


class Pipeline:
    class Valves(BaseModel):
        vault_url: str = Field(
            default="http://127.0.0.1:39517",
            description="EnigmAgent vault REST API base URL.",
        )
        vault_token: str = Field(
            default="",
            description="Bearer token for the vault (optional).",
        )
        pipelines: list[str] = Field(
            default=["*"],
            description="Pipelines this filter is attached to (* = all).",
        )
        priority: int = Field(
            default=0,
            description="Filter priority (lower = runs first).",
        )

    def __init__(self):
        self.type = "filter"
        self.name = "EnigmAgent Secret Resolver"
        self.valves = self.Valves()

    async def on_startup(self):
        print(f"[EnigmAgent] Pipeline started. Vault: {self.valves.vault_url}")

    async def on_shutdown(self):
        print("[EnigmAgent] Pipeline stopped.")

    async def inlet(self, body: dict, user: dict | None = None) -> dict:
        """Pre-process: resolve placeholders in all user/system messages."""
        messages = body.get("messages", [])
        for msg in messages:
            if isinstance(msg.get("content"), str):
                msg["content"] = self._resolve(msg["content"])
            elif isinstance(msg.get("content"), list):
                for part in msg["content"]:
                    if isinstance(part, dict) and part.get("type") == "text":
                        part["text"] = self._resolve(part["text"])
        body["messages"] = messages
        return body

    # ------------------------------------------------------------------

    def _resolve(self, text: str) -> str:
        placeholders = list(set(re.findall(r"\{\{([A-Za-z0-9_]+)\}\}", text)))
        if not placeholders:
            return text
        mapping = {n: v for n in placeholders if (v := self._fetch(n)) is not None}
        return re.sub(
            r"\{\{([A-Za-z0-9_]+)\}\}",
            lambda m: mapping.get(m.group(1), m.group(0)),
            text,
        )

    def _fetch(self, name: str) -> str | None:
        url = f"{self.valves.vault_url.rstrip('/')}/secret/{name}"
        headers = {"Accept": "application/json"}
        if self.valves.vault_token:
            headers["Authorization"] = f"Bearer {self.valves.vault_token}"
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=3) as r:
                return json.loads(r.read().decode()).get("value")
        except Exception:
            return None
