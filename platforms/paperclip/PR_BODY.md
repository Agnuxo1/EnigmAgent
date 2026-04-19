## feat(secrets): add EnigmAgent encrypted vault — secrets provider + plugin

### Summary

This PR contributes an **encrypted local vault integration** for Paperclip that
allows agents to use API tokens, passwords, and private documents without those
values ever appearing in the LLM's context, conversation history, or activity logs.

It consists of two parts that work together:

1. **`@enigmagent/paperclip-secrets-provider`** — a server-side `SecretsProvider`
   that routes Paperclip's existing `{{ secret.KEY }}` resolution through the
   EnigmAgent encrypted vault, requiring a one-line patch to the secrets factory.

2. **`@enigmagent/paperclip-plugin`** — a Paperclip plugin (out-of-process worker,
   `@paperclipai/plugin-sdk`) that exposes `vault_status` and `vault_list` agent
   tools and performs a startup health check.

---

### The security problem this solves

Paperclip agents call external APIs, push code, connect to databases, and fill
enterprise forms — all of which need credentials. Current approaches:

- **Environment variables** — visible in server logs, shared across all agents
- **Agent prompt injection** — credentials appear as LLM tokens (provider logs,
  fine-tuning datasets, prompt injection exfiltration)
- **Hardcoded in configs** — credentials in DB, version-controlled files

This PR solves the problem by plugging into Paperclip's **existing**
`{{ secret.KEY }}` resolution pipeline with a cryptographically strong backend:

```
LLM writes:  curl -H "Authorization: Bearer {{ secret.GITHUB_TOKEN }}" https://…
Server:      resolveSecretsInParams() → EnigmAgentSecretsProvider.resolve("GITHUB_TOKEN")
             → POST http://127.0.0.1:3737/resolve → vault decrypts → real token
Tool runs:   curl with real token
LLM gets:    HTTP response body — never the token
```

---

### Files changed

#### New packages

| Package | Purpose |
|---|---|
| `packages/secrets-provider-enigmagent/` | `EnigmAgentSecretsProvider` — implements `SecretsProvider`, calls local vault API |
| `packages/plugin-enigmagent/` | Paperclip plugin — `vault_status`, `vault_list` tools + startup health check |

#### Server changes

| File | Change |
|---|---|
| `packages/server/package.json` | +1 dependency: `@enigmagent/paperclip-secrets-provider` |
| `server/src/secrets/index.ts` | +4 lines: import + `case 'enigmagent'` in provider factory |
| `server/src/config.ts` | +`'enigmagent'` to the `SecretsProviderType` enum |
| `.env.example` | +6 lines: `PAPERCLIP_SECRETS_PROVIDER` and `ENIGMAGENT_*` variables |

#### Documentation

| File | Purpose |
|---|---|
| `doc/enigmagent.md` | Complete integration guide with architecture diagram, examples, troubleshooting |
| `AGENTS.md` (addition) | Agent instruction template for `{{ secret.KEY }}` usage |

---

### Architecture

The `EnigmAgentSecretsProvider` implements the `SecretsProvider` interface:

```typescript
async resolve(key: string): Promise<string | undefined> {
  // POST http://127.0.0.1:3737/resolve { placeholder: key, origin: "http://localhost" }
  // → EnigmAgent vault decrypts (AES-256-GCM, Argon2id) → returns plaintext
  // → Paperclip substitutes into tool param → tool executes → LLM gets result
}
```

The plugin uses `@paperclipai/plugin-sdk`'s `definePlugin` + `runWorker` pattern:

```typescript
const plugin = definePlugin({
  async setup(ctx) {
    ctx.tools.register('vault_status', schema, async () => { … });
    ctx.tools.register('vault_list',   schema, async () => { … });
  }
});
runWorker(plugin, import.meta.url);
```

---

### Security properties

| Property | Value |
|---|---|
| Encryption | AES-256-GCM, per-entry random nonces |
| Key derivation | Argon2id: m=64 MiB, t=3 iterations, p=1 |
| Key storage | Process memory only — wiped on lock |
| Network | `127.0.0.1` only — never exposed remotely |
| LLM exposure | Zero — injection happens server-side, after LLM generates tool call |
| Domain binding | Each secret scoped to a domain (`@localhost` for Paperclip tools) |
| Log safety | Only key names in logs, never values |
| Audit trail | Resolution events via Paperclip activity system |

---

### Design decisions

- **Uses Paperclip's own `{{ secret.KEY }}` syntax** — no new agent syntax. Agents
  that already use `{{ secret.KEY }}` work immediately after switching the provider.
- **One-line server patch** — the secrets factory already has a `switch` statement;
  we add one `case`. No architectural changes.
- **Zero new runtime dependencies** — the provider uses Node.js built-in `fetch`
  (Node 18+ / Node 20+ as required by Paperclip). No `axios`, no `got`, no `httpx`.
- **Graceful degradation** — if the vault server is unreachable, the provider logs a
  warning and returns `undefined` (same behaviour as a missing env var). Set
  `strictMode: true` in the plugin config to fail hard instead.
- **Fully additive** — no modifications to existing Paperclip functionality.

---

### Testing

```bash
# Start vault server
enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json

# Add a test secret
enigmagent add TEST_TOKEN @localhost hello-paperclip

# Set provider in .env
echo "PAPERCLIP_SECRETS_PROVIDER=enigmagent" >> .env

# Run verification script
./scripts/verify.sh

# In a Paperclip agent run, use:
# echo {{ secret.TEST_TOKEN }}
# Expected output: hello-paperclip
```

---

### Notes

- Voluntary, free open-source contribution. MIT licensed.
- Requires EnigmAgent MCP server: `npm install -g enigmagent-mcp`
- The vault server runs as a **separate process** — Paperclip startup is unaffected
  if the vault is unavailable (graceful degradation).
- Compatible with Paperclip's existing secret reference syntax unchanged.

### Checklist

- [x] One-line server patch to `server/src/secrets/index.ts`
- [x] `SecretsProvider` interface implemented correctly
- [x] Plugin uses official `@paperclipai/plugin-sdk` `definePlugin` + `runWorker` pattern
- [x] Tool handlers return `{ content: string, data: unknown }` as required
- [x] Zero new runtime dependencies (Node built-in `fetch` only)
- [x] Graceful degradation when vault server is unavailable
- [x] Full documentation in `doc/enigmagent.md`
- [x] Agent instruction template in `AGENTS.md`
- [x] Installation script and verification script included
- [x] `.env.example` updated with all new variables
