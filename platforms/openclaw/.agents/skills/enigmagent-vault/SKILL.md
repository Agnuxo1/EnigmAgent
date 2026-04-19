# EnigmAgent Vault — Agent Skill

## What this skill enables

You have access to an encrypted local vault (EnigmAgent) that stores sensitive credentials, API keys, and documents. You can reference any secret using a `{{PLACEHOLDER}}` syntax — the real value is injected **at execution time**, after you generate the tool call, so the actual secret never appears in your reasoning or output.

## Core security principle

**Never try to see or print secret values.** The vault's design ensures secrets flow directly from the encrypted store into the tool's execution environment. Your job is to use the correct placeholder name — the gateway handles the rest.

```
You write:   curl -H "Authorization: Bearer {{GITHUB_TOKEN}}" https://api.github.com/user
Gateway:     resolves {{GITHUB_TOKEN}} → injects real token → executes curl
You receive: the curl response (200 OK / user data)
```

The token never appears in the conversation.

---

## Placeholder syntax

| Pattern | Resolves to | Example |
|---|---|---|
| `{{NAME}}` | Secret by name (case-insensitive) | `{{GITHUB_TOKEN}}` |
| `{{LOGIN:domain}}` | Login credential bound to a domain | `{{LOGIN:gmail.com}}` |
| `{{DOC:filename}}` | Full text of a stored document | `{{DOC:company-policy.md}}` |

---

## Step 1 — Always check vault status first

Before any task that requires credentials, verify the vault is ready:

```
Tool: enigmagent_vault_status
```

**If running=false:**
> Tell the user: "The EnigmAgent vault server is not running. Please start it with:
> `enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json`"
> Do NOT proceed with the task until the vault is running.

**If running=true, unlocked=false:**
> Tell the user: "The vault server is running but locked. Please unlock it by restarting:
> `enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json`"

**If running=true, unlocked=true:**
> Proceed. All `{{PLACEHOLDER}}` references will resolve automatically.

---

## Step 2 — Discover available secrets

When you need a credential and you're not sure of the exact name:

```
Tool: enigmagent_vault_list
```

This lists all secret names and their domain bindings. Use the exact `name` value as your placeholder. Never guess names — use the list.

**Example output:**
```
count: 4
entries:
  - name: GITHUB_TOKEN     domain: github.com
  - name: OPENAI_KEY       domain: api.openai.com
  - name: LOGIN:gmail.com  domain: gmail.com
  - name: DOC_contract.md  domain: null (unbound)
```

To use `GITHUB_TOKEN`, write `{{GITHUB_TOKEN}}` in your tool call.
To use the Gmail login, write `{{LOGIN:gmail.com}}`.
To insert the contract document, write `{{DOC:contract.md}}`.

---

## Step 3 — Use placeholders in tool calls

Place the `{{PLACEHOLDER}}` exactly where the secret value would go.

### Bash / shell commands

```bash
# API calls
curl -H "Authorization: Bearer {{GITHUB_TOKEN}}" https://api.github.com/repos/owner/repo

# Git operations
git remote set-url origin https://{{GITHUB_TOKEN}}@github.com/owner/repo.git

# Database connections
psql "postgresql://admin:{{DB_PASSWORD}}@localhost:5432/mydb"
```

### HTTP requests (fetch / axios)

```typescript
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  headers: {
    'Authorization': 'Bearer {{OPENAI_KEY}}',
    'Content-Type': 'application/json',
  },
  // ...
});
```

### Form filling / web automation

```
Fill form field "password" with: {{LOGIN:myapp.com}}
Fill form field "api_key" with: {{MYAPP_API_KEY}}
```

### Document injection

```
Read the company's security policy and apply it:
{{DOC:security-policy.md}}
```

---

## Step 4 — Interpret resolution errors

If a tool call fails because a placeholder could not be resolved:

| Error | Meaning | Action |
|---|---|---|
| `vault_locked` | Vault is locked | Ask user to unlock the vault server |
| `not_found` | Secret name doesn't exist | Run `enigmagent_vault_list`, use exact name |
| `domain_mismatch` | Secret bound to different domain | Use `LOGIN:correct-domain.com` syntax |
| `no_domain_binding` | Secret has no domain but domain check failed | Inform user to add domain binding |
| `server_unreachable` | Vault server not running | Run `enigmagent:start` for setup instructions |

---

## What to NEVER do

- ❌ **Never ask the user to paste their API key or password into the chat** — that's what the vault is for.
- ❌ **Never print or log a `{{PLACEHOLDER}}` value** — if you somehow receive a resolved value, do not echo it back.
- ❌ **Never store secrets in files** (`.env`, config files, notes) — always use `{{PLACEHOLDER}}` references.
- ❌ **Never guess placeholder names** — always run `enigmagent_vault_list` first.
- ❌ **Never use vault features to bypass security checks** — domain binding exists for a reason.

---

## Quick reference card

```
# Check vault ready
Tool: enigmagent_vault_status

# Discover available secrets  
Tool: enigmagent_vault_list

# Use in any tool parameter
{{SECRET_NAME}}           ← named secret
{{LOGIN:example.com}}     ← domain login
{{DOC:filename.md}}       ← stored document

# The gateway resolves → executes → returns result
# You never see the actual secret value
```

---

## Behind the scenes (how it works)

1. You generate a tool call with `{{GITHUB_TOKEN}}` in a parameter.
2. The OpenClaw gateway intercepts the call before execution.
3. The EnigmAgent middleware resolves `{{GITHUB_TOKEN}}` by calling `POST http://127.0.0.1:3737/resolve`.
4. The vault decrypts the value (AES-256-GCM, Argon2id key) and returns it.
5. The gateway substitutes the value into the parameter and executes the tool.
6. You receive the tool's result — never the raw secret.

The vault runs entirely on the user's machine. No secret ever leaves the device.
