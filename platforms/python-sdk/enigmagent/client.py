"""Authenticated loopback-only client for EnigmAgent gateways and operation brokers.

No proxy settings, automatic redirects, credential logging or mandatory external
packages are used. Model-facing adapters must call execute(), never resolve().
"""
from __future__ import annotations

import http.client
import json
import math
import os
import re
import socket
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Any, Optional
from urllib.parse import urlsplit

_TOKEN = re.compile(r"[A-Za-z0-9_-]{32,256}\Z")
_NAME = re.compile(r"[A-Za-z0-9_:.@-]{1,128}\Z")
_OPERATION = re.compile(r"[A-Za-z][A-Za-z0-9_-]{0,63}\Z")
MAX_RESPONSE_BYTES = 8 * 1024 * 1024
VAULT_ERROR_CODES = frozenset({
    "vault_locked", "not_found", "no_domain_binding", "domain_mismatch", "vault_error",
    "unauthorized", "raw_resolve_disabled", "invalid_arguments", "request_too_large",
    "migration_required", "operation_not_allowed", "operation_timeout", "operation_failed",
    "destination_not_allowed", "redirect_not_allowed", "operation_response_too_large",
    "invalid_credential_header", "broker_busy", "server_unreachable", "timeout",
    "invalid_response", "response_too_large", "invalid_configuration", "resolve_error",
})


class VaultError(Exception):
    """A stable error code. Remote messages and response bodies are never propagated."""

    def __init__(self, code: str, message: str = "", placeholder: Optional[str] = None) -> None:
        self.code = code if code in VAULT_ERROR_CODES else "vault_error"
        self.placeholder = placeholder if isinstance(placeholder, str) and _NAME.fullmatch(placeholder) else None
        super().__init__(self.code)

    def __repr__(self) -> str:
        return f"VaultError(code={self.code!r})"


@dataclass(frozen=True, slots=True)
class VaultStatus:
    """Public gateway status, not proof of operating-system or process isolation."""
    status: str
    unlocked: bool
    version: str = ""
    raw_resolve_enabled: bool = False
    broker_enabled: bool = False
    vault_format: Optional[int] = None


@dataclass(frozen=True, slots=True)
class VaultEntry:
    """Metadata only. Names and domain bindings may themselves be sensitive."""
    id: str
    name: str
    domain: Optional[str]
    created: str


@dataclass(frozen=True, slots=True)
class OperationResult:
    """Only these three fields can leave a fixed-operation broker through this client."""
    operation: str
    status: int
    ok: bool


def _origin(value: str) -> str:
    if not isinstance(value, str) or len(value) > 2048:
        raise VaultError("invalid_arguments")
    try:
        parsed = urlsplit(value)
        if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError
        port = parsed.port
        host = parsed.hostname
        if ":" in host:
            host = f"[{host}]"
        suffix = f":{port}" if port is not None else ""
        return f"{parsed.scheme}://{host}{suffix}"
    except (TypeError, ValueError):
        raise VaultError("invalid_arguments") from None


