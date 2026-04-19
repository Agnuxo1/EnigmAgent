# EnigmAgent Roadmap

## M0 — Concept & scaffolding (done)
- [x] Architecture sketch
- [x] README, LICENSE, repo layout
- [x] Threat model draft

## M1 — Vault MVP (in progress)
- [ ] Single-file `vault-app/index.html` opens at `file://`
- [ ] Argon2id key derivation (with PBKDF2 fallback) via Web Crypto + WASM
- [ ] AES-256-GCM encrypt/decrypt of secret entries
- [ ] Local persistence via `localStorage` (per-origin, keyed by vault ID) + exportable JSON blob
- [ ] Chat-style UI: login → list secrets → add/edit/delete → lock
- [ ] Upload `.md` / `.txt` documents → store encrypted

**Exit criteria**: user can create a vault, add a `GITHUB_TOKEN`, close the browser, reopen, unlock, retrieve.

## M2 — Browser Bridge
- [ ] WebExtension manifest v3 (Chrome + Firefox)
- [ ] Content script detects `{{PLACEHOLDER}}` tokens in inputs
- [ ] Background script runs a local message bus to talk to the vault tab
- [ ] On form submit: swap placeholder → decrypted value → dispatch submit
- [ ] UX: small badge in the corner shows "🔓 N secrets available"
- [ ] Unit tests for the swap logic

**Exit criteria**: in a real browser, an LLM agent typing `{{GITHUB_TOKEN}}` into the GitHub token field results in a successful login without the agent ever seeing the token.

## M3 — Placeholder protocol v1
- [ ] Spec: `{{NAMESPACE:KEY}}`, `{{DOC:name.md}}`, `{{LOGIN:domain}}` (returns user+pass pair)
- [ ] Domain binding: a secret can be marked `github.com`-only — bridge refuses to swap on other domains
- [ ] Audit log: every swap is recorded with timestamp, domain, placeholder, hash of value
- [ ] Schema library in `examples/` (GitHub, Renta, Vercel, AWS…)

## M4 — Agent-side skill
- [ ] Claude Agent SDK skill that teaches the agent to *always* use placeholders
- [ ] System prompt template
- [ ] ChatGPT custom GPT wrapper
- [ ] MCP server that exposes placeholder *names* (never values) to MCP-capable agents

## M5 — Documents & redaction
- [ ] Upload a PDF / docx → extract text → store encrypted
- [ ] `{{DOC:contract.md#summary}}` — return only a pre-computed summary to the LLM
- [ ] Selective field redaction: e.g. give the LLM a tax form template with `{{NIE}}` slots

## M6 — Hardening & release
- [ ] Independent crypto review
- [ ] Reproducible builds for the extension
- [ ] Signed releases (extension + vault-app zip)
- [ ] Import/export with passphrase-wrapped key
- [ ] Docs site

## Post-1.0 ideas
- Mobile companion (share vault via encrypted QR, decrypt on phone)
- Team vaults with per-secret ACL (still client-side, using shared symmetric keys wrapped per-user)
- Hardware-key unlock (WebAuthn / YubiKey) as a second factor
- Integration with P2PCLAW for encrypted sync across devices without a central server
