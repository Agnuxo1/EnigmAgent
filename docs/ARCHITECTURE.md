# Architecture

## One extension, three components

EnigmAgent ships as a single Manifest V3 WebExtension. Everything — vault UI, crypto, form interception, messaging — lives under the same `chrome-extension://<id>` origin. There is no `file://` HTML to open, no native host to install, no external dependency loaded at runtime.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              USER'S BROWSER                               │
│                                                                           │
│  ┌────────────────────┐        ┌──────────────────┐                       │
│  │   LLM / Agent      │        │  Background SW   │                       │
│  │   (any provider)   │        │  (background.js) │                       │
│  │                    │        │                  │                       │
│  │   Sees only:       │        │  routes, 7 s TO  │                       │
│  │   {{GITHUB_TOKEN}} │        └────────┬─────────┘                       │
│  └─────────┬──────────┘                 │                                 │
│            │ types placeholder          │ chrome.tabs.sendMessage         │
│            │ into the form              │                                 │
│            ▼                            ▼                                 │
│      ┌──────────────┐            ┌──────────────┐                         │
│      │ content.js   │            │   vault.js   │                         │
│      │ (every page) │◀──────────▶│  (unlocked   │                         │
│      └──────┬───────┘   resolve  │   vault tab) │                         │
│             │                    └──────┬───────┘                         │
│             │ setInputValue              │                                │
│             ▼                            │                                │
│        ┌─────────────┐                   │                                │
│        │   Website   │                   │ chrome.storage.local          │
│        │  (github…)  │                   ▼                                │
│        └─────────────┘            Encrypted vault JSON                    │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### `content.js`

Injected on every page (except `file://`). Listens for the `submit` event in capture phase. When any `<input>` / `<textarea>` inside the submitting form contains a `{{PLACEHOLDER}}`:

1. `preventDefault()` + `stopImmediatePropagation()` on the submit.
2. For each hit, `chrome.runtime.sendMessage({ type: 'resolve-placeholder', placeholder, origin: location.origin })`.
3. The returned value is written using the native `value` setter so React's synthetic-event tracker registers the change.
4. The form's `dataset.enigmaDone = '1'` flag is set and `form.requestSubmit()` is called — the submit handler on the second pass sees the flag and lets the event propagate normally.

The real value exists in one JS variable for ~1 event-loop tick. Never copied to the clipboard, never logged, never sent to any other tab or script.

### `background.js`

Stateless service worker. Keeps `vaultTabId` in `chrome.storage.session` (cleared when the browser restarts). Exposes four message types:

- `resolve-placeholder` → routes to the vault tab with a 7-second timeout.
- `status` → returns whether the vault tab is open.
- `open-vault` → open or focus the vault tab.
- `vault-unlocked` / `vault-locked` → self-announcement from `vault.js`.

If the cached `vaultTabId` is stale (user closed that tab), the worker scans `chrome.tabs.query({ url: vault-url })` before giving up.

### `vault.js` (vault.html)

The entire vault UI: unlock screen, chat-style command input, secret list, modal for add/edit, document uploader.

On `bridge-resolve` messages:

1. Reject if the vault is locked.
2. Reject if the placeholder is unknown.
3. Reject if the secret has no bound domain **or** the request origin does not match.
4. Otherwise, decrypt and return the plaintext through `sendResponse`.

No plaintext is ever persisted. The `CryptoKey` is imported with `extractable = false`.

## Crypto

### Key derivation

```
           salt (16 B random)                 context = "enigma/v1|" + username
                  │                                          │
                  └──────────────── concat ──────────────────┘
                                     │
                                     ▼
password (UTF-8) ──── Argon2id ──── raw key (32 B)
              (m = 65536 KiB, t = 3, p = 1)
                                     │
                                     ▼
                             AES-GCM CryptoKey (non-extractable)
```

Memory cost: 64 MiB. Time cost: 3 passes. On a modern laptop this takes ~800 ms — deliberately. That's what makes a stolen vault file expensive to brute-force.

The username is mixed into the KDF context so that two users on the same machine with the same password still derive different keys.

### Vault file format

```json
{
  "version": 1,
  "kdf": "argon2id",
  "kdf_params": { "t": 3, "m": 65536, "p": 1, "dkLen": 32 },
  "salt": "<base64 16 bytes>",
  "check": {
    "nonce": "<base64 12 bytes>",
    "ciphertext": "<base64 AES-256-GCM of 'enigmagent-check|username'>"
  },
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

Each entry has an independent nonce. The `check` entry lets us validate a password on unlock without having to decrypt a real secret (the vault might be empty).

## Placeholder grammar

```
placeholder  := "{{" name "}}"
name         := [A-Z0-9_:\-.@]+         (case-insensitive)
```

Examples: `{{GITHUB_TOKEN}}`, `{{LOGIN:github.com}}`, `{{DOC:contract.md}}`, `{{NIF}}`, `{{Token.Main}}`, `{{my-secret-42}}`.

## What lives where

| Artifact | Location | Encrypted? | Accessible to |
|---|---|---|---|
| Vault JSON | `chrome.storage.local["vault"]` | yes (AES-256-GCM) | extension only |
| Master key | CryptoKey in vault-tab RAM | n/a (non-extractable) | vault.js only |
| Plaintext secret | DOM `<input>.value`, ~1 event-loop tick | no | content.js, then website |
| Placeholder token | LLM context, page DOM, chat logs | no (no secret value in it) | anyone reading the page |

## Why not `file://` + a standalone HTML?

The earlier design had a separate `vault-app/index.html` and used `window.postMessage` to talk to the extension. Dropped because:

- `file://` origins have inconsistent security rules across browsers.
- `postMessage` requires the user to keep a specific tab open and in focus.
- `chrome.storage` is not available from `file://`, forcing a fragile JSON-file workflow.
- One origin for the whole product means one CSP, one audit surface, one code path.

The extension ships everything the user needs, served from a single origin the browser treats with extension-level guarantees.
