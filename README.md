# EnigmAgent

> **Local-first credential vault for the age of AI agents.**
> Your LLM never sees your secrets — it only sees placeholders.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Status](https://img.shields.io/badge/status-alpha-orange.svg)](#status)
[![Crypto](https://img.shields.io/badge/crypto-Argon2id%20%2B%20AES--256--GCM-blue.svg)](docs/THREAT_MODEL.md)

---

## The problem

When you ask an AI agent (ChatGPT, Claude, a coding agent, a browser agent) to *"log into my GitHub"*, *"fill this tax form"*, or *"deploy with my Vercel token"*, one of three bad things happens:

1. You **paste the secret into the chat** → it ends up in the provider's logs, context window, and possibly training data.
2. You **give the agent a long-lived API token** → the agent can read/write things you never intended.
3. You **don't use agents for anything sensitive** → you lose most of their usefulness.

`gh auth`, SSH-agent, and 1Password's native integrations solve this for specific clients. EnigmAgent solves it **in the browser, for any form, against any website**.

## How it works

```
┌─────────────┐    placeholder     ┌──────────────┐   real value   ┌─────────┐
│  LLM/Agent  │ ─────────────────▶ │   EnigmAgent │ ─────────────▶ │ Website │
│             │  {{GITHUB_TOKEN}}  │   extension  │  ghp_xxx...    │         │
└─────────────┘                    │              │                └─────────┘
                                          ▲
                                          │ decrypt on demand, domain-checked
                                          │
                                   ┌──────────────┐
                                   │  Vault page  │  ← you unlock it
                                   │  (same ext)  │     with Argon2id + password
                                   └──────────────┘
                                          ▲
                                          │
                                   Encrypted blobs in
                                   chrome.storage.local
```

- **Vault page** (`chrome-extension://…/vault.html`): chat-style UI. You log in with username + password, manage secrets, optionally upload `.md`/`.txt` documents. Never leaves your browser.
- **Content script**: injected on every page. When a form submit fires and any input contains `{{PLACEHOLDER}}`, it pauses submission, resolves each token, writes the real value into the DOM via the native setter, and re-submits once.
- **Background service worker**: routes resolve-requests from content scripts to the vault tab. Enforces a 7-second timeout and structured error responses.
- **Agent side**: the LLM only ever works with placeholder names. Real values stay encrypted in `chrome.storage.local`, decrypted only at the exact moment a form is submitted on the matching domain.

## Security

| Layer | Choice |
|---|---|
| Password → key | **Argon2id** (m = 64 MiB, t = 3, p = 1) from [@noble/hashes](https://github.com/paulmillr/noble-hashes), bundled into the extension — no runtime fetch |
| Key material | CryptoKey, non-extractable, in vault-tab RAM only |
| Secret storage | **AES-256-GCM** with per-entry 96-bit nonce |
| Username binding | Mixed into Argon2id context to defeat cross-user rainbow tables |
| Domain binding | Every secret is pinned to a domain; bridge refuses to resolve on mismatched origins |
| Delivery to site | Direct DOM input via native property setter. Never clipboard, never console, never message to any other tab |

Full threat model: [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).

## Install (developer mode — v0.1)

### Chrome / Edge / Brave
1. Clone this repo.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and pick the `extension/` folder.

### Firefox
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and pick `extension/manifest.json`.

Signed releases for the Chrome Web Store and AMO are on the roadmap.

## Using it end-to-end

1. Click the EnigmAgent icon → **Open vault**.
2. In the vault tab, click **Create new vault**. Pick a username and a strong password (≥ 12 chars recommended). Argon2id takes about a second by design — this is what makes brute-forcing your vault file expensive.
3. Click **+ new** or type `add GITHUB_TOKEN @github.com ghp_yourtoken...` in the chat. The `@github.com` binds the secret to that domain.
4. In your LLM chat, tell the agent:
   > *When you need to log into GitHub, type `{{GITHUB_TOKEN}}` in the token field and submit the form. Do not ask me for the real value.*
5. The agent submits the form with `{{GITHUB_TOKEN}}` literally in the field. EnigmAgent intercepts, decrypts, substitutes, re-submits. You see a small badge in the corner: **✓ submitted with real values**.

Test page to verify the flow end-to-end: [tests/placeholder-demo.html](tests/placeholder-demo.html). Crypto round-trip: [tests/crypto-roundtrip.html](tests/crypto-roundtrip.html).

## Placeholder protocol

| Syntax | Meaning |
|---|---|
| `{{NAME}}` | Look up a secret named `NAME`. Fails unless the current origin matches the bound domain. |
| `{{LOGIN:domain.com}}` | *(planned M3)* Username + password pair for `domain.com`. |
| `{{DOC:name.md}}` | *(planned M3)* Paste the stored document body. |
| `{{NIF}}`, `{{IBAN}}`, `{{BIRTH_DATE}}` | Personal-data placeholders for form filling. |

Name grammar: `[A-Z0-9_:\-.@]+` (case-insensitive). Examples in [examples/](examples/).

## Status

**v0.1 — alpha.** The core swap works against real pages; the crypto layer matches RFC test vectors (see [tests/crypto-roundtrip.html](tests/crypto-roundtrip.html)). Before calling this 1.0 we still need:

- External crypto review of the vault format and Argon2id parameters.
- Reproducible extension builds + signing.
- Import/export with passphrase-wrapped keys for device transfer.
- `{{DOC:…}}` and `{{LOGIN:…}}` resolvers.
- A CLI companion (for `git push`, `curl`, etc. — out of scope for the browser-only M1).

See [ROADMAP.md](ROADMAP.md).

## Repository layout

```
EnigmAgent/
├── extension/         Chrome/Firefox extension (MV3) — the whole product
│   ├── manifest.json
│   ├── vault.html / vault.js / style.css   ← the unlock + management UI
│   ├── content.js                          ← intercepts submit, swaps placeholders
│   ├── background.js                       ← routes resolve requests
│   ├── popup.html / popup.js               ← toolbar popup
│   ├── icons/                              ← 16/48/128 PNGs
│   └── lib/argon2id.js                     ← bundled @noble/hashes
├── build-tool/        Reproducible build: esbuild config + icon generator
├── docs/              Architecture, threat model
├── examples/          Placeholder schemas (GitHub, Spanish Renta)
└── tests/             Crypto round-trip + placeholder demo page
```

## Reproducing the build

```bash
cd build-tool
npm install
npx esbuild argon2-entry.js --bundle --minify --format=iife --target=es2020 \
  --outfile=../extension/lib/argon2id.js
python make-icons.py
```

`package.json` and `package-lock.json` pin `@noble/hashes@1.4.0` so the bundled crypto is byte-reproducible.

## License

MIT — see [LICENSE](LICENSE).

## Author

[Francisco Angulo de Lafuente](https://github.com/agnuxo1) · part of the OpenCLAW / P2PCLAW ecosystem of privacy-preserving local tooling.
