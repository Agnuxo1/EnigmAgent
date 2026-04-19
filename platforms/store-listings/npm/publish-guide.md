# npm Publication Guide — enigmagent-mcp

## Package name
`enigmagent-mcp`

## Scoped alias (also publish)
`@enigmagent/mcp`

## Pre-publish checklist

```bash
# 1. Verify version
cat package.json | grep '"version"'

# 2. Build
npm run build

# 3. Dry run
npm publish --dry-run

# 4. Publish to npm
npm login
npm publish --access public

# 5. Publish scoped
npm publish --access public --scope @enigmagent
```

## npm keywords (for discoverability)
```json
["mcp", "model-context-protocol", "ai-agents", "vault", "secrets", "langchain", "crewai", 
 "autogen", "n8n", "llamaindex", "semantic-kernel", "smolagents", "phidata", "mem0",
 "langgraph", "openai-agents", "anthropic", "credential-management", "placeholder", 
 "aes-256", "encryption", "local-vault"]
```

## npm README badge block
```markdown
[![npm](https://img.shields.io/npm/v/enigmagent-mcp)](https://www.npmjs.com/package/enigmagent-mcp)
[![npm downloads](https://img.shields.io/npm/dm/enigmagent-mcp)](https://www.npmjs.com/package/enigmagent-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
```

## TypeScript types
Ensure `dist/index.d.ts` is included in the published package.

## Post-publish
1. Tag the release: `git tag v1.0.0 && git push --tags`
2. Create GitHub release with changelog
3. Update npm shield in README
