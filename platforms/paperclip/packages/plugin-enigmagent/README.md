# @enigmagent/paperclip-plugin

> Encrypted local vault plugin for Paperclip. Exposes `vault_status` and `vault_list` agent tools. Combines with `@enigmagent/paperclip-secrets-provider` to enable transparent `{{ secret.KEY }}` resolution at the server level.

## Quick start

```bash
# Install
pnpm paperclipai plugin install @enigmagent/paperclip-plugin

# Start vault server
enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json

# Configure Paperclip (.env)
PAPERCLIP_SECRETS_PROVIDER=enigmagent
```

## Plugin tools

| Tool | Description |
|---|---|
| `vault_status` | Check vault server status (running/unlocked) |
| `vault_list` | List secret names and domains — never values |

## Configuration (per-instance via Paperclip UI)

| Field | Default | Description |
|---|---|---|
| `host` | `127.0.0.1` | Vault API host |
| `port` | `3737` | Vault API port |
| `strictMode` | `false` | Block runs when secrets unavailable |
| `timeoutMs` | `5000` | Request timeout (ms) |
| `origin` | `http://localhost` | Domain-binding check origin |

## Full documentation

See [doc/enigmagent.md](../../doc/enigmagent.md) for the complete guide.

## License

MIT
