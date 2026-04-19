# EnigmAgent — Encrypted Vault for Paperclip

EnigmAgent is an **encrypted local vault** that allows Paperclip agents to use
API keys, passwords, and private documents without those values ever appearing
in the LLM's token stream, conversation history, or logs.

## Why this exists

Paperclip agents are powerful automation tools. They call GitHub APIs, push
code, log into web services, connect to databases, and fill enterprise forms.
All of these operations need credentials.

The problem with passing credentials directly to agents:

| Risk | Detail |
|---|---|
| **LLM context leakage** | Credentials in prompts appear in provider logs and potentially training data |
| **Conversation history** | Tokens stored in Paperclip's DB can be queried later |
| **Prompt injection** | An attacker can craft external content that tricks the agent into echoing a visible credential |
| **Accidental exposure** | Agent summarises or logs credentials it received in tool results |

EnigmAgent eliminates all of these risks with a **placeholder-at-write,
resolve-at-execution** architecture.

---

## How it works

```
┌─────────────────────────────────────────────────────────────────────┐
│                       User's Machine                                │
│                                                                     │
│  ┌────────────┐    ┌────────────────────────────────────────────┐  │
│  │  LLM API   │    │            Paperclip Server                 │  │
│  │  (online)  │    │                                             │  │
│  │            │    │   Agent writes tool call:                  │  │
│  │  sees only │◄───│   { "command": "curl -H 'Authorization:    │  │
│  │  {{ secret │    │      Bearer {{ secret.GITHUB_TOKEN }}' …"} │  │
│  │  .KEY }}"  │    │                    │                        │  │
│  │  patterns  │    │   resolveSecrets() │                        │  │
│  └────────────┘    │                    ▼                        │  │
│                    │   ┌──────────────────────────────┐          │  │
│                    │   │  EnigmAgentSecretsProvider   │          │  │
│                    │   │  .resolve("GITHUB_TOKEN")    │          │  │
│                    │   └──────────┬───────────────────┘          │  │
│                    │              │ POST /resolve                 │  │
│                    └──────────────┼──────────────────────────────┘  │
│                                   ▼                                 │
│                    ┌──────────────────────────────┐                 │
│                    │  EnigmAgent REST API          │                 │
│                    │  http://127.0.0.1:3737        │                 │
│                    └──────────┬───────────────────┘                 │
│                               │ decrypt                             │
│                               ▼                                     │
│                    ┌──────────────────────────────┐                 │
│                    │  Vault (AES-256-GCM)          │                 │
│                    │  ~/.enigmagent/vault.json     │                 │
│                    └──────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
```

**The key guarantee:** the LLM writes `{{ secret.GITHUB_TOKEN }}` in the tool
call. Paperclip's server resolves this via the EnigmAgent provider *before*
executing the tool. The real token is injected at the server level — it never
appears as an LLM input or output token.

---

## Installation

### Step 1 — Install the EnigmAgent MCP server

```bash
npm install -g enigmagent-mcp
# Or build from source:
git clone https://github.com/agnuxo1/EnigmAgent
cd EnigmAgent/platforms/mcp-server && npm link
```

### Step 2 — Create a vault

```bash
enigmagent create --vault ~/.enigmagent/vault.json
# Enter username and master password when prompted
```

### Step 3 — Add secrets

```bash
# All Hermes/local tool secrets should use @localhost as domain
enigmagent add GITHUB_TOKEN    @localhost  ghp_your_personal_access_token
enigmagent add OPENAI_API_KEY  @localhost  sk-your-openai-key
enigmagent add ANTHROPIC_KEY   @localhost  sk-ant-your-anthropic-key
enigmagent add NPM_TOKEN       @localhost  npm_your-publish-token
enigmagent add DB_PASSWORD     @localhost  your-database-password

# Login credentials for web automation
enigmagent add LOGIN:github.com  @localhost  your-github-password
enigmagent add LOGIN:gmail.com   @localhost  your-gmail-password

# Private documents (policies, templates, etc.)
enigmagent add DOC_company-policy.md  @localhost  "$(cat docs/policy.md)"
```

### Step 4 — Start the vault server

Run this **before** starting Paperclip, in a separate terminal or as a background service:

```bash
enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json
# Or with environment variables:
ENIGMAGENT_VAULT=~/.enigmagent/vault.json enigmagent-mcp --mode rest --port 3737
```

