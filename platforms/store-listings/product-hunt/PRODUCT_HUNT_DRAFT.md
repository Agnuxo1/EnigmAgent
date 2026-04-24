# EnigmAgent — Product Hunt Submission Draft

## Product Name
**EnigmAgent**

## Tagline (60 chars max — current: 58 chars)
Stop pasting API keys into AI chats — use {{placeholders}}

## Short Description (260 chars max — current: 255 chars)
EnigmAgent is a local-first encrypted vault for AI agents. Store API keys and credentials encrypted (AES-256-GCM + Argon2id), then reference them as {{PLACEHOLDER}} in prompts. The LLM never sees real secrets. Works with Claude, GPT-4, LangChain, CrewAI, n8n, and more.

## Topics / Categories
- AI Tools
- Developer Tools
- Security
- Productivity
- Open Source

## Links
- **GitHub:** https://github.com/Agnuxo1/EnigmAgent
- **Chrome Web Store:** https://chromewebstore.google.com/detail/enigmagent/kjelbdaphngolbjfgaahljhpkhknjank
- **Firefox Add-ons:** https://addons.mozilla.org/firefox/addon/enigmagent/ *(if published)*
- **npm (MCP server):** https://www.npmjs.com/package/enigmagent-mcp
- **Privacy Policy:** https://github.com/Agnuxo1/EnigmAgent/blob/main/PRIVACY.md

## Maker: Francisco Angulo de Lafuente (@agnuxo1)

---

## First Comment (Maker Comment) — the most important piece

Hi hunters!

I built **EnigmAgent** because I kept making the same security mistake: pasting real API keys directly into AI agent prompts.

Every time I spun up a LangChain agent, AutoGen workflow, or n8n automation, I had to literally write `sk-abc123...` into my prompts. That key then:
- Lands in the LLM's context window
- Gets stored in LLM memory and embeddings
- Shows up in server logs
- Gets included in completions returned to the user

That's a supply chain attack waiting to happen.

**The fix is simple: never put secrets in prompts.** Use `{{PLACEHOLDER}}` syntax instead.

```
"Use OPENAI_KEY={{OPENAI_KEY}} to call the API"
```

EnigmAgent resolves `{{OPENAI_KEY}}` at runtime from your local AES-256-GCM encrypted vault — before the message is sent to the LLM. The LLM only ever sees the resolved value (or better yet, the tool call result, not the key itself).

### What's in the box

- **Browser extension** (Chrome, Firefox, Edge) — manage your vault visually, with a popup and right-click injection
- **MCP server** (`npx enigmagent-mcp`) — expose your vault as MCP tools so Claude Desktop, Cursor, Continue.dev, and Open WebUI can resolve secrets natively
- **npm library** (`@enigmagent/vault`) — import directly into any Node.js agent
- **Python SDK** — for LangChain, CrewAI, AutoGen, SmolAgents, and other Python frameworks

### Security model
- AES-256-GCM for symmetric encryption (authenticated)
- Argon2id for key derivation (memory-hard, GPU-resistant)
- Vault never leaves your machine
- Zero telemetry, zero cloud, MIT licensed

I'd love to hear how you're handling secrets in your AI agents. What's your current approach? Anything you wish EnigmAgent would do differently?

---

## Gallery Assets (screenshots to prepare)

1. **vault-dashboard.png** — browser extension popup showing list of secret keys (no values)
2. **placeholder-demo.png** — before/after: prompt with `{{OPENAI_KEY}}` → resolved at runtime
3. **mcp-tool-call.png** — Claude Desktop calling `resolve_secret` MCP tool
4. **langchain-integration.png** — Python code snippet using the vault callback
5. **architecture.png** — diagram: Agent → MCP Server → Local Encrypted Vault → API

## Thumbnail / Icon
- Use the EnigmAgent shield logo (padlock + circuit board motif)
- Dimensions: 240×240px PNG

