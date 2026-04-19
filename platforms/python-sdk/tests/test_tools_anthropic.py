"""
Tests for enigmagent.tools.anthropic_sdk — mocked vault and Anthropic client.
Skipped if anthropic is not installed.
"""
from __future__ import annotations

import json
from unittest.mock import MagicMock

import pytest

pytest.importorskip("anthropic", reason="anthropic SDK not installed")

from enigmagent.client import VaultClient, VaultEntry, VaultStatus, VaultError
from enigmagent.tools.anthropic_sdk import (
    get_enigmagent_tool_schemas,
    handle_tool_call,
)


def _mock_client(unlocked: bool = True):
    c = MagicMock(spec=VaultClient)
    c.get_status.return_value = VaultStatus(status="ok", unlocked=unlocked)
    c.list_secrets.return_value = [
        VaultEntry(id="1", name="MY_SECRET", domain="@localhost", created="2024-01-01"),
    ]
    return c


class TestToolSchemas:
    def test_returns_two_schemas(self):
        schemas = get_enigmagent_tool_schemas()
        assert len(schemas) == 2
        names = {s["name"] for s in schemas}
        assert "enigmagent_vault_status" in names
        assert "enigmagent_vault_list" in names

    def test_schemas_have_input_schema(self):
        for schema in get_enigmagent_tool_schemas():
            assert "input_schema" in schema
            assert schema["input_schema"]["type"] == "object"


class TestHandleToolCall:
    def test_vault_status_unlocked(self):
        result = json.loads(handle_tool_call("enigmagent_vault_status", {}, _mock_client(True)))
        assert result["unlocked"] is True

    def test_vault_status_locked(self):
        result = json.loads(handle_tool_call("enigmagent_vault_status", {}, _mock_client(False)))
        assert result["unlocked"] is False

    def test_vault_list(self):
        result = json.loads(handle_tool_call("enigmagent_vault_list", {}, _mock_client()))
        assert result["count"] == 1
        assert result["entries"][0]["name"] == "MY_SECRET"

    def test_unknown_tool(self):
        result = json.loads(handle_tool_call("nonexistent_tool", {}, _mock_client()))
        assert result["error"] == "UNKNOWN_TOOL"

    def test_vault_error_returned_as_json(self):
        c = MagicMock(spec=VaultClient)
        c.get_status.side_effect = VaultError("server_unreachable", "refused")
        result = json.loads(handle_tool_call("enigmagent_vault_status", {}, c))
        assert result["error"] == "server_unreachable"
