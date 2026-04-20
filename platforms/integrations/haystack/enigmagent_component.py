"""
EnigmAgent Component for Haystack 2.x
=======================================
A Haystack Pipeline component that resolves {{PLACEHOLDER}} tokens
using the local EnigmAgent vault before passing text to other components.

Requirements:
    pip install haystack-ai httpx
    enigmagent serve --port 39517

Usage in a Pipeline:
    from haystack import Pipeline
    from enigmagent_component import EnigmAgentResolver

    pipe = Pipeline()
    pipe.add_component("resolver", EnigmAgentResolver())
    pipe.add_component("llm", OpenAIGenerator(...))
    pipe.connect("resolver.resolved_text", "llm.prompt")

    pipe.run({"resolver": {"text": "Use key {{OPENAI_KEY}} to..."}})
"""

import re
import httpx
import os
from typing import Optional
from haystack import component, default_from_dict, default_to_dict
from haystack.core.component import Component


@component
class EnigmAgentResolver:
    """
    Haystack component that resolves {{PLACEHOLDER}} tokens in text
    using the local EnigmAgent AES-256-GCM encrypted vault.
    """

    def __init__(
        self,
        vault_url: str = "http://127.0.0.1:39517",
        vault_token: str = "",
    ):
        self.vault_url = vault_url.rstrip("/")
        self.vault_token = vault_token
        self._cache: dict[str, str] = {}

    @component.output_types(resolved_text=str, resolved_count=int)
    def run(self, text: str) -> dict:
        """
        Resolve {{PLACEHOLDER}} tokens in *text*.

        Args:
            text: Input string with {{SECRET_NAME}} tokens.

        Returns:
            resolved_text: Text with secrets substituted.
            resolved_count: Number of secrets resolved.
        """
        names = list(set(re.findall(r"\{\{([A-Za-z0-9_]+)\}\}", text)))
        if not names:
            return {"resolved_text": text, "resolved_count": 0}

        mapping = {n: v for n in names if (v := self._fetch(n)) is not None}
        resolved = re.sub(
            r"\{\{([A-Za-z0-9_]+)\}\}",
            lambda m: mapping.get(m.group(1), m.group(0)),
            text,
        )
        return {"resolved_text": resolved, "resolved_count": len(mapping)}

    def _fetch(self, name: str) -> str | None:
        if name in self._cache:
            return self._cache[name]
        headers: dict[str, str] = {}
        if self.vault_token:
            headers["Authorization"] = f"Bearer {self.vault_token}"
        try:
            with httpx.Client(timeout=3.0) as c:
                r = c.get(f"{self.vault_url}/secret/{name}", headers=headers)
                r.raise_for_status()
                value = r.json().get("value")
                if value:
                    self._cache[name] = value
                return value
        except Exception:
            return None

    def to_dict(self) -> dict:
        return default_to_dict(self, vault_url=self.vault_url, vault_token="")

    @classmethod
    def from_dict(cls, data: dict) -> "EnigmAgentResolver":
        return default_from_dict(cls, data)


@component
class EnigmAgentGetSecret:
    """
    Haystack component that retrieves a single secret from the vault by name.
    """

    def __init__(self, vault_url: str = "http://127.0.0.1:39517", vault_token: str = ""):
        self.vault_url = vault_url.rstrip("/")
        self.vault_token = vault_token

    @component.output_types(value=Optional[str], found=bool)
    def run(self, name: str) -> dict:
        headers: dict[str, str] = {}
        if self.vault_token:
            headers["Authorization"] = f"Bearer {self.vault_token}"
        try:
            with httpx.Client(timeout=3.0) as c:
                r = c.get(f"{self.vault_url}/secret/{name}", headers=headers)
                r.raise_for_status()
                value = r.json().get("value")
                return {"value": value, "found": value is not None}
        except Exception:
            return {"value": None, "found": False}


# ── Example ────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    from haystack import Pipeline

    pipe = Pipeline()
    pipe.add_component("resolver", EnigmAgentResolver())

    result = pipe.run({"resolver": {"text": "My API key: {{OPENAI_KEY}}. Use it wisely."}})
    print(result["resolver"]["resolved_text"])
    print(f"Resolved {result['resolver']['resolved_count']} secret(s)")
