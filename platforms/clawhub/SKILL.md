# enigmagent-vault

**Category:** Security / Credentials  
**Type:** skill  
**Version:** 1.0.0  
**Author:** EnigmAgent  
**License:** MIT  
**Homepage:** https://enigmagent.com

---

## Overview

`enigmagent-vault` is a ClawHub skill that gives your agents authenticated, local-vault access to API keys, tokens, passwords, and private documents without hardcoding credentials.

Agents can reference secrets as `{{PLACEHOLDER}}` symbols. Raw resolution is an explicit trusted-backend mode: the returned value is plaintext and can enter the calling agent's context, logs, or memory.

---

## What this skill does

- **Check vault status** — verify the EnigmAgent server is running and unlocked before starting any credentialed task
- **List secrets** — discover what secrets are available (names and domains, never values)
- **Resolve placeholders** — available only when the adapter and gateway raw-resolution opt-ins are enabled
- **Guard agent memory** — do not use raw resolution with an untrusted model; use EnigmAgent's fixed-operation broker for agent mode

---

## Tools provided

| Tool | Description |
|------|-------------|
| `enigmagent_vault_status` | Check if vault is running and unlocked |
| `enigmagent_vault_list` | List all secret names and domains |
| `enigmagent_resolve` | Trusted-backend-only plaintext resolution |
| `enigmagent_resolve_text` | Trusted-backend-only plaintext substitution |

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
| `enigmagent.token` | required | Random REST bearer token |
| `enigmagent.allowRawResolve` | `false` | Adapter-side opt-in; the gateway must also use `--allow-raw-resolve` |

```yaml
# .clawhub/config.yaml
enigmagent:
  host: 127.0.0.1
  port: 3737
  origin: http://localhost
```

---

## Security model

- The REST gateway requires a bearer token and should remain bound to `127.0.0.1`
- Credentials are encrypted with **AES-256-GCM** + **Argon2id** KDF
- Domain binding ensures a secret can only be accessed from its registered origin
- Raw resolution is not model-isolating; for untrusted agents use the fixed-operation broker instead of these resolve tools

---

## Example usage

### Check vault before a task

```
Agent: Check vault status
→ { running: true, unlocked: true }
Agent: List available secrets
→ GITHUB_TOKEN, OPENAI_API_KEY, STRIPE_KEY
```

For an untrusted model, use EnigmAgent's fixed-operation broker. The model selects
an operator-defined operation name and receives only its status; it does not receive
a credential or response body. Do not put a placeholder into a URL, prompt, log or
memory store.

The resolve tools are reserved for a trusted backend with both raw-resolution
opt-ins enabled. In that mode the returned value is plaintext and can enter the
caller context; this is an explicit exception to the model-isolating broker design.

---

## Requirements

- EnigmAgent vault server running: `enigmagent-mcp --mode rest --port 3737` (add `--allow-raw-resolve` only for a trusted backend)
- A random REST bearer token configured as `enigmagent.token`
- Node.js >= 18 or Python >= 3.9
