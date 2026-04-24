# Chrome Web Store Listing — EnigmAgent

---

## Title (max 45 chars)

```
EnigmAgent — AI Secret Vault
```
(29 chars)

---

## Short Description (max 132 chars)

```
Encrypted local vault for AI agents. Write {{GITHUB_TOKEN}} in any form — real values inject at submit. Zero cloud exposure.
```
(125 chars)

---

## Long Description (max 16 000 chars)

```
EnigmAgent solves the single biggest unsolved problem in AI agent security: your agent needs credentials to act on your behalf, but you can't hand it your real secrets.

── THE PROBLEM ──────────────────────────────────────────────

Every time you use an AI agent (Claude, ChatGPT, Cursor, GitHub Copilot, AutoGPT, n8n, Zapier AI, or any browser automation tool) to do something that requires credentials, you face an impossible choice:

Option A — Paste the secret into the chat
  → It ends up in the AI provider's logs, context window, and possibly training data. If the session is stored, your API key is stored too.

Option B — Give the agent a long-lived token
  → The agent can now read and write anything the token allows, forever, even in future sessions you didn't initend.

Option C — Do it yourself
  → You lose most of the value of having an agent in the first place.

EnigmAgent is Option D: the agent only ever sees a placeholder like {{GITHUB_TOKEN}} or {{STRIPE_KEY}}. The real value never leaves your machine. It is decrypted locally and injected into the form at the exact moment of submit — and only if the current page matches the domain you configured.

── HOW IT WORKS ─────────────────────────────────────────────

1. You store your secret in the vault (AES-256-GCM, Argon2id key derivation, 64 MiB memory cost). Nothing is sent to any server. The vault lives in chrome.storage.local on your device.

2. You tell your agent: "When you need to authenticate to GitHub, type {{GITHUB_TOKEN}} in the token field and submit."

3. The agent types {{GITHUB_TOKEN}} — a placeholder, not the real value.

4. When the form submits, EnigmAgent intercepts it, decrypts the real value from your local vault, writes it into the field via the native DOM setter (React and Vue compatible), and re-submits the form exactly once.

5. The agent receives a success signal. It never saw the real token. It cannot repeat it, log it, or leak it.

── SECURITY ARCHITECTURE ────────────────────────────────────

Every technical decision was made to minimize secret exposure:

• AES-256-GCM: Each secret is encrypted with a 96-bit random nonce. Nonces are never reused (generated fresh per write). The auth tag provides integrity — a tampered vault file will fail to decrypt.

• Argon2id (m=64 MiB, t=3, p=1): Your password is never stored. The master key is derived fresh on every unlock via the memory-hard Argon2id algorithm from @noble/hashes — the same audited library used by the Ethereum ecosystem. At 64 MiB and 3 passes, brute-forcing a stolen vault costs roughly 800 ms per guess on modern hardware. An 8-character password would take thousands of CPU-years; 12+ characters is effectively unbreakable offline.

• Non-extractable CryptoKey: The master key is imported with extractable=false into the Web Cryptography API. It cannot be serialized, exported, or transferred between tabs.

• Domain binding: Every secret is pinned to a specific domain (e.g., github.com). The bridge refuses to resolve the secret on any other origin — including typosquatted domains like g1thub.com.

• No clipboard, no console, no other tabs: The real value travels from the vault tab to the content script via a direct chrome.runtime message channel. It is written to the input's value property via the native setter. It is never copied to the clipboard, never logged, never sent to any other tab.

• Shadow DOM badge: The status badge shown on pages uses a closed Shadow DOM so host-page CSS and JavaScript cannot read or interfere with it.

── FEATURES ──────────────────────────────────────────────────

✅ AES-256-GCM + Argon2id vault — military-grade local encryption
✅ {{PLACEHOLDER}} form interception — works on any website
✅ Domain binding — each secret restricted to its origin
✅ React / Vue compatible — uses native property setter + dispatches input/change events
✅ Chat-style command interface — add, list, rename, delete secrets by typing commands
✅ Import / Export — encrypted JSON backup, safe to store on untrusted media
✅ Document storage — store .md / .txt docs as {{DOC:filename}} references
✅ No network, no telemetry, no accounts — 100% local
✅ Fully reproducible build — bundled @noble/hashes@1.4.0, SHA-256 verifiable

── USE CASES ─────────────────────────────────────────────────

With Claude:
  Tell Claude "use {{GITHUB_TOKEN}} to authenticate on GitHub". Claude types the placeholder in the form. EnigmAgent injects the real token only on github.com.

With Cursor / Copilot:
  Let your coding agent commit code or deploy to Vercel without ever knowing your deploy token.

With GitHub Actions / Browser Automation:
  Script any web workflow using placeholder syntax. No secrets in your scripts.

With ChatGPT Operator or any browser agent:
  The agent fills forms on your behalf. API keys, OAuth tokens, 2FA backup codes — all resolved at submit time, bound to the right domain.

With n8n / Zapier / Make:
  AI workflow automation that accesses external APIs through the browser — without storing credentials in the workflow definition.

── PERMISSIONS ───────────────────────────────────────────────

• storage — required to persist the encrypted vault in chrome.storage.local (never chrome.storage.sync — vault never leaves the device)
• tabs — required for the background service worker to locate the vault tab and route resolve requests
• scripting + host_permissions (<all_urls>) — required for the content script to intercept form submits on any page the agent might visit. Same permission used by all major password managers.

None of these permissions involve network access. EnigmAgent makes zero outbound HTTP requests.

── PRIVACY ───────────────────────────────────────────────────

EnigmAgent collects no analytics, no crash reports, no telemetry. It has no remote servers. It does not use any third-party services. The only data it writes is the encrypted vault blob in chrome.storage.local on your own machine.

Full privacy policy: https://github.com/agnuxo1/EnigmAgent/blob/main/SECURITY.md

── OPEN SOURCE ───────────────────────────────────────────────

EnigmAgent is MIT-licensed. Source code, architecture documentation, and the reproducible build recipe are at:
https://github.com/agnuxo1/EnigmAgent

The bundled cryptography library (@noble/hashes) is audited, MIT-licensed, and byte-reproducible. SHA-256 of argon2id.js matches the esbuild output of @noble/hashes@1.4.0 — verifiable by anyone.
```

