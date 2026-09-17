"""Execute ten native framework integrations against a real encrypted broker fixture.

No remote model, paid endpoint or private credential is used. PydanticAI uses its
FunctionModel as a deterministic local agent-loop driver, not an inference claim.
"""
from __future__ import annotations
import asyncio
import inspect
import json
import os
import queue
import shutil
import subprocess
import threading
import uuid
from importlib.metadata import version
from pathlib import Path
import pytest
from enigmagent.adapters import make_tool, SUPPORTED_FRAMEWORKS
from enigmagent.client import VaultClient

SENTINEL = "SYNTHETIC_FRAMEWORK_CREDENTIAL_NEVER_FOR_REAL_USE"
PACKAGES = {
    "langchain": "langchain-core", "langgraph": "langgraph", "llamaindex": "llama-index-core",
    "crewai": "crewai", "haystack": "haystack-ai", "agent_framework": "agent-framework-core",
    "smolagents": "smolagents", "agno": "agno", "pydantic_ai": "pydantic-ai-slim", "autogen": "autogen-core",
}


def ensure_no_secret(text, token):
    """Report only a safe failure message; never put test credentials in reports."""
    serialized = text if isinstance(text, str) else repr(text)
    if SENTINEL in serialized or token in serialized:
        raise AssertionError("Synthetic credential appeared in a model-visible or serialized surface")


