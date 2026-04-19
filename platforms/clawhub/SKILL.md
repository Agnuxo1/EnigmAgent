# enigmagent-vault

**Category:** Security / Credentials  
**Type:** skill  
**Version:** 1.0.0  
**Author:** EnigmAgent  
**License:** MIT  
**Homepage:** https://enigmagent.com

---

## Overview

`enigmagent-vault` is a ClawHub skill that gives your agents secure, local-vault access to API keys, tokens, passwords, and private documents — without ever hardcoding credentials.

Agents reference secrets as `{{PLACEHOLDER}}` symbols. The vault resolves them at execution time using AES-256-GCM encryption, never exposing values in prompts, logs, or memory.

---

## What this skill does

- **Check vault status** — verify the EnigmAgent server is running and unlocked before starting any credentialed task
- **List secrets** — discover what secrets are available (names and domains, never values)
- **Resolve placeholders** — replace `{{SECRET_NAME}}` with the real value at call time
- **Guard agent memory** — integrate with Mem0 / vector stores to keep placeholders symbolic in stored memories

---

## Tools provided

| Tool | Description |
|------|-------------|
| `enigmagent_vault_status` | Check if vault is running and unlocked |
| `enigmagent_vault_list` | List all secret names and domains |
| `enigmagent_resolve` | Resolve a single `{{PLACEHOLDER}}` |
| `enigmagent_resolve_text` | Replace all `{{PLACEHOLDER}}` in a text block |

---

## Installation

```bash
# Via ClawHub CLI
clawhub install enigmagent-vault

# Manual (npm)
npm install clawhub-skill-enigmagent
```

After installing, add to your agent config:

```yaml
skills:
  - enigmagent-vault
```

---

## Configuration

| Key | Default | Description |
|-----|---------|-------------|
| `enigmagent.host` | `127.0.0.1` | Vault server host |
| `enigmagent.port` | `3737` | Vault server port |
| `enigmagent.origin` | `http://localhost` | Origin for domain binding |

```yaml
# .clawhub/config.yaml
enigmagent:
  host: 127.0.0.1
  port: 3737
  origin: http://localhost
```

---

## Security model

- The vault server runs **locally only** — `127.0.0.1`, never exposed to the network
- Credentials are encrypted with **AES-256-GCM** + **Argon2id** KDF
- Domain binding ensures a secret can only be accessed from its registered origin
- Placeholder references are symbolic in all agent prompts and memory stores

---

## Example usage

### Check vault before a task

```
Agent: Check vault status
→ { running: true, unlocked: true }
Agent: List available secrets
→ GITHUB_TOKEN, OPENAI_API_KEY, STRIPE_KEY
Agent: Run: git clone https://{{GITHUB_TOKEN}}@github.com/org/repo
→ Vault resolves {{GITHUB_TOKEN}} → real token at execution time
```

### Resolve text with multiple placeholders

```
Input:  "curl -H 'Authorization: Bearer {{OPENAI_API_KEY}}' https://api.openai.com/v1/models"
Output: "curl -H 'Authorization: Bearer sk-proj-abc...' https://api.openai.com/v1/models"
```

---

## Requirements

- EnigmAgent vault server running: `enigmagent-mcp --mode rest --port 3737`
- Node.js >= 18 or Python >= 3.9