---

## Category

**Productivity** (primary)
Alternative: Developer Tools

---

## Additional Fields

- **Language**: English
- **Homepage URL**: https://github.com/agnuxo1/EnigmAgent
- **Support URL**: https://github.com/agnuxo1/EnigmAgent/issues
- **Privacy Policy URL**: https://github.com/agnuxo1/EnigmAgent/blob/main/SECURITY.md

---

## Permissions Justification (for Google Reviewer)

This is required for the Chrome Web Store review form under "Permissions Justification".

| Permission | Justification |
|---|---|
| `storage` | The extension stores the AES-256-GCM encrypted vault exclusively in `chrome.storage.local`. No data is written to `chrome.storage.sync` — the vault never leaves the device. Storage is also used (via `chrome.storage.session`) to track which tab hosts the unlocked vault across service worker restarts. |
| `tabs` | The background service worker needs `tabs` to (a) query which tab is currently displaying vault.html and (b) send resolve-request messages to that specific tab via `chrome.tabs.sendMessage`. Without this, the routing of credential-resolve requests from content scripts to the vault tab is impossible. |
| `scripting` | Used in manifest declaration to allow injection of content.js on all pages. Content.js intercepts form submit events and communicates with the background service worker to replace {{PLACEHOLDER}} tokens before form submission. |
| `host_permissions: <all_urls>` | The user cannot predict in advance which websites their AI agent will interact with. The content script must be present on any page the agent might visit, just as all major password managers require. The extension uses this permission only to listen for form submit events — it does not read page content, DOM, or other form values. The extension makes no outbound network requests. |

**Single Purpose Statement**: EnigmAgent has a single, clearly defined purpose: to securely store encrypted credential secrets and inject them into web forms at submit time, replacing placeholder tokens. It does not modify page behavior in any other way.

---

## Screenshots (5 recommended, 1280x800 or 640x400)

### Screenshot 1 — Vault Chat Interface
**Filename**: `screenshot-1-vault-chat.png`
**What to show**: The main vault.html page after unlock. Show the chat-style command interface with a few example secrets listed in the sidebar (e.g., GITHUB_TOKEN bound to github.com, STRIPE_KEY bound to stripe.com). In the chat log, show the output of the `list` command.
**Caption**: "Chat-style vault management. Type commands to add, list, and manage encrypted secrets."

### Screenshot 2 — Secret Add Flow
**Filename**: `screenshot-2-add-secret.png`
**What to show**: The modal dialog open with a new secret being added. Name: `OPENAI_API_KEY`, Domain: `platform.openai.com`, Value: `sk-proj-••••••••••` (partially masked). Show the domain binding field prominently.
**Caption**: "Every secret is bound to a specific domain. The vault refuses to resolve it on any other site."

### Screenshot 3 — Form Interception in Action
**Filename**: `screenshot-3-injection.png`
**What to show**: A browser window on a site like GitHub settings with a token input field containing `{{GITHUB_TOKEN}}` (the placeholder). In the corner, show the EnigmAgent badge saying "✓ submitted with real values" in green. Illustrates the moment of injection.
**Caption**: "The agent types the placeholder. EnigmAgent injects the real value at submit time — never before."

