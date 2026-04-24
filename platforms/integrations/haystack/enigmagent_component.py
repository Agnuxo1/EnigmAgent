"""
EnigmAgent Component for Haystack 2.x
=======================================
A Haystack Pipeline component that resolves {{PLACEHOLDER}} tokens
using the local EnigmAgent vault before passing text to other components.

REST API (enigmagent-mcp --mode rest --port 3737 --vault ./vault.json):
  GET  /status
  GET  /list
  POST /resolve  {"placeholder": "NAME", "origin": "https://..."}

Requirements:
    pip install haystack-ai
    enigmagent-mcp --mode rest --port 3737 --vault ./vault.json

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
import json
import urllib.request
import urllib.error
from typing import Optional
from haystack import component, default_from_dict, default_to_dict
from haystack.core.component import Component


def _post_resolve(vault_url: str, placeholder: str, origin: str, timeout: float = 5.0) -> Optional[str]:
    """Call POST /resolve on the EnigmAgent REST API."""
    url = f"{vault_url}/resolve"
    payload = json.dumps({"placeholder": placeholder, "origin": origin}).encode()
    req = urllib.request.Request(
        url, data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode())
            return data.get("value")
    except Exception:
        return None


@component
class EnigmAgentResolver:
    """
    Haystack component that resolves {{PLACEHOLDER}} tokens in text
    using the local EnigmAgent AES-256-GCM encrypted vault.
    """

    def __init__(
        self,
        vault_url: str = "http://127.0.0.1:3737",
        origin: str = "http://localhost",
    ):
        self.vault_url = vault_url.rstrip("/")
        self.origin = origin
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

        mapping: dict[str, str] = {}
        for name in names:
            if name in self._cache:
                mapping[name] = self._cache[name]
            else:
                value = _post_resolve(self.vault_url, name, self.origin)
                if value is not None:
                    self._cache[name] = value
                    mapping[name] = value

        resolved = re.sub(
            r"\{\{([A-Za-z0-9_]+)\}\}",
            lambda m: mapping.get(m.group(1), m.group(0)),
            text,
        )
        return {"resolved_text": resolved, "resolved_count": len(mapping)}

    def to_dict(self) -> dict:
        return default_to_dict(self, vault_url=self.vault_url, origin=self.origin)

    @classmethod
    def from_dict(cls, data: dict) -> "EnigmAgentResolver":
        return default_from_dict(cls, data)


@component
class EnigmAgentGetSecret:
    """
    Haystack component that retrieves a single secret from the vault by name.
    """

    def __init__(
        self,
        vault_url: str = "http://127.0.0.1:3737",
        origin: str = "http://localhost",
    ):
        self.vault_url = vault_url.rstrip("/")
        self.origin = origin

    @component.output_types(value=Optional[str], found=bool)
    def run(self, name: str) -> dict:
        value = _post_resolve(self.vault_url, name, self.origin)
        return {"value": value, "found": value is not None}


@component
class EnigmAgentListSecrets:
    """
    Haystack component that lists all secret names from the vault.
    """

    def __init__(self, vault_url: str = "http://127.0.0.1:3737"):
        self.vault_url = vault_url.rstrip("/")

    @component.output_types(names=list, count=int)
    def run(self) -> dict:
        url = f"{self.vault_url}/list"
        try:
            with urllib.request.urlopen(url, timeout=5) as resp:
                data = json.loads(resp.read().decode())
                entries = data.get("entries", [])
                names = [e.get("name", str(e)) if isinstance(e, dict) else str(e) for e in entries]
                return {"names": names, "count": len(names)}
        except Exception:
            return {"names": [], "count": 0}


# ── Example ────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    from haystack import Pipeline

    # Start vault first:
    # enigmagent-mcp --mode rest --port 3737 --vault ./vault.json

    pipe = Pipeline()
    pipe.add_component("resolver", EnigmAgentResolver(vault_url="http://127.0.0.1:3737"))

    result = pipe.run({"resolver": {"text": "My API key: {{OPENAI_KEY}}. Use it wisely."}})
    print(result["resolver"]["resolved_text"])
    print(f"Resolved {result['resolver']['resolved_count']} secret(s)")
