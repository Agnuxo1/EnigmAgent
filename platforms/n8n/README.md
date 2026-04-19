# n8n-nodes-enigmagent

[![npm](https://img.shields.io/npm/v/n8n-nodes-enigmagent)](https://www.npmjs.com/package/n8n-nodes-enigmagent)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)

**EnigmAgent Vault** community node for [n8n](https://n8n.io).

Securely access API keys, tokens, and passwords stored in your local EnigmAgent vault — without ever hardcoding credentials in your workflows.

---

## Features

| Operation | Description |
|-----------|-------------|
| **Get Status** | Check if the vault server is running and unlocked |
| **List Secrets** | List all secret names and domain bindings (never values) |
| **Resolve Placeholder** | Resolve a single `{{PLACEHOLDER}}` to its real value |
| **Resolve Text** | Replace all `{{PLACEHOLDER}}` references in a text block |

---

## Prerequisites

1. **EnigmAgent** installed: `npm install -g enigmagent-mcp`
2. Vault server running:
   ```bash
   enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json
   ```
3. Vault unlocked (enter master password on startup).

---

## Installation in n8n

### Community Nodes UI (recommended)

1. Open n8n → **Settings** → **Community Nodes**
2. Click **Install a community node**
3. Enter: `n8n-nodes-enigmagent`
4. Click **Install**

### Manual (self-hosted)

```bash
cd ~/.n8n
npm install n8n-nodes-enigmagent
```

Then restart n8n.

---

## Usage

### Get Status

Use as the first node in any workflow that needs credentials:

```
EnigmAgent Vault (Get Status) → IF unlocked → ... rest of workflow
```

### List Secrets

Returns a list of secret names you can use as `{{PLACEHOLDER}}` references:

```json
{
  "count": 3,
  "entries": [
    { "name": "GITHUB_TOKEN",   "domain": "@localhost" },
    { "name": "OPENAI_API_KEY", "domain": "@localhost" },
    { "name": "STRIPE_KEY",     "domain": "@localhost" }
  ]
}
```

### Resolve Placeholder

Input: `GITHUB_TOKEN`  
Output: `{ "placeholder": "GITHUB_TOKEN", "value": "ghp_abc123..." }`

### Resolve Text

Input:
```
Authorization: Bearer {{GITHUB_TOKEN}}
X-API-Key: {{OPENAI_API_KEY}}
```

Output:
```json
{
  "original":  "Authorization: Bearer {{GITHUB_TOKEN}}\nX-API-Key: {{OPENAI_API_KEY}}",
  "resolved":  "Authorization: Bearer ghp_abc123...\nX-API-Key: sk-proj-...",
  "replaced":  2
}
```

---

## Example workflow

```
[Manual Trigger]
       ↓
[EnigmAgent: Get Status]
       ↓
[IF: unlocked == true]
  YES ↓                    NO ↓
[EnigmAgent:            [Stop workflow +
 Resolve Text]           Send alert]
       ↓
[HTTP Request with
 resolved credentials]
```

---

## Security notes

- The vault server binds to `127.0.0.1` only — never accessible from the network.
- All resolution happens locally; credentials never transit the internet.
- The **List Secrets** operation returns only names and domains, never values.
- Use **Resolve Text** for headers and payloads that contain multiple credentials.

---

## License

MIT
