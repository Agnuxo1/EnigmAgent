"""
Tests for enigmagent.client — uses unittest.mock to avoid requiring a live vault.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from unittest.mock import MagicMock, patch

import pytest

from enigmagent.client import (
    VaultClient,
    VaultEntry,
    VaultError,
    VaultStatus,
    configure,
    get_client,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_response(body: dict, status: int = 200):
    """Return a mock urllib response with JSON body."""
    data = json.dumps(body).encode()
    mock = MagicMock()
    mock.read.return_value = data
    mock.status = status
    mock.__enter__ = lambda s: s
    mock.__exit__ = MagicMock(return_value=False)
    return mock


# ---------------------------------------------------------------------------
# VaultClient.get_status
# ---------------------------------------------------------------------------

class TestGetStatus:
    def test_unlocked(self):
        client = VaultClient()
        with patch("urllib.request.urlopen", return_value=_mock_response(
            {"status": "ok", "unlocked": True}
        )):
            status = client.get_status()
        assert isinstance(status, VaultStatus)
        assert status.unlocked is True

    def test_locked(self):
        client = VaultClient()
        with patch("urllib.request.urlopen", return_value=_mock_response(
            {"status": "ok", "unlocked": False}
        )):
            status = client.get_status()
        assert status.unlocked is False

    def test_connection_error_raises_vault_error(self):
        client = VaultClient()
        with patch("urllib.request.urlopen", side_effect=OSError("refused")):
            with pytest.raises(VaultError) as exc_info:
                client.get_status()
        assert exc_info.value.code == "server_unreachable"


# ---------------------------------------------------------------------------
# VaultClient.list_secrets
# ---------------------------------------------------------------------------

class TestListSecrets:
    def test_returns_entries(self):
        client = VaultClient()
        payload = {
            "entries": [
                {"id": "1", "name": "GITHUB_TOKEN", "domain": "@localhost", "created": "2024-01-01"},
                {"id": "2", "name": "OPENAI_API_KEY", "domain": "@localhost", "created": "2024-01-02"},
            ]
        }
        with patch("urllib.request.urlopen", return_value=_mock_response(payload)):
            entries = client.list_secrets()
        assert len(entries) == 2
        assert all(isinstance(e, VaultEntry) for e in entries)
        assert entries[0].name == "GITHUB_TOKEN"

    def test_empty_vault(self):
        client = VaultClient()
        with patch("urllib.request.urlopen", return_value=_mock_response({"entries": []})):
            entries = client.list_secrets()
        assert entries == []


# ---------------------------------------------------------------------------
# VaultClient.resolve
# ---------------------------------------------------------------------------

class TestResolve:
    def test_success(self):
        client = VaultClient()
        with patch("urllib.request.urlopen", return_value=_mock_response(
            {"value": "ghp_supersecret"}
        )):
            value = client.resolve("GITHUB_TOKEN")
        assert value == "ghp_supersecret"

    def test_http_error_raises_vault_error(self):
        client = VaultClient()
        err_body = json.dumps({"error": "not_found", "message": "Secret not found"}).encode()
        fp = MagicMock()
        fp.read.return_value = err_body
        http_err = urllib.error.HTTPError(
            url="http://127.0.0.1:3737/resolve",
            code=404,
            msg="Not Found",
            hdrs=None,  # type: ignore[arg-type]
            fp=fp,
        )
        with patch("urllib.request.urlopen", side_effect=http_err):
            with pytest.raises(VaultError) as exc_info:
                client.resolve("NONEXISTENT")
        assert exc_info.value.code == "not_found"


# ---------------------------------------------------------------------------
# VaultClient.resolve_batch
# ---------------------------------------------------------------------------

class TestResolveBatch:
    def test_returns_dict(self):
        client = VaultClient()
        counter = {"n": 0}

        def side_effect(req, *args, **kwargs):
            counter["n"] += 1
            return _mock_response({"value": f"val{counter['n']}"})

        placeholders = ["A", "B", "C"]
        with patch("urllib.request.urlopen", side_effect=side_effect):
            result = client.resolve_batch(placeholders)

        assert isinstance(result, dict)
        assert set(result.keys()) == set(placeholders)

    def test_all_values_are_strings(self):
        client = VaultClient()
        with patch("urllib.request.urlopen", return_value=_mock_response({"value": "ok"})):
            result = client.resolve_batch(["X", "Y"])
        assert all(isinstance(v, str) for v in result.values())


# ---------------------------------------------------------------------------
# Module-level helpers
# ---------------------------------------------------------------------------

class TestModuleHelpers:
    def test_get_client_returns_vault_client(self):
        c = get_client()
        assert isinstance(c, VaultClient)

    def test_configure_returns_vault_client(self):
        c = configure(host="10.0.0.1", port=9999)
        assert isinstance(c, VaultClient)
        assert "10.0.0.1" in c._base
        assert "9999" in c._base

    def test_get_client_returns_same_singleton(self):
        configure(host="127.0.0.1", port=3737)  # reset
        c1 = get_client()
        c2 = get_client()
        assert c1 is c2
