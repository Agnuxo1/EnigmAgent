# enigmagent — Python SDK

[![PyPI](https://img.shields.io/pypi/v/enigmagent)](https://pypi.org/project/enigmagent/)
[![Python](https://img.shields.io/pypi/pyversions/enigmagent)](https://pypi.org/project/enigmagent/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**EnigmAgent** brings secure, local-vault secret management to every major Python AI agent framework.
API keys, passwords, and tokens stay on your machine — agents reference them as `{{PLACEHOLDER}}`
symbols and the vault resolves them only at the moment they are needed.

---

## Installation

```bash
# Core (zero dependencies — stdlib only)
pip install enigmagent

# With a specific framework integration
pip install enigmagent[langchain]
pip install enigmagent[crewai]
pip install enigmagent[autogen]
pip install enigmagent[llamaindex]
pip install enigmagent[haystack]
pip install enigmagent[semantic-kernel]
pip install enigmagent[smolagents]
pip install enigmagent[phidata]      # or enigmagent[agno]
pip install enigmagent[mem0]
pip install enigmagent[langgraph]
pip install enigmagent[openai-agents]
pip install enigmagent[anthropic]

# Everything at once
pip install enigmagent[all]
```

---

## Prerequisites

1. **EnigmAgent vault server** running locally:
   ```bash
   enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json
   ```
2. Vault unlocked (master password entered at startup).
3. Secrets stored in the vault under meaningful names (e.g. `GITHUB_TOKEN`, `OPENAI_API_KEY`).

---

## Quick start

```python
from enigmagent import get_client

client = get_client()           # reads ENIGMAGENT_HOST / ENIGMAGENT_PORT env vars
status = client.get_status()
print(status.unlocked)          # True

secrets = client.list_secrets()
for s in secrets:
    print(s.name, s.domain)     # GITHUB_TOKEN  @localhost

# Resolve a placeholder to its real value (never log this!)
token = client.resolve("GITHUB_TOKEN")
```

Environment variables:

| Variable           | Default       | Description              |
|--------------------|---------------|--------------------------|
| `ENIGMAGENT_HOST`  | `127.0.0.1`   | Vault server hostname    |
| `ENIGMAGENT_PORT`  | `3737`        | Vault server port        |
| `ENIGMAGENT_ORIGIN`| `http://localhost` | Origin header for domain binding |

---

## Framework integrations

### LangChain

```python
from enigmagent.tools.langchain import get_enigmagent_tools
from langchain.agents import initialize_agent, AgentType
from langchain_openai import ChatOpenAI

tools = get_enigmagent_tools()
agent = initialize_agent(
    tools, ChatOpenAI(model="gpt-4o"), agent=AgentType.OPENAI_FUNCTIONS
)
agent.run("Check if the vault is ready, then list available secrets.")
```

### CrewAI

```python
from enigmagent.tools.crewai import get_enigmagent_tools
from crewai import Agent, Task, Crew

tools = get_enigmagent_tools()
agent = Agent(role="Security Agent", goal="Manage secrets", tools=tools, ...)
```

### AutoGen

```python
from enigmagent.tools.autogen import get_enigmagent_tools
import autogen

tools = get_enigmagent_tools()
# tools is a list of FunctionTool (or raw callables as fallback)
assistant = autogen.AssistantAgent("assistant", llm_config={...})
for tool in tools:
    assistant.register_function(tool)
```

### LlamaIndex

```python
from enigmagent.tools.llamaindex import get_enigmagent_tools
from llama_index.core.agent import ReActAgent
from llama_index.llms.openai import OpenAI

tools = get_enigmagent_tools()
agent = ReActAgent.from_tools(tools, llm=OpenAI(model="gpt-4o"))
agent.chat("List vault secrets.")
```

### Haystack

```python
from enigmagent.tools.haystack import EnigmAgentVaultStatus, EnigmAgentVaultList
from haystack import Pipeline

pipe = Pipeline()
pipe.add_component("vault_check", EnigmAgentVaultStatus())
pipe.add_component("vault_list",  EnigmAgentVaultList())
pipe.connect("vault_check.running", "vault_list.__PLACEHOLDER__")
result = pipe.run({})
```

### Semantic Kernel

```python
from enigmagent.tools.semantic_kernel import EnigmAgentPlugin
from semantic_kernel import Kernel

kernel = Kernel()
kernel.add_plugin(EnigmAgentPlugin(), plugin_name="enigmagent")
# Use {{enigmagent.vault_status}} and {{enigmagent.vault_list}} in prompts
```

### SmolAgents (HuggingFace)

```python
from enigmagent.tools.smolagents import get_enigmagent_tools
from smolagents import CodeAgent, HfApiModel

agent = CodeAgent(tools=get_enigmagent_tools(), model=HfApiModel())
agent.run("List the available vault secrets.")
```

### Phidata / Agno

```python
from enigmagent.tools.phidata import EnigmAgentToolkit
from phi.agent import Agent

agent = Agent(tools=[EnigmAgentToolkit()], show_tool_calls=True)
agent.print_response("Check vault status and list secrets.")
```

### Mem0

```python
from enigmagent.tools.mem0 import EnigmAgentMemory

mem = EnigmAgentMemory(user_id="alice")
mem.add("My GitHub token placeholder is {{GITHUB_TOKEN}}", user_id="alice")
# Placeholders are stored symbolically — never the real value.

results = mem.search("GitHub token", user_id="alice")
```

### LangGraph

```python
from enigmagent.tools.langgraph import get_enigmagent_tools
from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI

tools = get_enigmagent_tools()
graph = create_react_agent(ChatOpenAI(model="gpt-4o"), tools)
result = graph.invoke({"messages": [("human", "Check vault and list secrets.")]})
```

### OpenAI Agents SDK

```python
from enigmagent.tools.openai_agents import get_enigmagent_tools
from agents import Agent, Runner

tools = get_enigmagent_tools()
agent = Agent(name="VaultAgent", instructions="Manage secrets.", tools=tools)
result = Runner.run_sync(agent, "List available secrets.")
```

### Anthropic SDK

```python
from enigmagent.tools.anthropic_sdk import get_enigmagent_tool_schemas, handle_tool_call
import anthropic

client_ai = anthropic.Anthropic()
response = client_ai.messages.create(
    model="claude-opus-4-5",
    max_tokens=1024,
    tools=get_enigmagent_tool_schemas(),
    messages=[{"role": "user", "content": "List vault secrets."}],
)
for block in response.content:
    if block.type == "tool_use":
        result = handle_tool_call(block.name, block.input)
        print(result)
```

---

## Security model

- Secrets **never** leave the local vault in plaintext over the network.
- `{{PLACEHOLDER}}` references are resolved over `localhost` only.
- Domain binding ensures secrets are only accessible from their registered origin.
- Memory integrations store placeholders symbolically — real values are resolved at execution time.

---

## API reference

### `VaultClient`

| Method | Description |
|--------|-------------|
| `get_status() → VaultStatus` | Check if vault is running and unlocked |
| `list_secrets() → list[VaultEntry]` | List all secret names and domains |
| `resolve(placeholder, origin?) → str` | Resolve one placeholder to its value |
| `resolve_batch(placeholders, origin?, max_workers?) → dict` | Resolve many in parallel |

### Module-level helpers

| Function | Description |
|----------|-------------|
| `get_client() → VaultClient` | Return the module-level singleton |
| `configure(host?, port?, timeout?, origin?) → VaultClient` | Set a new default client |

---

## Contributing

```bash
git clone https://github.com/enigmagent/enigmagent
cd enigmagent/platforms/python-sdk
pip install -e ".[all]"
pytest tests/
```

---

## License

MIT — see [LICENSE](LICENSE).
