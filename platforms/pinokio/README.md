# EnigmAgent — Pinokio Launcher

Appears in the Pinokio **Discover** tab so local AI users can install EnigmAgent with one click.

## Install

1. Open Pinokio
2. Click **Discover** → search **EnigmAgent**
3. Click **Install** → wait for dependencies
4. Click **Start Vault** to open the vault in your browser
5. Click **Start MCP Server** to enable AI agent resolution on port 3737

## Manual install (GitHub URL)

In Pinokio → **New** → paste:
```
https://github.com/agnuxo1/EnigmAgent
```

## Scripts

| Script | Description |
|---|---|
| `install.json` | Runs `npm install` for all Node.js platforms |
| `start.json` | Starts the PWA on http://localhost:8282 |
| `start-mcp.json` | Starts the REST API (prompts for vault credentials) |

## Integration with local AI

Once the MCP server is running, add this to your AI app's tool config:

**Open WebUI:**
```json
{
  "enigmagent": {
    "url": "http://127.0.0.1:3737/resolve",
    "method": "POST"
  }
}
```

**AnythingLLM:**
```json
{
  "enigmagent_resolve": {
    "endpoint": "http://127.0.0.1:3737",
    "type": "rest"
  }
}
```
