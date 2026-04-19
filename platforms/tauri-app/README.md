# EnigmAgent — Tauri Desktop App

Native desktop app using **Tauri 2** — much smaller than Electron (< 10 MB) because it uses the OS WebView instead of bundling Chromium.

## Prerequisites

```bash
# macOS
xcode-select --install
# Install Rust: https://rustup.rs

# Windows
# Install Visual Studio Build Tools + Rust: https://rustup.rs

# Linux (Ubuntu/Debian)
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
# Install Rust: https://rustup.rs
```

## Quick start

```bash
# 1. Install Rust (if not already)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. Copy frontend assets
node setup.js

# 3. Install Node.js dependencies
npm install

# 4. Development (hot-reload)
npm run dev

# 5. Production build
npm run build
```

Outputs:
- `src-tauri/target/release/bundle/` — platform-specific installer

## Architecture

```
Tauri app
  ├── Rust backend (src-tauri/src/main.rs)
  │   ├── read_vault(path) → file I/O
  │   ├── write_vault(path, data) → atomic file write
  │   └── vault_path() → OS userData path
  └── WebView frontend (dist/)
      └── vault-pwa.js — all crypto runs here (never in Rust)
```

The Rust backend only handles file I/O. All crypto (Argon2id + AES-256-GCM) runs in the WebView using the same `lib/argon2id.js` as the browser extension.

## Bundle size comparison

| Tool | Size |
|---|---|
| Electron | ~70-80 MB |
| Tauri | ~4-8 MB |
| PWA | ~50 KB |

## Cross-compilation

For cross-platform builds, use GitHub Actions with the Tauri workflows.
See `.github/workflows/` (to be added).
