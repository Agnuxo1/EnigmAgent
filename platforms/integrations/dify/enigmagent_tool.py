"""
EnigmAgent Tool Plugin for Dify
=================================
Exposes vault secret retrieval as a Dify tool that can be added to any
Workflow, Agent, or Chatbot app.

Installation:
  1. Go to Dify > Tools > Custom > Create Tool
  2. Copy the YAML schema (enigmagent_schema.yaml) into the schema field.
  3. Set the Tool Endpoint to your EnigmAgent server URL.
  4. Or deploy this file as a custom Python tool using Dify's Python tool SDK.

For the Python tool approach (Dify 0.6+):
  Place this file in api/core/tools/provider/builtin/enigmagent/tools/get_secret.py
"""

from typing import Any, Generator
import httpx
from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage


class GetSecretTool(Tool):
    """Retrieve a single secret from the EnigmAgent vault."""

    def _invoke(
        self, tool_parameters: dict[str, Any]
    ) -> Generator[ToolInvokeMessage, None, None]:
        name = tool_parameters.get("name", "").strip()
        if not name:
            yield self.create_text_message("Error: secret name is required.")
            return

        vault_url = (self.runtime.credentials.get("vault_url") or "http://127.0.0.1:39517").rstrip("/")
        vault_token = self.runtime.credentials.get("vault_token") or ""

        headers: dict[str, str] = {"Accept": "application/json"}
        if vault_token:
            headers["Authorization"] = f"Bearer {vault_token}"

        try:
            with httpx.Client(timeout=5.0) as client:
                resp = client.get(f"{vault_url}/secret/{name}", headers=headers)
                resp.raise_for_status()
                value = resp.json().get("value")
                if not value:
                    yield self.create_text_message(f'Secret "{name}" not found in vault.')
                    return
                yield self.create_text_message(value)
        except httpx.HTTPError as e:
            yield self.create_text_message(f"Vault error: {e}")


class ListSecretsTool(Tool):
    """List all secret names stored in the EnigmAgent vault."""

    def _invoke(
        self, tool_parameters: dict[str, Any]
    ) -> Generator[ToolInvokeMessage, None, None]:
        vault_url = (self.runtime.credentials.get("vault_url") or "http://127.0.0.1:39517").rstrip("/")
        vault_token = self.runtime.credentials.get("vault_token") or ""

        headers: dict[str, str] = {"Accept": "application/json"}
        if vault_token:
            headers["Authorization"] = f"Bearer {vault_token}"

        try:
            with httpx.Client(timeout=5.0) as client:
                resp = client.get(f"{vault_url}/secrets", headers=headers)
                resp.raise_for_status()
                secrets = resp.json().get("secrets", [])
                names = [s.get("name", s) if isinstance(s, dict) else s for s in secrets]
                yield self.create_text_message(", ".join(names) if names else "No secrets stored.")
        except httpx.HTTPError as e:
            yield self.create_text_message(f"Vault error: {e}")
