# Firefox AMO Submission Guide — EnigmAgent v1.0.1

Submit at: https://addons.mozilla.org/en-US/developers/

---

## Pre-submission checklist

- [ ] Mozilla account created and logged in at https://accounts.firefox.com
- [ ] XPI file ready: `enigmagent-firefox-v1.0.1.xpi` (project root)
- [ ] Privacy policy URL live: https://github.com/Agnuxo1/EnigmAgent/blob/main/PRIVACY.md
- [ ] Source code URL ready: https://github.com/Agnuxo1/EnigmAgent

---

## Step 1 — Developer Hub

1. Go to https://addons.mozilla.org/en-US/developers/
2. Click **Submit a New Add-on**
3. Select **On this site** (distribute via AMO — recommended for discovery)
4. Click **Continue**

---

## Step 2 — Upload the XPI

1. Click **Select a file**
2. Choose: `enigmagent-firefox-v1.0.1.xpi`
3. Wait for validation to complete (AMO runs automated linting)
4. If validation passes with warnings (not errors), click **Continue**

> **Note:** AMO may warn about `<all_urls>` in host_permissions. This is expected and
> will be reviewed manually. Prepare the justification from Step 6 below.

---

## Step 3 — Basic Information

Fill in the listing fields:

| Field | Value |
|-------|-------|
| **Name** | EnigmAgent — AI Secret Vault |
| **Summary** (max 250 chars) | Encrypted local vault for AI agents. Secrets resolve at submit time via {{PLACEHOLDER}} — your LLM never sees real values. AES-256-GCM + Argon2id. Zero cloud exposure. |
| **Description** | (see below) |
| **Categories** | Privacy & Security (primary), Productivity |
| **Tags** | ai, agents, vault, secrets, security, credentials, encryption |
| **Homepage** | https://github.com/Agnuxo1/EnigmAgent |
| **Support email** | (your email) |
| **Support website** | https://github.com/Agnuxo1/EnigmAgent/issues |
| **License** | MIT License |

### Description (copy-paste)

```
EnigmAgent solves the core security problem in AI agent workflows: your agent needs credentials to act on your behalf, but you cannot hand it your real secrets.

HOW IT WORKS

1. Store your secrets (API keys, tokens, passwords) in an AES-256-GCM encrypted local vault. Nothing is sent to any server. The vault lives in browser storage on your device.

2. Tell your agent: "When you need to authenticate, type {{SECRET_NAME}} in the field and submit."

3. The agent types the placeholder — not the real value.

4. EnigmAgent intercepts the form submit, decrypts the value from your local vault, injects it via the native DOM setter (React/Vue compatible), and re-submits.

5. The agent receives a success signal. It never saw the real credential.

SECURITY

• AES-256-GCM with per-entry 96-bit random nonces
• Argon2id key derivation (m=64 MiB, t=3) — brute-force resistant
• Non-extractable CryptoKey — cannot be serialized or stolen
• Domain binding — each secret only resolves on its registered origin
• No network requests, no telemetry, no accounts required
• Shadow DOM badge — isolated from host-page CSS/JS

FEATURES

• Chat-style command interface: add, list, rename, delete secrets by typing
• {{PLACEHOLDER}} form interception on any website
• {{LOGIN:domain}} shorthand — resolve by domain without knowing the name
• {{DOC:filename}} — embed stored documents in agent prompts
• Import/export encrypted JSON backup
• 100% offline — works without internet

PERMISSIONS

• storage — persists the encrypted vault in browser local storage
• windows — focuses the vault window when opened via the toolbar popup
• host_permissions (<all_urls>) — content script must intercept form submits on any page the agent visits, the same as all major password managers

OPEN SOURCE

MIT license. Source: https://github.com/Agnuxo1/EnigmAgent
```

---

## Step 4 — Privacy Policy

In the **Privacy Policy** field, enter:

```
https://github.com/Agnuxo1/EnigmAgent/blob/main/PRIVACY.md
```

> AMO requires a privacy policy for extensions that use the `storage` permission.
> The PRIVACY.md file confirms: no data collection, no analytics, no remote servers.

---

## Step 5 — Screenshots (at least 1 required)

Upload screenshots from `platforms/store-listings/chrome/` (same screenshots work for Firefox):

- `screenshot-1-vault-chat.png` — Main vault interface
- `screenshot-2-integration.png` — Integration overview

If you don't have screenshots yet, take them by loading the unpacked extension
(`platforms/firefox-ext/dist/firefox/`) in Firefox:
1. Go to `about:debugging` → This Firefox → Load Temporary Add-on
2. Select `manifest.json` in the `dist/firefox/` folder
3. Take screenshots of vault.html and the popup

---

## Step 6 — Source Code Submission

AMO requires source code for review of non-trivial extensions.

1. Check **"My add-on uses obfuscated or minified code"** → **No** (the source is plain JS)
2. In the **Notes to Reviewer** box, add:

```
EnigmAgent is a fully local, zero-network encrypted vault for AI agents.

Source code: https://github.com/Agnuxo1/EnigmAgent

The only bundled dependency is lib/argon2id.js — a pre-built version of
@noble/hashes@1.4.0 (MIT license, audited cryptography library used by the
Ethereum ecosystem). Build instructions are in build-tool/README.md.

Permissions justification:
- storage: AES-256-GCM encrypted vault stored in browser.storage.local only.
  Nothing goes to sync storage or any remote server.
- windows: background.js calls browser.windows.update() to focus the vault
  window when the user clicks "Open vault" in the toolbar popup.
- host_permissions (<all_urls>): The content script must be present on any
  page the agent might interact with — identical to all major password managers.
  The extension only listens for form submit events; it does not read page
  content or any other form values.

The extension makes zero outbound HTTP requests.
```

---

## Step 7 — Submit for Review

1. Click **Submit Version**
2. AMO review typically takes **1–7 business days** for new extensions
3. You will receive an email when reviewed

---

## Firefox-specific notes

- The extension uses `background.scripts` (not `service_worker`) as required by Firefox MV3
- `chrome.storage.session` is not available in Firefox; the background script uses
  a module-level variable instead (background scripts in Firefox persist for the session)
- `chrome.*` API aliases work in Firefox MV3 (same as `browser.*`)
- The extension ID `enigmagent@agnuxo1.github.io` is declared in `browser_specific_settings.gecko`
  so Firefox can update it across versions
- Minimum Firefox version: 115.0 (first version with MV3 support)

---

## After approval

1. Test install from AMO: https://addons.mozilla.org/firefox/addon/enigmagent-vault/
2. Announce the release in the GitHub repo
3. Future updates: increment `version` in `platforms/firefox-ext/manifest.json`,
   rebuild with `node build.js firefox`, and submit the new XPI via the Developer Hub