class VaultClient:
    """A bounded, authenticated HTTP client that can connect only to local loopback.

    api_token defaults to ENIGMAGENT_API_TOKEN. Raw resolution requires a separate
    explicit allow_raw_resolve=True and a raw-enabled server. Broker and raw
    resolution cannot share the server transport in the integrated release.
    """
    __slots__ = ("_port", "_timeout", "origin", "__token", "_allow_raw", "_base")

    def __init__(self, host: str = "127.0.0.1", port: int = 3737, timeout: float = 5.0,
                 origin: str = "http://localhost", api_token: Optional[str] = None,
                 allow_raw_resolve: bool = False) -> None:
        token = api_token if api_token is not None else os.environ.get("ENIGMAGENT_API_TOKEN", "")
        if host not in ("127.0.0.1", "localhost") or type(port) is not int or not 1 <= port <= 65535:
            raise VaultError("invalid_configuration")
        if isinstance(timeout, bool) or not isinstance(timeout, (int, float)) or not math.isfinite(timeout) or not 0 < timeout <= 60:
            raise VaultError("invalid_configuration")
        if not isinstance(token, str) or not _TOKEN.fullmatch(token) or type(allow_raw_resolve) is not bool:
            raise VaultError("invalid_configuration")
        self._port, self._timeout = port, float(timeout)
        self.origin, self.__token = _origin(origin), token
        self._allow_raw, self._base = allow_raw_resolve, f"http://127.0.0.1:{port}"

    @classmethod
    def from_env(cls) -> "VaultClient":
        """Read only broker connection settings; never read a vault password."""
        try:
            port = int(os.environ.get("ENIGMAGENT_PORT", "3737"))
            timeout = float(os.environ.get("ENIGMAGENT_TIMEOUT", "5"))
        except ValueError:
            raise VaultError("invalid_configuration") from None
        return cls(port=port, timeout=timeout)

    @property
    def port(self) -> int:
        return self._port

    @property
    def timeout(self) -> float:
        return self._timeout

    def __repr__(self) -> str:
        return f"VaultClient(host='127.0.0.1', port={self._port}, authenticated=True)"

    def __getstate__(self) -> Any:
        """Credentials must be supplied at runtime, not pickled into framework state."""
        raise TypeError("VaultClient is not serializable; configure the token at runtime")

    def _request(self, path: str, payload: Optional[dict] = None) -> dict:
        """Make one direct local request with a body limit and an absolute deadline."""
        if path not in ("/status", "/list", "/resolve", "/operations", "/execute"):
            raise VaultError("invalid_arguments")
        body = None if payload is None else json.dumps(payload, separators=(",", ":")).encode("utf-8")
        if body is not None and len(body) > 16 * 1024:
            raise VaultError("request_too_large")
        connection = http.client.HTTPConnection("127.0.0.1", self._port, timeout=self._timeout)
        deadline = time.monotonic() + self._timeout
        expired = threading.Event()
        timer = None
        response = None
        try:
            connection.connect()
            transport = connection.sock
            if transport is None:
                raise VaultError("server_unreachable")
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise VaultError("timeout")
            transport.settimeout(remaining)

            def interrupt() -> None:
                expired.set()
                try:
                    transport.shutdown(socket.SHUT_RDWR)
                except OSError:
                    pass

            timer = threading.Timer(remaining, interrupt)
            timer.daemon = True
            timer.start()
            headers = {"Authorization": f"Bearer {self.__token}", "Accept": "application/json", "Connection": "close"}
            if body is not None:
                headers["Content-Type"] = "application/json"
            connection.request("GET" if payload is None else "POST", path, body=body, headers=headers)
            response = connection.getresponse()
            if 300 <= response.status < 400:
                raise VaultError("redirect_not_allowed")
            content_type = response.getheader("Content-Type", "").split(";", 1)[0].strip().lower()
            if content_type != "application/json" or response.getheader("Content-Encoding"):
                raise VaultError("invalid_response")
            length = response.getheader("Content-Length")
            if length is not None:
                if not length.isdigit():
                    raise VaultError("invalid_response")
                if int(length) > MAX_RESPONSE_BYTES:
                    raise VaultError("response_too_large")
            chunks = bytearray()
            while True:
                if expired.is_set() or time.monotonic() >= deadline:
                    raise VaultError("timeout")
                chunk = response.read1(min(65536, MAX_RESPONSE_BYTES + 1 - len(chunks)))
                if not chunk:
                    break
                chunks.extend(chunk)
                if len(chunks) > MAX_RESPONSE_BYTES:
                    raise VaultError("response_too_large")
            if expired.is_set() or time.monotonic() >= deadline:
                raise VaultError("timeout")
            if length is not None and len(chunks) != int(length):
                raise VaultError("invalid_response")
            value = json.loads(chunks.decode("utf-8"))
            if not isinstance(value, dict):
                raise VaultError("invalid_response")
            if response.status != 200:
                code = value.get("error")
                raise VaultError(code if isinstance(code, str) and code in VAULT_ERROR_CODES else "vault_error")
            return value
        except VaultError:
            raise
        except (TimeoutError, socket.timeout):
            raise VaultError("timeout") from None
        except (http.client.HTTPException, OSError, UnicodeError, ValueError):
            raise VaultError("timeout" if expired.is_set() else "invalid_response" if response is not None else "server_unreachable") from None
        finally:
            if timer is not None:
                timer.cancel()
            if response is not None:
                response.close()
            connection.close()

    def _get(self, path: str) -> dict:
        return self._request(path)

    def _post(self, path: str, payload: dict) -> dict:
        return self._request(path, payload)

    def get_status(self) -> VaultStatus:
        """Validate public health metadata without accepting arbitrary server text."""
        data = self._get("/status")
        if data.get("status") != "ok" or type(data.get("unlocked")) is not bool:
            raise VaultError("invalid_response")
        for field in ("rawResolveEnabled", "brokerEnabled"):
            if field in data and type(data[field]) is not bool:
                raise VaultError("invalid_response")
        version = data.get("version", "")
        if not isinstance(version, str) or len(version) > 64:
            raise VaultError("invalid_response")
        vault_format = data.get("vaultFormat")
        if vault_format is not None and (type(vault_format) is not int or vault_format not in (1, 2)):
            raise VaultError("invalid_response")
        return VaultStatus("ok", data["unlocked"], version, data.get("rawResolveEnabled", False), data.get("brokerEnabled", False), vault_format)

    def list_secrets(self) -> list[VaultEntry]:
        """Return an explicit metadata projection, never unknown response fields."""
        values = self._get("/list").get("entries")
        if not isinstance(values, list) or len(values) > 4096:
            raise VaultError("invalid_response")
        entries = []
        for entry in values:
            if not isinstance(entry, dict) or any(not isinstance(entry.get(key), str) or len(entry[key]) > limit
                    for key, limit in (("id", 128), ("name", 128), ("created", 64))):
                raise VaultError("invalid_response")
            domain = entry.get("domain")
            if domain is not None and (not isinstance(domain, str) or len(domain) > 253):
                raise VaultError("invalid_response")
            entries.append(VaultEntry(entry["id"], entry["name"], domain, entry["created"]))
        return entries

    def list_operations(self) -> list[str]:
        """List only the names of operations approved by the local operator."""
        values = self._get("/operations").get("operations")
        if not isinstance(values, list) or len(values) > 64:
            raise VaultError("invalid_response")
        result = []
        for item in values:
            name = item.get("name") if isinstance(item, dict) else None
            if not isinstance(name, str) or not _OPERATION.fullmatch(name) or name in result:
                raise VaultError("invalid_response")
            result.append(name)
        return result

    def execute(self, operation: str) -> OperationResult:
        """Request an approved operation; arbitrary destinations/headers are not accepted."""
        if not isinstance(operation, str) or not _OPERATION.fullmatch(operation):
            raise VaultError("invalid_arguments")
        data = self._post("/execute", {"operation": operation})
        status = data.get("status")
        if data.get("operation") != operation or type(status) is not int or not 100 <= status <= 599 or \
                type(data.get("ok")) is not bool or data["ok"] != (200 <= status < 300):
            raise VaultError("invalid_response")
        return OperationResult(operation, status, data["ok"])

    def resolve(self, placeholder: str, origin: Optional[str] = None) -> str:
        """Trusted backend escape hatch. Never expose this function as an agent tool."""
        if not self._allow_raw:
            raise VaultError("raw_resolve_disabled")
        if not isinstance(placeholder, str) or not _NAME.fullmatch(placeholder):
            raise VaultError("invalid_arguments")
        data = self._post("/resolve", {"placeholder": placeholder, "origin": _origin(self.origin if origin is None else origin)})
        value = data.get("value")
        if not isinstance(value, str):
            raise VaultError("invalid_response")
        return value

    def resolve_batch(self, placeholders: list[str], origin: Optional[str] = None,
                      max_workers: int = 8) -> dict[str, "str | VaultError"]:
        """Resolve explicit trusted-backend requests; empty input needs no executor."""
        if not isinstance(placeholders, list) or len(placeholders) > 4096 or type(max_workers) is not int or not 1 <= max_workers <= 32:
            raise VaultError("invalid_arguments")
        if any(not isinstance(name, str) or not _NAME.fullmatch(name) for name in placeholders):
            raise VaultError("invalid_arguments")
        if not placeholders:
            return {}
        names = list(dict.fromkeys(placeholders))
        results: dict[str, str | VaultError] = {}
        with ThreadPoolExecutor(max_workers=min(max_workers, len(names))) as pool:
            futures = {pool.submit(self.resolve, name, origin): name for name in names}
            for future in as_completed(futures):
                name = futures[future]
                try:
                    results[name] = future.result()
                except VaultError as error:
                    results[name] = error
                except Exception:
                    results[name] = VaultError("vault_error")
        return results


_default_client: Optional[VaultClient] = None
_default_lock = threading.RLock()


def configure(**settings: Any) -> VaultClient:
    """Replace the default trusted backend client without serializing credentials."""
    global _default_client
    client = VaultClient(**settings)
    with _default_lock:
        _default_client = client
    return client


def get_client(**settings: Any) -> VaultClient:
    """Explicit settings replace the singleton; omitted settings reuse it."""
    global _default_client
    with _default_lock:
        if settings:
            return configure(**settings)
        if _default_client is None:
            _default_client = VaultClient.from_env()
        return _default_client