### Screenshot 4 — Popup Status
**Filename**: `screenshot-4-popup.png`
**What to show**: The toolbar popup (popup.html) open with the green dot indicating the vault is open and ready, and the "Open vault" button visible.
**Caption**: "Quick-access popup: see vault status at a glance and open the vault with one click."

### Screenshot 5 — Agent Workflow Diagram
**Filename**: `screenshot-5-workflow.png`
**What to show**: A clean diagram showing: LLM/Agent → {{GITHUB_TOKEN}} → Form → EnigmAgent → Real Value → Website. Could be a styled version of the ASCII diagram from the README, or a composed screenshot showing Claude.ai chat on one side with a placeholder, and the GitHub form on the other side with the real value injected.
**Caption**: "The AI agent never sees the real credential. It only works with placeholder names."

---

## Promo Images

### Small Promo Tile (440x280 px)
- Dark background (#171a21)
- Large lock icon (unlocked state, blue key)
- Title: "EnigmAgent"
- Tagline: "Your agent types {{PLACEHOLDER}}. You keep the secret."

### Large Promo Marquee (1400x560 px)
- Split design: left side shows an LLM chat interface with {{GITHUB_TOKEN}} visible; right side shows the GitHub form with `ghp_xxx...` injected after EnigmAgent interception
- Central arrow with "EnigmAgent" label between the two sides
- Text overlay: "AES-256-GCM · Argon2id · Zero Cloud"

---

## Chrome Web Store Submission Checklist

### Account & Developer
- [ ] Google Developer Account created (one-time $5 fee)
- [ ] Account verified with valid payment method
- [ ] Privacy policy URL accessible and live (required)

### Extension Package
- [ ] `extension/` folder contains all files
- [ ] `manifest.json` version bumped to `1.0.0`
- [ ] All icon files present: `icons/icon-16.png`, `icons/icon-48.png`, `icons/icon-128.png`
- [ ] ZIP created from `extension/` folder contents (not the folder itself): `cd extension && zip -r ../enigmagent-chrome-1.0.0.zip .`
- [ ] ZIP size under 128 MB (current: ~29 KB — well within limit)
- [ ] No `node_modules/`, `.git/`, or test files in ZIP

### Manifest Requirements
- [ ] `manifest_version: 3` (MV3 required for new submissions)
- [ ] `version` field set (must match store version)
- [ ] `name` field (max 45 chars in store, manifest name can be longer)
- [ ] `description` field (brief, no keyword stuffing)
- [ ] `icons` field with 16, 48, 128 sizes
- [ ] CSP set in `content_security_policy.extension_pages`
- [ ] `host_permissions` declared (not lumped into `permissions`)
- [ ] Service worker declared in `background.service_worker`

### Store Listing Content
- [ ] Title (max 45 chars)
- [ ] Short description (max 132 chars)
- [ ] Long description (max 16 000 chars) — no HTML, plain text only
- [ ] Category selected (Productivity or Developer Tools)
- [ ] At least 1 screenshot (1280x800 or 640x400, PNG or JPEG)
- [ ] Small promo tile uploaded (440x280 px) — optional but strongly recommended
- [ ] Large promo image uploaded (1400x560 px) — optional

### Policy Compliance
- [ ] Single-purpose declaration written
- [ ] Permissions justification filled out for each non-obvious permission
- [ ] Privacy policy URL provided and live (required for `storage` permission)
- [ ] No use of remote code execution (no eval, no remotely loaded scripts)
- [ ] Extension does not collect user data (confirm in privacy practices form)
- [ ] `data_collection: []` confirmed in the privacy practices section
- [ ] Confirm extension does not require login or account creation
- [ ] Confirm extension functions 100% offline (no required network calls)

### Post-Submission
- [ ] Review typically takes 1-3 business days for new extensions
- [ ] If rejected, review the violation details carefully — most common issues:
  - Missing or vague permissions justification
  - `<all_urls>` without clear explanation
  - Privacy policy URL not reachable
- [ ] After approval, test install from the Web Store before announcing
- [ ] Set up a monitored email for user reviews and support requests

### Signing & Reproducibility (recommended before submission)
- [ ] Run `cd build-tool && npm ci && npx esbuild argon2-entry.js --bundle --minify --format=iife --target=es2020 --outfile=../extension/lib/argon2id.js`
- [ ] Verify SHA-256 of `extension/lib/argon2id.js` matches documented hash in SECURITY.md
- [ ] Tag git release: `git tag v1.0.0 && git push origin v1.0.0`
- [ ] Create GitHub Release with the same ZIP attached
