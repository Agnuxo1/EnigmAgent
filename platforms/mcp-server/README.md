# EnigmAgent MCP Server

Exposes your encrypted vault as a tool for any MCP-compatible AI agent:
**Open WebUI**, **AnythingLLM**, **LM Studio**, **Ollama** toolchains, and any JSON-RPC 2.0 MCP client.

Also provides a local REST API for custom integrations.

## Quick start

```bash
npm install
node index.js --vault ~/.enigmagent/vault.json
```

Enter your vault credentials when prompted. The server starts listening on stdin (MCP stdio mode).

## Modes

### MCP stdio (default — for LLM tool use)

```bash
node index.js --vault ./vault.json --mode mcp
```

Add to your MCP config (`~/.config/open-webui/mcpservers.json` or equivalent):

```json
{
  "enigmagent": {
    "command": "node",
    "args": ["/path/to/enigmagent/platforms/mcp-server/index.js",
             "--vault", "/home/user/.enigmagent/vault.json"],
    "env": {
      "ENIGMAGENT_USER": "alice",
      "ENIGMAGENT_PASS": "your-vault-password"
    }
  }
}
```

### REST API

```bash
node index.js --vault ./vault.json --mode rest --port 3737
```

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| `GET` | `/status` | Vault health check |
| `GET` | `/list` | List all secret names and domains |
| `POST` | `/resolve` | Resolve a placeholder |

**Resolve example:**
```bash
curl -X POST http://127.0.0.1:3737/resolve \
  -H 'Content-Type: application/json' \
  -d '{"placeholder":"API_KEY","origin":"https://api.example.com"}'
# → {"value":"ghp_your-actual-token"}
```

## MCP tools

| Tool | Description |
|---|---|
| `enigmagent_resolve` | Resolve `{{PLACEHOLDER}}` to its real value. Domain binding enforced. |
| `enigmagent_list` | List secret names and domains. Never returns values. |

## Environment variables

| Variable | Description |
|---|---|
| `ENIGMAGENT_VAULT` | Path to vault file |
| `ENIGMAGENT_USER` | Username (skips interactive prompt) |
| `ENIGMAGENT_PASS` | Password (skips interactive prompt — use only in secure environments) |

## Security

- The REST API binds to `127.0.0.1` only (never exposed to the network)
- The master key lives in Node.js process memory only
- Domain binding is enforced: `origin` must match the secret's bound domain
- All errors return error codes without leaking vault contents
