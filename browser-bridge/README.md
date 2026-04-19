# EnigmAgent Browser Bridge

WebExtension (Manifest V3) that intercepts `{{PLACEHOLDER}}` tokens in form inputs and swaps them for real values decrypted by the local vault.

## Status

**Skeleton only.** The submit-interception logic is in place, but the extension → vault-app message channel needs to be wired up. See [ROADMAP M2](../ROADMAP.md).

## Load it (developer mode)

### Chrome / Edge / Brave
1. Open `chrome://extensions`.
2. Enable "Developer mode" (top right).
3. Click "Load unpacked" and select this `browser-bridge/` folder.

### Firefox
1. Open `about:debugging#/runtime/this-firefox`.
2. Click "Load Temporary Add-on…"
3. Select `browser-bridge/manifest.json`.

(Icons are placeholders — the folder `icons/` will be added before the first release.)

## How it works (for developers)

```
┌────────────────┐   chrome.runtime    ┌──────────────────┐   postMessage    ┌────────────┐
│ content script │ ──────────────────▶ │ service worker   │ ───────────────▶ │ vault tab  │
│  (any page)    │ ◀────────────────── │ (background.js)  │ ◀─────────────── │ (file://…) │
└────────────────┘  resolve-placeholder└──────────────────┘   bridge-resolve └────────────┘
        │
        │ setInputValue → form.requestSubmit()
        ▼
    real website
```

- `content.js` hooks the `submit` event on every form, scans for `{{…}}` patterns, and pauses submission while it requests each placeholder.
- `background.js` routes requests to the tab registered as the vault, with a 5-second timeout.
- `vault-tab.js` is the extension-hosted vault (stub in M1; full UI in M2).

## Placeholder syntax

Currently matches: `/\{\{([A-Z0-9_:\-.@]+)\}\}/g`

Valid examples: `{{GITHUB_TOKEN}}`, `{{LOGIN:github.com}}`, `{{DOC:contract.md}}`, `{{NIE}}`.

## Testing

Open `tests/placeholder.html` in a browser with the extension loaded, with the vault unlocked in another tab. The test page has a form pre-filled with `{{DEMO_TOKEN}}` — clicking submit should trigger the swap.
