# Product Hunt Submission — EnigmAgent

## Name
EnigmAgent

## Tagline
Local AI secret vault — {{PLACEHOLDER}} injection for AI agents

## URL
https://enigmagent.pages.dev

## Topics
AI Tools, Security, Developer Tools, Open Source, Privacy

## Description (< 260 chars)
Encrypted local vault for AI agents. Store API keys once, reference as {{PLACEHOLDER}} in prompts — real values inject at runtime. AES-256-GCM + Argon2id. Zero cloud. Zero telemetry. MIT. Works with 40+ frameworks.

## Thumbnail Image
Use: extension/icons/icon-128.png

## Gallery Screenshots (order)
1. platforms/store-listings/chrome/screenshot-1-vault-chat.png
2. platforms/store-listings/chrome/screenshot-2-integration.png

## Maker Comment (first comment)
We built EnigmAgent because we kept seeing AI demos leaking API keys.
The problem: AI agents need real credentials at runtime, but you don't want your LLM to see or log them.

Solution: store secrets in a local AES-256-GCM vault, reference them as {{OPENAI_KEY}} in prompts, and let EnigmAgent inject the real values at submit time — before the LLM ever sees the message.

Works with LangChain, CrewAI, AutoGen, LlamaIndex, Open WebUI, n8n, SillyTavern, Flowise, and 35+ more frameworks. Chrome extension available, Python + npm packages published.

All code is MIT licensed and 100% local — no accounts, no cloud, no telemetry.

## Links
- GitHub: https://github.com/agnuxo1/EnigmAgent
- Chrome Extension: https://chromewebstore.google.com/
- PyPI: https://pypi.org/project/enigmagent/
- npm: https://www.npmjs.com/package/n8n-nodes-enigmagent
