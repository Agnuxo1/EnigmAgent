# EnigmAgent — Multi-platform builds

Every format lives in its own subdirectory. The original browser extension stays untouched in `extension/`.

| Directory | Platform | Status | Effort |
|---|---|---|---|
| [`firefox-ext/`](firefox-ext/) | Firefox + Edge + Opera | ✅ Ready | Low |
| [`pwa/`](pwa/) | Progressive Web App | ✅ Ready | Low |
| [`mcp-server/`](mcp-server/) | MCP / REST API for AI agents | ✅ Ready | Low |
| [`cli/`](cli/) | Node.js CLI | ✅ Ready | Low |
| [`npm-library/`](npm-library/) | npm package (`@enigmagent/vault`) | ✅ Ready | Low |
| [`docker/`](docker/) | Docker / docker-compose | ✅ Ready | Medium |
| [`vscode-extension/`](vscode-extension/) | VS Code / Cursor / Windsurf | ✅ Ready | Medium |
| [`electron-app/`](electron-app/) | Electron desktop | ✅ Ready | Medium |
| [`tauri-app/`](tauri-app/) | Tauri desktop (< 10 MB) | ✅ Ready | Medium |
| [`mobile/`](mobile/) | Android + iOS (Capacitor) | ✅ Ready | High |
| [`pinokio/`](pinokio/) | Pinokio launcher | ✅ Ready | Very low |
| [`safari-extension/`](safari-extension/) | Safari (macOS + iOS App Store) | ✅ Ready | Medium |
| [`shared/`](shared/) | Shared Node.js vault core | Internal | — |

## Quick start

```bash
# PWA (any device — no install needed)
cd platforms/pwa && node setup.js && npx serve .

# MCP server for Open WebUI / AnythingLLM
cd platforms/mcp-server && npm install
node index.js --vault ~/.enigmagent/vault.json --mode rest --port 3737

# CLI
cd platforms/cli && npm install && npm link
enigmagent list

# Docker
cd platforms/docker && docker compose up -d
# Open http://localhost:8080

# Electron desktop
cd platforms/electron-app && npm install && node setup.js && npm start

# Tauri desktop (< 10 MB)
cd platforms/tauri-app && npm install && node setup.js && npm run dev
```

## Vault compatibility

All platforms share the same encrypted vault format (Argon2id + AES-256-GCM JSON).
Export from any platform and import into any other — the password stays the same.
