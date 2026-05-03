# EnigmAgent
[![CAJAL](https://img.shields.io/badge/CAJAL-Paper%20Generator-blue)](https://github.com/Agnuxo1/CAJAL)

[![CAJAL](https://img.shields.io/badge/CAJAL-Paper%20Generator-blue)](https://github.com/Agnuxo1/CAJAL)
[![npm version](https://img.shields.io/npm/v/enigmagent-mcp?label=npm&color=cb3837)](https://www.npmjs.com/package/enigmagent-mcp)
[![CAJAL](https://img.shields.io/badge/CAJAL-Paper%20Generator-blue)](https://github.com/Agnuxo1/CAJAL)
[![npm downloads](https://img.shields.io/npm/dw/enigmagent-mcp?label=downloads)](https://www.npmjs.com/package/enigmagent-mcp)
[![CAJAL](https://img.shields.io/badge/CAJAL-Paper%20Generator-blue)](https://github.com/Agnuxo1/CAJAL)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CAJAL](https://img.shields.io/badge/CAJAL-Paper%20Generator-blue)](https://github.com/Agnuxo1/CAJAL)
[![Crypto](https://img.shields.io/badge/crypto-Argon2id%20%2B%20AES--256--GCM-green.svg)](docs/THREAT_MODEL.md)
[![Glama MCP](https://glama.ai/mcp/servers/Agnuxo1/enigmagent-mcp/badges/score.svg)](https://glama.ai/mcp/servers/Agnuxo1/enigmagent-mcp)
[![GitHub stars](https://img.shields.io/github/stars/Agnuxo1/EnigmAgent?style=social)](https://github.com/Agnuxo1/EnigmAgent)

**Integrations:** [![n8n-nodes-enigmagent](https://img.shields.io/npm/v/n8n-nodes-enigmagent?label=n8n%20node&color=ea4b71)](https://www.npmjs.com/package/n8n-nodes-enigmagent) · [![langchain-enigmagent](https://img.shields.io/pypi/v/langchain-enigmagent?label=langchain&color=1c3c3c)](https://pypi.org/project/langchain-enigmagent/) · [![llama-index-tools-enigmagent](https://img.shields.io/pypi/v/llama-index-tools-enigmagent?label=llamaindex&color=00d4aa)](https://pypi.org/project/llama-index-tools-enigmagent/) · [![crewai-tools-enigmagent](https://img.shields.io/pypi/v/crewai-tools-enigmagent?label=crewai&color=ff5a1f)](https://pypi.org/project/crewai-tools-enigmagent/) · [Claude Desktop](INTEGRATIONS.md#claude-desktop) · [Cursor](INTEGRATIONS.md#cursor) · [Continue.dev](INTEGRATIONS.md#continuedev) · [Cline](INTEGRATIONS.md#cline-vs-code) · [Open WebUI](INTEGRATIONS.md#open-webui) · [more →](INTEGRATIONS.md)

> **Last week I asked Claude to push a fix to a private GitHub repo. To do that, Claude needed my personal access token. I had three options, and all three were terrible: paste the token into the chat (and into the provider's logs forever), give the agent a long-lived token it could reuse on its own at 3 a.m., or give up and do it by hand.**

EnigmAgent is option four.

Your AI agent types `{{GITHUB_TOKEN}}`. The placeholder leaves the model and travels through the conversation, the logs, the context window — and only at the moment your tool actually needs the credential does EnigmAgent intercept the call, decrypt the real token locally with AES-256-GCM, and inject it. The plaintext exists for one event-loop tick. The model never sees it. The provider never sees it. Your terminal scrollback never sees it.

```bash
npx enigmagent-mcp --vault ./my.vault.json
```

That's the entire install for **Claude Desktop, Cursor, Continue.dev, Cline, Open WebUI, AnythingLLM, and LM Studio.** A separate browser extension covers everything that lives in a tab.

> ⭐ **Star this repo if you've ever pasted a token you regretted.**

---

## 30-second Claude Desktop setup

Add this to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "enigmagent": {
      "command": "npx",
      "args": ["-y", "enigmagent-mcp", "--vault", "/absolute/path/to/my.vault.json"]
    }
  }
}
```

Restart Claude Desktop. Two new tools appear: `enigmagent_resolve` and `enigmagent_list`. Now ask Claude:

> *"List my vault entries, then call my GitHub API with `{{GITHUB_TOKEN}}` in the Authorization header."*

The real token never enters the conversation. Same pattern works for [Cursor](#cursor) and [Continue.dev](#continuedev) below.

---

## The problem (in detail)

When you use an AI agent — Claude, ChatGPT, Cursor, a browser automation tool — to do something that requires credentials, you face an impossible choice:

| Option | What happens |
|---|---|
| Paste the secret in the chat | It ends up in AI provider logs, context window, possibly training data |
| Give the agent a long-lived token | The agent can act with full permissions, in any future session |
| Don't use agents for sensitive tasks | You lose most of the value |

**EnigmAgent is option D.** The agent only ever types `{{GITHUB_TOKEN}}`. The real value never appears in the conversation, in logs, or in the agent's memory.

---

## How it works

```
┌─────────────────┐   types {{GITHUB_TOKEN}}   ┌────────────────────┐
│   LLM / Agent   │ ──────────────────────────▶ │  Tool call / Form  │
│  (any provider) │                             │  (github.com / …)  │
└─────────────────┘                             └─────────┬──────────┘
                                                          │ submit / call (intercepted)
                                                          ▼
                                              ┌───────────────────────┐
                                              │      EnigmAgent       │
                                              │  detects placeholder, │
                                              │  checks domain match, │
                                              │  decrypts → ghp_xxx   │
                                              └───────────┬───────────┘
                                                          │ real value
                                                          ▼
                                              ┌───────────────────────┐
                                              │  Request reissued     │
                                              │  with real credential │
                                              └───────────────────────┘
```

The plaintext value exists in memory for approximately one event-loop tick. It is never written to the clipboard, never logged, and never visible to any other tab, script, or LLM context.

---

## Install paths

### MCP server (recommended for AI agents)

```bash
npx enigmagent-mcp --vault ./my.vault.json     # MCP stdio for Claude/Cursor/etc.
npx enigmagent-mcp --mode rest --port 3737     # local REST API for custom integrations
```

Set `ENIGMAGENT_USER` + `ENIGMAGENT_PASS` env vars to skip the interactive unlock prompt (CI/headless mode).

### Browser extension (for credentials inside web forms)

**Chrome / Edge / Brave**

1. Download the [latest release ZIP](https://github.com/Agnuxo1/EnigmAgent/releases) and unzip it.
2. Go to `chrome://extensions` and enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the `extension/` folder.

**Firefox**

1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**
3. Select `extension/manifest.json`.

> Signed releases for Chrome Web Store, Firefox AMO, Edge Add-ons, and Opera are in progress.

---

## Per-client config

### Claude Desktop
See [30-second setup above](#30-second-claude-desktop-setup).

### Cursor

Add to `~/.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "enigmagent": {
      "command": "npx",
      "args": ["-y", "enigmagent-mcp", "--vault", "/abs/path/my.vault.json"]
    }
  }
}
```

### Continue.dev

In `~/.continue/config.yaml`:
```yaml
mcpServers:
  - name: enigmagent
    command: npx
    args: ["-y", "enigmagent-mcp", "--vault", "/abs/path/my.vault.json"]
```

### Cline (VS Code)

Edit `cline_mcp_settings.json`:
```json
{
  "mcpServers": {
    "enigmagent": {
      "command": "npx",
      "args": ["-y", "enigmagent-mcp", "--vault", "/abs/path/my.vault.json"]
    }
  }
}
```

### Open WebUI

Use [`mcpo`](https://github.com/open-webui/mcpo) as the bridge:
```bash
mcpo --port 8000 -- npx enigmagent-mcp --vault /abs/path/my.vault.json
```

---

## Real use cases

### Browser-based agents

Tell your agent: *"When you need to authenticate on GitHub, type `{{GITHUB_TOKEN}}` and submit. Do not ask me for the real value."*

The agent types the placeholder. EnigmAgent intercepts, resolves on the bound domain, injects, re-submits. A small badge shows: **✓ submitted with real values**.

### Document injection (`{{DOC:filename}}`)

Upload a Markdown file as a document secret. Reference it as `{{DOC:system-prompt.md}}` in any text field on its bound domain. Your agent can embed your full system prompt without it appearing in the chat.

### Personal data placeholders

```
add NIF @agenciatributaria.gob.es 12345678A
add IBAN @banca.example.com ES9121000418450200051332
```

Any custom name works. Domain binding is enforced everywhere.

---

## Placeholder syntax reference

| Syntax | Resolves to |
|---|---|
| `{{GITHUB_TOKEN}}` | Secret named `GITHUB_TOKEN`, only on its bound domain |
| `{{LOGIN:github.com}}` | First secret bound to `github.com` |
| `{{DOC:report.md}}` | Contents of stored document `DOC_report.md` |
| `{{NIF}}` | Personal-data placeholder — any custom name works |

Name grammar: `[A-Za-z0-9_:\-.@]+` — case-insensitive.

---

## Security model

| Layer | Implementation |
|---|---|
| Password-to-key derivation | **Argon2id** (m=64 MiB, t=3, p=1) — `@noble/hashes@1.4.0`, bundled, reproducible |
| Secret encryption | **AES-256-GCM**, 96-bit nonce per entry |
| Key material | Lives in process memory only — never written to disk |
| Username binding | Username mixed into Argon2id context: same password + different user = different key |
| Domain enforcement | Every secret pinned to a domain; resolver refuses mismatched origins |
| Delivery to site | Native `value` setter + `input`/`change` events — never clipboard, never console |
| Vault storage | Encrypted file on disk, plaintext never persisted |

Full threat model: [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md). What it does NOT protect against:

- A compromised process on your machine reading the unlocked session memory
- A malicious MCP server you've connected to with permission to call `enigmagent_resolve`
- Side-channels (timing, swap, core dumps) — out of scope for v0.x

---

## EnigmAgent vs. 1Password / Bitwarden / `.env`

| | 1Password / Bitwarden | `.env` files | EnigmAgent |
|---|---|---|---|
| **Target user** | Humans logging in | Devs avoiding hardcoded secrets | AI agents acting on behalf of humans |
| **Core problem** | Filling logins for humans | Keeping secrets out of source control | Keeping secrets out of AI context windows and logs |
| **At rest** | Encrypted (cloud) | Plaintext | Encrypted (local file) |
| **Visible to LLM context** | Yes (when human pastes) | Yes (when agent cats `.env`) | **Never** |
| **Domain binding** | Per-item URL hint | None | Enforced |
| **Cloud sync** | Yes | N/A | No — local-only by design |

Use 1Password or Bitwarden for your own logins. Use `.env` for your local-dev shorthand. Use EnigmAgent for the credentials your AI agents need to act on your behalf.

---

## Why I built this

EnigmAgent is part of the [OpenCLAW / P2PCLAW](https://www.p2pclaw.com) ecosystem of privacy-preserving local AI tooling — a multi-agent scientific research network where dozens of LLM agents coordinate, evaluate each other, and publish papers. Every one of those agents needs credentials. None of them should have them.

That's the entire problem statement. The vault is just the smallest viable solution.

— [Francisco Angulo de Lafuente](https://github.com/Agnuxo1)

---

## Repository layout

```
EnigmAgent/
├── extension/              Chrome/Firefox extension (MV3)
├── platforms/firefox-ext/  Firefox manifest variant
├── build-tool/             Reproducible build (esbuild + icon generator)
├── docs/                   ARCHITECTURE.md, THREAT_MODEL.md
│   └── papers/             Background research papers (PDF)
├── examples/               Placeholder schemas
├── tests/                  Smoke tests + crypto round-trip
├── glama.json              Glama MCP server manifest
├── smithery.yaml           Smithery server descriptor
├── PRIVACY.md
├── SECURITY.md             Responsible disclosure
└── README.md
```

The Node/MCP server source is in the sister repo: [Agnuxo1/enigmagent-mcp](https://github.com/Agnuxo1/enigmagent-mcp).

---

## Reproducing the extension build

```bash
cd build-tool
npm ci
npx esbuild argon2-entry.js \
  --bundle --minify --format=iife --target=es2020 \
  --outfile=../extension/lib/argon2id.js
python make-icons.py
```

`package.json` and `package-lock.json` pin `@noble/hashes@1.4.0`. The output is byte-reproducible — verify with `sha256sum extension/lib/argon2id.js`.

---

## Why not just use `.env` files? (Comparison)

| Approach | Secret in prompt? | Secret in logs? | Per-domain binding? | Works in CI? |
|---|---|---|---|---|---|
| `.env` / environment vars | ✅ No (but agent can read them) | ✅ No | ❌ Global | ✅ Yes |
| Paste into chat | ❌ Yes — permanent | ❌ Yes — permanent | — | — |
| 1Password CLI | ✅ No | ✅ No | ❌ All vault | ✅ Yes |
| Doppler / HashiCorp Vault | ✅ No | ✅ No | ❌ Global namespace | ✅ Yes |
| **EnigmAgent** | ✅ **No** | ✅ **No** | ✅ **Per-secret** | ✅ Yes |

EnigmAgent is the only option that combines **local-first encryption**, **per-secret domain binding**, and **zero plaintext in context**. The vault file never leaves your machine.

---

## License

MIT — see [LICENSE](LICENSE).

## Built by

**[Francisco Angulo de Lafuente](https://github.com/Agnuxo1)** — independent researcher & developer. 35+ years in software. Also building [P2PCLAW](https://p2pclaw.com) (decentralized science network), [BenchClaw](https://github.com/Agnuxo1/BenchClaw) (agent evaluation), and [PaperClaw](https://www.npmjs.com/package/paperclaw) (autonomous research publishing).

If this tool is useful to you:
- ⭐ **Star the repo** — it's how the AI ecosystem discovers tools
- 🐛 **Open an issue** — every real use case sharpens the threat model
- 📣 **Tell one person** who still pastes API keys into Claude
