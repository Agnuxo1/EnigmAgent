# EnigmAgent Roadmap

## M1 — v0.1 alpha (current)

Scope: a single WebExtension (Chrome + Firefox) that intercepts `{{PLACEHOLDER}}` in form fields and substitutes real values from a locally-encrypted vault.

- [x] Manifest V3 extension, vault UI inside the extension origin (no `file://` hacks).
- [x] Argon2id-derived key + AES-256-GCM, noble-hashes bundled (~13 KB), reproducible.
- [x] `chrome.storage.local` persistence, `chrome.storage.session` tab-tracking.
- [x] Submit interception with native-setter DOM write (React/Vue compatible).
- [x] Domain binding: resolve refuses when origin doesn't match the bound domain.
- [x] Icons, popup, export of the encrypted vault file.
- [x] Crypto round-trip tests, placeholder demo page.
- [ ] **End-to-end pass on real Chrome**: demo form receives the real value on submit. *(this is the gate for publishing the repo)*

## M2 — hardening

- [ ] Independent crypto review of the vault format and Argon2id parameters.
- [ ] Reproducible build recipe baked into CI (`npm ci` → `esbuild` → compare SHA256 of `argon2id.js`).
- [ ] CSP lockdown for `vault.html` (`script-src 'self'` only; no inline).
- [ ] Signed releases: Chrome Web Store + Mozilla AMO + GitHub Release.
- [ ] Automatic auto-lock after N minutes of inactivity.
- [ ] Enforce domain binding on **create** (no unbound secrets by default).

## M3 — protocol v1

- [ ] `{{LOGIN:domain}}` resolves user+pass into the two nearest labeled inputs.
- [ ] `{{DOC:name.md}}` and `{{DOC:name.md#summary}}`.
- [ ] Personal-data namespace (`NIF`, `IBAN`, etc.) with per-placeholder description shown in the vault UI.
- [ ] Audit log: every resolve is recorded locally with timestamp, placeholder name, origin, and a SHA-256 of the value (not the value itself).
- [ ] Schema library (`examples/*.json`) published in a versioned form.

## M4 — agent-side

- [ ] Claude Agent SDK skill that injects the placeholder system prompt automatically.
- [ ] ChatGPT custom-GPT with the same guardrails.
- [ ] MCP server that exposes placeholder **names** (never values) to MCP-aware agents so they can auto-complete placeholder tokens.

## M5 — cross-device and CLI

- [ ] Import/export with a passphrase-wrapped key for device transfer.
- [ ] Native messaging host (small Python binary) that exposes the vault to CLI tools:
      `git config credential.helper enigmagent` → resolves `{{GITHUB_TOKEN}}` when git asks for HTTPS auth.
- [ ] Optional sync over P2PCLAW (encrypted blobs replicated between devices without a central server).

## M6 — mobile companion

- [ ] PWA variant for Android/iOS.
- [ ] WebAuthn / YubiKey as a second factor for unlock.

---

## Not doing

- Running the vault in the cloud. Ever.
- SaaS tiers. The whole point is *no server*.
- Acting as a general-purpose password manager. Use 1Password / Bitwarden for daily login UX; EnigmAgent is specifically the agent-in-the-loop layer.
