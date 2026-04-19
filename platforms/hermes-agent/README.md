# EnigmAgent × Hermes Agent — Contribution Guide

This directory contains the EnigmAgent encrypted vault plugin for
[nousresearch/hermes-agent](https://github.com/nousresearch/hermes-agent).

## What this contribution adds

| Directory | Contents |
|---|---|
| `plugin/enigmagent/` | Hermes plugin (Python, pure stdlib) |
| `skills/security/enigmagent-vault/` | Agent skill for safe credential usage |

## File placement in nousresearch/hermes-agent

```
hermes-agent/
├── plugins/
│   └── enigmagent/                         ← copy from plugin/enigmagent/
│       ├── __init__.py
│       ├── plugin.yaml
│       ├── vault_client.py
│       ├── resolver.py
│       ├── tools.py
│       └── README.md
└── skills/
    └── security/
        └── enigmagent-vault/               ← copy from skills/security/enigmagent-vault/
            └── SKILL.md
```

## How to submit the PR

### 1. Fork and clone

```bash
git clone https://github.com/YOUR_FORK/hermes-agent.git
cd hermes-agent
git checkout -b feat/enigmagent-vault-plugin
```

### 2. Copy the files

```bash
# From the EnigmAgent repo root:
cp -r platforms/hermes-agent/plugin/enigmagent   hermes-agent/plugins/enigmagent
cp -r platforms/hermes-agent/skills              hermes-agent/skills/security/enigmagent-vault
```

Or create the directories manually and copy each file.

### 3. Verify the structure

```
hermes-agent/plugins/enigmagent/
├── __init__.py       ← register(ctx) entry point
├── plugin.yaml       ← manifest
├── vault_client.py   ← HTTP client (stdlib only)
├── resolver.py       ← pre_tool_call hook
├── tools.py          ← agent tools
└── README.md         ← documentation

hermes-agent/skills/security/enigmagent-vault/
└── SKILL.md          ← agent skill with YAML frontmatter
```

### 4. Quick smoke test

```bash
# Terminal 1 — start vault server
npm install -g enigmagent-mcp
enigmagent create --vault ~/.enigmagent/vault.json
enigmagent add TEST_KEY @localhost hello-vault
enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json

# Terminal 2 — verify plugin loads
cd hermes-agent
python -c "
import sys
sys.path.insert(0, '.')
from plugins.enigmagent import register
print('Plugin imports OK')

from plugins.enigmagent.vault_client import VaultClient
c = VaultClient()
print('Status:', c.get_status())
print('Secrets:', c.list_secrets())
print('Resolve:', c.resolve('TEST_KEY', 'http://localhost'))
"
```

### 5. Open the pull request

```bash
cd hermes-agent
git add plugins/enigmagent skills/security/enigmagent-vault
git commit -m "feat(plugin): add EnigmAgent encrypted vault plugin

Adds a pre_tool_call hook that resolves {{PLACEHOLDER}} secret references
in tool arguments at execution time. Credentials never appear in the
LLM context, conversation history, or logs.

- vault_client.py: stdlib-only HTTP client for local REST API
- resolver.py: pre_tool_call hook with in-place arg patching
- tools.py: enigmagent_vault_status, enigmagent_vault_list
- SKILL.md: agent skill for safe credential usage patterns
- Zero new dependencies, zero changes to existing code"

git push origin feat/enigmagent-vault-plugin
gh pr create \
  --repo nousresearch/hermes-agent \
  --title "feat(plugin): add EnigmAgent encrypted vault plugin" \
  --body "$(cat platforms/hermes-agent/PR_BODY.md)"
```

## License

MIT — consistent with both the EnigmAgent and Hermes Agent projects.
