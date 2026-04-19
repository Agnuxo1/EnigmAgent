# EnigmAgent × Paperclip — Contribution Guide

Encrypted local vault integration for [paperclipai/paperclip](https://github.com/paperclipai/paperclip).

## What's here

```
platforms/paperclip/
├── packages/
│   ├── secrets-provider-enigmagent/   ← Server-side SecretsProvider
│   │   ├── src/
│   │   │   ├── index.ts               ← EnigmAgentSecretsProvider class
│   │   │   └── vault-client.ts        ← HTTP client (stdlib fetch only)
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── plugin-enigmagent/             ← Paperclip plugin (plugin-sdk)
│       ├── src/
│       │   ├── manifest.ts            ← Plugin manifest & tool declarations
│       │   ├── worker.ts              ← definePlugin + tools registration
│       │   └── vault-client.ts        ← HTTP client (shared)
│       ├── package.json
│       └── tsconfig.json
├── server-patches/
│   └── secrets-provider.patch.ts      ← Exact patch for server/src/secrets/index.ts
├── doc/
│   └── enigmagent.md                  ← Full documentation
├── scripts/
│   ├── install.sh                     ← One-command installation
│   └── verify.sh                      ← End-to-end verification
├── AGENTS.md                           ← Agent instruction template
├── PR_BODY.md                          ← Ready-to-use PR description
└── README.md                          ← This file
```

## How to submit the PR

### 1. Fork and clone

```bash
git clone https://github.com/YOUR_FORK/paperclip.git
cd paperclip
git checkout -b feat/enigmagent-vault
```

### 2. Copy the packages

```bash
# From the EnigmAgent repo root:
cp -r platforms/paperclip/packages/secrets-provider-enigmagent \
      paperclip/packages/secrets-provider-enigmagent

cp -r platforms/paperclip/packages/plugin-enigmagent \
      paperclip/packages/plugin-enigmagent
```

### 3. Apply the server patch

Edit `server/src/secrets/index.ts` (see `server-patches/secrets-provider.patch.ts`):

```typescript
// Add import:
import { createEnigmAgentSecretsProvider } from '@enigmagent/paperclip-secrets-provider';

// Add case:
case 'enigmagent':
  return createEnigmAgentSecretsProvider();
```

Edit `server/src/config.ts` — add `'enigmagent'` to the `SecretsProviderType` enum.

### 4. Add dependency to server package.json

```json
"@enigmagent/paperclip-secrets-provider": "workspace:*"
```

### 5. Update .env.example

```bash
# EnigmAgent vault secrets provider
PAPERCLIP_SECRETS_PROVIDER=enigmagent
ENIGMAGENT_HOST=127.0.0.1
ENIGMAGENT_PORT=3737
ENIGMAGENT_TIMEOUT_MS=5000
ENIGMAGENT_ORIGIN=http://localhost
ENIGMAGENT_DEBUG=false
```

### 6. Copy docs

```bash
cp platforms/paperclip/doc/enigmagent.md paperclip/doc/enigmagent.md
# Append AGENTS.md content to paperclip/AGENTS.md (if it exists)
cat platforms/paperclip/AGENTS.md >> paperclip/AGENTS.md
```

### 7. Build and verify

```bash
pnpm install
pnpm build
# Start vault server, then:
./scripts/verify.sh
```

### 8. Open the PR

```bash
git add packages/secrets-provider-enigmagent packages/plugin-enigmagent \
        server/src/secrets/index.ts server/src/config.ts \
        .env.example doc/enigmagent.md AGENTS.md
git commit -m "feat(secrets): add EnigmAgent encrypted vault — secrets provider + plugin"
git push origin feat/enigmagent-vault
gh pr create \
  --repo paperclipai/paperclip \
  --title "feat(secrets): add EnigmAgent encrypted vault secrets provider and plugin" \
  --body "$(cat platforms/paperclip/PR_BODY.md)"
```

## License

MIT — consistent with both EnigmAgent and Paperclip.