For persistent deployment, create a systemd service:

```ini
# /etc/systemd/system/enigmagent.service
[Unit]
Description=EnigmAgent vault server
After=network.target

[Service]
Type=simple
User=%i
Environment=ENIGMAGENT_USER=your-user
Environment=ENIGMAGENT_PASS=your-pass
Environment=ENIGMAGENT_VAULT=/home/%i/.enigmagent/vault.json
ExecStart=/usr/local/bin/enigmagent-mcp --mode rest --port 3737
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

### Step 5 — Configure Paperclip

Add to your `.env` (or deployment environment):

```bash
PAPERCLIP_SECRETS_PROVIDER=enigmagent
ENIGMAGENT_HOST=127.0.0.1
ENIGMAGENT_PORT=3737
ENIGMAGENT_TIMEOUT_MS=5000
# Optional: set true to block agent runs when secrets are unavailable
# PAPERCLIP_SECRETS_STRICT_MODE=true
```

### Step 6 — Apply the server patch

Add the `@enigmagent/paperclip-secrets-provider` package to `packages/server/package.json`:

```json
{
  "dependencies": {
    "@enigmagent/paperclip-secrets-provider": "^0.2.0"
  }
}
```

Then apply the one-line patch to `server/src/secrets/index.ts` (see
[`server-patches/secrets-provider.patch.ts`](../server-patches/secrets-provider.patch.ts)
for exact instructions).

### Step 7 — Install the plugin

```bash
pnpm paperclipai plugin install @enigmagent/paperclip-plugin
# Or from local source:
pnpm paperclipai plugin install file:packages/plugin-enigmagent
```

### Step 8 — Verify everything

```bash
./scripts/verify.sh
```

---

## Using secrets in agent configurations

Once configured, use `{{ secret.KEY_NAME }}` anywhere in:
- Agent bash/shell commands
- HTTP tool parameters (headers, bodies, URLs)
- File contents to write
- Web automation form values
- Any tool parameter that accepts a string

### Examples

**GitHub operations:**
```bash
# List private repositories
curl -H "Authorization: Bearer {{ secret.GITHUB_TOKEN }}" \
     https://api.github.com/user/repos?visibility=private

# Push to a private repository
git remote set-url origin https://{{ secret.GITHUB_TOKEN }}@github.com/org/repo.git
git push origin main

# Create a GitHub Actions secret via API
curl -X PUT \
  -H "Authorization: Bearer {{ secret.GITHUB_TOKEN }}" \
  -H "Content-Type: application/json" \
  "https://api.github.com/repos/org/repo/actions/secrets/MY_SECRET" \
  -d '{"encrypted_value":"...", "key_id":"..."}'
```

**npm publishing:**
```bash
npm set //registry.npmjs.org/:_authToken={{ secret.NPM_TOKEN }}
npm publish --access public
```

**Database connections:**
```bash
# PostgreSQL
psql "postgresql://admin:{{ secret.DB_PASSWORD }}@db.example.com:5432/prod"

# MySQL
mysql -u admin -p{{ secret.DB_PASSWORD }} -h db.example.com prod_db

# Connection string for app config
echo "DATABASE_URL=postgresql://admin:{{ secret.DB_PASSWORD }}@localhost/mydb" >> .env
```

**HTTP API calls:**
```json
{
  "url": "https://api.openai.com/v1/chat/completions",
  "headers": {
    "Authorization": "Bearer {{ secret.OPENAI_API_KEY }}",
    "Content-Type": "application/json"
  },
  "body": { "model": "gpt-4", "messages": [{"role": "user", "content": "Hello"}] }
}
```

**Web automation / login flows:**
```
Navigate to https://myapp.com/login
Fill #email    with: user@company.com
Fill #password with: {{ secret.LOGIN:myapp.com }}
Click #submit
```

**Private document injection:**
```
Review this PR against the company coding standards:

{{ secret.DOC:coding-standards.md }}

