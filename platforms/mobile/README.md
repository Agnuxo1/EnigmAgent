# EnigmAgent — Mobile App (Android + iOS)

Native mobile app using **Capacitor 6**. Wraps the vault PWA in a native shell for the App Store and Google Play.

## Prerequisites

- **Android:** Android Studio + Android SDK
- **iOS:** Xcode 15+ on macOS

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Copy PWA assets to www/
node setup.js

# 3. Add native platforms
npx cap add android
npx cap add ios

# 4. Sync assets to native projects
npx cap sync

# 5. Open in IDE
npx cap open android   # opens Android Studio
npx cap open ios       # opens Xcode
```

## Build

### Android

1. Open Android Studio: `npx cap open android`
2. Build → Generate Signed Bundle/APK
3. Or use CI: `npx cap build android`

### iOS

1. Open Xcode: `npx cap open ios`
2. Set your Team/Bundle ID in **Signing & Capabilities**
3. Archive → Distribute App

## Vault storage

On mobile, the vault JSON is stored using `@capacitor/preferences` (wraps `SharedPreferences` on Android, `NSUserDefaults` on iOS). All data is encrypted before storage — only the AES-256-GCM + Argon2id ciphertext is persisted.

## Features

- Full vault management (same UI as desktop)
- `copy NAME` — copies secret value to clipboard (mobile-friendly)
- Offline support (service worker)
- Import/export vault files for cross-device sync
- Dark mode follows system theme

## Store submission

| Store | Bundle ID | Min OS |
|---|---|---|
| Google Play | `io.github.agnuxo1.enigmagent` | Android 7.0 (API 24) |
| App Store | `io.github.agnuxo1.enigmagent` | iOS 16.0 |
