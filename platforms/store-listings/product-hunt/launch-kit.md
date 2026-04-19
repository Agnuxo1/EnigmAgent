# EnigmAgent — Product Hunt Launch Kit

## Tagline (60 chars max)
> Local AI vault: store secrets, use {{PLACEHOLDER}} references

## Maker Intro (for first comment)
Hi hunters 👋

I built **EnigmAgent** because I was tired of hardcoding API keys in AI agent prompts.

Every time I built a LangChain agent, AutoGen workflow, or n8n automation — I had to paste real credentials into prompts. That's a security nightmare: keys end up in logs, vector memory, and LLM context windows.

EnigmAgent solves this with a simple idea: **don't put real secrets in prompts — use {{PLACEHOLDER}} symbols instead.**

The local vault resolves them at execution time, using AES-256-GCM encryption. Nothing leaves your machine.

Works with 40+ AI frameworks out of the box: LangChain, CrewAI, AutoGen, LlamaIndex, n8n, Semantic Kernel, Haystack, SmolAgents, and more.

Would love your feedback! 🙏

## Short Description (260 chars)
EnigmAgent is a local-first encrypted vault for AI agent developers. Store API keys, tokens, and passwords. Reference them as {{PLACEHOLDER}} in prompts and scripts. Integrates with LangChain, CrewAI, n8n, and 40+ frameworks.

## Topics
- Artificial Intelligence
- Developer Tools
- Security
- Productivity
- Open Source

## Gallery (screenshots needed)
1. `vault-dashboard.png` — main vault UI showing secret list
2. `placeholder-resolve.png` — before/after: {{GITHUB_TOKEN}} → real value
3. `langchain-demo.gif` — LangChain agent using vault tools
4. `n8n-workflow.png` — n8n workflow with EnigmAgent nodes
5. `vscode-extension.png` — VS Code sidebar with vault status

## Links
- Website: https://enigmagent.com
- GitHub: https://github.com/enigmagent/enigmagent
- Docs: https://docs.enigmagent.com
- npm: https://www.npmjs.com/package/enigmagent-mcp
- PyPI: https://pypi.org/project/enigmagent/

## Pricing
Free and open source (MIT)
