# Awesome-List Submission PRs — Mythos Visibility Campaign

## Wave 2 — Strike-1 + Strike-2 + Strike-7 (2026-04-25)

Combined reach: ~150,000 stars across destination repositories.

### Strike-1 (8 PRs — awesome-mcp ecosystem)
| List | PR | Stars |
|------|----|-------|
| Puliczek/awesome-mcp-security | [#140](https://github.com/Puliczek/awesome-mcp-security/pull/140) | 684 |
| TensorBlock/awesome-mcp-servers | [#445](https://github.com/TensorBlock/awesome-mcp-servers/pull/445) | 638 |
| MobinX/awesome-mcp-list | [#236](https://github.com/MobinX/awesome-mcp-list/pull/236) | 878 |
| AlexMili/Awesome-MCP | [#104](https://github.com/AlexMili/Awesome-MCP/pull/104) | 139 |
| ever-works/awesome-mcp-servers | [#99](https://github.com/ever-works/awesome-mcp-servers/pull/99) | 59 |
| yzfly/Awesome-MCP-ZH | [#195](https://github.com/yzfly/Awesome-MCP-ZH/pull/195) | 6,900 |
| LangGPT/awesome-claude-code | [#53](https://github.com/LangGPT/awesome-claude-code/pull/53) | — |
| webfuse-com/awesome-claude | [#210](https://github.com/webfuse-com/awesome-claude/pull/210) | 1,400 |

### Strike-2 (7 PRs/issue — high-star Claude lists + cline marketplace)
| List | PR/Issue | Stars |
|------|----------|-------|
| ComposioHQ/awesome-claude-skills | [#731](https://github.com/ComposioHQ/awesome-claude-skills/pull/731) | **56,000** |
| travisvn/awesome-claude-skills | [#646](https://github.com/travisvn/awesome-claude-skills/pull/646) | 11,700 |
| BehiSecc/awesome-claude-skills | [#268](https://github.com/BehiSecc/awesome-claude-skills/pull/268) | 8,700 |
| win4r/Awesome-Claude-MCP-Servers | [#45](https://github.com/win4r/Awesome-Claude-MCP-Servers/pull/45) | 83 |
| PatrickJS/awesome-cursorrules | [#268](https://github.com/PatrickJS/awesome-cursorrules/pull/268) | **39,000** |
| e2b-dev/awesome-ai-agents | [#853](https://github.com/e2b-dev/awesome-ai-agents/pull/853) | **27,000** |
| cline/mcp-marketplace | [issue #1438](https://github.com/cline/mcp-marketplace/issues/1438) | (in-IDE) |

### Strike-7 (in progress — VoltAgent, sysadmin, Korean, meta-list, ai-agents)
Pending submissions tracked separately in this campaign run.

### Web form / CLI (manual — user action required)
| Target | Method | Doc reference |
|--------|--------|---------------|
| MCP Registry | `mcp-publisher publish` CLI | MYTHOS_VISIBILITY_PACKAGE.md §6.D |
| PulseMCP | Web form | §6.A |
| mcp.so | Web form | §6.B |
| cursor.directory | Web form | §6.C |
| Smithery.ai | Deferred (needs Streamable-HTTP) | §6.E |

---

## Wave 1 — Initial submissions (2026-04-24)

### PR 1 — punkpeye/awesome-mcp-servers (85,500 stars)
**PR URL:** https://github.com/punkpeye/awesome-mcp-servers/pull/5336
**Status:** Open
**Section:** Security (alphabetical, between Erodenn/fetch-guard and firstorderai)
**Entry added:**
```
- [Agnuxo1/EnigmAgent](https://github.com/Agnuxo1/EnigmAgent/tree/main/platforms/mcp-server) 📇 🏠 🍎 🪟 🐧 - Encrypted local vault for AI agents. Resolve `{{SECRET}}` placeholders in prompts at runtime — the LLM never sees real API keys. AES-256-GCM + Argon2id, zero cloud, browser extension included. `npx enigmagent-mcp`
```

### PR 2 — caramaschiHG/awesome-ai-agents-2026 (360 stars)
**PR URL:** https://github.com/caramaschiHG/awesome-ai-agents-2026/pull/184
**Status:** Open
**Section:** AI Safety and Guardrails
**Entry added:**
```
| [EnigmAgent](https://github.com/Agnuxo1/EnigmAgent) | Browser extension + MCP server that gives AI agents access to encrypted credentials via `{{PLACEHOLDER}}` syntax. Secrets never exposed to the LLM. AES-256-GCM + Argon2id, zero cloud. |
```

### PR 3 — janhq/awesome-local-ai (1,931 stars)
**PR URL:** https://github.com/janhq/awesome-local-ai/pull/88
**Status:** Open
**Section:** User Tools
**Entry added:**
```
- [EnigmAgent](https://github.com/Agnuxo1/EnigmAgent) - Encrypted local vault for local AI stacks. Integrates with Ollama, LM Studio, Jan, GPT4All, Open WebUI and more. Resolves {{PLACEHOLDER}} secrets at runtime so your local LLM never sees real credentials. AES-256-GCM + Argon2id.
```

### PR 4 — e2b-dev/awesome-ai-sdks (1,167 stars)
**PR URL:** https://github.com/e2b-dev/awesome-ai-sdks/pull/159
**Status:** Open
**Section:** End of list (new entry)
**Entry added:** Full formatted entry with description, features, and links

---

## Glama.ai MCP Directory

**Status:** Pending auto-indexing (typically 24-48 hours after GitHub repo creation)

**GitHub repo created:** https://github.com/Agnuxo1/enigmagent-mcp
- Contains: `index.js`, `package.json` (name: `enigmagent-mcp`), `README.md`
- Topics: mcp, mcp-server, ai-agents, secrets, vault, aes-256-gcm, argon2id, security, claude, openai
- **Expected Glama URL:** https://glama.ai/mcp/servers/Agnuxo1/enigmagent-mcp

Glama auto-indexes GitHub repos with `mcp` in package.json keywords. The standalone `enigmagent-mcp` repo has the correct metadata. If not indexed automatically within 48h, sign in to glama.ai with GitHub to claim/submit manually.

---

## Submitted PRs (2026-04-25)

### 5. awesome-selfhosted
**Repo:** https://github.com/awesome-selfhosted/awesome-selfhosted
**Status:** ❌ Blocked — repository has interaction restrictions (collaborators only)
**Note:** Fork branch `add-enigmagent` exists at Agnuxo1/awesome-selfhosted — can retry later if restrictions lifted.

### 6. awesome-ai-tools (mahseema)
**PR URL:** https://github.com/mahseema/awesome-ai-tools/pull/1187
**Status:** Open
**Section:** Developer tools
**Entry added:**
```
- [EnigmAgent](https://github.com/Agnuxo1/EnigmAgent) - Local AES-256-GCM encrypted vault for AI agents. Store API keys and reference them as `{{PLACEHOLDER}}` tokens — secrets resolved at runtime, never exposed to the LLM. Zero cloud, MIT licensed.
```

### 7. Awesome-LLM (Hannibal046)
**PR URL:** https://github.com/Hannibal046/Awesome-LLM/pull/515
**Status:** Open
**Section:** LLM Applications
**Entry added:**
```
- [EnigmAgent](https://github.com/Agnuxo1/EnigmAgent) - Local AES-256-GCM encrypted vault for LLM agent secrets. Inject API keys as `{{PLACEHOLDER}}` tokens — never exposed in LLM context. AES-256-GCM + Argon2id, zero cloud, MIT.
```

### 8. awesome-langchain (kyrolabs)
**PR URL:** https://github.com/kyrolabs/awesome-langchain/pull/324
**Status:** Open
**Section:** Tools → Services
**Entry added:**
```
- [EnigmAgent](https://github.com/Agnuxo1/EnigmAgent): Local secret vault with LangChain callbacks. Resolve `{{PLACEHOLDER}}` tokens transparently in any chain or agent — API keys never enter the LLM context. AES-256-GCM + Argon2id.
```

### 9. awesome-local-ai (ethicals7s variant)
**Repo:** https://github.com/ethicals7s/awesome-local-ai *(check if exists)*

---

## Manual Submission Directories

### AlternativeTo.net
**URL to submit:** https://alternativeto.net/ → avatar → "Suggest new application"
**Fields:**
- Name: EnigmAgent
- Website: https://github.com/Agnuxo1/EnigmAgent
- Platform: Windows, macOS, Linux, Browser Extension
- License: Open Source (MIT)
- Description: Local AES-256-GCM encrypted vault for AI agents. Store API keys and reference them as {{PLACEHOLDER}} tokens in agent prompts — secrets are resolved at runtime so the LLM never sees real values. Browser extension + MCP server + Python/Node.js SDK. Zero cloud, zero telemetry.
- Alternatives to: 1Password, Bitwarden, HashiCorp Vault (for AI agent use cases)
- Tags: password-manager, api-keys, ai-agents, security, encryption, mcp, langchain, openai
**Status:** Manual action required (no API)

### Product Hunt
**Draft:** `D:/PROJECTS/EnigmAgent/platforms/store-listings/product-hunt/PRODUCT_HUNT_DRAFT.md`
**URL to submit:** https://www.producthunt.com/posts/new
**Status:** Manual action required (Francisco must submit)

### chrome-stats.com
**Auto-indexed** from Chrome Web Store.
**Extension ID:** `kjelbdaphngolbjfgaahljhpkhknjank`
**Expected URL:** https://chrome-stats.com/d/kjelbdaphngolbjfgaahljhpkhknjank
**Status:** Auto-populated once extension has installs/activity on Chrome Web Store. No manual submission needed.

---

## GitHub Topics to add to main EnigmAgent repo
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
mcp
mcp-server
```

## PR Template

**Title:** Add EnigmAgent — local secret vault for AI agents

**Body:**
```
Adding EnigmAgent (https://github.com/Agnuxo1/EnigmAgent) to the [Category] section.

EnigmAgent is a local AES-256-GCM encrypted vault that resolves {{PLACEHOLDER}} 
tokens in AI agent prompts at runtime — the LLM never sees real API keys.

- MIT licensed, open source
- Zero cloud, zero telemetry
- Chrome extension + Python package + npm package + MCP server
- Integrations for LangChain, CrewAI, AutoGen, Open WebUI, n8n, and more

GitHub: https://github.com/Agnuxo1/EnigmAgent
npm (MCP): enigmagent-mcp
```
