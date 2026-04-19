---
name: enigmagent-vault
description: >
  Use the EnigmAgent encrypted vault to handle credentials, API keys,
  and private documents without those values ever appearing in your
  reasoning or output. Placeholders are resolved at execution time.
version: 0.2.0
license: MIT
platforms: [macos, linux, windows]
metadata:
  hermes:
    tags: [security, vault, credentials, api-keys, privacy]
    related_skills: [git-operations, web-browsing, github-automation]
---

# EnigmAgent Vault — Secure Credential Usage

## Core principle

**Never ask the user for credentials. Never write credentials in tool arguments.**
Use `{{PLACEHOLDER}}` references instead — they are resolved to real values
*after* you generate the tool call, *before* the tool executes.

The LLM (you) writes the placeholder. The gateway injects the real value.
You never see it. The user's secrets stay private.

```
You write:   curl -H "Authorization: Bearer {{GITHUB_TOKEN}}" https://api.github.com
Gateway:     resolves {{GITHUB_TOKEN}} → injects ghp_xxxxxxxxxxxx → runs curl
You receive: the HTTP response body (200 OK, user data, etc.)
```

---

## Placeholder syntax

| Pattern | Example | Use case |
|---|---|---|
| `{{NAME}}` | `{{GITHUB_TOKEN}}` | Any named secret |
| `{{LOGIN:domain}}` | `{{LOGIN:gmail.com}}` | Login password for a domain |
| `{{DOC:filename}}` | `{{DOC:report.md}}` | Full text of a stored document |

Names are **case-insensitive**. Use the exact name shown by `enigmagent_vault_list`.

---

## Step 1 — Check vault is ready

Before any task involving credentials, call:

```
Tool: enigmagent_vault_status
```

**If `running: false`:**
Tell the user:
> "The EnigmAgent vault server is not running. Please open a new terminal and run:
> `enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json`
> Then try again."

Do NOT proceed until the vault is running.

**If `running: true, unlocked: false`:**
Tell the user:
> "The vault server is running but locked. Please restart it:
> `enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json`"

**If `running: true, unlocked: true`:**
Proceed. All `{{PLACEHOLDER}}` references will work.

---

## Step 2 — Discover available secrets

When you need a credential and are unsure of the exact name, call:

```
Tool: enigmagent_vault_list
```

This lists all secrets by name and domain. Use the **exact** `name` field as your placeholder.
Never guess names — always check the list first.

**Example output:**
```json
{
  "count": 4,
  "entries": [
    {"name": "GITHUB_TOKEN",      "domain": "localhost"},
    {"name": "OPENAI_API_KEY",    "domain": "localhost"},
    {"name": "LOGIN:gmail.com",   "domain": "localhost"},
    {"name": "DOC_contract.md",   "domain": "localhost"}
  ]
}
```

To use `GITHUB_TOKEN`, write `{{GITHUB_TOKEN}}` in your tool argument.
To use the Gmail password, write `{{LOGIN:gmail.com}}`.
To insert the contract, write `{{DOC:contract.md}}` (note: stored as `DOC_contract.md` but referenced as `DOC:contract.md`).

---

## Step 3 — Using placeholders in Hermes tools

### Terminal tool (bash commands)

```bash
# GitHub API
curl -s -H "Authorization: Bearer {{GITHUB_TOKEN}}" \
     -H "Accept: application/vnd.github+json" \
     https://api.github.com/repos/owner/repo/issues

# Git push over HTTPS (token in URL)
git remote set-url origin https://{{GITHUB_TOKEN}}@github.com/owner/repo.git
git push origin main

# Database connection
psql "postgresql://admin:{{DB_PASSWORD}}@localhost:5432/mydb" -c "SELECT version();"

# AWS CLI (if key is in vault)
AWS_ACCESS_KEY_ID={{AWS_ACCESS_KEY}} AWS_SECRET_ACCESS_KEY={{AWS_SECRET_KEY}} \
  aws s3 ls s3://my-bucket

# pip install from private registry
pip install mypackage --extra-index-url https://{{PYPI_TOKEN}}@private.registry.com/simple/
```

### Browser tool (web automation)

```json
{
  "action": "fill",
  "selector": "#password",
  "value": "{{LOGIN:myapp.com}}"
}
```

```json
{
  "action": "fill",
  "selector": "#api-key-input",
  "value": "{{MYAPP_API_KEY}}"
}
```

### File write (inject credentials into config files temporarily)

```python
# Write a config file that includes a real token — the placeholder is resolved
# before this code runs, so the real value is written to the file.
config_content = """
[auth]
token = {{GITHUB_TOKEN}}
"""
with open(".github-config", "w") as f:
    f.write(config_content)
```

### Document injection

When a task requires using a private document:

```bash
# Inject document content inline
cat << 'EOF'
Apply the following company policy to this PR review:

{{DOC:code-review-policy.md}}
EOF
```

### Python code that calls APIs

```python
import httpx

# {{OPENAI_API_KEY}} is resolved before this Python snippet runs
client = httpx.Client(headers={"Authorization": "Bearer {{OPENAI_API_KEY}}"})
response = client.post("https://api.openai.com/v1/chat/completions", json={...})
```

---

## Step 4 — Interpret resolution errors

If a tool call fails with an EnigmAgent error:

| Error code | Meaning | What to do |
|---|---|---|
| `vault_locked` | Vault is locked | Ask user to restart the vault server |
| `not_found` | Secret name doesn't exist | Run `enigmagent_vault_list`, use exact name |
| `domain_mismatch` | Secret bound to wrong domain | Secret was added with `@different-domain`. Ask user to re-add with `@localhost` |
| `no_domain_binding` | Secret has no domain | Ask user to re-add with `@localhost`: `enigmagent add NAME @localhost value` |
| `server_unreachable` | Server not running | Ask user to start server (see Step 1) |

---

## What NOT to do

- ❌ **Never ask "what is your GitHub token?"** — use `{{GITHUB_TOKEN}}` instead.
- ❌ **Never put a real credential in a tool argument** — the LLM context is not a safe place for secrets.
- ❌ **Never echo or print a resolved value** — if you somehow receive a secret in output, do not include it in your response.
- ❌ **Never store secrets in files that are committed to git** — use placeholder syntax in templates.
- ❌ **Never guess placeholder names** — call `enigmagent_vault_list` first.

---

## Quick reference

```bash
# Start vault server (run once before Hermes)
enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json

# Add secrets
enigmagent add GITHUB_TOKEN @localhost ghp_yourtoken
enigmagent add OPENAI_API_KEY @localhost sk-yourkey
enigmagent add LOGIN:gmail.com @localhost yourpassword
enigmagent add DOC_policy.md @localhost "$(cat policy.md)"

# In tool calls — write the placeholder, never the value:
{{GITHUB_TOKEN}}        ← API token
{{LOGIN:gmail.com}}     ← login password
{{DOC:policy.md}}       ← document text
```

---

## How the resolution works (for your understanding)

```
1. You generate:  args = {"command": "curl -H 'Authorization: Bearer {{GITHUB_TOKEN}}'..."}
2. pre_tool_call hook fires (before execution)
3. Hook scans args → finds {{GITHUB_TOKEN}}
4. Hook calls: POST http://127.0.0.1:3737/resolve  {"placeholder": "GITHUB_TOKEN", "origin": "http://localhost"}
5. Vault decrypts (AES-256-GCM, Argon2id key) → returns real value
6. Hook patches args in-place → real token in command
7. Terminal tool runs curl with real token
8. You receive: HTTP response
```

The vault runs entirely on the user's machine. Nothing leaves the device.
