# EnigmAgent Integrations

This directory contains integration files for 60+ platforms. Each subdirectory
has ready-to-use code and installation instructions.

## Quick Reference

| Platform | Type | File(s) | Status |
|---|---|---|---|
| **Open WebUI** | Pipeline filter + Tool | `open-webui/` | Ready |
| **Pinokio** | Launcher | `pinokio/pinokio.js` | Ready |
| **text-generation-webui** | Extension | `text-generation-webui/script.py` | Ready |
| **SillyTavern** | Extension | `sillytavern/` | Ready |
| **Flowise** | Custom node | `flowise/EnigmAgentTool.ts` | Ready |
| **Jan.ai** | Extension | `jan/src/index.ts` | Ready |
| **AnythingLLM** | Agent Tool | `anythingllm/handler.js` | Ready |
| **LibreChat** | Custom Tool | `librechat/enigmagent.js` | Ready |
| **Dify** | Tool Plugin | `dify/enigmagent_tool.py` | Ready |
| **Chainlit** | Middleware | `chainlit/enigmagent_action.py` | Ready |
| **Ollama** | Client wrapper | `ollama/enigmagent_ollama.py` | Ready |
| **LM Studio** | Client wrapper | `lm-studio/enigmagent-lmstudio.js` | Ready |
| **GPT4All** | Client wrapper | `gpt4all/enigmagent_gpt4all.py` | Ready |
| **LocalAI** | Proxy backend | `localai/enigmagent_backend.py` | Ready |
| **vLLM** | Proxy + wrapper | `vllm/enigmagent_vllm.py` | Ready |
| **llamafile** | Shell + Python | `llamafile/` | Ready |
| **PrivateGPT** | Client wrapper | `privategpt/enigmagent_privategpt.py` | Ready |
| **LangChain** | Tools + Callback | `langchain/enigmagent_tool.py` | Ready |
| **LlamaIndex** | FunctionTools | `llamaindex/enigmagent_tool.py` | Ready |
| **CrewAI** | BaseTool set | `crewai/enigmagent_tool.py` | Ready |
| **AutoGen** | Tool functions | `autogen/enigmagent_tool.py` | Ready |
| **Phidata** | Toolkit | `phidata/enigmagent_tool.py` | Ready |
| **Mem0** | Wrapped client | `mem0/enigmagent_mem0.py` | Ready |
| **Haystack** | Component | `haystack/enigmagent_component.py` | Ready |
| **n8n** | Community node | `n8n/enigmagent-node/` | Ready |
| **Python SDK** | Core library | `python-sdk/enigmagent/` | Ready |
| **Streamlit** | Component + utils | `streamlit/enigmagent_streamlit.py` | Ready |
| **Gradio** | Middleware + UI | `gradio/enigmagent_gradio.py` | Ready |
| **FastAPI** | ASGI Middleware | `fastapi-middleware/enigmagent_middleware.py` | Ready |
| **h2oGPT** | Client wrapper | `h2ogpt/enigmagent_h2ogpt.py` | Ready |

## Common Pattern

All integrations follow the same principle:

```
{{SECRET_NAME}} in prompt
       ↓
EnigmAgent vault lookup
       ↓
Real value injected
       ↓
LLM receives resolved text
```

## Prerequisites

The vault REST API must be running before any integration can resolve secrets:

```bash
# Start vault server
enigmagent serve --port 39517

# Or use the CLI run command
enigmagent run -- your-command
```

## Vault REST API

All integrations call these endpoints:

| Endpoint | Method | Description |
|---|---|---|
| `/secret/{name}` | GET | Get a single secret value |
| `/secrets` | GET | List all secret names (no values) |
| `/health` | GET | Vault status and count |
| `/resolve` | POST | Resolve placeholders in text body |

## Framework-specific Notes

### LangChain
```python
from enigmagent.langchain import EnigmAgentCallbackHandler
llm = ChatOpenAI(callbacks=[EnigmAgentCallbackHandler()])
```

### CrewAI
```python
from enigmagent.crewai import ALL_TOOLS
agent = Agent(tools=ALL_TOOLS)
```

### Open WebUI
Upload `open-webui/enigmagent_pipeline.py` to your Pipelines server.
Every `{{PLACEHOLDER}}` in every message is resolved automatically.

### n8n
Install via n8n > Settings > Community Nodes: `n8n-nodes-enigmagent`
Or manually from `n8n/enigmagent-node/`.

### SillyTavern
Copy `sillytavern/` folder to `SillyTavern/public/scripts/extensions/enigmagent/`.

### Flowise
Copy `flowise/EnigmAgentTool.ts` to `packages/components/nodes/tools/EnigmAgent/`.
Run `pnpm build`.
