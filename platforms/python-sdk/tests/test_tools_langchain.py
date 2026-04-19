"""
Tests for enigmagent.tools.langchain — mocked vault, no live server needed.
Skipped if langchain-core is not installed.
"""
from __future__ import annotations

import json
from unittest.mock import MagicMock

import pytest

pytest.importorskip("langchain_core", reason="langchain-core not installed")

from enigmagent.client import VaultClient, VaultEntry, VaultError, VaultStatus
from enigmagent.tools.langchain import (
    EnigmAgentVaultListTool,
    EnigmAgentVaultStatusTool,
    get_enigmagent_tools,
)


def _mock_client(unlocked: bool = True, entries=None):
    c = MagicMock(spec=VaultClient)
    c.get_status.return_value = VaultStatus(status="ok", unlocked=unlocked)
    c.list_secrets.return_value = entries or [
        VaultEntry(id="1", name="GITHUB_TOKEN", domain="@localhost", created="2024-01-01"),
    ]
    return c


class TestVaultStatusTool:
    def test_unlocked_message(self):
        tool = EnigmAgentVaultStatusTool(client=_mock_client(unlocked=True))
        result = tool._run()
        data = json.loads(result)
        assert data["unlocked"] is True

    def test_locked_message(self):
        tool = EnigmAgentVaultStatusTool(client=_mock_client(unlocked=False))
        result = tool._run()
        data = json.loads(result)
        assert data["unlocked"] is False

    def test_connection_error(self):
        c = MagicMock(spec=VaultClient)
        c.get_status.side_effect = VaultError("server_unreachable", "refused")
        tool = EnigmAgentVaultStatusTool(client=c)
        with pytest.raises(Exception):
            tool._run()


class TestVaultListTool:
    def test_returns_entries(self):
        tool = EnigmAgentVaultListTool(client=_mock_client())
        result = tool._run()
        data = json.loads(result)
        assert data["count"] == 1
        assert data["entries"][0]["name"] == "GITHUB_TOKEN"


class TestGetTools:
    def test_returns_two_tools(self):
        tools = get_enigmagent_tools(client=_mock_client())
        assert len(tools) == 2
        names = {t.name for t in tools}
        assert "enigmagent_vault_status" in names
        assert "enigmagent_vault_list" in names
