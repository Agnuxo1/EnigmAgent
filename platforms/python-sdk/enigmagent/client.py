"""
enigmagent.client — HTTP client for the EnigmAgent local vault REST API.

Zero external dependencies. Works with Python 3.9+.

The vault server must be started separately:
    enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json

All requests go to 127.0.0.1 only — never exposed to the network.
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

# ── Error types ────────────────────────────────────────────────────────────────

VAULT_ERROR_CODES = frozenset({
    "vault_locked",
    "not_found",
    "no_domain_binding",
    "domain_mismatch",
    "resolve_error",
    "server_unreachable",
    "timeout",
})


class VaultError(Exception):
    """Raised when the EnigmAgent vault returns an error or is unreachable."""

    def __init__(self, code: str, message: str, placeholder: Optional[str] = None) -> None:
        super().__init__(message)
        self.code = code
        self.placeholder = placeholder

    def __repr__(self) -> str:
        return f"VaultError(code={self.code!r}, placeholder={self.placeholder!r})"


# ── Data classes ───────────────────────────────────────────────────────────────

@dataclass
class VaultStatus:
    status: str        # "ok" | "error"
    unlocked: bool


@dataclass
class VaultEntry:
    id: str
    name: str
    domain: Optional[str]
    created: str


# ── Client ─────────────────────────────────────────────────────────────────────

class VaultClient:
    """
    HTTP client for the EnigmAgent local REST API.

    Args:
        host:      API host (default: 127.0.0.1).
        port:      API port (default: 3737).
        timeout:   Per-request timeout in seconds (default: 5.0).
        origin:    Default origin for domain-binding checks.
                   Use "http://localhost" for all local agent tooling.
    """

    def __init__(
        self,
        host: str = "127.0.0.1",
        port: int = 3737,
        timeout: float = 5.0,
        origin: str = "http://localhost",
    ) -> None:
        self._base   = f"http://{host}:{port}"
        self._timeout = timeout
        self.origin  = origin

    # ── Internal helpers ───────────────────────────────────────────────────────

    def _get(self, path: str) -> dict:
        url = f"{self._base}{path}"
        try:
            with urllib.request.urlopen(url, timeout=self._timeout) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as exc:
            body: dict = {}
            try:
                body = json.loads(exc.read().decode())
            except Exception:
                pass
            raise VaultError(body.get("error", "resolve_error"), body.get("message", str(exc))) from exc
        except (urllib.error.URLError, OSError) as exc:
            raise VaultError(
                "server_unreachable",
                f"EnigmAgent server unreachable at {self._base} — "
                f"start with: enigmagent-mcp --mode rest --port {self._base.split(':')[-1]} "
                f"--vault ~/.enigmagent/vault.json",
            ) from exc

    def _post(self, path: str, payload: dict) -> dict:
        url  = f"{self._base}{path}"
        data = json.dumps(payload).encode()
        req  = urllib.request.Request(url, data=data,
                                      headers={"Content-Type": "application/json"},
                                      method="POST")
        try:
            with urllib.request.urlopen(req, timeout=self._timeout) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as exc:
            body: dict = {}
            try:
                body = json.loads(exc.read().decode())
            except Exception:
                pass
            raise VaultError(body.get("error", "resolve_error"), body.get("message", str(exc))) from exc
        except (urllib.error.URLError, OSError) as exc:
            raise VaultError("server_unreachable", f"EnigmAgent server unreachable at {self._base}") from exc

    # ── Public API ─────────────────────────────────────────────────────────────

    def get_status(self) -> VaultStatus:
        """Check whether the vault server is running and unlocked."""
        data = self._get("/status")
        return VaultStatus(status=data.get("status", "ok"), unlocked=bool(data.get("unlocked", False)))

    def list_secrets(self) -> list[VaultEntry]:
        """List all secrets — names and domains only, never values."""
        data = self._get("/list")
        return [
            VaultEntry(id=e["id"], name=e["name"], domain=e.get("domain"), created=e["created"])
            for e in data.get("entries", [])
        ]

    def resolve(self, placeholder: str, origin: Optional[str] = None) -> str:
        """
        Resolve a placeholder to its real value.

        Args:
            placeholder:  Name without braces — e.g. ``GITHUB_TOKEN``,
                          ``LOGIN:github.com``, ``DOC:policy.md``.
            origin:       Requesting origin. Uses client default if not set.

        Returns:
            The decrypted secret value as a string.

        Raises:
            VaultError on failure.
        """
        data = self._post("/resolve", {
            "placeholder": placeholder,
            "origin":      origin or self.origin,
        })
        value = data.get("value")
        if value is None:
            raise VaultError("resolve_error", "Server returned no value", placeholder)
        return value

    def resolve_batch(
        self,
        placeholders: list[str],
        origin: Optional[str] = None,
        max_workers: int = 8,
    ) -> dict[str, "str | VaultError"]:
        """
        Resolve multiple placeholders in parallel.

        Returns a dict mapping placeholder → value or VaultError.
        Individual errors are captured without blocking others.
        """
        results: dict[str, str | VaultError] = {}
        effective_origin = origin or self.origin

        with ThreadPoolExecutor(max_workers=min(max_workers, len(placeholders))) as pool:
            futures = {
                pool.submit(self.resolve, p, effective_origin): p
                for p in placeholders
            }
            for fut in as_completed(futures):
                p = futures[fut]
                try:
                    results[p] = fut.result()
                except VaultError as exc:
                    results[p] = exc
                except Exception as exc:
                    results[p] = VaultError("resolve_error", str(exc), p)

        return results


# ── Module-level convenience singleton ────────────────────────────────────────

_default_client: Optional[VaultClient] = None


def get_client(
    host: str = "127.0.0.1",
    port: int = 3737,
    timeout: float = 5.0,
    origin: str = "http://localhost",
) -> VaultClient:
    """Return the module-level default VaultClient, creating it if needed."""
    global _default_client
    if _default_client is None:
        _default_client = VaultClient(host=host, port=port, timeout=timeout, origin=origin)
    return _default_client


def configure(
    host: str = "127.0.0.1",
    port: int = 3737,
    timeout: float = 5.0,
    origin: str = "http://localhost",
) -> VaultClient:
    """Create and set a new default VaultClient with the given settings."""
    global _default_client
    _default_client = VaultClient(host=host, port=port, timeout=timeout, origin=origin)
    return _default_client
