# Awesome-List Submission PRs

## Repos to submit a PR to

### 1. awesome-selfhosted
**Repo:** https://github.com/awesome-selfhosted/awesome-selfhosted
**Category:** Personal Dashboards / Security
**Line to add (under Password Managers & Vaults):**
```
- [EnigmAgent](https://enigmagent.pages.dev) - Local AES-256-GCM encrypted vault for AI agent secrets. Resolves {{PLACEHOLDER}} tokens at runtime — LLMs never see real values. ([Source Code](https://github.com/agnuxo1/EnigmAgent)) `MIT` `JavaScript/Python`
```

### 2. awesome-ai-tools
**Repo:** https://github.com/mahseema/awesome-ai-tools (or equivalent)
**Category:** Developer Tools / Security
**Line to add:**
```
- [EnigmAgent](https://enigmagent.pages.dev) - Local encrypted vault for AI agents. {{PLACEHOLDER}} syntax resolves API keys at runtime. AES-256-GCM, zero cloud.
```

### 3. awesome-llm
**Repo:** https://github.com/Hannibal046/Awesome-LLM
**Category:** Tools / Agents / Security
**Line to add:**
```
- [EnigmAgent](https://github.com/agnuxo1/EnigmAgent) - Local AES-256-GCM vault for LLM agent secrets. Inject API keys as {{PLACEHOLDER}} tokens — never exposed in LLM context.
```

### 4. awesome-langchain
**Repo:** https://github.com/kyrolabs/awesome-langchain
**Category:** Tools / Security
**Line to add:**
```
- [EnigmAgent](https://enigmagent.pages.dev) - Local secret vault with LangChain callbacks. Resolve {{PLACEHOLDER}} tokens transparently in any chain or agent.
```

### 5. awesome-open-webui
**Category:** Tools / Extensions
**Line to add:**
```
- [EnigmAgent Pipeline](https://github.com/agnuxo1/EnigmAgent) - Filter pipeline that resolves {{PLACEHOLDER}} tokens in Open WebUI using a local AES-256-GCM vault.
```

### 6. awesome-n8n
**Category:** Security / Credentials
**Line to add:**
```
- [n8n-nodes-enigmagent](https://www.npmjs.com/package/n8n-nodes-enigmagent) - Community node for resolving {{PLACEHOLDER}} vault secrets in n8n workflows.
```

### 7. awesome-local-ai
**Repo:** https://github.com/janhansen/awesome-local-ai (or similar)
**Category:** Security / Privacy
**Line to add:**
```
- [EnigmAgent](https://enigmagent.pages.dev) - Encrypted local vault for local AI stacks. Integrates with Ollama, LM Studio, Jan, GPT4All, text-generation-webui, Open WebUI and more.
```

### 8. GitHub Topics to add to repo
```
ai-security
secret-vault
langchain
crewai
open-webui
llm-tools
local-ai
aes-256
credential-management
browser-extension
```

## PR Template

**Title:** Add EnigmAgent — local secret vault for AI agents

**Body:**
```
Adding EnigmAgent (https://enigmagent.pages.dev) to the [Category] section.

EnigmAgent is a local AES-256-GCM encrypted vault that resolves {{PLACEHOLDER}} 
tokens in AI agent prompts at runtime — the LLM never sees real API keys.

- MIT licensed, open source
- Zero cloud, zero telemetry
- Chrome extension + Python package + npm package
- Integrations for LangChain, CrewAI, AutoGen, Open WebUI, n8n, etc.

GitHub: https://github.com/agnuxo1/EnigmAgent
```
