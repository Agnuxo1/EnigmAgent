# EnigmAgent CLI

Manage your encrypted vault from the terminal or shell scripts.

## Install

```bash
cd platforms/cli
npm install
npm link   # adds 'enigmagent' to your PATH
```

Or without linking:
```bash
node bin/enigmagent.js <command>
```

## Commands

```
enigmagent create               Create a new vault
enigmagent list                 List all secret names and domains
enigmagent add NAME @dom VAL    Add a domain-bound secret
enigmagent get NAME             Show masked value
enigmagent reveal NAME          Show full value (stdout)
enigmagent resolve "{{NAME}}"   Resolve a {{PLACEHOLDER}} template
enigmagent del NAME             Delete a secret
enigmagent rename OLD NEW       Rename a secret
enigmagent domain NAME @dom     Change domain binding
enigmagent export               Export vault to JSON file
enigmagent import <file>        Import vault from JSON file
```

## Examples

```bash
# Create vault
enigmagent create -v ~/.enigmagent/vault.json

# Add secrets
enigmagent add GITHUB_TOKEN @github.com ghp_mytoken
enigmagent add OPENAI_KEY @api.openai.com sk-proj-...

# List
enigmagent list

# Use in scripts (resolve and inject into environment)
export GITHUB_TOKEN=$(enigmagent reveal GITHUB_TOKEN)
gh api /user

# Resolve a template string
enigmagent resolve "Bearer {{OPENAI_KEY}}" -o https://api.openai.com
# → Bearer sk-proj-...

# Export for use in PWA or another device
enigmagent export -o backup-2025-06-01.json
```

## Environment variables

```bash
export ENIGMAGENT_VAULT=~/.enigmagent/vault.json
export ENIGMAGENT_USER=alice
export ENIGMAGENT_PASS=mypassword   # only in secure CI environments
```

## Options

```
--vault, -v <path>    Vault file path (default: ~/.enigmagent/vault.json)
--origin, -o <url>    Origin for domain-binding check
```
