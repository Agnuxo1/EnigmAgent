# EnigmAgent — Encrypted Vault Integration

EnigmAgent is an **encrypted local vault** that lets OpenClaw agents use API keys, passwords, and sensitive documents without those values ever passing through the LLM or leaving the user's device.

## Why this matters

Standard AI agent workflows have a fundamental tension: agents need credentials to call APIs, log into services, and fill forms — but handing raw credentials to an LLM risks:

- **Token leakage** — the secret appears in the conversation history, embeddings, or fine-tuning datasets.
- **Prompt injection** — an attacker could craft content that tricks the agent into exfiltrating a visible credential.
- **Logging exposure** — LLM providers may log prompts for safety review.

EnigmAgent solves this with a **placeholder-at-write, resolve-at-execution** pattern:

```
Agent writes:   curl -H "Authorization: Bearer {{GITHUB_TOKEN}}" https://api.github.com
Gateway:        resolves {{GITHUB_TOKEN}} → real token → executes curl
Agent receives: HTTP 200 + response body
```

The token is **never in the LLM's context**. It exists only in the vault (AES-256-GCM encrypted) and momentarily in the gateway's process memory during execution.

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                     User's Machine                         │
│                                                            │
│  ┌─────────────┐    ┌──────────────────────────────────┐  │
│  │  LLM / API  │    │         OpenClaw Gateway          │  │
│  │  (online)   │    │                                   │  │
│  │             │    │  ┌────────────┐  ┌─────────────┐ │  │
│  │  sees only  │◄───┼──│ Middleware │  │   Tool      │ │  │
│  │  {{NAME}}   │    │  │ (resolver) │  │ Execution   │ │  │
│  │  patterns   │    │  └─────┬──────┘  └──────┬──────┘ │  │
│  └─────────────┘    │        │ POST /resolve   │        │  │
│                     │        ▼                 │        │  │
│                     │  ┌─────────────┐         │        │  │
│                     │  │  EnigmAgent │         │        │  │
│                     │  │  REST API   │ real    │        │  │
│                     │  │  :3737      ├─────────►        │  │
│                     │  └─────┬───────┘ value   │        │  │
│                     │        │                 │        │  │
│                     └────────┼─────────────────┼────────┘  │
│                              │                 │           │
│                     ┌────────▼─────────┐       │           │
│                     │  Encrypted Vault │       │           │
│                     │  AES-256-GCM     │       ▼           │
│                     │  Argon2id KDF    │    External        │
│                     │  ~/.enigmagent/  │    Service         │
│                     │  vault.json      │    (GitHub,        │
│                     └──────────────────┘    OpenAI…)       │
└────────────────────────────────────────────────────────────┘
```

---

## Installation

### 1. Install the EnigmAgent MCP server

```bash
npm install -g enigmagent-mcp
```

Or clone and link locally:

```bash
git clone https://github.com/agnuxo1/EnigmAgent
cd EnigmAgent/platforms/mcp-server
npm link
```

### 2. Create a vault

```bash
enigmagent create --vault ~/.enigmagent/vault.json
# Enter a username and master password when prompted
```

### 3. Start the REST API server

The server must run as a **persistent background process** while OpenClaw is active:

```bash
enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json
```

For production or persistent setups, create a systemd service or use your OS process manager.

### 4. Add the plugin to your OpenClaw project

```bash
cd your-openclaw-project
npm install @openclaw/plugin-enigmagent
```

Register the plugin in `openclaw.config.ts`:

```typescript
import { defineOpenClawConfig } from '@openclaw/config';
import { createEnigmAgentPlugin } from '@openclaw/plugin-enigmagent';

export default defineOpenClawConfig({
  plugins: [
    createEnigmAgentPlugin({
      strictMode: true,  // recommended: block tool calls with unresolvable secrets
    }),
  ],
});
```

---

## Managing secrets

### Add secrets

```bash
# API token for a specific service
enigmagent add GITHUB_TOKEN @github.com ghp_...

# Login credential for a domain
enigmagent add LOGIN:gmail.com @gmail.com my-password

