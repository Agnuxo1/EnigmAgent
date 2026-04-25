# EnigmAgent Integrations

Quick links to every supported client and framework.

## MCP-native clients (zero code, just a config snippet)

| Client | Config file | Repo |
|---|---|---|
| **Claude Desktop** | `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) · `%APPDATA%\Claude\claude_desktop_config.json` (Windows) | [README → Claude Desktop](README.md#claude-desktop) |
| **Cursor** | `~/.cursor/mcp.json` | [README → Cursor](README.md#cursor) |
| **Continue.dev** | `~/.continue/config.yaml` | [README → Continue.dev](README.md#continuedev) |
| **Cline** (VS Code) | `cline_mcp_settings.json` | [README → Cline](README.md#cline-vs-code) |
| **Open WebUI** | via [`mcpo`](https://github.com/open-webui/mcpo) bridge | [README → Open WebUI](README.md#open-webui) |
| **Zed** | `~/.config/zed/settings.json` (context_servers) | (config pattern same as MCP) |
| **AnythingLLM** | MCP-compatibility settings | (config pattern same as MCP) |
| **LM Studio** | MCP support in 0.3.x | (config pattern same as MCP) |
| **LibreChat** | `librechat.yaml` mcpServers section | (config pattern same as MCP) |

All use the same command + args:
```json
{
  "command": "npx",
  "args": ["-y", "enigmagent-mcp", "--vault", "/abs/path/my.vault.json"]
}
```

---

## Framework integrations (separate packages)

### Node.js / TypeScript

| Package | What it does | Repo |
|---|---|---|
| **`enigmagent-mcp`** (npm) | The core MCP server itself | [Agnuxo1/enigmagent-mcp](https://github.com/Agnuxo1/enigmagent-mcp) |
| **`n8n-nodes-enigmagent`** (npm) | n8n community node — drop between an LLM node and an HTTP Request node to substitute placeholders | [Agnuxo1/n8n-nodes-enigmagent](https://github.com/Agnuxo1/n8n-nodes-enigmagent) |

### Python

| Package | What it does | Repo |
|---|---|---|
| **`langchain-enigmagent`** (PyPI) | LangChain integration: `EnigmAgentClient`, `EnigmAgentSubstitute` Runnable, callback handler, `enigma_secret()` SecretStr | [Agnuxo1/langchain-enigmagent](https://github.com/Agnuxo1/langchain-enigmagent) |

### Browser

| Surface | What it does | Status |
|---|---|---|
| Chrome / Edge / Brave / Opera (Chromium) | Browser extension intercepts form submits with `{{PLACEHOLDER}}` and resolves before submit | Bundled in this repo under `extension/` |
| Firefox | Same extension, MV3 manifest variant | `platforms/firefox-ext/` |

---

## Roadmap (in progress / planned)

| Target | Status |
|---|---|
| **LlamaIndex** Python integration | Planned (mirrors `langchain-enigmagent`) |
| **CrewAI** tool | Planned |
| **AutoGen** v0.4 ext | Planned |
| **PydanticAI** docs example | Planned |
| **Pipedream** component | Planned |
| **Activepieces** piece | Planned |
| Chrome Web Store / Firefox AMO / Edge Add-ons signed releases | In progress |

Pull requests welcome for any of these.

---

## REST API (for custom integrations)

If your tool isn't in the list above, EnigmAgent also exposes a local REST API:

```bash
npx enigmagent-mcp --mode rest --port 3737 --vault /abs/path/my.vault.json
```

Endpoints (all bound to 127.0.0.1):

```http
POST /resolve
Content-Type: application/json

{"placeholder": "OPENAI_KEY", "origin": "https://api.openai.com"}

→ 200 OK
  {"value": "sk-..."}

→ 401  {"error": "vault_locked"}
→ 403  {"error": "domain_mismatch", "expected": "api.example.com", ...}
→ 403  {"error": "no_domain_binding", ...}
→ 403  {"error": "not_found", ...}
```

```http
GET /list   →  {"entries": [{"name": ..., "domain": ..., "id": ...}]}
GET /status →  {"status": "ok", "unlocked": true|false}
```

Optional `X-EnigmAgent-Auth` header if you set a shared secret.

---

## Sister projects

EnigmAgent is part of the [OpenCLAW / P2PCLAW](https://www.p2pclaw.com) ecosystem:

- **[BenchClaw](https://github.com/Agnuxo1/BenchClaw)** — agentic SRE evaluation harness (17-judge tribunal). Already in `awesome-mcp-servers`.
- **[PaperClaw](https://github.com/Agnuxo1/paperclaw-obsidian)** — turns notes into peer-reviewed research papers via P2PCLAW.
- **[P2PCLAW](https://www.p2pclaw.com)** — decentralized science network for AI agents.

— [Francisco Angulo de Lafuente](https://github.com/Agnuxo1)
