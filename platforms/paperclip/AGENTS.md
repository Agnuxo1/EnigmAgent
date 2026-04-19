# EnigmAgent Vault — Agent Instructions

Include this section in your AGENTS.md or agent instruction file to teach your
Paperclip agents how to use the encrypted vault safely.

---

## Using the EnigmAgent Vault

Your credentials, API tokens, and private documents are stored in an encrypted
local vault (EnigmAgent). You can reference any secret using Paperclip's
`{{ secret.KEY }}` syntax — the real value is injected **after** you generate
the tool call, so you never see the actual credential.

### Security rule

**Never write a real credential value in a tool argument.** Always use
`{{ secret.KEY_NAME }}` instead. If you do not know the exact key name, call
the `@enigmagent/paperclip-plugin:vault_list` tool first.

---

## Before any task that needs credentials

1. Check the vault is ready:
   ```
   Tool: @enigmagent/paperclip-plugin:vault_status
   ```
   If `running: false` → ask the user to start the vault server.
   If `running: true, unlocked: false` → ask the user to unlock it.

2. Discover available secret names (if unsure):
   ```
   Tool: @enigmagent/paperclip-plugin:vault_list
   ```
   Use the exact `name` field as your `{{ secret.NAME }}` reference.

---

## Secret reference syntax

| What you write | Resolves to |
|---|---|
| `{{ secret.GITHUB_TOKEN }}` | GitHub personal access token |
| `{{ secret.OPENAI_API_KEY }}` | OpenAI API key |
| `{{ secret.LOGIN:gmail.com }}` | Gmail password |
| `{{ secret.DOC:company-policy.md }}` | Full text of a stored document |

The key after `secret.` must match the `name` field from `vault_list` exactly.

---

## Usage examples

### Shell / bash commands

```bash
# GitHub API
curl -s \
  -H "Authorization: Bearer {{ secret.GITHUB_TOKEN }}" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/owner/repo/issues

# Git push over HTTPS
git remote set-url origin https://{{ secret.GITHUB_TOKEN }}@github.com/owner/repo.git
git push origin main

# Database operations
psql "postgresql://admin:{{ secret.DB_PASSWORD }}@localhost:5432/mydb" -c "SELECT 1"

# npm publish to private registry
npm set //registry.npmjs.org/:_authToken={{ secret.NPM_TOKEN }}
npm publish
```

### HTTP tool parameters

```json
{
  "url": "https://api.openai.com/v1/chat/completions",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer {{ secret.OPENAI_API_KEY }}",
    "Content-Type": "application/json"
  }
}
```

### Web automation / form filling

```
Fill field "#api-key" with: {{ secret.MYSERVICE_API_KEY }}
Fill field "#password"  with: {{ secret.LOGIN:myapp.com }}
```

### Document/context injection

```
Apply the following company security policy when reviewing this PR:

{{ secret.DOC:code-review-policy.md }}
```

---

## Error handling

If Paperclip reports that a `{{ secret.KEY }}` reference could not be resolved:

| Error | Cause | Action |
|---|---|---|
| Secret not found | Key name doesn't exist | Run `vault_list`, use exact name |
| Vault locked | Server started but not unlocked | Ask user to restart vault server |
| Server unreachable | EnigmAgent not running | Ask user to start the server |
| Domain mismatch | Secret bound to different domain | Ask user to re-add with `@localhost` |

---

## What NOT to do

- ❌ Do NOT ask the user "what is your GitHub token?" — use `{{ secret.GITHUB_TOKEN }}`
- ❌ Do NOT print or echo a resolved value — if it appears in tool output, do not include it in your reply
- ❌ Do NOT store credentials in files that get committed — use `{{ secret.KEY }}` templates
- ❌ Do NOT guess key names — always call `vault_list` first
