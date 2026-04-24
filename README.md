# EnigmAgent

> **The credential vault built for the age of AI agents.**
> Your LLM only sees placeholders. Real secrets stay encrypted on your device.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](#install)
[![Crypto](https://img.shields.io/badge/crypto-Argon2id%20%2B%20AES--256--GCM-green.svg)](docs/THREAT_MODEL.md)
[![MV3](https://img.shields.io/badge/Manifest-V3-orange.svg)](extension/manifest.json)

---

## The problem

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
│   LLM / Agent   │ ──────────────────────────▶ │     Web Form       │
│  (any provider) │                             │  (github.com/…)    │
└─────────────────┘                             └─────────┬──────────┘
                                                          │ submit event (intercepted)
                                                          ▼
                                              ┌───────────────────────┐
                                              │      EnigmAgent       │
                                              │  content.js detects   │
                                              │  {{GITHUB_TOKEN}} →   │
                                              │  asks background SW   │
                                              └───────────┬───────────┘
                                                          │
                                              ┌───────────▼───────────┐
                                              │      Vault Tab        │
                                              │  (extension origin)   │
                                              │  checks domain match  │
                                              │  decrypts → ghp_xxx   │
                                              └───────────┬───────────┘
                                                          │ real value
                                                          ▼
                                              ┌───────────────────────┐
                                              │  Form re-submitted    │
                                              │  with real credential  │
                                              └───────────────────────┘
```

The plaintext value exists in memory for approximately one event-loop tick. It is never written to the clipboard, never logged, and never visible to any other tab or script.

---

## Install in 3 steps

### Chrome / Edge / Brave

1. Download the [latest release ZIP](https://github.com/agnuxo1/EnigmAgent/releases) and unzip it.
2. Go to `chrome://extensions` and enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the `extension/` folder.

### Firefox

1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**
3. Select `extension/manifest.json` (or use `platforms/firefox-ext/manifest.json` for the Firefox-specific build).

> **Note**: Signed releases for Chrome Web Store and Mozilla AMO are in progress. See [LAUNCH_REPORT.md](LAUNCH_REPORT.md) for current status.

---

## Using EnigmAgent

### First-time setup

1. Click the EnigmAgent icon in the toolbar → **Open vault**.
2. Click **Create new vault**. Enter a username and a strong password (12+ characters recommended). Argon2id will take about 1 second to derive your master key — this is intentional and makes brute-forcing a stolen vault file extremely expensive.
3. Add your first secret. Type in the chat box:
   ```
   add GITHUB_TOKEN @github.com ghp_yourtoken_here
   ```
   The `@github.com` part binds this secret to that domain — it will only be resolved on github.com, nowhere else.

### Using placeholders with your AI agent

Tell your agent:

> *When you need to authenticate on GitHub, type `{{GITHUB_TOKEN}}` in the token or password field and submit the form. Do not ask me for the real value.*

The agent will type the placeholder literally. When the form submits, EnigmAgent intercepts, resolves, injects, and re-submits. You will see a small badge in the lower-right corner: **✓ submitted with real values**.

---

## Real use cases

### With Claude (Anthropic)

Claude writes `{{OPENAI_API_KEY}}` in the API key field on platform.openai.com. EnigmAgent resolves it automatically. Claude never sees the `sk-proj-…` value.

```
add OPENAI_API_KEY @platform.openai.com sk-proj-yourkey
```

### With Cursor or GitHub Copilot

Let your coding agent commit code, open PRs, or deploy to Vercel without your tokens ever appearing in the editor context or AI chat.

```
add VERCEL_TOKEN @vercel.com vercel_token_here
add GITHUB_PAT @github.com ghp_pathere
```

### With GitHub Actions (browser UI)

When setting repository secrets through the GitHub UI with a browser agent:
```
add REPO_SECRET @github.com supersecretvalue
```
The agent navigates to Settings → Secrets → New, types `{{REPO_SECRET}}` in the value field, and submits. EnigmAgent injects the real value only on github.com.

### With n8n / Zapier AI (browser-based)

When configuring webhook credentials or API keys in n8n's browser UI:
```
add N8N_WEBHOOK_SECRET @app.n8n.cloud yourwebhooksecret
```

### With any form on any site

The placeholder syntax works on any form field on any domain, as long as you've bound the secret to that domain:

```
add NIF @agenciatributaria.gob.es 12345678A
add IBAN @banca.example.com ES9121000418450200051332
```

### Document injection ({{DOC:filename}})

Upload a Markdown or text file as a document secret:
```
add DOC_system-prompt.md @claude.ai (via Upload button or drag-and-drop)
```
Then reference it as `{{DOC:system-prompt.md}}` in any text field on claude.ai. The agent can embed your full system prompt without it appearing in the chat.

---

## Placeholder syntax reference

| Syntax | Resolves to |
|---|---|
| `{{GITHUB_TOKEN}}` | Secret named `GITHUB_TOKEN`, only on its bound domain |
| `{{LOGIN:github.com}}` | First secret bound to github.com *(M3 — coming soon)* |
| `{{DOC:report.md}}` | Contents of stored document `DOC_report.md` |
| `{{NIF}}` | Personal-data placeholder — any custom name works |

Name grammar: `[A-Za-z0-9_:\-.@]+` — case-insensitive.

---

## Security model

| Layer | Implementation |
|---|---|
| Password-to-key derivation | **Argon2id** (m=64 MiB, t=3, p=1) — @noble/hashes@1.4.0, bundled, reproducible |
| Secret encryption | **AES-256-GCM**, 96-bit random nonce per entry |
| Key material | `CryptoKey` with `extractable: false` — never serialized, vault-tab RAM only |
| Username binding | Username mixed into Argon2id context: same password + different user = different key |
| Domain enforcement | Every secret pinned to a domain; bridge refuses mismatched origins |
| Delivery to site | Native `value` setter + `input`/`change` events — never clipboard, never console |
| Vault storage | `chrome.storage.local` — extension-exclusive, never `storage.sync` |

Full threat model: [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md)

---

## EnigmAgent vs. 1Password / Bitwarden

| | 1Password / Bitwarden | EnigmAgent |
|---|---|---|
| **Target user** | Humans logging into websites | AI agents acting on behalf of humans |
| **Core problem** | Remembering & filling passwords for human logins | Keeping secrets out of AI context windows and logs |
| **Secret visible to** | The human (by design) | **Nobody** — not the human during agent workflows, not the AI |
| **Integration method** | Browser autofill on focus | Form submit interception on `{{PLACEHOLDER}}` |
| **Cloud sync** | Yes (end-to-end encrypted) | No — deliberately local-only |
| **Agent-aware** | No | Yes — built specifically for AI agent workflows |
| **Comparison** | Best-in-class for human login UX | Complementary — handles the AI-agent credential layer |

Use 1Password or Bitwarden for your own logins. Use EnigmAgent for the credentials your AI agents need to act on your behalf.

---

## Repository layout

```
EnigmAgent/
├── extension/              Chrome/Firefox extension (MV3) — the whole product
│   ├── manifest.json       MV3 manifest (Chrome)
│   ├── vault.html          Unlock & management UI
│   ├── vault.js            Crypto + vault logic + bridge protocol
│   ├── content.js          Form submit interceptor
│   ├── background.js       Service worker — routes resolve requests
│   ├── popup.html/js       Toolbar popup
│   ├── style.css
│   ├── icons/              16/48/128 PNG icons
│   └── lib/argon2id.js     Bundled @noble/hashes (reproducible build)
├── platforms/
│   ├── firefox-ext/        Firefox-specific manifest (MV3 + gecko settings)
│   └── store-listings/     Chrome, Firefox, Edge store assets
├── build-tool/             Reproducible build: esbuild config + icon generator
├── docs/                   ARCHITECTURE.md, THREAT_MODEL.md
├── examples/               Placeholder schemas (GitHub, Spanish Renta, etc.)
├── tests/                  Smoke test page, crypto round-trip tests
├── CHROME_STORE_LISTING.md Store submission guide
├── SECURITY.md             Threat model + responsible disclosure
└── LAUNCH_REPORT.md        Publication checklist + status
```

---

## Reproducing the build

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

## License

MIT — see [LICENSE](LICENSE).

## Author

[Francisco Angulo de Lafuente](https://github.com/agnuxo1) · part of the [OpenCLAW / P2PCLAW](https://p2pclaw.com) ecosystem of privacy-preserving local AI tooling.
