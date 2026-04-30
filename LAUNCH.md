# 🚀 EnigmAgent Launch Plan

## Goal: 100+ GitHub stars · 1000+ followers

---

## 1. HACKER NEWS — Show HN (Highest Priority)

### Title (80 chars max)
```
Show HN: EnigmAgent — Your AI agent never sees your API keys
```

### Body
```
Problem: When you ask Claude or Cursor to use your GitHub API, it needs your token. Your options suck:

1. Paste the token in chat → it's in Anthropic/OpenAI logs forever
2. Give the agent a long-lived token → it can act on its own at 3 AM
3. Don't use agents for real work → defeats the purpose

EnigmAgent is option 4.

Your agent types `{{GITHUB_TOKEN}}`. That's all it ever sees. At the moment the API call actually goes out, EnigmAgent intercepts, decrypts the real token locally with AES-256-GCM+Argon2id, injects it, and the request fires. The plaintext exists for one event-loop tick. The model never sees it. The provider never sees it. Your terminal never sees it.

How it works:
• npx enigmagent-mcp --vault ./my.vault.json → MCP server for Claude Desktop, Cursor, Continue.dev, Cline, Open WebUI
• Browser extension intercepts form submits on GitHub, AWS, etc. and substitutes placeholders
• Per-secret domain binding — the GitHub token only works on github.com
• 5 framework adapters: LangChain, CrewAI, LlamaIndex, AutoGen, n8n

MIT licensed. Zero cloud. The vault file lives on your machine.

Repo: https://github.com/Agnuxo1/EnigmAgent
npm: https://www.npmjs.com/package/enigmagent-mcp

Built by a solo developer in Madrid. Would love feedback on the threat model and the UX of the setup flow.
```

### Posting instructions
1. Go to https://news.ycombinator.com/submit
2. Title: `Show HN: EnigmAgent — Your AI agent never sees your API keys`
3. URL: `https://github.com/Agnuxo1/EnigmAgent`
4. Paste the body above
5. Post on a **Tuesday, Wednesday, or Thursday between 9-11 AM EST** (14:00-16:00 CET)

### Expected outcome
- Good post: 50-150 upvotes, 500-2000 stars
- Solid post: 20-50 upvotes, 100-500 stars

---

## 2. REDDIT — Community Posts (same day, 30 min after HN)

### r/ClaudeAI (108K members) — Most relevant
**Title:** I built a local vault so Claude never sees my API keys
**Body:**
```
I kept pasting GitHub tokens into Claude Desktop and feeling uneasy about it. So I built EnigmAgent — an MCP server that intercepts {{PLACEHOLDER}} tokens at runtime.

Claude types {{GITHUB_TOKEN}}. The real value is decrypted locally with AES-256-GCM and injected only at the moment of the actual API call. Claude never sees it. Anthropic never sees it.

Setup: npx enigmagent-mcp --vault ./my.vault.json

Works with Claude Desktop, Cursor, Continue.dev, Cline, Open WebUI. Framework adapters for LangChain, CrewAI, LlamaIndex.

MIT license. Zero cloud. Free.

https://github.com/Agnuxo1/EnigmAgent
```
**Post in:** r/ClaudeAI

### r/programming (6M members) — Broader reach
**Title:** Stop pasting API keys into LLM prompts — a local encrypted vault for AI agents
**Body:** (use the HN body, slightly adapted with more technical detail)

### r/MCP (if exists) or r/LocalLLaMA — Niche but targeted
Short version, focused on the MCP integration aspect.

### r/selfhosted (300K members)
**Title:** EnigmAgent — keep your API keys out of LLM contexts, self-hosted
Focus on: local-first, zero cloud, MIT license, no telemetry.

---

## 3. DEV.TO — Technical Deep Dive (24h after HN)

### Title
```
How EnigmAgent keeps API keys out of LLM context — a technical walkthrough
```

### Structure
1. The problem with narrative hook
2. The threat model (3 attack surfaces)
3. Architecture deep dive (AES-256-GCM + Argon2id)
4. Per-secret domain binding explained
5. MCP server integration
6. Framework adapters
7. Limitations (honest disclosure)
8. Call to action

### Tags
`security`, `ai`, `mcp`, `claude`, `tutorial`

---

## 4. TWITTER/X — @Francisco_Ecofa (day of launch)

### Tweet 1 (announcement)
```
I built EnigmAgent because I was tired of pasting API keys into Claude.

Your agent types {{GITHUB_TOKEN}}. The real value is decrypted locally at the last possible moment. AES-256-GCM + Argon2id. Zero cloud.

MIT. Free. npx enigmagent-mcp

github.com/Agnuxo1/EnigmAgent
```

### Tweet 2 (reply to own tweet, 30 min later)
```
Framework adapters ready:
• LangChain callback handler
• CrewAI tool
• LlamaIndex ToolSpec
• n8n community node
• AutoGen adapter

All open source. All local. No cloud.

github.com/Agnuxo1/EnigmAgent#integrations
```

### Tweet 3 (24h later — social proof / engagement bait)
```
What's the sketchiest thing you've ever pasted into an LLM prompt?

(Asking for a friend who's building a vault for exactly this problem)
```

---

## 5. TIMING SEQUENCE

| Time | Action | Platform |
|---|---|---|
| Tue 9 AM EST (15:00 CET) | Post Show HN | Hacker News |
| Tue 9:30 AM EST | Post to r/ClaudeAI | Reddit |
| Tue 10 AM EST | Post to r/selfhosted | Reddit |
| Tue 10 AM EST | Tweet announcement | X/Twitter |
| Tue 10:30 AM EST | Reply with adapters | X/Twitter |
| Tue 6 PM EST | Post to r/programming | Reddit |
| Wed 9 AM EST | Post technical article | dev.to |
| Wed 10 AM EST | Engagement tweet | X/Twitter |
| Thu | Respond to all comments | All platforms |

---

## 6. POST-LAUNCH: Convert traffic into followers

### Add to EnigmAgent README (already done):
✅ Comparison table vs alternatives
✅ Clear call-to-action (star + tell someone)
✅ "Built by" section linking to @Agnuxo1

### Add to key pages:
- EnigmAgent README footer → link to profile
- p2pclaw.com → link to GitHub profile
- PaperClaw npm page → link to GitHub

### Weekly maintenance:
- Respond to every GitHub issue within 24h
- Thank every new stargazer (if feasible)
- Post 1 update tweet per week showing progress
