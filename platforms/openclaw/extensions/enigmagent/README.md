# @openclaw/plugin-enigmagent

> Encrypted local vault for OpenClaw agents — resolves `{{SECRET}}` references at execution time. Secret values never reach the LLM.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/agnuxo1/EnigmAgent/blob/main/LICENSE)

## The problem

AI agents need credentials — API tokens, passwords, private documents — but those credentials should never appear in the LLM's context. Standard approaches (environment variables, config files) still expose values to logs and prompt history.

## The solution

EnigmAgent uses a **placeholder-at-write, resolve-at-execution** pattern:

1. The agent writes `{{GITHUB_TOKEN}}` in a tool parameter (the LLM sees the placeholder, not the value).
2. The OpenClaw gateway intercepts the tool call before execution.
3. This plugin's middleware resolves `{{GITHUB_TOKEN}}` against the encrypted local vault.
4. The real token is injected and the tool executes.
5. The agent receives the tool's result — never the raw secret.

```
Agent writes → {{GITHUB_TOKEN}}
Gateway injects → ghp_xxxxxxxxxxxx
Service receives → real token
Agent receives → success response
```

## Quick start

### 1. Start the vault server

```bash
# Install
npm install -g enigmagent-mcp

# Create vault (first time)
enigmagent create --vault ~/.enigmagent/vault.json

# Start REST API
enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json
```

### 2. Add secrets

```bash
enigmagent add GITHUB_TOKEN @github.com ghp_your_token_here
enigmagent add OPENAI_KEY @api.openai.com sk-your-key-here
enigmagent add LOGIN:gmail.com @gmail.com your-password
```

### 3. Register the plugin

```typescript
// openclaw.config.ts
import { createEnigmAgentPlugin } from '@openclaw/plugin-enigmagent';

export default defineOpenClawConfig({
  plugins: [
    createEnigmAgentPlugin({ strictMode: true }),
  ],
});
```

### 4. Use secrets in agent tool calls

```bash
# The agent writes this — the gateway resolves it
curl -H "Authorization: Bearer {{GITHUB_TOKEN}}" https://api.github.com/user
```

## Placeholder syntax

| Pattern | Example | Resolves to |
|---|---|---|
| `{{NAME}}` | `{{GITHUB_TOKEN}}` | Secret by name |
| `{{LOGIN:domain}}` | `{{LOGIN:gmail.com}}` | Login for domain |
| `{{DOC:filename}}` | `{{DOC:policy.md}}` | Stored document |

## Agent tools

| Tool | Description |
|---|---|
| `enigmagent_vault_status` | Check if vault is running and unlocked |
| `enigmagent_vault_list` | List available secret names (no values) |

## CLI commands

```bash
openclaw enigmagent:status   # Check vault server status
openclaw enigmagent:list     # List secrets
openclaw enigmagent:start    # Print startup instructions
```

## Security

- **AES-256-GCM** encryption with per-entry random nonces
- **Argon2id** key derivation (m=64 MiB, t=3) — brute-force resistant
- **127.0.0.1 only** — vault REST API never exposed to the network
- **Zero LLM exposure** — secrets injected after LLM generates tool call
- **Domain binding** — each secret can be restricted to a specific domain

## Full documentation

See [docs/enigmagent.md](../../../../docs/enigmagent.md) for the complete guide including architecture diagrams, all configuration options, and troubleshooting.

## License

MIT — free to use in any OpenClaw project.