The PR diff is: [paste diff here]
```

---

## Plugin tools

The `@enigmagent/paperclip-plugin` exposes two agent-callable tools:

### `@enigmagent/paperclip-plugin:vault_status`

Check whether the vault server is running and the vault is unlocked. Call this at the start of any task that requires credentials.

**Returns:**
```json
{
  "running": true,
  "unlocked": true,
  "host": "127.0.0.1",
  "port": 3737
}
```

### `@enigmagent/paperclip-plugin:vault_list`

List all secret names and domain bindings. **Never returns actual values.** Use this to discover available secret names.

**Returns:**
```json
{
  "count": 3,
  "entries": [
    { "name": "GITHUB_TOKEN",     "domain": "localhost", "created": "2025-01-01T..." },
    { "name": "OPENAI_API_KEY",   "domain": "localhost", "created": "2025-01-01T..." },
    { "name": "LOGIN:github.com", "domain": "localhost", "created": "2025-01-01T..." }
  ]
}
```

---

## Secret reference syntax

| Pattern | Example | Resolves to |
|---|---|---|
| `{{ secret.NAME }}` | `{{ secret.GITHUB_TOKEN }}` | Named secret |
| `{{ secret.LOGIN:domain }}` | `{{ secret.LOGIN:github.com }}` | Domain login |
| `{{ secret.DOC:filename }}` | `{{ secret.DOC:policy.md }}` | Stored document |

Keys are case-insensitive for lookup.

---

## Security properties

| Property | Value |
|---|---|
| **Encryption** | AES-256-GCM with random per-entry nonces |
| **Key derivation** | Argon2id: m=64 MiB, t=3 iterations, p=1 — brute-force resistant |
| **Key storage** | Process memory only — never on disk in plaintext, wiped on lock |
| **Network exposure** | Binds to `127.0.0.1` only — never accessible from outside the machine |
| **LLM exposure** | Zero — secrets injected by Paperclip server after LLM generates tool call |
| **Domain binding** | Each secret scoped to a domain; use `@localhost` for Paperclip tools |
| **Log safety** | Secret values never appear in logs — only key names |
| **Audit trail** | Resolution events logged via Paperclip's activity system (key name only) |

---

## Managing secrets

```bash
# List secrets (no values shown)
enigmagent list

# Add a secret
enigmagent add KEY_NAME @domain value

# Update a secret
enigmagent add --update KEY_NAME @domain new-value

# Remove a secret
enigmagent del KEY_NAME

# Export vault (encrypted — safe to back up)
enigmagent export --out backup.vault.json

# Import vault
enigmagent import --from backup.vault.json
```

---

## Troubleshooting

### "EnigmAgent server unreachable"

The vault server isn't running. Start it:
```bash
enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json
```

### "vault_locked"

The server is running but the vault isn't unlocked (e.g., after a restart without credentials). Restart the server — it prompts for credentials at startup.

### "not_found"

The key name doesn't match any stored secret. Run `vault_list` and use the exact `name` field.

### "domain_mismatch"

The secret was added with a different domain. Re-add it with `@localhost`:
```bash
enigmagent add KEY_NAME @localhost new-value
```

### Secrets resolving as `undefined` instead of the real value

Check that `PAPERCLIP_SECRETS_PROVIDER=enigmagent` is set in your environment and that the server-side patch was applied correctly. Run `./scripts/verify.sh` for a full diagnostic.

---

## Environment variables reference

| Variable | Default | Description |
|---|---|---|
| `PAPERCLIP_SECRETS_PROVIDER` | `env` | Set to `enigmagent` to enable |
| `ENIGMAGENT_HOST` | `127.0.0.1` | Vault REST API host |
| `ENIGMAGENT_PORT` | `3737` | Vault REST API port |
| `ENIGMAGENT_TIMEOUT_MS` | `5000` | Request timeout in milliseconds |
| `ENIGMAGENT_ORIGIN` | `http://localhost` | Origin for domain-binding checks |
| `ENIGMAGENT_DEBUG` | `false` | Log resolution events (key names only, never values) |
| `ENIGMAGENT_VAULT` | `~/.enigmagent/vault.json` | Path to vault file |
| `ENIGMAGENT_USER` | — | Non-interactive username |
| `ENIGMAGENT_PASS` | — | Non-interactive password (only in secure CI environments) |

---

## Source

- Repository: https://github.com/agnuxo1/EnigmAgent
- Secrets provider: `platforms/paperclip/packages/secrets-provider-enigmagent/`
- Plugin: `platforms/paperclip/packages/plugin-enigmagent/`
- Agent instructions: `platforms/paperclip/AGENTS.md`
- License: MIT
