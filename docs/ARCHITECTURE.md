# Architecture

## Three components, one principle

**Principle**: the LLM must operate on *references*, not on *values*. The value lives on disk, encrypted, and is only materialized in the exact DOM input that will submit it — after the agent has finished its turn.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              USER'S MACHINE                               │
│                                                                           │
│  ┌────────────────────┐        ┌──────────────────┐                       │
│  │   LLM / Agent      │        │   Browser Bridge │                       │
│  │   (any provider)   │        │   (WebExtension) │                       │
│  │                    │        │                  │                       │
│  │   Sees only:       │        │  content script  │                       │
│  │   {{GITHUB_TOKEN}} │        │  + background    │                       │
│  └─────────┬──────────┘        └────────┬─────────┘                       │
│            │                            │                                 │
│            │ types placeholder          │ intercepts submit,              │
│            │ into form field            │ requests decrypted              │
│            ▼                            │ value from vault tab            │
│     ┌─────────────┐                     │                                 │
│     │   Website   │◀────────────────────┘                                 │
│     │  (github…)  │   substituted value arrives just-in-time              │
│     └─────────────┘                                                       │
│                                                                           │
│            ▲                                                              │
│            │ message via window.postMessage /                             │
│            │ chrome.runtime + sessionStorage key                          │
│            │                                                              │
│  ┌─────────┴──────────┐                                                   │
│  │   Vault App        │                                                   │
│  │   (local .html)    │   AES-256-GCM blobs on disk                       │
│  │                    │ ◀──── encrypted-vault.json (next to index.html)   │
│  │   Web Crypto API   │                                                   │
│  │   Argon2id (WASM)  │                                                   │
│  └────────────────────┘                                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

## Crypto

### Key derivation
```
password + username + salt  ──Argon2id──▶  master_key (32 bytes)
                            (m=64 MiB, t=3, p=1)
```
The username is mixed into the salt so that two users on the same machine with the same password still get different keys.

### Vault format
Each vault is a single JSON file:
```json
{
  "version": 1,
  "kdf": "argon2id",
  "kdf_params": { "m": 65536, "t": 3, "p": 1 },
  "salt": "<base64 16 bytes>",
  "entries": [
    {
      "id": "uuid",
      "name": "GITHUB_TOKEN",
      "domain": "github.com",
      "created": "2026-04-19T10:00:00Z",
      "nonce": "<base64 12 bytes>",
      "ciphertext": "<base64 AES-256-GCM output>"
    }
  ]
}
```
Each entry has its own nonce. The master key is never written to disk.

### Why AES-256-GCM + Argon2id, not "Bitcoin encryption"?

Bitcoin uses **secp256k1 ECDSA/Schnorr signatures** — those sign, they don't encrypt. There is an ECIES construction built on secp256k1 that *does* encrypt, but for a single-user local vault it adds complexity without a security benefit over authenticated symmetric encryption. AES-256-GCM is:
- Hardware-accelerated on every modern CPU (AES-NI).
- Available natively in the browser via `crypto.subtle.encrypt`.
- AEAD — detects tampering.
- The de-facto standard for at-rest encryption (1Password, Bitwarden, age, NaCl…).

## The placeholder protocol

Placeholders are plain text tokens the LLM is trained (via system prompt) to emit:

| Syntax | Meaning |
|---|---|
| `{{GITHUB_TOKEN}}` | Fetch secret named `GITHUB_TOKEN` |
| `{{LOGIN:github.com}}` | Fetch user+pass pair bound to `github.com`, dispatched to the two nearest input fields |
| `{{DOC:contract.md}}` | Paste the decrypted document contents |
| `{{DOC:contract.md#summary}}` | Paste a pre-computed summary (the LLM may see this one — the user authored it) |
| `{{NIE}}`, `{{IBAN}}`, `{{BIRTH_DATE}}` | Personal-data placeholders, typically used in form filling |

### Submit-time swap

1. Agent types `{{GITHUB_TOKEN}}` into `<input name="token">`.
2. User (or agent) clicks Submit.
3. Content script intercepts `submit` (and `keydown Enter`, `click` on `type=submit`).
4. Content script scans all form fields for the `{{…}}` pattern.
5. For each hit: post a message to the background script → to the vault tab → returns plaintext.
6. Content script replaces the field value and then programmatically re-submits.
7. The plaintext lives in JS memory for a single event loop tick.

### Domain binding

A secret marked `domain: "github.com"` will refuse to swap if the form's origin is not `github.com` or a subdomain. This prevents a malicious page from asking the agent to paste a GitHub token into a phishing form.

## What lives where

| Artifact | Location | Encrypted? | Who touches it |
|---|---|---|---|
| `vault.json` | next to the vault-app, on disk | yes (AES-256-GCM) | vault-app only |
| Master key | vault-app RAM | n/a (never written) | vault-app only |
| Plaintext secret | DOM input value, for ~1 tick | no | content script, then the website |
| Placeholder token | LLM context, chat logs | no (but has no secret value) | agent, chat provider |

## Open questions

- **How does the vault tab reach the extension?** Options: (a) the extension ships a bundled vault page as part of its own UI; (b) the vault runs as a separate tab and communicates via `window.postMessage` through a small shim the extension injects. Leaning toward (a) for v1.
- **Mobile?** `file://` workflow doesn't apply. Probably a PWA or a dedicated React Native app that talks to the browser via QR + WebRTC.
- **Cross-device sync?** Integrate with P2PCLAW — encrypted blobs can sync without ever being readable by the sync provider.
