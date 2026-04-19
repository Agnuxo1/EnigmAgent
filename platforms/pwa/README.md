# EnigmAgent PWA

Standalone Progressive Web App — works on any device (Android, iOS, Windows, macOS, Linux) without installing a browser extension.

## Features

- Same vault UI as the extension
- Installable as a native app (Add to Home Screen / Install App)
- Works offline (service worker caches all assets)
- Export/import vault files — compatible with the browser extension
- `copy NAME` command — copies secret value to clipboard (mobile-friendly)

## Quick start

```bash
node setup.js        # copies style.css + argon2id.js from extension/
npx serve .          # serve on http://localhost:3000
```

Or with Python:
```bash
python -m http.server 8080
```

## Deploy to GitHub Pages

The PWA is designed to be served from any static host. The simplest option:

1. In your GitHub repo → **Settings → Pages → Source: GitHub Actions**
2. Or push the `platforms/pwa/` directory (after `node setup.js`) to a `gh-pages` branch

Then open `https://agnuxo1.github.io/EnigmAgent/platforms/pwa/`.

## Vault compatibility

The vault format is identical to the browser extension. To migrate:

1. In the Chrome extension: click **Export** (creates an encrypted `.json` file)
2. In the PWA: click **Import / export a vault file** and select the exported file
3. Enter the same username + password — unlocks immediately

## Limitations

- No automatic form injection (that requires the browser extension)
- Users copy secrets manually with the `copy NAME` command or the modal's **Copy value** button
