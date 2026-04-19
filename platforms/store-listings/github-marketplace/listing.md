# EnigmAgent Vault Resolve — GitHub Marketplace

## Marketplace listing

**Name:** EnigmAgent Vault Resolve  
**Category:** Security  
**Pricing:** Free  
**License:** MIT  

## Short description (100 chars)
Resolve {{PLACEHOLDER}} references from a local EnigmAgent vault in your CI/CD workflows.

## Full description

Integrate EnigmAgent's local-vault secret resolution into your GitHub Actions workflows.

Instead of using GitHub Secrets for every credential — or worse, hardcoding them — store sensitive values in a local EnigmAgent vault and reference them as `{{PLACEHOLDER}}` symbols. This action connects to a locally running vault server (useful in self-hosted runners) to resolve placeholders at CI time.

**Use cases:**
- Self-hosted runners with a local vault server
- Resolving credentials for deployment scripts
- Generating resolved configuration files from templates

## Usage

```yaml
- name: Start EnigmAgent vault
  run: |
    npx enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json &
    sleep 2

- name: Resolve secrets in deploy config
  uses: enigmagent/enigmagent@v1
  with:
    text: |
      DATABASE_URL={{DATABASE_URL}}
      API_KEY={{OPENAI_API_KEY}}
    output-var: RESOLVED_CONFIG

- name: Use resolved config
  run: echo "$RESOLVED_CONFIG" > .env
```

## Links
- Source: https://github.com/enigmagent/enigmagent/platforms/store-listings/github-marketplace
- Docs: https://docs.enigmagent.com/integrations/github-actions
