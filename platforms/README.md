# EnigmAgent — Multi-platform builds

Every format lives in its own subdirectory. The original browser extension stays untouched in `extension/`.

## Core platforms

| Directory | Platform | Status | Effort |
|---|---|---|---|
| [`firefox-ext/`](firefox-ext/) | Firefox + Edge + Opera | ✅ Ready | Low |
| [`pwa/`](pwa/) | Progressive Web App | ✅ Ready | Low |
| [`mcp-server/`](mcp-server/) | MCP / REST API for AI agents | ✅ Ready | Low |
| [`cli/`](cli/) | Node.js CLI | ✅ Ready | Low |
| [`npm-library/`](npm-library/) | npm package (`@enigmagent/vault`) | ✅ Ready | Low |
| [`docker/`](docker/) | Docker / docker-compose | ✅ Ready | Medium |
| [`vscode-extension/`](vscode-extension/) | VS Code / Cursor / Windsurf | ✅ Ready | Medium |
| [`electron-app/`](electron-app/) | Electron desktop | ✅ Ready | Medium |
| [`tauri-app/`](tauri-app/) | Tauri desktop (< 10 MB) | ✅ Ready | Medium |
| [`mobile/`](mobile/) | Android + iOS (Capacitor) | ✅ Ready | High |
| [`pinokio/`](pinokio/) | Pinokio launcher | ✅ Ready | Very low |
| [`safari-extension/`](safari-extension/) | Safari (macOS + iOS App Store) | ✅ Ready | Medium |
| [`shared/`](shared/) | Shared Node.js vault core | Internal | — |

## AI Framework integrations

| Directory | Platform | Type | Status |
|---|---|---|---|
| [`python-sdk/`](python-sdk/) | Python SDK (PyPI: `enigmagent`) | Python package | ✅ Ready |
| [`python-sdk/enigmagent/tools/langchain.py`](python-sdk/enigmagent/tools/langchain.py) | LangChain | Python tool | ✅ Ready |
| [`python-sdk/enigmagent/tools/langgraph.py`](python-sdk/enigmagent/tools/langgraph.py) | LangGraph | Python tool | ✅ Ready |
| [`python-sdk/enigmagent/tools/crewai.py`](python-sdk/enigmagent/tools/crewai.py) | CrewAI | Python tool | ✅ Ready |
| [`python-sdk/enigmagent/tools/autogen.py`](python-sdk/enigmagent/tools/autogen.py) | AutoGen | Python tool | ✅ Ready |
| [`python-sdk/enigmagent/tools/llamaindex.py`](python-sdk/enigmagent/tools/llamaindex.py) | LlamaIndex | Python tool | ✅ Ready |
| [`python-sdk/enigmagent/tools/haystack.py`](python-sdk/enigmagent/tools/haystack.py) | Haystack | Python component | ✅ Ready |
| [`python-sdk/enigmagent/tools/semantic_kernel.py`](python-sdk/enigmagent/tools/semantic_kernel.py) | Semantic Kernel | Python plugin | ✅ Ready |
| [`python-sdk/enigmagent/tools/smolagents.py`](python-sdk/enigmagent/tools/smolagents.py) | SmolAgents | Python tool | ✅ Ready |
| [`python-sdk/enigmagent/tools/phidata.py`](python-sdk/enigmagent/tools/phidata.py) | Phidata / Agno | Python toolkit | ✅ Ready |
| [`python-sdk/enigmagent/tools/mem0.py`](python-sdk/enigmagent/tools/mem0.py) | Mem0 | Python memory | ✅ Ready |
| [`python-sdk/enigmagent/tools/openai_agents.py`](python-sdk/enigmagent/tools/openai_agents.py) | OpenAI Agents SDK | Python tool | ✅ Ready |
| [`python-sdk/enigmagent/tools/anthropic_sdk.py`](python-sdk/enigmagent/tools/anthropic_sdk.py) | Anthropic SDK | Python tool | ✅ Ready |
| [`openclaw/`](openclaw/) | OpenClaw | TypeScript middleware | ✅ Ready |
| [`hermes-agent/`](hermes-agent/) | Hermes Agent | Python plugin | ✅ Ready |
| [`paperclip/`](paperclip/) | Paperclip | TypeScript plugin | ✅ Ready |
| [`n8n/`](n8n/) | n8n community node | TypeScript INodeType | ✅ Ready |
| [`nanoclaw/`](nanoclaw/) | NanoClaw channel | TypeScript channel | ✅ Ready |
| [`clawhub/`](clawhub/) | ClawHub skill | TypeScript skill | ✅ Ready |

## Store listings & publication guides

| Directory | Platform | Status |
|---|---|---|
| [`store-listings/chrome/`](store-listings/chrome/) | Chrome / Brave / Vivaldi / Kiwi Web Store | ✅ Ready |
| [`store-listings/edge/`](store-listings/edge/) | Microsoft Edge Add-ons | ✅ Ready |
| [`store-listings/firefox/`](store-listings/firefox/) | Firefox AMO | ✅ Ready |
| [`store-listings/opera/`](store-listings/opera/) | Opera Add-ons | ✅ Ready |
| [`store-listings/jetbrains/`](store-listings/jetbrains/) | JetBrains Marketplace | ✅ Ready |
| [`store-listings/openvsx/`](store-listings/openvsx/) | Open VSX Registry | ✅ Ready |
| [`store-listings/pwa/`](store-listings/pwa/) | PWABuilder / Google Play / Apple / Microsoft Store | ✅ Ready |
| [`store-listings/f-droid/`](store-listings/f-droid/) | F-Droid | ✅ Ready |
| [`store-listings/npm/`](store-listings/npm/) | npm / npmjs.com | ✅ Ready |
| [`store-listings/pypi/`](store-listings/pypi/) | PyPI | ✅ Ready |
| [`store-listings/github-marketplace/`](store-listings/github-marketplace/) | GitHub Marketplace (Action) | ✅ Ready |
| [`store-listings/product-hunt/`](store-listings/product-hunt/) | Product Hunt launch kit | ✅ Ready |
| [`store-listings/alternative-to/`](store-listings/alternative-to/) | AlternativeTo listing | ✅ Ready |

## Quick start

```bash
# PWA (any device — no install needed)
cd platforms/pwa && node setup.js && npx serve .

# MCP server for Open WebUI / AnythingLLM
cd platforms/mcp-server && npm install
node index.js --vault ~/.enigmagent/vault.json --mode rest --port 3737

# CLI
cd platforms/cli && npm install && npm link
enigmagent list

# Docker
cd platforms/docker && docker compose up -d
# Open http://localhost:8080

# Electron desktop
cd platforms/electron-app && npm install && node setup.js && npm start

# Tauri desktop (< 10 MB)
cd platforms/tauri-app && npm install && node setup.js && npm run dev
```

## Vault compatibility

All platforms share the same encrypted vault format (Argon2id + AES-256-GCM JSON).
Export from any platform and import into any other — the password stays the same.
