# EnigmAgent Python SDK 3.0.0

A dependency-light authenticated local client and ten optional native framework
integrations. Install the wheel from the matching GitHub release. Use Python 3.12
for the complete tested framework set; the standalone client supports Python 3.10+.
Do not assume a separately published PyPI version has been updated.

## Agent-facing factory

```python
from enigmagent.adapters import make_tool

tool = make_tool("langchain")
result = tool.invoke({"operation": "check"})
```

The operator must first configure an actual `check` operation in the separate
broker. The tool does not select a URL, secret, header or request body. It returns
only a validated status result or a fixed error code. Other native frameworks use
their own invocation interface; the factory always returns a real native object.
LangGraph returns a compiled graph and Haystack a pipeline component.

Runtime connection settings are `ENIGMAGENT_API_TOKEN`, `ENIGMAGENT_PORT` (default
3737) and optional `ENIGMAGENT_TIMEOUT` (default 5 seconds). **Never give an agent
process `ENIGMAGENT_PASS` or the broker's private vault/configuration filesystem.**
The connection token is not a master password and raw resolution is disabled on a
broker transport. A separate OS security boundary is required for hostile generated
code; an in-process Python object is not a sandbox.

| Framework | Factory key | Tested package | Version |
|---|---|---|---|
| LangChain | `langchain` | `langchain-core` | `1.6.3` |
| LangGraph | `langgraph` | `langgraph` | `1.2.11` |
| LlamaIndex | `llamaindex` | `llama-index-core` | `0.14.24` |
| CrewAI | `crewai` | `crewai` | `1.15.22` |
| Haystack | `haystack` | `haystack-ai` | `3.1.1` |
| Microsoft Agent Framework | `agent_framework` | `agent-framework-core` | `1.18.0` |
| smolagents | `smolagents` | `smolagents` | `1.26.0` |
| Agno | `agno` | `agno` | `3.0.10` |
| PydanticAI | `pydantic_ai` | `pydantic-ai-slim` | `2.44.0` |
| AutoGen Core | `autogen` | `autogen-core` | `0.7.5` |

Install the needed optional extra from the source project or an actually published
matching package. Extras are `langchain`, `langgraph`, `llamaindex`, `crewai`,
`haystack`, `agent-framework`, `smolagents`, `agno`, `pydantic-ai`, `autogen`, or `all`.
The exact direct SDK versions above are pinned in `pyproject.toml`.

## Client API

```python
from enigmagent.client import VaultClient

client = VaultClient.from_env()
status = client.get_status()
operations = client.list_operations()
result = client.execute("check")
```

Only numeric loopback is used internally. Proxy environment variables are ignored;
redirects are refused; response size, schemas and absolute deadlines are checked.
`resolve()` is a separate trusted-backend escape hatch requiring both client and
server opt-in. It must not be exposed as an agent tool. Empty `resolve_batch([])`
returns an empty dictionary without creating an invalid executor.

Client objects cannot be pickled and their representation does not expose the
connection token. Native adapters do not capture a client/token in their schemas
or serialized configurations. For Haystack pipeline restoration, explicitly trust
only our installed component module:

```python
restored = Pipeline.loads(serialized_pipeline, allowed_modules=["enigmagent.adapters.haystack"])
```

Do not disable the deserialization allowlist globally. Full runnable round-trip,
checkpoint, native tool and agent-loop examples are the executable tests in
`tests/test_native_integrations.py`. They use only synthetic data and a real
local encrypted broker fixture. The additional MCP test uses the official client.
Older `enigmagent.tools` metadata helpers remain for compatibility; they are not
new raw-secret isolation integrations and are not counted among the ten factories.

See the root threat model and integrated release document for storage migration,
container setup, tested versions, limitations and distribution provenance.
