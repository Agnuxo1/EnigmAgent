# enigmagent — Hermes Agent Plugin

> Encrypted local vault for Hermes agents. Resolves `{{SECRET}}` references in tool arguments at execution time — credentials never appear in the LLM's context.

## The problem

Hermes agents need credentials to call APIs, push to GitHub, connect to databases, and log into services. The standard approach — pasting tokens into the chat or storing them in `.env` files — means secrets can appear in:

- LLM conversation history (stored by providers)
- Hermes session logs
- Prompt injection attacks that exfiltrate visible credentials

## The solution

EnigmAgent uses a **placeholder-at-write, resolve-at-execution** pattern:

```
You write:   curl -H "Authorization: Bearer {{GITHUB_TOKEN}}" https://api.github.com
Hook fires:  resolves {{GITHUB_TOKEN}} → injects real token → tool runs
You receive: the curl response (HTTP 200, JSON body, etc.)
```

The token is **never in your context**. It lives only in the encrypted vault (AES-256-GCM, Argon2id key) and momentarily in the gateway's process memory during execution.

## Installation

### 1. Install EnigmAgent MCP server

```bash
npm install -g enigmagent-mcp
# or
pip install enigmagent-mcp  # Python wrapper (if available)
```

Or build from source:
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

### 3. Add secrets

```bash
# API tokens — bind to @localhost for use with Hermes local tools
enigmagent add GITHUB_TOKEN @localhost ghp_your_token_here
enigmagent add OPENAI_API_KEY @localhost sk-your-key-here
enigmagent add ANTHROPIC_API_KEY @localhost sk-ant-your-key

# Login credentials
enigmagent add LOGIN:gmail.com @localhost your-gmail-password

# Private documents (policies, templates, etc.)
enigmagent add DOC_company-policy.md @localhost "$(cat ~/docs/policy.md)"
```

### 4. Start the vault server

The server must run as a **persistent background process** while Hermes is active:

```bash
# In a separate terminal, or add to your startup scripts:
enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json
```

### 5. Install the Hermes plugin

```bash
mkdir -p ~/.hermes/plugins/enigmagent
# Copy this directory into the plugin location:
cp -r path/to/hermes-agent/plugin/enigmagent/* ~/.hermes/plugins/enigmagent/
```

### 6. Configure (optional)

Add to `~/.hermes/config.yaml`:

```yaml
plugins:
  enigmagent:
    port: 3737           # default
    host: 127.0.0.1      # default — never change to 0.0.0.0
    strict_mode: false   # set true to block calls with unresolved secrets
    timeout_s: 5
```

### 7. Install the agent skill (optional but recommended)

```bash
mkdir -p ~/.hermes/skills/security/enigmagent-vault
cp path/to/skills/security/enigmagent-vault/SKILL.md \
   ~/.hermes/skills/security/enigmagent-vault/
```

## Usage

The plugin works transparently — you don't need to change how you use Hermes.
Simply write `{{PLACEHOLDER}}` wherever a credential would go:

```bash
# GitHub operations
git clone https://{{GITHUB_TOKEN}}@github.com/org/private-repo.git
curl -H "Authorization: Bearer {{GITHUB_TOKEN}}" https://api.github.com/user

# OpenAI API calls
curl https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer {{OPENAI_API_KEY}}" \
  -d '{"model": "gpt-4", "messages": [...]}'

# Database connections
psql "postgresql://user:{{DB_PASSWORD}}@localhost:5432/db"

# Form filling
# In browser automation: fill #password with {{LOGIN:myapp.com}}
```

## Placeholder syntax

| Pattern | Example | Resolves to |
|---|---|---|
| `{{NAME}}` | `{{GITHUB_TOKEN}}` | Secret by name |
| `{{LOGIN:domain}}` | `{{LOGIN:gmail.com}}` | Login for a domain |
| `{{DOC:filename}}` | `{{DOC:policy.md}}` | Full text of a document |

## Agent tools

| Tool | Description |
|---|---|
| `enigmagent_vault_status` | Check if vault is running and unlocked |
| `enigmagent_vault_list` | List secret names and domains (no values) |

## Security properties

| Property | Value |
|---|---|
| Encryption | AES-256-GCM with per-entry random nonces |
| Key derivation | Argon2id: m=64 MiB, t=3 iterations, p=1 |
| Key lifetime | Process memory only — wiped on lock |
| Network | Binds to 127.0.0.1 only |
| LLM exposure | Zero — injection happens after LLM generates tool call |
| Domain binding | Secrets bound to specific domains (use `@localhost` for Hermes) |
| Log safety | Only placeholder names appear in logs, never values |

## Troubleshooting

**"server_unreachable" / plugin logs show connection refused:**
Start the vault server: `enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json`

**"not_found" for a placeholder:**
Run `enigmagent_vault_list` in Hermes and use the exact `name` field.

**"domain_mismatch":**
The secret was added with a domain other than `localhost`. Re-add it:
`enigmagent add SECRET_NAME @localhost <value>`

**"vault_locked":**
The server is running but the vault was not unlocked at startup. Restart the server.

## License

MIT — free to use in any Hermes project.
