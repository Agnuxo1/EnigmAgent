# EnigmAgent × OpenClaw — Contribution Guide

This directory contains everything needed to contribute the EnigmAgent encrypted vault integration to the [openclaw/openclaw](https://github.com/openclaw/openclaw) project.

## What this contribution adds

| File | Purpose |
|---|---|
| `extensions/enigmagent/` | TypeScript plugin package (`@openclaw/plugin-enigmagent`) |
| `.agents/skills/enigmagent-vault/SKILL.md` | Agent skill — teaches Claude how to use vault references safely |
| `docs/enigmagent.md` | Full documentation page for the OpenClaw docs site |

## File placement in the openclaw/openclaw repository

When submitting the PR, place files as follows:

```
openclaw/openclaw/
├── extensions/
│   └── enigmagent/                         ← copy from extensions/enigmagent/
│       ├── openclaw.plugin.json
│       ├── package.json
│       ├── tsconfig.json
│       ├── README.md
│       └── src/
│           ├── index.ts
│           ├── types.ts
│           ├── vault-client.ts
│           ├── middleware.ts
│           ├── tools.ts
│           └── cli.ts
├── .agents/
│   └── skills/
│       └── enigmagent-vault/               ← copy from .agents/skills/enigmagent-vault/
│           └── SKILL.md
└── docs/
    └── enigmagent.md                       ← copy from docs/enigmagent.md
```

## How to submit the PR

### 1. Fork and clone the OpenClaw repo

```bash
git clone https://github.com/YOUR_FORK/openclaw.git
cd openclaw
git checkout -b feat/enigmagent-vault
```

### 2. Copy the integration files

```bash
# From the EnigmAgent repository root:
cp -r platforms/openclaw/extensions/enigmagent/ path/to/openclaw/extensions/enigmagent/
cp -r platforms/openclaw/.agents/             path/to/openclaw/.agents/
cp    platforms/openclaw/docs/enigmagent.md   path/to/openclaw/docs/enigmagent.md
```

### 3. Install dependencies

```bash
cd path/to/openclaw
pnpm install
```

### 4. Build and type-check the plugin

```bash
cd extensions/enigmagent
npm install
npm run build
npm run typecheck
```

### 5. Register the plugin in the root config (if needed by OpenClaw)

Check `openclaw.config.ts` in the repo root. If plugins are registered there, add:

```typescript
import { createEnigmAgentPlugin } from './extensions/enigmagent/src/index.js';

// In plugins array:
createEnigmAgentPlugin(),
```

### 6. Open the pull request

```bash
cd path/to/openclaw
git add extensions/enigmagent .agents/skills/enigmagent-vault docs/enigmagent.md
git commit -m "feat(vault): add EnigmAgent encrypted secret vault plugin

Adds a plugin that resolves {{PLACEHOLDER}} references in tool call
parameters at execution time. Secret values never reach the LLM.

- AES-256-GCM encryption + Argon2id KDF (m=64 MiB)
- Middleware hooks into tool execution pipeline
- Agent tools: enigmagent_vault_status, enigmagent_vault_list
- CLI: enigmagent:status, enigmagent:list, enigmagent:start
- Agent skill (SKILL.md) teaches safe usage patterns
- Full documentation in docs/enigmagent.md"

git push origin feat/enigmagent-vault
gh pr create \
  --repo openclaw/openclaw \
  --title "feat(vault): add EnigmAgent encrypted secret vault plugin" \
  --body "$(cat platforms/openclaw/PR_BODY.md)"
```

## PR description template

See [PR_BODY.md](PR_BODY.md) for the pull request body to use.

## Testing the integration locally

Before submitting, verify the plugin works end-to-end:

```bash
# 1. Start the vault server
enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json

# 2. In a second terminal, run a quick integration check
node -e "
import('./extensions/enigmagent/src/index.js').then(async ({ createEnigmAgentPlugin }) => {
  const plugin = createEnigmAgentPlugin();
  console.log('Plugin meta:', plugin.meta);
  console.log('Tools:', plugin.tools.map(t => t.name));
  console.log('CLI commands:', plugin.cliCommands.map(c => c.name));
  const status = await plugin.tools[0].execute({});
  console.log('Vault status:', status);
});
"
```

## License

This contribution is released under the MIT License, consistent with the EnigmAgent project.
Free to use, modify, and distribute. No attribution required.
