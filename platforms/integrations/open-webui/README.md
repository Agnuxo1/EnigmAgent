# EnigmAgent × Open WebUI

Two integration modes — pick the one that fits your setup.

## Option A — Tool (manual invoke)

Upload `enigmagent_tool.py` via **Admin → Tools → Upload**.  
Users can call it explicitly or enable auto-tool-call per model.

## Option B — Pipeline Filter (automatic, recommended)

Requires the [Open WebUI Pipelines](https://github.com/open-webui/pipelines) server.

1. Start Pipelines server.
2. Upload `enigmagent_pipeline.py`.
3. Enable for the models you want.
4. Every `{{PLACEHOLDER}}` in every message is resolved before the LLM sees it.

## Prerequisites

The vault REST API must be reachable:
```bash
enigmagent serve --port 39517
```

Or configure `vault_url` in the Valves settings to point to any running vault instance.

## Example

```
User: Call the OpenAI API with key {{OPENAI_KEY}} and summarize this text.
```
The LLM receives the real key value — your vault secret never appears in chat history.
