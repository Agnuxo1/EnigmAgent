"""
EnigmAgent Hermes Plugin — vault HTTP client.

Communicates with the EnigmAgent REST API running on localhost.
The server must be started separately before Hermes is launched:

    enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json

Uses only Python standard-library modules (no extra dependencies).
All requests go to 127.0.0.1 — the vault API is never on the network.
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional

logger = logging.getLogger(__name__)

# ── Error types ────────────────────────────────────────────────────────────────

VAULT_ERROR_CODES = {
    "vault_locked",
    "not_found",
    "no_domain_binding",
    "domain_mismatch",
    "resolve_error",
    "server_unreachable",
    "timeout",
}


class VaultError(Exception):
    """Raised when the EnigmAgent vault returns an error or is unreachable."""

    def __init__(
        self,
        code: str,
        message: str,
        placeholder: Optional[str] = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.placeholder = placeholder

    def __repr__(self) -> str:
        return f"VaultError(code={self.code!r}, placeholder={self.placeholder!r})"


# ── VaultClient ────────────────────────────────────────────────────────────────


class VaultClient:
    """
    Minimal HTTP client for the EnigmAgent local REST API.

    Args:
        host:       API host (default: 127.0.0.1).
        port:       API port (default: 3737).
        timeout_s:  Per-request timeout in seconds (default: 5).
    """

    def __init__(
        self,
        host: str = "127.0.0.1",
        port: int = 3737,
        timeout_s: float = 5.0,
    ) -> None:
        self._base = f"http://{host}:{port}"
        self._timeout = timeout_s

    # ── Low-level request helper ──────────────────────────────────────────────

    def _get(self, path: str) -> dict:
        url = f"{self._base}{path}"
        try:
            with urllib.request.urlopen(url, timeout=self._timeout) as resp:
                data = json.loads(resp.read().decode())
            return data
        except urllib.error.HTTPError as exc:
            body = {}
            try:
                body = json.loads(exc.read().decode())
            except Exception:
                pass
            code = body.get("error", "resolve_error")
            msg  = body.get("message", str(exc))
            raise VaultError(code, msg) from exc
        except (urllib.error.URLError, OSError) as exc:
            raise VaultError(
                "server_unreachable",
                f"EnigmAgent server unreachable at {self._base} — is it running? "
                f"Start with: enigmagent-mcp --mode rest --port {self._base.split(':')[-1]} "
                f"--vault ~/.enigmagent/vault.json",
            ) from exc
        except TimeoutError as exc:
            raise VaultError(
                "timeout",
                f"EnigmAgent server timed out after {self._timeout}s",
            ) from exc

    def _post(self, path: str, payload: dict) -> dict:
        url  = f"{self._base}{path}"
        data = json.dumps(payload).encode()
        req  = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self._timeout) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as exc:
            body = {}
            try:
                body = json.loads(exc.read().decode())
            except Exception:
                pass
            code = body.get("error", "resolve_error")
            msg  = body.get("message", str(exc))
            raise VaultError(code, msg) from exc
        except (urllib.error.URLError, OSError) as exc:
            raise VaultError(
                "server_unreachable",
                f"EnigmAgent server unreachable at {self._base}",
            ) from exc
        except TimeoutError as exc:
            raise VaultError("timeout", f"Timed out after {self._timeout}s") from exc

    # ── Public API ────────────────────────────────────────────────────────────

    def get_status(self) -> dict:
        """
        Check whether the vault server is running and the vault is unlocked.

        Returns:
            {"status": "ok", "unlocked": bool}

        Raises:
            VaultError with code="server_unreachable" if the server is not running.
        """
        return self._get("/status")

    def list_secrets(self) -> list[dict]:
        """
        List all secrets by name and domain — never returns actual values.

        Returns:
            List of {"id": str, "name": str, "domain": str|None, "created": str}

        Raises:
            VaultError with code="vault_locked" if vault is locked.
        """
        data = self._get("/list")
        return data.get("entries", [])

    def resolve(self, placeholder: str, origin: str) -> str:
        """
        Resolve a ``{{PLACEHOLDER}}`` name to its real value.

        Args:
            placeholder:  The name without braces, e.g. ``GITHUB_TOKEN``,
                          ``LOGIN:github.com``, ``DOC:report.md``.
            origin:       The requesting origin for domain-binding checks.
                          Use ``http://localhost`` for local Hermes tool calls.

        Returns:
            The decrypted secret value as a plain string.

        Raises:
            VaultError with appropriate code on failure.
        """
        data = self._post("/resolve", {"placeholder": placeholder, "origin": origin})
        value = data.get("value")
        if value is None:
            raise VaultError("resolve_error", "Server returned no value")
        return value

    def resolve_batch(
        self,
        items: list[tuple[str, str]],
        max_workers: int = 8,
    ) -> dict[str, str | VaultError]:
        """
        Resolve multiple ``(placeholder, origin)`` pairs in parallel.

        Returns:
            Mapping of placeholder → resolved_value or VaultError.
            Errors are captured per-placeholder — a single failure
            does not block the rest.
        """
        results: dict[str, str | VaultError] = {}

        with ThreadPoolExecutor(max_workers=min(max_workers, len(items))) as pool:
            futures = {
                pool.submit(self.resolve, placeholder, origin): placeholder
                for placeholder, origin in items
            }
            for fut in as_completed(futures):
                placeholder = futures[fut]
                try:
                    results[placeholder] = fut.result()
                except VaultError as exc:
                    results[placeholder] = exc
                except Exception as exc:
                    results[placeholder] = VaultError("resolve_error", str(exc), placeholder)

        return results
