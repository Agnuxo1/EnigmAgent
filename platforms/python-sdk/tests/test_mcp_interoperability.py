"""Verify the actual MCP protocol through the independently installed official client."""
import asyncio
import json
import os
import shutil
from pathlib import Path
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

def test_official_mcp_client_initializes_and_executes_broker_tool():
    root = Path(__file__).resolve().parents[3]
    fixture = root / "platforms/mcp-server/scripts/mcp-interop-fixture.mjs"
    env = {key: os.environ[key] for key in ("PATH", "SystemRoot", "WINDIR", "TEMP", "TMP", "HOME", "USERPROFILE") if key in os.environ}
    async def verify():
        params = StdioServerParameters(command=shutil.which("node"), args=[str(fixture), "--run-fixture"], env=env)
        async with stdio_client(params) as (reader, writer):
            async with ClientSession(reader, writer) as session:
                initialized = await session.initialize()
                assert initialized.serverInfo.version == "3.0.0"
                tools = await session.list_tools()
                names = [tool.name for tool in tools.tools]
                assert "enigmagent_execute" in names and "enigmagent_resolve" not in names
                result = await session.call_tool("enigmagent_execute", {"operation": "check"})
                assert not result.isError
                assert json.loads(result.content[0].text) == {"operation": "check", "status": 200, "ok": True}
                if "SYNTHETIC_MCP_SENTINEL" in result.model_dump_json():
                    raise AssertionError("Synthetic credential reached the MCP client")
                rejected = await session.call_tool("enigmagent_execute", {"operation": "unknown"})
                assert rejected.isError
                assert rejected.content[0].text == "operation_not_allowed"
    asyncio.run(verify())
