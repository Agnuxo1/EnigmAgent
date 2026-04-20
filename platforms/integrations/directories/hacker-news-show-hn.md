# Show HN: EnigmAgent — local AES-256-GCM vault for AI agent secrets

**Title:** Show HN: EnigmAgent – local encrypted vault that injects {{PLACEHOLDER}} secrets into AI prompts

**URL:** https://enigmagent.pages.dev

---

**Body:**

I built EnigmAgent because I kept seeing AI agent tutorials that hardcode API keys in prompts or environment variables that end up in LLM context windows and logs.

The problem is subtle: when you write `api_key = os.getenv("OPENAI_KEY")` and pass it to an LLM agent, the model may echo it back, include it in summarizations, or it ends up in your message history forever.

**How it works:**

1. Store secrets once: `add OPENAI_KEY @openai.com sk-proj-...`
2. Reference as placeholder: `api_key = "{{OPENAI_KEY}}"`
3. EnigmAgent resolves at submit time — the LLM receives the real value only for that request
4. Secret is never stored in prompt history

The vault is AES-256-GCM with Argon2id key derivation. Everything runs locally — no accounts, no cloud sync, no telemetry.

**What's included:**
- Chrome extension (popup vault + content script injection)
- `enigmagent` Python package (PyPI)
- `n8n-nodes-enigmagent` npm package
- Integrations for LangChain, CrewAI, AutoGen, LlamaIndex, Open WebUI, Flowise, SillyTavern, Ollama, and ~35 more

`enigmagent run -- any-command` is probably the quickest way to try it — it injects vault secrets as env vars before running your script.

Source: https://github.com/agnuxo1/EnigmAgent (MIT)
