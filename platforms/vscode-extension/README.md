# EnigmAgent — VS Code / Cursor / Windsurf Extension

Manage your encrypted vault from inside the editor. Resolve `{{PLACEHOLDER}}` references without leaving your workflow.

## Features

- **Sidebar panel** — full vault UI (same as browser extension) in the VS Code activity bar
- **`enigmagent.resolveSelection`** — select `{{API_KEY}}` in any file, run the command, get the real value inserted
- **`enigmagent.copySecret`** — pick a secret from the list and copy to clipboard
- **Status bar indicator** — shows vault lock state at a glance

## Install

### From VSIX

```bash
cd platforms/vscode-extension
npm install
node build.js          # copies style.css + argon2id.js to media/
npx vsce package       # creates enigmagent-vscode-0.2.0.vsix
```

Then: **VS Code → Extensions → ... → Install from VSIX**

### From VS Code Marketplace (future)

Search for `EnigmAgent` in the Extensions panel.

## Usage

1. Open the **EnigmAgent** panel in the Activity Bar (lock icon)
2. Unlock your vault (or create a new one)
3. Add secrets with `add NAME @domain VALUE`
4. In any file, type `{{SECRET_NAME}}` and run `EnigmAgent: Resolve selected {{PLACEHOLDER}}`

## Settings

| Setting | Default | Description |
|---|---|---|
| `enigmagent.vaultPath` | `~/.enigmagent/vault.json` | Path to the vault JSON file |

## Compatibility

Works in:
- **VS Code** 1.85+
- **Cursor** (VS Code fork — fully compatible)
- **Windsurf** (VS Code fork — fully compatible)
- **VSCodium** (open-source VS Code — fully compatible)