@pytest.fixture(scope="module")
def broker_fixture():
    root = Path(__file__).resolve().parents[3]
    script = root / "platforms/mcp-server/scripts/integration-fixture.mjs"
    node = shutil.which("node")
    if node is None:
        raise RuntimeError("Node.js is required for real integration validation")
    environment = {key: os.environ[key] for key in ("PATH", "SystemRoot", "WINDIR", "TEMP", "TMP", "HOME", "USERPROFILE") if key in os.environ}
    process = subprocess.Popen([node, str(script), "--run-fixture"], env=environment,
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8")
    lines = queue.Queue()
    errors = []
    reader = threading.Thread(target=lambda: [lines.put(line) for line in process.stdout], daemon=True)
    error_reader = threading.Thread(target=lambda: errors.extend(process.stderr.readlines()), daemon=True)
    reader.start(); error_reader.start()
    old = {key: os.environ.get(key) for key in ("ENIGMAGENT_API_TOKEN", "ENIGMAGENT_PORT", "ENIGMAGENT_TIMEOUT")}
    results = []
    counts = None
    try:
        ready = json.loads(lines.get(timeout=60))
        if ready.get("ready") is not True:
            raise RuntimeError("Synthetic broker did not initialize")
        token = ready["token"]
        os.environ.update(ENIGMAGENT_API_TOKEN=token, ENIGMAGENT_PORT=str(ready["port"]), ENIGMAGENT_TIMEOUT="5")
        if "ENIGMAGENT_PASS" in os.environ:
            raise RuntimeError("Framework validation must not inherit a master password")
        assert VaultClient.from_env().get_status().broker_enabled
        yield {"token": token, "results": results}
        process.stdin.write("evidence\n"); process.stdin.flush()
        counts = json.loads(lines.get(timeout=10))
        assert counts["unauthorized"] == 0
        assert counts["authorized"] >= 10
        ensure_no_secret("".join(errors), token)
    finally:
        for key, value in old.items():
            if value is None: os.environ.pop(key, None)
            else: os.environ[key] = value
        if process.stdin:
            process.stdin.close()
        try: process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.terminate(); process.wait(timeout=5)
        reader.join(timeout=1); error_reader.join(timeout=1)
        if process.stdout: process.stdout.close()
        if process.stderr: process.stderr.close()
        path = os.environ.get("ENIGMAGENT_TEST_EVIDENCE")
        if path:
            evidence = {"synthetic_data_only": True, "native_framework_execution": True,
                        "model_inference_benchmark": False, "upstream_adoption_claimed": False,
                        "frameworks": results, "destination_counts": counts,
                        "fixture_exit_code": process.returncode}
            Path(path).write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")


def resolve_awaitable(value):
    """Use native async interfaces without requiring a pytest event-loop plugin."""
    if inspect.isawaitable(value):
        async def await_value(): return await value
        return asyncio.run(await_value())
    return value


def native_invoke(framework, operation):
    """Exercise each framework's actual execution, not just import its adapter."""
    tool = make_tool(framework)
    surfaces = [f"{type(tool).__module__}.{type(tool).__name__}"]
    if framework == "langchain":
        from langchain_core.callbacks import BaseCallbackHandler
        class Recorder(BaseCallbackHandler):
            def on_tool_start(self, serialized, input_str, **kwargs): surfaces.extend([serialized, input_str])
            def on_tool_end(self, output, **kwargs): surfaces.append(output)
        value = tool.invoke({"operation": operation}, config={"callbacks": [Recorder()]})
        surfaces.extend([tool.get_input_schema().model_json_schema(), tool.to_json()])
    elif framework == "langgraph":
        config = {"configurable": {"thread_id": str(uuid.uuid4())}}
        value = tool.invoke({"operation": operation}, config=config)["result"]
        surfaces.append(list(tool.get_state_history(config)))
        surfaces.append(tool.get_state(config).values)
    elif framework == "llamaindex":
        result = tool.call(operation=operation)
        value = result.content
        surfaces.extend([result.raw_input, result.raw_output, tool.metadata.to_openai_tool()])
    elif framework == "crewai":
        value = tool.run(operation=operation)
        surfaces.append(tool.args_schema.model_json_schema())
    elif framework == "haystack":
        from haystack import Pipeline
        pipeline = Pipeline()
        pipeline.add_component("approved", tool)
        serialized = pipeline.dumps()
        surfaces.append(serialized)
        restored = Pipeline.loads(serialized, allowed_modules=["enigmagent.adapters.haystack"])
        output = restored.run({"approved": {"operation": operation}})
        surfaces.append(output); value = output["approved"]["result"]
    elif framework == "agent_framework":
        value = resolve_awaitable(tool.invoke(arguments={"operation": operation}, skip_parsing=True))
        surfaces.append(repr(tool))
    elif framework == "smolagents":
        value = tool(operation=operation)
        surfaces.extend([tool.inputs, tool.description])
    elif framework == "agno":
        from agno.tools.function import FunctionCall
        execution = FunctionCall(function=tool, arguments={"operation": operation}).execute()
        value = execution.result
        surfaces.append(tool.to_dict())
    elif framework == "pydantic_ai":
        from pydantic_ai import Agent
        from pydantic_ai.messages import ModelResponse, TextPart, ToolCallPart
        from pydantic_ai.models.function import FunctionModel
        def local_model(messages, info):
            surfaces.append(messages)
            if any(getattr(part, "part_kind", "") == "tool-return" for message in messages for part in message.parts):
                return ModelResponse(parts=[TextPart("Synthetic tool call completed")])
            return ModelResponse(parts=[ToolCallPart("enigmagent_execute", {"operation": operation}, tool_call_id="fixture-call")])
        agent = Agent(model=FunctionModel(local_model), tools=[tool])
        completed = agent.run_sync("Execute the configured test operation")
        messages = completed.all_messages()
        surfaces.append(messages)
        values = [part.content for message in messages for part in message.parts if getattr(part, "part_kind", "") == "tool-return"]
        assert len(values) == 1
        value = values[0]
        surfaces.append(tool.function_schema.json_schema)
    elif framework == "autogen":
        from autogen_core import CancellationToken
        value = resolve_awaitable(tool.run_json({"operation": operation}, CancellationToken()))
        surfaces.append(tool.schema)
    else:
        raise AssertionError("Native invocation path is missing")
    if not isinstance(value, str):
        raise AssertionError(f"Native tool returned an unexpected type: {type(value).__name__}")
    return value, surfaces, f"{type(tool).__module__}.{type(tool).__name__}"


@pytest.mark.parametrize("framework", SUPPORTED_FRAMEWORKS)
def test_native_framework_executes_authorized_operation_and_denies_unknown(framework, broker_fixture, capsys, caplog):
    token = broker_fixture["token"]
    output, surfaces, native_class = native_invoke(framework, "check")
    ensure_no_secret(output, token); ensure_no_secret(surfaces, token)
    assert json.loads(output) == {"operation": "check", "status": 200, "ok": True}
    denied, denial_surfaces, _ = native_invoke(framework, "not_allowed")
    ensure_no_secret(denied, token); ensure_no_secret(denial_surfaces, token)
    assert json.loads(denied) == {"error": "operation_not_allowed"}
    captured = capsys.readouterr()
    ensure_no_secret(captured.out + captured.err + caplog.text, token)
    broker_fixture["results"].append({
        "framework": framework, "package": PACKAGES[framework], "version": version(PACKAGES[framework]),
        "native_class": native_class, "authorized_operation_status": 200,
        "unknown_operation": "denied", "inspected_outputs_logs_and_native_state": True,
        "synthetic_secret_or_broker_token_in_inspected_surfaces": False,
    })
