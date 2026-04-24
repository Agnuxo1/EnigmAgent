# EnigmAgent Plugin for LM Studio

TypeScript plugin that exposes three LM Studio tools:

| Tool | Description |
|------|-------------|
| `enigmagent_resolve` | Resolve `{{PLACEHOLDER}}` tokens in any text string |
| `enigmagent_list`    | List secret names available in the vault (never values) |
| `enigmagent_status`  | Check vault running/unlocked state |

## Prerequisites

1. EnigmAgent vault running: `enigmagent-mcp --mode rest --port 3737`
2. Node.js 18+ / npm

## Install & Build

```bash
cd platforms/integrations/lm-studio/lmstudio-plugin
npm install
npm run build
```

## Register in LM Studio

LM Studio does not yet have a plugin registry UI. Register via the SDK:

```typescript
import { LMStudioClient } from "@lmstudio/sdk";
import { tools } from "./dist/index.js";

const client = new LMStudioClient();
// Load a model and attach the tools
const model = await client.llm.load("lmstudio-community/Meta-Llama-3-8B-Instruct-GGUF");
const response = await model.respond(
  [{ role: "user", content: "List my available secrets: call enigmagent_list" }],
  { tools }
);
console.log(response.content);
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENIGMAGENT_HOST`  | `127.0.0.1` | Vault REST API host |
| `ENIGMAGENT_PORT`  | `3737`      | Vault REST API port |
| `ENIGMAGENT_TOKEN` | *(empty)*   | Bearer token (optional) |

## Example

```typescript
import { tools } from "enigmagent-lmstudio-plugin";

// The model can call enigmagent_resolve automatically:
// User: "Send a request using {{OPENAI_KEY}}"
// → model calls enigmagent_resolve({ text: "Send a request using {{OPENAI_KEY}}" })
// → vault returns real value
// → model uses resolved text
```
