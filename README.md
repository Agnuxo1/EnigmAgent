# EnigmAgent

> **Local-first credential & document vault for the age of AI agents.**
> Your LLM never sees your secrets — it only sees placeholders.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Status](https://img.shields.io/badge/status-alpha-orange.svg)](#roadmap)

---

## The problem

When you ask an AI agent (ChatGPT, Claude, a coding agent, a browser agent…) to *"log into my GitHub"*, *"fill my tax form"*, or *"push this branch"*, one of three bad things happens:

1. You **paste the secret into the chat** → it ends up in the provider's logs, context window, and possibly training data.
2. You **give the agent a long-lived API token** → the agent can read/write things you never intended.
3. You **don't use agents for anything sensitive** → you lose 80% of the usefulness.

Tools like `gh` CLI solve this for one service. EnigmAgent aims to solve it **universally** — for any form, any field, any document, on any device.

## The idea

```
┌─────────────┐    placeholder     ┌──────────────┐   real value   ┌─────────┐
│  LLM/Agent  │ ─────────────────▶ │   Browser    │ ─────────────▶ │ Website │
│             │  {{GITHUB_TOKEN}}  │   Bridge     │  ghp_xxx...    │         │
└─────────────┘                    │  (extension) │                └─────────┘
                                          ▲
                                          │ decrypt on demand
                                          │
                                   ┌──────────────┐
                                   │   Vault App  │  ← you unlock it
                                   │  (local HTML)│     with your password
                                   │              │
                                   │  AES-256-GCM │
                                   │  + Argon2id  │
                                   └──────────────┘
                                          ▲
                                          │
                                   Encrypted blobs
                                   stored next to the app
```

- **Vault App** — a single static HTML file you double-click. Opens in your browser at `file://`, no server, no install. Login with username+password unlocks a local encrypted store.
- **Browser Bridge** — a WebExtension that watches form fields. When the agent types `{{GITHUB_TOKEN}}`, the bridge asks the vault (running in another tab) to decrypt and swap the real value in at submit time.
- **Agent side** — the LLM only ever works with placeholder names like `{{GITHUB_TOKEN}}`, `{{NIE}}`, `{{IBAN}}`, `{{TAX_ID}}`. The real values stay on disk, encrypted, on your machine.

## What it is good for

| Use case | Placeholder example |
|---|---|
| Log into any site via agent | `{{LOGIN:github.com}}` → user + password |
| Push a git branch | `{{GITHUB_TOKEN}}` |
| Fill Spanish tax form (Renta) | `{{NIE}}`, `{{IBAN}}`, `{{BIRTH_DATE}}` |
| Deploy to Vercel/AWS/Cloudflare | `{{VERCEL_TOKEN}}`, `{{AWS_KEY}}` |
| Share a private document with an LLM | `{{DOC:contract.md}}` — LLM sees a summary, not the original |

## Security model

- **Encryption**: AES-256-GCM for data, keys derived from your password via **Argon2id** (fallback: PBKDF2-SHA-256 with 600 000 iters where Argon2 isn't available).
- **Key material never leaves RAM** of the vault tab. Encrypted blobs live on disk next to the app.
- **LLM isolation**: the agent process never receives the decrypted value. Substitution happens in the browser, inside the DOM, after the agent has given up control of the input.
- **Clipboard is off by default**: decrypted values are typed directly into inputs via the extension's scripting API, not copied to the system clipboard.
- **What EnigmAgent cannot protect against**: a compromised OS, a keylogger, a malicious browser extension with `<all_urls>` permission, or the user pasting the secret manually. This is a *credential-isolation* layer, not a full sandbox.

Read the full [Threat Model](docs/THREAT_MODEL.md).

## Status

**Alpha — architecture and MVP in progress.** See the [Roadmap](ROADMAP.md).

## Quick start (MVP)

```bash
git clone https://github.com/agnuxo1/EnigmAgent.git
cd EnigmAgent/vault-app
# Open index.html in your browser (Firefox or Chromium)
```

1. Create a vault with a username and a strong password.
2. Add a secret: name = `GITHUB_TOKEN`, value = `ghp_...`.
3. Install the browser bridge (see [browser-bridge/README.md](browser-bridge/README.md)).
4. In any LLM chat, tell the agent: *"when you reach the token field, type `{{GITHUB_TOKEN}}`"*.
5. When the agent submits the form, the bridge intercepts and substitutes the real value.

## Repository layout

```
EnigmAgent/
├── vault-app/         Single-file HTML+JS vault (local, offline, no server)
├── browser-bridge/    WebExtension (Chrome/Firefox) that swaps placeholders
├── docs/              Architecture, threat model, protocol spec
├── examples/          Example placeholder schemas (GitHub, Renta, etc.)
└── tests/             Crypto round-trip and protocol tests
```

## License

MIT — see [LICENSE](LICENSE).

## Author

[Francisco Angulo de Lafuente](https://github.com/agnuxo1) — part of the OpenCLAW / P2PCLAW ecosystem of privacy-preserving local tooling.
