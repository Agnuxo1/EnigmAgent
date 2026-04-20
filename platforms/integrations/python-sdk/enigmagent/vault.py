"""
EnigmAgent Python SDK
======================
High-level API for the local EnigmAgent vault.

Usage:
    from enigmagent import Vault
    vault = Vault()
    key = vault.get("OPENAI_KEY")
    prompt = vault.resolve("Use key {{OPENAI_KEY}} to call the API.")

Install:
    pip install enigmagent
"""

from __future__ import annotations

import re
import os
import json
import httpx
from typing import Optional


class Vault:
    """
    Client for the local EnigmAgent AES-256-GCM encrypted vault.

    Attributes:
        vault_url: Base URL of the vault REST API (default: http://127.0.0.1:39517).
        vault_token: Optional bearer token for authenticated vaults.
        cache: Whether to cache secret values in memory (default: True).
    """

    DEFAULT_URL = "http://127.0.0.1:39517"

    def __init__(
        self,
        vault_url: str | None = None,
        vault_token: str | None = None,
        cache: bool = True,
        timeout: float = 5.0,
    ):
        self.vault_url = (vault_url or os.environ.get("ENIGMAGENT_URL") or self.DEFAULT_URL).rstrip("/")
        self.vault_token = vault_token or os.environ.get("ENIGMAGENT_TOKEN") or ""
        self.timeout = timeout
        self._cache_enabled = cache
        self._cache: dict[str, str] = {}

    # ── Public API ────────────────────────────────────────────────────────────

    def get(self, name: str) -> str:
        """
        Retrieve a secret value by name.

        Raises:
            KeyError: If the secret is not found in the vault.
            RuntimeError: If the vault is unreachable.
        """
        value = self._fetch(name)
        if value is None:
            raise KeyError(f'Secret "{name}" not found in EnigmAgent vault.')
        return value

    def get_or_default(self, name: str, default: str = "") -> str:
        """Retrieve a secret value, returning *default* if not found."""
        return self._fetch(name) or default

    def resolve(self, text: str) -> str:
        """
        Replace every {{NAME}} token in *text* with the vault value for NAME.
        Unknown placeholders are left unchanged.
        """
        names = list(set(re.findall(r"\{\{([A-Za-z0-9_]+)\}\}", text)))
        if not names:
            return text
        mapping = {n: v for n in names if (v := self._fetch(n)) is not None}
        return re.sub(r"\{\{([A-Za-z0-9_]+)\}\}", lambda m: mapping.get(m.group(1), m.group(0)), text)

    def list(self) -> list[dict]:
        """
        Return a list of secret metadata dicts (name, domain) — never values.
        """
        resp = self._request("GET", "/secrets")
        return resp.get("secrets", [])

    def health(self) -> dict:
        """Return vault health info (status, count, version)."""
        return self._request("GET", "/health")

    def clear_cache(self) -> None:
        """Clear the in-memory secret cache."""
        self._cache.clear()

    # ── Context manager support ───────────────────────────────────────────────

    def __enter__(self) -> "Vault":
        return self

    def __exit__(self, *_) -> None:
        self.clear_cache()

    # ── Private helpers ───────────────────────────────────────────────────────

    def _fetch(self, name: str) -> Optional[str]:
        if self._cache_enabled and name in self._cache:
            return self._cache[name]
        try:
            data = self._request("GET", f"/secret/{name}")
            value = data.get("value")
            if value and self._cache_enabled:
                self._cache[name] = value
            return value
        except Exception:
            return None

    def _headers(self) -> dict[str, str]:
        h: dict[str, str] = {"Accept": "application/json"}
        if self.vault_token:
            h["Authorization"] = f"Bearer {self.vault_token}"
        return h

    def _request(self, method: str, path: str, **kwargs) -> dict:
        url = f"{self.vault_url}{path}"
        try:
            with httpx.Client(timeout=self.timeout) as c:
                r = c.request(method, url, headers=self._headers(), **kwargs)
                r.raise_for_status()
                return r.json()
        except httpx.HTTPStatusError as e:
            raise RuntimeError(f"Vault returned {e.response.status_code} for {path}") from e
        except httpx.RequestError as e:
            raise RuntimeError(
                f"Cannot reach EnigmAgent vault at {self.vault_url}. "
                "Is it running? Run: enigmagent serve"
            ) from e


# ── Module-level convenience functions ────────────────────────────────────────

_default_vault: Optional[Vault] = None


def _vault() -> Vault:
    global _default_vault
    if _default_vault is None:
        _default_vault = Vault()
    return _default_vault


def get(name: str) -> str:
    """Module-level shortcut for Vault().get(name)."""
    return _vault().get(name)


def resolve(text: str) -> str:
    """Module-level shortcut for Vault().resolve(text)."""
    return _vault().resolve(text)


def configure(vault_url: str, vault_token: str = "") -> None:
    """Configure the module-level default vault."""
    global _default_vault
    _default_vault = Vault(vault_url=vault_url, vault_token=vault_token)
