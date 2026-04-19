# EnigmAgent — Electron Desktop App

Native desktop app for Windows, macOS and Linux.
Wraps the vault PWA in a standalone window with system tray integration.

## Quick start

```bash
# 1. Copy shared assets
node setup.js

# 2. Install dependencies
npm install

# 3. Run in development
npm start

# 4. Build distributable
npm run dist            # current platform
npm run pack:win        # Windows NSIS installer
npm run pack:mac        # macOS DMG (arm64 + x64)
npm run pack:linux      # Linux AppImage
```

## Output

Built packages appear in `platforms/electron-app/dist/`:

| Platform | Format | Size (approx.) |
|---|---|---|
| Windows | `.exe` NSIS installer | ~70 MB |
| macOS | `.dmg` | ~80 MB |
| Linux | `.AppImage` | ~75 MB |

## Architecture

```
Electron main process (main.js)
  ├── Spawns static HTTP server on 127.0.0.1:random port
  ├── Opens BrowserWindow loading http://127.0.0.1:<port>/
  │   └── Renders vault PWA (vault-pwa.js + argon2id.js)
  │       └── All crypto runs in renderer (WebView)
  └── System tray (show/hide/quit)
```

The main process has **no access to vault data** — `nodeIntegration: false` and `contextIsolation: true` are enforced.

## Code signing

For distribution:
- **macOS:** Set `APPLE_ID`, `APPLE_ID_PASS`, `APPLE_TEAM_ID` in environment
- **Windows:** Set `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` for code signing
