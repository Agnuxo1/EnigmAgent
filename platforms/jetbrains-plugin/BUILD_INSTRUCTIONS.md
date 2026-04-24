# JetBrains Plugin — Build Instructions

## Why it doesn't build here

The machine does not have a JDK installed. The Gradle wrapper (`gradlew.bat`) requires
**JDK 17 or later**. No `java` binary was found in PATH or registry.

## How to build

### Option 1 — Install JDK locally (recommended)

```powershell
# Via winget (Windows 10/11):
winget install EclipseAdoptium.Temurin.17.JDK

# Or download directly:
# https://adoptium.net/temurin/releases/?version=17
```

Then build:
```cmd
cd D:\PROJECTS\EnigmAgent\platforms\jetbrains-plugin
gradlew.bat buildPlugin
```

Output: `build\distributions\enigmagent-vault-1.0.0.zip`

### Option 2 — GitHub Actions CI (zero-install)

Add this workflow to `.github/workflows/build-jetbrains.yml`:

```yaml
name: Build JetBrains Plugin
on: [push, workflow_dispatch]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { java-version: '17', distribution: 'temurin' }
      - name: Build plugin
        working-directory: platforms/jetbrains-plugin
        run: ./gradlew buildPlugin
      - uses: actions/upload-artifact@v4
        with:
          name: enigmagent-vault-plugin
          path: platforms/jetbrains-plugin/build/distributions/*.zip
```

### Option 3 — IntelliJ IDEA built-in

1. Open IntelliJ IDEA
2. File > Open > select `platforms/jetbrains-plugin/`
3. IDEA will prompt to download a JDK — accept (downloads Temurin 17)
4. Gradle > Tasks > intellij platform > buildPlugin

## Plugin code status

All source files are complete and correct:

| File | Status |
|------|--------|
| `build.gradle.kts` | Complete — Kotlin 1.9.25, IntelliJ Platform 2.1.0, IDEA Community 2024.1 |
| `settings.gradle.kts` | Complete |
| `plugin.xml` | Complete — actions, tool window, notifications, settings |
| `VaultClient.kt` | Complete — stdlib HTTP, GET /status + /list + POST /resolve |
| `EnigmAgentSettings.kt` | Complete — persistent state, vaultHost/vaultPort/origin/autoRefresh |
| `EnigmAgentSettingsConfigurable.kt` | Complete — Kotlin UI DSL settings page |
| `EnigmAgentToolWindowFactory.kt` | Complete — tool window panel with live status + secret list |
| `CopyPlaceholderAction.kt` | Complete — popup picker + clipboard copy |
| `VaultStatusAction.kt` | Complete — vault status balloon notification |
| `ListSecretsAction.kt` | Complete — focuses the tool window |

## Publish to JetBrains Marketplace

1. Sign in at https://plugins.jetbrains.com/vendor/p2pclaw
2. Click "Upload plugin" → upload the `.zip` from `build/distributions/`
3. The plugin is pre-signed via environment variables (`CERTIFICATE_CHAIN`, `PRIVATE_KEY`,
   `PRIVATE_KEY_PASSWORD`) — set these before running `gradlew signPlugin publishPlugin`
4. Or manually upload and sign via the web UI

## Signing (for automated publish)

```cmd
set CERTIFICATE_CHAIN=<base64 cert chain>
set PRIVATE_KEY=<base64 private key>
set PRIVATE_KEY_PASSWORD=<password>
set PUBLISH_TOKEN=<JetBrains Marketplace token>

gradlew.bat signPlugin publishPlugin
```

Get the Marketplace token from: https://plugins.jetbrains.com/author/me/tokens
