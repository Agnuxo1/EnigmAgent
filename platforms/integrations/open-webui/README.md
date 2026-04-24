# EnigmAgent x Open WebUI

Two integration modes — pick the one that fits your setup.

## Prerequisites

Start the EnigmAgent vault REST API before using either mode:

```bash
enigmagent-mcp --mode rest --port 3737 --vault ./vault.json
```

The server listens on `http://127.0.0.1:3737` by default (localhost only).

REST endpoints:
- `GET  /status`  — vault health check
- `GET  /list`    — list secret names
- `POST /resolve` — `{"placeholder": "NAME", "origin": "https://..."}`

## Option A — Tool (manual invoke)

Upload `enigmagent_tool.py` via **Admin > Tools > Upload**.

Users can call it explicitly in any prompt, or enable auto-tool-call per model.

Tool methods:
- `resolve_secret(placeholder, origin)` — resolve a single secret
- `list_secrets()` — list all secret names

Configure the Vault URL in the Valves settings (default: `http://127.0.0.1:3737`).

## Option B — Pipeline Filter (automatic, recommended)

Requires the [Open WebUI Pipelines](https://github.com/open-webui/pipelines) server.

1. Start Pipelines server.
2. Upload `enigmagent_pipeline.py`.
3. Enable for the models you want.
4. Every `{{PLACEHOLDER}}` in every message is resolved before the LLM sees it.

## Example

```
User: Call the OpenAI API with key {{OPENAI_KEY}} and summarize this text.
```

The LLM receives the real key value — your vault secret never appears in chat history.

## Configuration

Both integrations accept these Valve settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `vault_url` | `http://127.0.0.1:3737` | Base URL of the EnigmAgent REST API |
| `origin` | `http://localhost` | Origin for domain-binding validation |

## Community Tool Submission

The `enigmagent_tool.py` file is ready for the Open WebUI community tool library.

### Submit steps

1. Go to https://openwebui.com/tools and click **Submit Tool**
2. Paste the raw GitHub URL:
   ```
   https://raw.githubusercontent.com/Agnuxo1/EnigmAgent/main/platforms/integrations/open-webui/enigmagent_tool.py
   ```
3. Fill in tags: `security`, `vault`, `secrets`, `credentials`, `ai-agents`
4. The community library indexes the metadata from the docstring header automatically

The tool file already carries the required Open WebUI metadata header (`title`, `author`,
`author_url`, `funding_url`, `version`, `license`, `description`, `requirements`).
