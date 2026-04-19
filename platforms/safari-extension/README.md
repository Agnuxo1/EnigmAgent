# EnigmAgent — Safari Extension

Converts the Chrome/Firefox extension to a Safari Web Extension for distribution via the macOS App Store and iOS App Store.

## Requirements

- macOS 13+ with Xcode 15+
- Apple Developer Program membership ($99/year) for App Store distribution

## Conversion steps

### 1. Convert with Xcode's built-in tool

```bash
# From repo root
xcrun safari-web-extension-converter \
  extension/ \
  --project-location platforms/safari-extension/ \
  --app-name "EnigmAgent" \
  --bundle-identifier "io.github.agnuxo1.enigmagent" \
  --swift
```

This generates a full Xcode project in `platforms/safari-extension/`.

### 2. Patch the generated manifest

Replace the generated `manifest.json` with the template in `template/manifest.json`:

```bash
cp template/manifest.json \
   "platforms/safari-extension/EnigmAgent/Resources/manifest.json"
```

The template adds `browser_specific_settings.safari` with the minimum Safari version.

### 3. Build and test in Safari

1. Open the generated `.xcodeproj` in Xcode
2. **Product → Build** (`⌘B`)
3. Open Safari → **Preferences → Extensions → Enable EnigmAgent**
4. Test the vault on `http://localhost:8088`

### 4. Submit to the App Store

1. Archive: **Product → Archive**
2. **Distribute App → App Store Connect**
3. Submit for review on [App Store Connect](https://appstoreconnect.apple.com)

## Shared source files

All logic files are shared with the Chrome extension — no duplication:
- `extension/background.js`
- `extension/content.js`
- `extension/vault.js`
- `extension/vault.html`
- `extension/popup.js` / `popup.html`
- `extension/style.css`
- `extension/lib/argon2id.js`

Only the manifest is Safari-specific (in `template/manifest.json`).

## Notes

- Safari MV3 is supported from **Safari 17** (macOS 14 Sonoma / iOS 17)
- `chrome.storage.session` requires Safari 17.2+
- The extension appears in both macOS Safari and iOS Safari (one submission = two platforms)
- App must have a native app wrapper (Xcode project) — the converter handles this automatically

## Useful links

- [Apple Web Extensions overview](https://developer.apple.com/documentation/safariservices/safari-web-extensions)
- [Converting to Safari Web Extension](https://developer.apple.com/documentation/safariservices/converting-a-web-extension-for-safari)
- [App Store Connect](https://appstoreconnect.apple.com)