# Stored document (e.g. company policy, form template)
enigmagent add DOC_contract.md @localhost "$(cat contract.md)"

# Unbound secret (matches any origin — use with care)
enigmagent add MASTER_PASSWORD ''  secret-value
```

### List secrets (names only, no values)

```bash
enigmagent list
# or via OpenClaw CLI:
openclaw enigmagent:list
```

### Remove a secret

```bash
enigmagent del GITHUB_TOKEN
```

### Export / import (for backup or migration)

```bash
enigmagent export --out backup.vault.json
enigmagent import --from backup.vault.json
```

The export file is fully encrypted — safe to store in version control if your vault password is strong.

---

## Usage in agent workflows

### Placeholder syntax

| Syntax | Resolves to |
|---|---|
| `{{GITHUB_TOKEN}}` | Secret named `GITHUB_TOKEN` |
| `{{LOGIN:github.com}}` | Login bound to `github.com` |
| `{{DOC:report.md}}` | Contents of document stored as `DOC_report.md` |

### Examples

**Bash tool — GitHub API call:**
```bash
curl -s \
  -H "Authorization: Bearer {{GITHUB_TOKEN}}" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/owner/repo/issues
```

**Bash tool — push to Git:**
```bash
git remote set-url origin https://{{GITHUB_TOKEN}}@github.com/owner/repo.git
git push origin main
```

**HTTP tool — OpenAI API:**
```json
{
  "url": "https://api.openai.com/v1/embeddings",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer {{OPENAI_KEY}}",
    "Content-Type": "application/json"
  },
  "body": { "input": "hello world", "model": "text-embedding-3-small" }
}
```

**Form tool — web login:**
```json
{
  "selector": "#password",
  "value": "{{LOGIN:myapp.com}}"
}
```

**Document injection — policy application:**
```
Apply the following company security policy when reviewing the code:

{{DOC:security-policy.md}}
```

---

## Security properties

| Property | Detail |
|---|---|
| **Encryption** | AES-256-GCM with per-entry random nonces |
| **Key derivation** | Argon2id: m=64 MiB, t=3 iterations, p=1 |
| **Key lifetime** | Lives in process memory only; wiped on lock |
| **Transport** | 127.0.0.1 only — never exposed to the network |
| **LLM exposure** | Zero — secrets are resolved after the LLM generates the tool call |
| **Domain binding** | Each secret can be locked to a specific domain to prevent cross-service leakage |
| **Audit log** | Resolution events logged (placeholder names only, never values) |

---

## CLI reference

```
openclaw enigmagent:status          Check vault server status
openclaw enigmagent:list            List available secrets (no values)
openclaw enigmagent:start           Print vault server startup instructions
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `ENIGMAGENT_HOST` | `127.0.0.1` | Vault REST API host |
| `ENIGMAGENT_PORT` | `3737` | Vault REST API port |
| `ENIGMAGENT_STRICT` | `false` | Block tool calls with unresolvable secrets |
| `ENIGMAGENT_VAULT` | `~/.enigmagent/vault.json` | Path to vault file |
| `ENIGMAGENT_USER` | — | Username for non-interactive unlock |
| `ENIGMAGENT_PASS` | — | Password for non-interactive unlock (use only in secure envs) |

---

## Troubleshooting

### "EnigmAgent server is not running"

Start the server:
```bash
enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json
```

### "vault_locked"

The server is running but the vault is locked (e.g., after a restart). Rerun the start command — it prompts for credentials on startup.

### "not_found" for a placeholder

The secret name doesn't match exactly. Run `openclaw enigmagent:list` and copy the exact name.

### "domain_mismatch"

The secret is bound to a different domain than the tool's target URL. Either use `{{LOGIN:correct-domain.com}}` syntax, or update the domain binding with `enigmagent domain SECRET_NAME new.domain.com`.

---

## Source

- Repository: https://github.com/agnuxo1/EnigmAgent
- Plugin code: `platforms/openclaw/extensions/enigmagent/`
- Agent skill: `.agents/skills/enigmagent-vault/SKILL.md`
- License: MIT
