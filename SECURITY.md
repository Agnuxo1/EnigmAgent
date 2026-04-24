# Security Policy — EnigmAgent

## Overview

EnigmAgent is a local-first, encrypted credential vault for AI agent workflows. This document covers the threat model, data storage architecture, known limitations, and the responsible disclosure process.

For the full architectural threat model, see [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).

---

## Supported Versions

| Version | Status |
|---|---|
| 1.0.x | Supported — active maintenance |
| 0.2.x | Deprecated — please upgrade |
| < 0.2 | Unsupported |

---

## Threat Model Summary

### What EnigmAgent defends against

| Threat | Defense |
|---|---|
| AI provider logs or trains on your secret | The agent only ever sees `{{PLACEHOLDER}}`. The real value is substituted inside the DOM at submit time. It never appears in the conversation. |
| Chat history or context window leaks the secret | Same as above — there is no real value in the chat. |
| Stolen vault file (exported JSON) | AES-256-GCM with key derived via Argon2id (64 MiB, 3 passes). Brute-forcing an 8-char password on a stolen vault takes thousands of CPU-years. |
| Rogue site tricks the agent into submitting a token on the wrong domain | Domain binding. Every secret is pinned to an origin. The bridge returns `domain_mismatch` for mismatched origins — including lookalike domains. |
| Clipboard sniffer / paste logger | The plaintext is written directly via the native `value` property setter, never to `navigator.clipboard`. |
| Another browser tab reading the resolved value | Resolution happens inside the vault tab (extension origin). Only the content script in the target tab receives the value via a direct message channel. Other tabs are never involved. |
| Agent tries to exfiltrate the value by echoing it in chat | The agent receives a success/failure signal from the form submit, not the value. It never sees the plaintext, so it cannot repeat it. |

### What EnigmAgent does NOT defend against

| Threat | Reason |
|---|---|
| Compromised OS or kernel-level malware | Any kernel-level attacker can read process memory. No userland security tool can prevent this. |
| Malicious browser extension with `<all_urls>` | A rogue extension running on the same page could read DOM values during the brief injection window. Users must audit installed extensions. A dedicated browser profile is recommended for agent workflows. |
| Phishing the vault master password | If an attacker tricks you into typing your password on a fake page, they win. The vault UI runs only at `chrome-extension://…` — verify the URL before typing your password. |
| Tampered version of EnigmAgent itself | Install only from signed releases (Chrome Web Store, Mozilla AMO). Verify the SHA-256 of `argon2id.js` against the documented hash for the release. |
| Weak master password | Argon2id makes brute force expensive but a 4-character password still falls quickly. The UI enforces a minimum of 8 characters. 12+ characters is strongly recommended. Use a passphrase. |
| Screen recording or shoulder-surfing | The `reveal` vault command displays the plaintext on screen. Use `get` instead (which masks the value) for reference. |

---

## Data Storage Architecture

### What is stored, where, and how

