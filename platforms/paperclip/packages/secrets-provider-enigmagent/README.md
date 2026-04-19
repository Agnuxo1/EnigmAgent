# @enigmagent/paperclip-secrets-provider

> Server-side Paperclip secrets provider backed by the EnigmAgent encrypted local vault.
> Routes `{{ secret.KEY }}` resolution through AES-256-GCM encrypted storage — credentials never appear in LLM context.

## What it does

When `PAPERCLIP_SECRETS_PROVIDER=enigmagent` is set, every `{{ secret.KEY }}` reference
in agent tool parameters is resolved by this provider via the local EnigmAgent REST API
(`http://127.0.0.1:3737`), instead of environment variables or a shared secrets file.

```
Agent writes   → {{ secret.GITHUB_TOKEN }}
Server calls   → EnigmAgentSecretsProvider.resolve("GITHUB_TOKEN")
Provider calls → POST http://127.0.0.1:3737/resolve
Vault decrypts → real token
Tool executes  → with real token (LLM never sees it)
```

## Integration

### 1. Add dependency

```json
// packages/server/package.json
{
  "dependencies": {
    "@enigmagent/paperclip-secrets-provider": "^0.2.0"
  }
}
```

### 2. Apply the server patch

In `server/src/secrets/index.ts` (or equivalent), add:

```typescript
import { createEnigmAgentSecretsProvider } from '@enigmagent/paperclip-secrets-provider';

// In the provider factory switch:
case 'enigmagent':
  return createEnigmAgentSecretsProvider();
```

### 3. Set environment variables

```bash
PAPERCLIP_SECRETS_PROVIDER=enigmagent
ENIGMAGENT_HOST=127.0.0.1
ENIGMAGENT_PORT=3737
```

### 4. Start the vault server

```bash
enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json
```

## API

```typescript
import { EnigmAgentSecretsProvider, createEnigmAgentSecretsProvider } from '@enigmagent/paperclip-secrets-provider';

const provider = createEnigmAgentSecretsProvider();

// Used automatically by Paperclip's secrets system
const value = await provider.resolve('GITHUB_TOKEN'); // → string | undefined

// Health check
const health = await provider.healthCheck(); // → { ok, unlocked, message }
```

## License

MIT
