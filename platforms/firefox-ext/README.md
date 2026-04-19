# EnigmAgent — Firefox / Edge / Opera Extension

Same vault, same crypto, same UX as the Chrome extension — adapted for Firefox, Edge and Opera.

## Status

| Browser | Engine | Changes needed |
|---|---|---|
| Firefox 115+ | Gecko | `background.scripts` + `gecko` manifest settings |
| Edge | Chromium | None — accepts Chrome MV3 packages unchanged |
| Opera | Chromium | None — accepts Chrome MV3 packages unchanged |

## Build

```bash
npm install
npm run build:firefox   # → dist/firefox/  +  dist/enigmagent-firefox.zip
npm run build:edge      # → dist/edge/      +  dist/enigmagent-edge.zip
npm run build:opera     # → dist/opera/     +  dist/enigmagent-opera.zip
npm run build:all       # all three
```

## Load in Firefox (development)

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `dist/firefox/manifest.json`

## Submit to stores

- **Firefox Add-ons (AMO):** https://addons.mozilla.org/developers/addon/submit/
- **Edge Add-ons:** https://partner.microsoft.com/dashboard/microsoftedge/
- **Opera Add-ons:** https://addons.opera.com/developer/

## Lint (Firefox)

```bash
npm run lint   # uses web-ext lint
```
