## feat(plugin): add EnigmAgent encrypted vault plugin

### Summary

This PR contributes an **encrypted local vault plugin** for Hermes agents.
It allows agents to use credentials (API tokens, passwords, private documents)
without those values ever appearing in the LLM's context, conversation history,
or logs.

### The security problem this solves

Hermes agents call external APIs, push to GitHub, connect to databases, and fill
forms — all of which require credentials. The typical approach is to expose those
credentials via environment variables or paste them in the chat, which means:

- Secrets can appear in LLM conversation history (stored by cloud providers).
- They can be exfiltrated by prompt injection attacks targeting visible values.
- They appear in Hermes session logs.

This plugin solves the problem by separating **credential authorship** (the LLM)
from **credential access** (the gateway hook):

```
LLM writes:   curl -H "Authorization: Bearer {{GITHUB_TOKEN}}" https://api.github.com
Hook fires:   resolves {{GITHUB_TOKEN}} → injects real token
Tool runs:    curl with real token (LLM never sees it)
LLM receives: HTTP response body
```

### What's included

| File | Description |
|---|---|
| `plugins/enigmagent/__init__.py` | Plugin entry point — `register(ctx)` wires hooks and tools |
| `plugins/enigmagent/vault_client.py` | HTTP client for the EnigmAgent local REST API |
| `plugins/enigmagent/resolver.py` | `pre_tool_call` hook — scans args, resolves `{{PLACEHOLDER}}` in-place |
| `plugins/enigmagent/tools.py` | Agent tools: `enigmagent_vault_status`, `enigmagent_vault_list` |
| `plugins/enigmagent/plugin.yaml` | Plugin manifest with capabilities and config schema |
| `plugins/enigmagent/README.md` | Installation and usage guide |
| `skills/security/enigmagent-vault/SKILL.md` | Agent skill — when/how to use vault references safely |

### How it works

1. **EnigmAgent server** runs locally on `127.0.0.1:3737` (started separately). It stores secrets encrypted with AES-256-GCM using an Argon2id-derived key (m=64 MiB, t=3).

2. **`pre_tool_call` hook** intercepts every tool call before execution. It walks the `args` dict, finds all `{{PLACEHOLDER}}` patterns, resolves them in parallel via the local API, and patches `args` in-place. The tool then runs with the real values.

3. **Agent tools** (`enigmagent_vault_status`, `enigmagent_vault_list`) let the agent verify vault readiness and discover available secret names — without ever accessing values.

4. **Agent skill** (`SKILL.md`) teaches the agent exactly when to check the vault, how to use each placeholder syntax, and what to do when resolution fails.

### Placeholder syntax

| Pattern | Example | Use case |
|---|---|---|
| `{{NAME}}` | `{{GITHUB_TOKEN}}` | API token |
| `{{LOGIN:domain}}` | `{{LOGIN:gmail.com}}` | Login password |
| `{{DOC:filename}}` | `{{DOC:policy.md}}` | Private document |

### Security properties

- AES-256-GCM + Argon2id KDF — OWASP/NIST compliant
- Vault server binds to `127.0.0.1` only
- Master key in process memory only, wiped on lock
- Domain binding: each secret scoped to a domain
- Zero LLM exposure: injection happens *after* the LLM generates the call
- Logs emit only placeholder names, never values

### Design decisions

- **No new dependencies** — `vault_client.py` uses only Python stdlib (`urllib.request`, `concurrent.futures`). No `requests`, no `httpx` required.
- **In-place arg patching** — the `pre_tool_call` hook receives `args` by reference and modifies it with `.clear()` + `.update()` — consistent with the Hermes hook contract.
- **Strict mode off by default** — unresolvable placeholders are left as-is and logged as warnings, so the plugin doesn't break existing workflows during adoption.
- **Fully additive** — no changes to existing Hermes code.

### Testing the integration

```bash
# Start vault server
enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json

# Add a test secret
enigmagent add TEST_SECRET @localhost hello-from-vault

# Start Hermes and ask:
# "Check vault status, then list available secrets, then run:
#  echo {{TEST_SECRET}}"
# Expected: echo outputs 'hello-from-vault'
```

### Notes

- Voluntary, free open-source contribution.
- Zero changes to existing Hermes code — purely additive plugin.
- Python 3.11+ compatible (uses `list[T]` and `dict[K,V]` syntax in type hints).
- MIT licensed.

### Checklist

- [x] No changes to existing Hermes source files
- [x] Zero new runtime dependencies (stdlib only)
- [x] Follows Hermes tool handler conventions (returns JSON string)
- [x] Follows Hermes hook contract (modifies args in-place, returns None)
- [x] Plugin manifest (`plugin.yaml`) complete with config schema
- [x] Agent skill documents safe and unsafe usage patterns
- [x] README covers full installation, configuration, and troubleshooting
