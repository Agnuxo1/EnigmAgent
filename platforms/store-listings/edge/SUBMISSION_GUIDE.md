# Microsoft Edge Add-ons Submission Guide — EnigmAgent v1.0.1

Submit at: https://partner.microsoft.com/dashboard/microsoftedge/

---

## Key fact: Edge accepts Chrome extension ZIPs directly

Edge is Chromium-based and runs Chrome MV3 extensions without modification.
You can submit the exact same ZIP used for the Chrome Web Store:

**Use this file:** `enigmagent-v1.0.1.zip` (project root)

Alternatively, a dedicated Edge build is at:
`platforms/firefox-ext/dist/enigmagent-edge.zip` (identical contents)

---

## Pre-submission checklist

- [ ] Microsoft account created and linked to Partner Center
- [ ] Publisher profile created at https://partner.microsoft.com/dashboard/microsoftedge/
- [ ] One-time developer registration fee paid (if required in your region — often free)
- [ ] ZIP file ready: `enigmagent-v1.0.1.zip`
- [ ] Privacy policy URL live: https://github.com/Agnuxo1/EnigmAgent/blob/main/PRIVACY.md

---

## Step 1 — Partner Center access

1. Go to https://partner.microsoft.com/dashboard/microsoftedge/
2. Sign in with your Microsoft account
3. If first time: complete publisher registration (name, contact info)
4. Click **Create new extension**

---

## Step 2 — Upload the package

1. Click **Upload package**
2. Select `enigmagent-v1.0.1.zip`
3. Partner Center will validate the manifest automatically
4. Once validation passes, click **Next**

---

## Step 3 — Availability

| Field | Value |
|-------|-------|
| **Visibility** | Public |
| **Markets** | All markets (or select specific regions) |
| **Publication date** | Publish as soon as certified (recommended) |

---

## Step 4 — Properties

| Field | Value |
|-------|-------|
| **Category** | Productivity |
| **Language** | English (United States) |
| **Privacy policy URL** | https://github.com/Agnuxo1/EnigmAgent/blob/main/PRIVACY.md |
| **Website URL** | https://github.com/Agnuxo1/EnigmAgent |
| **Support URL** | https://github.com/Agnuxo1/EnigmAgent/issues |
| **Mature content** | No |

---

## Step 5 — Store listing (English)

### Name (max 45 chars)
```
EnigmAgent — AI Secret Vault
```

### Short description (max 150 chars)
```
Encrypted local vault for AI agents. Write {{GITHUB_TOKEN}} in any form — real values inject at submit. Zero cloud exposure.
```

### Long description

```
EnigmAgent solves the core security problem in AI agent workflows: your agent needs credentials to act on your behalf, but you cannot hand it your real secrets.

Instead of pasting API keys into prompts, store them in an AES-256-GCM encrypted local vault and reference them as {{PLACEHOLDER}} symbols. EnigmAgent intercepts form submits, decrypts the value locally, and injects the real credential — only on the bound domain.

HOW IT WORKS

1. Store secrets in the local vault (AES-256-GCM + Argon2id key derivation).
   Nothing is sent to any server.

2. Your agent types {{GITHUB_TOKEN}} in a form field — the placeholder, not the real value.

3. At form submit, EnigmAgent decrypts and injects the real value.

4. The agent receives success. It never saw the actual credential.

SECURITY ARCHITECTURE

• AES-256-GCM — 96-bit random nonces, per-entry encryption
• Argon2id (m=64 MiB, t=3) — memory-hard key derivation, brute-force resistant
• Non-extractable CryptoKey — cannot be serialized or exported
• Domain binding — each secret restricted to its registered origin
• No outbound network requests, no telemetry, no accounts required
• Shadow DOM status badge — isolated from host-page interference

FEATURES

• Chat-style command interface for managing secrets
• {{PLACEHOLDER}} form injection on any website
• {{LOGIN:domain}} shorthand resolution
• {{DOC:filename}} document embedding
• Import/export encrypted JSON backup
• 100% local and offline — no server required

COMPATIBLE WITH

Claude, ChatGPT, Cursor, GitHub Copilot, AutoGPT, n8n, Zapier AI, and any
browser automation tool that fills web forms.

OPEN SOURCE — MIT license
Source: https://github.com/Agnuxo1/EnigmAgent
```

---

## Step 6 — Screenshots

Upload at least 2 screenshots (1280x800 PNG recommended):

Reuse the screenshots from `platforms/store-listings/chrome/`:
- `screenshot-1-vault-chat.png`
- `screenshot-2-integration.png`

Edge Partner Center accepts the same resolution as Chrome Web Store.

---

## Step 7 — Permissions justification

In the **Notes for certification** field, add:

```
EnigmAgent is a fully local, zero-network encrypted vault for AI agents.

Source code: https://github.com/Agnuxo1/EnigmAgent

Permissions justification:
- storage: The AES-256-GCM encrypted vault is stored exclusively in
  chrome.storage.local. Nothing goes to sync storage or any remote server.
- windows: background.js calls chrome.windows.update() to focus the vault
  window when the user opens it via the toolbar popup.
- host_permissions (<all_urls>): The content script must intercept form submits
  on any page the agent might visit — the same requirement as all major password
  managers. The extension only listens for submit events; it does not read page
  content or other form values. No outbound HTTP requests are made.

The extension has a single, clearly defined purpose: store encrypted credentials
and inject them into web forms at submit time, replacing {{placeholder}} tokens.
```

---

## Step 8 — Submit for certification

1. Click **Publish** (or **Submit for review**)
2. Microsoft Edge certification typically takes **1–7 business days**
3. You will receive an email notification when certified

---

## Edge-specific notes

- Edge accepts Chrome MV3 extensions without any changes — no separate build needed
- The manifest uses `service_worker` (Chrome MV3 style) — fully supported in Edge
- Edge Partner Center may ask you to confirm the extension does not collect data:
  answer **No data collected** (EnigmAgent has no analytics or remote calls)
- If your extension is already on the Chrome Web Store, you can reference it in
  the submission notes to speed up review

---

## After certification

1. Test install from Edge Add-ons: https://microsoftedge.microsoft.com/addons/
2. Future updates: bump `version` in `extension/manifest.json`, rebuild Chrome ZIP,
   and upload the new package through Partner Center

---

## Opera note (same ZIP)

Opera Add-ons (https://addons.opera.com/developer/) also accepts Chrome MV3 packages.
Use the same `enigmagent-v1.0.1.zip` — no changes required.
A dedicated Opera build can also be generated: `node build.js opera` in `platforms/firefox-ext/`.
