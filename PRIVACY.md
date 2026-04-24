# EnigmAgent — Privacy Policy

**Last updated: 2026-04-24**

## Overview

EnigmAgent is a browser extension that stores encrypted secrets (API keys, tokens, passwords) locally on your device and resolves `{{PLACEHOLDER}}` references in web form fields at submit time. Your real credential values are never sent to any remote server by this extension.

## What data we collect

**We collect nothing.** EnigmAgent:

- Does **not** transmit any user data to any external server.
- Does **not** use analytics, crash reporting, or telemetry of any kind.
- Does **not** store any data outside your local browser (`chrome.storage.local`).

## What data is stored locally

EnigmAgent stores encrypted vault data in your browser's local storage (`chrome.storage.local`). This data:

- Is encrypted with **AES-256-GCM** using a key derived with **Argon2id** from your master password.
- Never leaves your device via this extension.
- Is accessible only to the EnigmAgent extension.

## How secrets are used

When you type `{{SECRET_NAME}}` in a web form field and submit, EnigmAgent:

1. Intercepts the form submission.
2. Asks the vault (running in your browser) to decrypt the referenced secret.
3. Writes the decrypted value into the form field **in JavaScript memory only**, for one event-loop tick.
4. Re-submits the form.

The decrypted value is **never written to the clipboard**, to the browser console, or to any log. It is held in JavaScript memory only for the duration of the form submit.

## Domain binding

Each secret can be bound to a specific domain. The extension will only inject a secret when the form is on the exact domain (or a subdomain) the secret is bound to. This prevents credential leakage to unintended websites.

## Permissions used

| Permission | Why it is needed |
|-----------|-----------------|
| `storage` | Store the encrypted vault locally on your device. |
| `windows` | Bring the vault window to the foreground when you open it. |
| Host permission (`<all_urls>`) | Intercept form submissions on any website so placeholders can be resolved. The extension only acts when a `{{PLACEHOLDER}}` is found in a form field. |

## Third-party services

This extension communicates with **no third-party services**. All cryptographic operations run locally using the browser's built-in Web Crypto API and a bundled, auditable Argon2id implementation.

## Data retention and deletion

All vault data is stored in `chrome.storage.local`. To delete all stored data, uninstall the extension or use the browser's extension storage clearing tools. No data is retained remotely.

## Changes to this policy

If this policy changes, the updated version will be published in the [EnigmAgent GitHub repository](https://github.com/Agnuxo1/EnigmAgent). The date at the top of this document reflects the latest revision.

## Contact

For privacy questions, contact the author via the [GitHub repository](https://github.com/Agnuxo1/EnigmAgent/issues).
