# EnigmAgent Vault — JetBrains Plugin

[![JetBrains Marketplace](https://img.shields.io/badge/JetBrains-Marketplace-green)](https://plugins.jetbrains.com/plugin/com.enigmagent.vault)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)

Secure local credential vault for IntelliJ IDEA, PyCharm, WebStorm, GoLand, and all JetBrains IDEs.

## Features

| Feature | Description |
|---------|-------------|
| **Vault status panel** | Real-time indicator: 🟢 unlocked / 🟡 locked / 🔴 offline |
| **Secret browser** | List all secret names and domain bindings — never values |
| **One-click copy** | Select any secret → copies `{{SECRET_NAME}}` to clipboard |
| **Settings page** | Configure host, port, origin under **Settings → Tools → EnigmAgent Vault** |
| **Tools menu** | Check Vault Status · Browse Secrets · Copy Placeholder |

## Installation

### From JetBrains Marketplace
1. Open **Settings** → **Plugins** → **Marketplace**
2. Search: `EnigmAgent Vault`
3. Click **Install**, restart IDE

### From disk (.zip)
1. **Settings** → **Plugins** → ⚙️ → **Install Plugin from Disk...**
2. Select `enigmagent-vault-1.0.0.zip` from the `build/distributions/` folder

## Building from source

Requirements: JDK 17, Gradle 8.6+

```bash
cd platforms/jetbrains-plugin
./gradlew buildPlugin          # → build/distributions/enigmagent-vault-1.0.0.zip
./gradlew runIde               # Launch sandbox IDE with plugin installed
./gradlew publishPlugin        # Publish to JetBrains Marketplace (needs PUBLISH_TOKEN)
```

## Prerequisites

1. EnigmAgent vault server running:
   ```bash
   enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json
   ```
2. At least one secret added:
   ```bash
   enigmagent add GITHUB_TOKEN @localhost ghp_...
   ```

## Usage

1. Open **View → Tool Windows → EnigmAgent**
2. Click **⟳ Refresh** to load vault status and secrets
3. Select a secret → click **Copy {{…}}** or double-click → `{{GITHUB_TOKEN}}` is in your clipboard
4. Paste into HTTP client files, run configs, terminal, AI prompts

## Architecture

```
IntelliJ Plugin
    ↕ HTTP (127.0.0.1:3737)
EnigmAgent MCP Server
    ↕
AES-256-GCM Vault (Argon2id)
```