| Data | Location | Encrypted? | Who can access it |
|---|---|---|---|
| Vault JSON (secrets + check entry) | `chrome.storage.local["vault"]` | Yes — AES-256-GCM | Extension only (`chrome.storage` is isolated per extension) |
| Master key (CryptoKey) | Vault-tab JavaScript heap (RAM) | N/A — non-extractable | `vault.js` in that tab only |
| Vault unlock state (`vaultTabId`) | `chrome.storage.session` | Plaintext (it's just a tab ID integer) | Extension only — cleared on browser restart |
| Plaintext secret value | `<input>.value` in target tab, ~1 event-loop tick | No | Content script + target page for one tick, then gone |
| Placeholder token (e.g., `{{GITHUB_TOKEN}}`) | LLM context, chat history, page DOM | No — but it is NOT the secret itself | Anyone reading the page/chat |
| Exported vault file | User's filesystem (where they save it) | Yes — same AES-256-GCM as in storage | The file system and its users |

### What is never stored

- Plaintext secret values
- Master password (in any form)
- Any data in `chrome.storage.sync` (the vault is never synced to the cloud)
- Any data on any remote server
- Any analytics, telemetry, crash reports, or usage data

---

## Vault File Format

The exported vault JSON is safe to store on untrusted media (cloud storage, USB, email). Without the correct username and password, it cannot be decrypted. The format is:

```json
{
  "version": 1,
  "kdf": "argon2id",
  "kdf_params": { "t": 3, "m": 65536, "p": 1, "dkLen": 32 },
  "salt": "<base64 — 16 random bytes>",
  "check": {
    "nonce": "<base64 — 12 random bytes>",
    "ciphertext": "<base64 — AES-256-GCM of 'enigmagent-check|username'>"
  },
  "entries": [
    {
      "id": "uuid",
      "name": "GITHUB_TOKEN",
      "domain": "github.com",
      "created": "ISO-8601 timestamp",
      "nonce": "<base64 — 12 random bytes, unique per entry>",
      "ciphertext": "<base64 — AES-256-GCM encrypted secret value>"
    }
  ]
}
```

Key properties:
- Each entry has an independent random nonce. Nonces are never reused across entries.
- The `check` entry allows password validation without having any real secrets in the vault.
- The `salt` is unique per vault creation. Re-creating the vault generates a new salt, making cross-vault rainbow tables impossible.
- The username is mixed into the Argon2id context string (`enigma/v1|<username>`) — same password + different username = completely different master key.

---

## Cryptographic Implementation

| Component | Library | Version | License |
|---|---|---|---|
| Argon2id | @noble/hashes | 1.4.0 | MIT |
| AES-256-GCM | Web Cryptography API (browser-native) | — | — |
| CSPRNG | `crypto.getRandomValues` (browser-native) | — | — |
| UUID generation | `crypto.randomUUID` with fallback | — | — |

The `@noble/hashes` library is bundled into the extension at build time (`extension/lib/argon2id.js`). No runtime fetches are made. The bundle is reproducible:

```bash
cd build-tool
npm ci
npx esbuild argon2-entry.js --bundle --minify --format=iife --target=es2020 \
  --outfile=../extension/lib/argon2id.js
```

SHA-256 of the bundled `argon2id.js` for each release is documented in the GitHub Release notes.

---

## Known Residual Risks

### Brief plaintext exposure in the DOM

During the submit-time swap, the real value is present in `<input>.value` for approximately one event-loop tick before the form re-submits. A sufficiently fast content script from another extension running on the same page could theoretically read it during this window.

Mitigations in place:
- The value is written via the native property setter — not via `setAttribute` or direct assignment through a framework — minimizing the observation surface.
- The form is re-submitted immediately via `requestSubmit()`.
- Users are advised to use a separate browser profile for agent workflows with no other `<all_urls>` extensions installed.

This is the fundamental cost of browser-based form automation. Password managers accept the same trade-off.

### `<all_urls>` host permission

The content script must run on every page because AI agents can be directed to any website. This is the same permission used by 1Password, Bitwarden, Dashlane, and all major password managers.

Future consideration: a "strict mode" that only activates the content script on domains where the user has configured at least one secret. This would reduce the theoretical attack surface but require the user to pre-declare every domain.

---

## Responsible Disclosure

**Please do not open a public GitHub issue for security vulnerabilities.**

If you discover a security issue in EnigmAgent, please report it responsibly:

1. **Email**: Send details to the repository maintainer's commit email (visible via `git log` in the repository, or the GitHub profile of [agnuxo1](https://github.com/agnuxo1)).

2. **Subject line**: `[EnigmAgent Security] Brief description`

3. **Include**:
   - A clear description of the vulnerability
   - Steps to reproduce (proof-of-concept code if applicable)
   - The potential impact (what an attacker could gain)
   - Your suggested fix or remediation (if any)
   - The disclosure timeline you are comfortable with (we request a minimum of 14 days to patch before public disclosure)

4. **What we commit to**:
   - Acknowledge your report within 48 hours
   - Provide a timeline for remediation within 7 days
   - Credit you in the release notes of the fixed version (unless you prefer to remain anonymous)
   - Not pursue legal action against good-faith security researchers

5. **Scope**: Vulnerabilities in the core extension (vault.js, background.js, content.js, manifest.json), the cryptographic implementation, and the vault file format are in scope. Vulnerabilities in bundled third-party libraries should be reported to those projects first, then to us if they affect EnigmAgent specifically.

---

## Privacy Policy

EnigmAgent collects no personal data, no analytics, no telemetry, and no crash reports.

- No data leaves your device through the extension.
- No remote servers are contacted by the extension.
- No accounts, registration, or email addresses are required.
- The only storage used is `chrome.storage.local` on your own machine.

The extension's behavior can be audited completely from the open-source code at [github.com/agnuxo1/EnigmAgent](https://github.com/agnuxo1/EnigmAgent).
