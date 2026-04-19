## feat(vault): add EnigmAgent encrypted secret vault plugin

### Summary

This PR adds an **encrypted local vault integration** for OpenClaw agents. It allows agents to use sensitive credentials (API keys, passwords, private documents) **without those values ever appearing in the LLM's context**.

### The security problem this solves

AI agents need credentials to call external APIs, log into services, and fill forms. Today, the typical approach is to put secrets in environment variables or configuration files — which means they can appear in:
- LLM prompt history and assistant responses
- Application logs
- Fine-tuning datasets

This PR solves the problem by using a **placeholder-at-write, resolve-at-execution** architecture:

```
Agent (LLM) writes:   curl -H "Authorization: Bearer {{GITHUB_TOKEN}}" https://api.github.com
Gateway intercepts:   resolves {{GITHUB_TOKEN}} → real token → executes curl
Agent receives:       HTTP 200 response body (not the token)
```

The token is decrypted in the gateway's process memory and injected directly into the tool parameter — **it never appears in any LLM token sequence**.

### What's included

| Component | Description |
|---|---|
| `extensions/enigmagent/` | TypeScript plugin (`@openclaw/plugin-enigmagent`) |
| `extensions/enigmagent/src/vault-client.ts` | HTTP client for EnigmAgent REST API |
| `extensions/enigmagent/src/middleware.ts` | Tool execution middleware — resolves `{{PLACEHOLDER}}` patterns |
| `extensions/enigmagent/src/tools.ts` | Agent tools: `enigmagent_vault_status`, `enigmagent_vault_list` |
| `extensions/enigmagent/src/cli.ts` | CLI: `enigmagent:status`, `enigmagent:list`, `enigmagent:start` |
| `.agents/skills/enigmagent-vault/SKILL.md` | Agent skill — safe usage instructions for Claude |
| `docs/enigmagent.md` | Full documentation with architecture diagram |

### How it works

1. The **EnigmAgent server** runs locally as a separate process on `127.0.0.1:3737`. It decrypts secrets from an AES-256-GCM vault (Argon2id key derivation, m=64 MiB).

2. The **middleware** intercepts every tool call, scans parameters for `{{PLACEHOLDER}}` patterns, resolves them via the local API, and substitutes the values before execution.

3. **Agent tools** (`enigmagent_vault_status`, `enigmagent_vault_list`) let agents check vault readiness and discover available secret names — without ever accessing values.

4. The **agent skill** (SKILL.md) teaches Claude exactly when to check the vault, how to use placeholder syntax, and what to do when resolution fails.

### Security properties

- AES-256-GCM encryption + Argon2id KDF (m=64 MiB, t=3 iters) — OWASP/NIST compliant
- Vault server binds to `127.0.0.1` only — never exposed to the network
- Master key lives in process memory only, wiped on lock
- Domain binding: each secret can be restricted to a specific domain
- Zero LLM exposure: secrets injected after the LLM generates the tool call
- Debug logs emit only placeholder names — never values

### Placeholder syntax

| Pattern | Example | Use case |
|---|---|---|
| `{{NAME}}` | `{{GITHUB_TOKEN}}` | API token |
| `{{LOGIN:domain}}` | `{{LOGIN:gmail.com}}` | Login credential |
| `{{DOC:filename}}` | `{{DOC:policy.md}}` | Private document |

### Usage

```typescript
// openclaw.config.ts
import { createEnigmAgentPlugin } from './extensions/enigmagent/src/index.js';

export default defineOpenClawConfig({
  plugins: [
    createEnigmAgentPlugin({ strictMode: true }),
  ],
});
```

```bash
# Start vault server (separate process)
enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json

# Add a secret
enigmagent add GITHUB_TOKEN @github.com ghp_your_token

# Agent can now use {{GITHUB_TOKEN}} in any tool call
```

### Notes

- This is a voluntary, free open-source contribution.
- No changes to existing OpenClaw code — purely additive.
- Zero production dependencies (uses Node.js built-in `fetch`).
- TypeScript strict mode, ES2022 target, NodeNext module resolution.
- MIT licensed.

### Checklist

- [x] TypeScript strict mode passes
- [x] No changes to existing files
- [x] Agent skill documents safe and unsafe usage patterns
- [x] Full documentation in `docs/enigmagent.md`
- [x] Vault server is an external process — no startup/shutdown changes needed in OpenClaw core
