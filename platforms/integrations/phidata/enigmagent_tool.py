"""
EnigmAgent Tools for Phidata
==============================
Provides Phidata-compatible tools for vault secret retrieval
and {{PLACEHOLDER}} resolution.

Requirements:
    pip install phidata httpx
    enigmagent serve --port 39517

Usage:
    from phi.agent import Agent
    from enigmagent_tool import enigmagent_tools
    agent = Agent(tools=enigmagent_tools)
"""

import re
import httpx
import os
from phi.tools import Toolkit

_VAULT_URL = os.environ.get("ENIGMAGENT_URL", "http://127.0.0.1:39517").rstrip("/")
_VAULT_TOKEN = os.environ.get("ENIGMAGENT_TOKEN", "")
_cache: dict[str, str] = {}


def _fetch(name: str) -> str | None:
    if name in _cache:
        return _cache[name]
    headers: dict[str, str] = {}
    if _VAULT_TOKEN:
        headers["Authorization"] = f"Bearer {_VAULT_TOKEN}"
    try:
        with httpx.Client(timeout=3.0) as c:
            r = c.get(f"{_VAULT_URL}/secret/{name}", headers=headers)
            r.raise_for_status()
            value = r.json().get("value")
            if value:
                _cache[name] = value
            return value
    except Exception:
        return None


class EnigmAgentTools(Toolkit):
    def __init__(
        self,
        vault_url: str = _VAULT_URL,
        vault_token: str = _VAULT_TOKEN,
        get_secret: bool = True,
        resolve_text: bool = True,
        list_secrets: bool = True,
    ):
        super().__init__(name="enigmagent_vault")
        global _VAULT_URL, _VAULT_TOKEN
        _VAULT_URL = vault_url.rstrip("/")
        _VAULT_TOKEN = vault_token
        _cache.clear()

        if get_secret:
            self.register(self.get_secret)
        if resolve_text:
            self.register(self.resolve_text)
        if list_secrets:
            self.register(self.list_secrets)

    def get_secret(self, name: str) -> str:
        """
        Retrieve a secret value from the local EnigmAgent AES-256-GCM vault.

        Args:
            name: Secret name (e.g. OPENAI_KEY, GITHUB_TOKEN).
        Returns:
            The secret value, or an error message.
        """
        v = _fetch(name.strip())
        return v or f'Secret "{name}" not found in vault.'

    def resolve_text(self, text: str) -> str:
        """
        Resolve all {{PLACEHOLDER}} tokens in text using the local EnigmAgent vault.

        Args:
            text: Text with {{SECRET_NAME}} tokens.
        Returns:
            Resolved text with vault values substituted.
        """
        names = list(set(re.findall(r"\{\{([A-Za-z0-9_]+)\}\}", text)))
        if not names:
            return text
        mapping = {n: v for n in names if (v := _fetch(n)) is not None}
        return re.sub(r"\{\{([A-Za-z0-9_]+)\}\}", lambda m: mapping.get(m.group(1), m.group(0)), text)

    def list_secrets(self) -> str:
        """
        List all secret names in the local EnigmAgent vault (names only, no values).

        Returns:
            Comma-separated list of secret names.
        """
        headers: dict[str, str] = {}
        if _VAULT_TOKEN:
            headers["Authorization"] = f"Bearer {_VAULT_TOKEN}"
        try:
            with httpx.Client(timeout=3.0) as c:
                r = c.get(f"{_VAULT_URL}/secrets", headers=headers)
                r.raise_for_status()
                secrets = r.json().get("secrets", [])
                names = [s.get("name", s) if isinstance(s, dict) else s for s in secrets]
                return ", ".join(names) or "No secrets stored."
        except Exception as e:
            return f"Vault error: {e}"


# Convenience instance
enigmagent_tools = EnigmAgentTools()


# ── Example ────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    from phi.agent import Agent
    from phi.model.openai import OpenAIChat

    key = _fetch("OPENAI_KEY") or "your-key"
    agent = Agent(
        model=OpenAIChat(id="gpt-4o-mini", api_key=key),
        tools=[enigmagent_tools],
        show_tool_calls=True,
    )
    agent.print_response("List all my EnigmAgent vault secrets.")
