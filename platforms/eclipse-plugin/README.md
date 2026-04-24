# EnigmAgent — Eclipse Plugin

Eclipse plugin providing `{{PLACEHOLDER}}` secret resolution from the EnigmAgent local vault.

## Features

- **Edit menu integration** — "EnigmAgent" submenu under Edit
- **Copy {{Placeholder}}** — popup picker of vault secret names, copies `{{NAME}}` to clipboard
- **Check Vault Status** — dialog showing vault running/locked/unreachable state
- **Preferences** — Window > Preferences > EnigmAgent Vault (configure host/port)

## Requirements

- Eclipse 2022-09 or later (Eclipse Platform 4.25+, Java 17+)
- Local EnigmAgent vault running: `enigmagent-mcp --mode rest --port 3737`

## Build

```bash
# From Eclipse PDE:
# 1. File > Import > Existing Projects into Workspace
# 2. Import enigmagent.plugin/ and enigmagent.feature/
# 3. Right-click enigmagent.feature > Export > Deployable features
# 4. Choose "Install into host. Repository:" to get the update site zip

# Or from CLI with Eclipse's headless PDE build:
eclipse -nosplash -application org.eclipse.ant.core.antRunner \
  -buildfile build.xml -Dbuilder=. -DbuildDirectory=build
```

## Install (manual)

1. Download `enigmagent-eclipse-1.0.0.zip` from [GitHub Releases](https://github.com/Agnuxo1/EnigmAgent/releases)
2. In Eclipse: Help > Install New Software > Add > Archive...
3. Select the zip → check "EnigmAgent Vault" → Finish → Restart

## Eclipse Marketplace Submission

1. Go to https://marketplace.eclipse.org/node/add/content
2. Log in with your Eclipse Foundation account
3. Fill in:
   - **Title**: EnigmAgent Vault
   - **Tags**: security, credentials, ai, vault, placeholder
   - **Update Site URL**: https://enigmagent.com/eclipse/updatesite
   - **Minimum Eclipse version**: 2022-09
4. The marketplace listing requires a publicly accessible update site (p2 repository)
5. Build and host the update site via GitHub Pages or similar

## Project Structure

```
eclipse-plugin/
  enigmagent.plugin/          ← OSGi bundle (the actual plugin)
    META-INF/MANIFEST.MF
    plugin.xml
    build.properties
    src/enigmagent/plugin/
      Activator.java           ← OSGi bundle activator
      VaultClient.java         ← stdlib HTTP client for the vault REST API
      CopyPlaceholderHandler.java  ← "Copy {{Placeholder}}" command
      VaultStatusHandler.java  ← "Check Vault Status" command
      EnigmAgentPreferencePage.java ← Preferences UI
      PreferenceInitializer.java    ← Default preference values
  enigmagent.feature/         ← Eclipse feature (wraps the plugin for Marketplace)
    feature.xml
```