## Video (optional but recommended)
60-second screen recording showing:
1. Open vault in browser extension — it's locked
2. Unlock with master password
3. Show a prompt with `{{MY_API_KEY}}`
4. Run the agent — key is resolved without appearing in the LLM message
5. Check the LLM's response — no key visible

---

## Submission Checklist

- [ ] Create Product Hunt account (https://www.producthunt.com/auth/signup)
- [ ] Link GitHub: https://github.com/Agnuxo1/EnigmAgent
- [ ] Upload gallery screenshots (prepare 5 images)
- [ ] Optional: find a hunter with 1000+ followers to hunt EnigmAgent
- [ ] Set launch date (best days: Tuesday, Wednesday, Thursday — 12:01 AM PT)
- [ ] Notify your network 24h before launch
- [ ] Prepare 20-30 upvote "asks" from friends/colleagues
- [ ] Monitor comments on launch day and respond within 15 minutes
- [ ] Cross-post to Hacker News "Show HN" on same day

## Manual Action Required

Product Hunt does not have a public API for submissions. You must submit manually at:
**https://www.producthunt.com/posts/new**

Steps:
1. Log in to producthunt.com
2. Click "Submit" in the top nav
3. Enter the product URL: https://github.com/Agnuxo1/EnigmAgent
4. Fill in the fields from this draft
5. Upload gallery images
6. Write the maker comment from above
7. Schedule or publish immediately

---

## AlternativeTo Listing

Submit EnigmAgent as an alternative to:
- 1Password (for AI/developer use cases)
- Bitwarden (specifically for AI agent secret injection)
- HashiCorp Vault (local, zero-config alternative)
- Doppler (offline/local variant)

**Submission URL:** https://alternativeto.net/ → click your avatar → "Suggest new application"

Fields to fill:
- **Name:** EnigmAgent
- **Website:** https://github.com/Agnuxo1/EnigmAgent
- **Platform:** Windows, macOS, Linux, Browser Extension
- **License:** Open Source (MIT)
- **Description:** Local AES-256-GCM encrypted vault for AI agents. Store API keys and reference them as {{PLACEHOLDER}} tokens in agent prompts — secrets are resolved at runtime so the LLM never sees real values. Browser extension + MCP server + Python/Node.js SDK. Zero cloud, zero telemetry.
- **Tags:** password-manager, api-keys, ai-agents, security, encryption, mcp, langchain, openai

---

## chrome-stats.com

Chrome-stats.com automatically indexes extensions from the Chrome Web Store. Your extension `kjelbdaphngolbjfgaahljhpkhknjank` will appear at:

**https://chrome-stats.com/d/kjelbdaphngolbjfgaahljhpkhknjank**

No manual submission is required. chrome-stats.com crawls the Chrome Web Store automatically. Once your extension has any installs or reviews, it will be discoverable.

To accelerate visibility on chrome-stats.com:
1. Make sure your Chrome Web Store listing has accurate categories and keywords
2. Add a privacy policy URL: https://github.com/Agnuxo1/EnigmAgent/blob/main/PRIVACY.md
3. Encourage early users to leave reviews on the Chrome Web Store
4. chrome-stats.com also tracks version history, rating trends, and install count changes

---

## Glama.ai MCP Registry

Glama.ai automatically indexes MCP servers from GitHub repositories. EnigmAgent MCP has been set up for indexing at:

- **GitHub repo:** https://github.com/Agnuxo1/enigmagent-mcp
- **Expected Glama URL:** https://glama.ai/mcp/servers/Agnuxo1/enigmagent-mcp

Glama's crawler indexes repos with `mcp` in the package.json keywords and README. The `enigmagent-mcp` repo has been created with the correct metadata and will be indexed within Glama's next crawl cycle (typically 24-48 hours).

If not indexed automatically, visit https://glama.ai and sign in with GitHub — there should be a "Claim server" option for repos you own.
