## Bundled gateway 2.0.0 - 2026-09-17

## 3.0.0 - Integrated authenticated vault and native frameworks (2026-09-17)

- Added authenticated format-v2 vault envelopes, explicit v1 migration, permanent
  original backups, revision-checked writes and verified recovery.
- Added the fixed-operation broker and connected it to MCP/REST with raw resolution
  disabled and mutually exclusive with broker mode.
- Replaced secret-bearing CLI arguments with hidden/piped input and integrated the
  standalone administrator and Node library against identical tested core code.
- Added the authenticated bounded Python client and ten native execution-tested
  framework adapters, plus official MCP-client interoperability tests.
- Replaced the old Docker-specific unauthenticated server with the canonical gateway
  and source-pinned non-root image; release delivery is gated on actual runtime tests.
- Preserved the complete 2.0.0 source tree in a versioned archive and clarified the
  separate validation status of historical browser/GUI/IDE/mobile products.
- Added current release/migration/security documentation, package provenance and
  a factual project landing page. No upstream adoption or registry publication is implied.

Scope: `platforms/mcp-server`, not a synchronized release of every platform.

- Require bearer authentication on every loopback REST endpoint.
- Disable raw-secret resolution by default for MCP and REST; require operator opt-in.
- Validate local Host, reject browser Origin, bound incoming bodies and stdio frames.
- Handle invalid JSON-RPC input and notifications without crashing or exposing exception details.
- Add a loopback-only authenticated Node client and a no-credential encrypted-vault demo.
- Add actual HTTP/stdio and CLI regression tests, packaging checks and cross-platform CI.
- Preserve all 325 pre-change tracked files in a verified versioned source archive.
- Document ten integration candidates without claiming upstream adoption.

Breaking changes: Node.js 22+, non-interactive credentials, REST bearer token and
raw-resolution opt-in. The v1 encrypted-vault format remains unchanged.
Registry and Docker publication are not performed by this source change.
See `docs/GATEWAY_V2_AUDIT.md` for remaining project-wide security work.

# Changelog

All notable changes to EnigmAgent are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The MCP server lives in the [`enigmagent-mcp`](https://github.com/Agnuxo1/enigmagent-mcp) repo and the [`enigmagent-mcp`](https://www.npmjs.com/package/enigmagent-mcp) npm package; its versions are tracked here in the `[npm/enigmagent-mcp]` rows.

The framework integration packages have their own repos but their releases are summarized here for visibility.

---

## [Unreleased]

- Demo GIF showing `{{OPENAI_KEY}}` substitution
- Show HN launch
- Reddit launches (r/LocalLLaMA, r/ClaudeAI, r/MachineLearning, r/selfhosted)

---

## [npm/enigmagent-mcp 1.0.5] — 2026-04-25

### Changed
- **Description rewrite:** package.json description now leads with Claude Desktop and Cursor (highest-traffic discovery paths) instead of Open WebUI / AnythingLLM / LM Studio. Old description buried the most-searched clients.
- **Keywords expanded:** from 8 to 18, covering protocol (`mcp`, `mcp-server`, `model-context-protocol`), audience (`ai-agents`, `llm`, `claude-desktop`, `cursor`), domain (`vault`, `secrets`, `secrets-management`, `credentials`), crypto (`encryption`, `aes-256-gcm`, `argon2id`, `security`), ecosystem (`enigmagent`, `openclaw`, `p2pclaw`).
- **Metadata completeness:** added `homepage` and `bugs.url` fields.

### Fixed
- **`server.json` description length:** shortened to 99 characters (MCP Registry rejects descriptions > 100 chars).

---

## [npm/enigmagent-mcp 1.0.4] — 2026-04-25

### Changed
- **Republish to refresh npm/Glama README cache.** The npm-rendered README and the Glama listing were both serving the v1.0.x README with outdated MCP tool names (`resolve_secret`, `list_keys`, `vault_status`). The actual server exposes `enigmagent_resolve` and `enigmagent_list`.
- README rewritten problem-first: hero is now the concrete pain story (Claude needs your GitHub PAT, three terrible options, EnigmAgent is option four) rather than a slogan.
- Per-client setup snippets added for Claude Desktop, Cursor, Continue.dev, Cline, Open WebUI, Zed, custom REST.
- Headless / CI mode documented (`ENIGMAGENT_USER` + `ENIGMAGENT_PASS` env vars).
- Badges row added: npm version, downloads, MIT, Argon2id, Glama MCP, GitHub stars.

### Fixed
- Repo hygiene: `enigmagent-vault-2026-04-19.json` and `vault-test.json` removed from repo root (encrypted but should not be public on a security tool's repo). PYPI_TOKEN bound to that vault should be rotated as a precaution.
- `PUSH.md` and `LAUNCH_REPORT.md` (internal dev notes) removed from public repo.
- Research PDFs moved to `docs/papers/`.

### Added
- `INTEGRATIONS.md` — directory of all client + framework integrations.
- `PRESS.md` — press kit for journalists, editors, podcast hosts.
- `server.json` — MCP Registry submission descriptor.
- `.github/workflows/ci.yml` — matrix CI on Node 18/20/22 × Linux/macOS/Windows.
- `.github/workflows/publish.yml` — tag-driven npm publish (with provenance) + MCP Registry publish (via OIDC).
- `smithery.yaml` and `manifest.json` — Smithery.ai server descriptors.

---

## [npm/enigmagent-mcp 1.0.3] — 2026-04-24

### Fixed
- Glama build test compatibility: server now starts in **locked mode** when stdin has no TTY (running behind `mcp-proxy` and similar wrappers). Previously the server hung waiting for interactive credential input.
- `vault-core.js` inlined into `index.js` to remove a separate-file dependency that broke Glama's pinned-commit build cache.

### Verified
- Glama build test [`019dc281`](https://glama.ai/mcp/servers/Agnuxo1/enigmagent-mcp/admin/dockerfile/tests/019dc281-977a-75bc-8b96-7e988d3c4ab0) — status `success`. Server responds correctly to `initialize` and `tools/list`.
- Glama Score: **Security A** + **Quality A** (AAA tier).

---

## [npm/enigmagent-mcp 1.0.0 .. 1.0.2] — 2026-04-24

### Added
- Initial public release.
- AES-256-GCM + Argon2id encryption.
- MCP stdio + REST dual-mode API.
- `enigmagent_resolve` and `enigmagent_list` MCP tools.
- Domain-binding enforcement on every secret.

---

## Framework integrations — 2026-04-25

All four integration packages released to PyPI/npm in a single day, each scaffolded around the local REST API of `enigmagent-mcp`.

| Package | Registry | Repo | Description |
|---------|----------|------|-------------|
| [`n8n-nodes-enigmagent`](https://www.npmjs.com/package/n8n-nodes-enigmagent) | npm 0.1.0 | [Agnuxo1/n8n-nodes-enigmagent](https://github.com/Agnuxo1/n8n-nodes-enigmagent) | n8n community node — drop between an LLM node and an HTTP node to substitute placeholders inline. Auto-listed in n8n's marketplace via the `n8n-community-node-package` keyword. |
| [`langchain-enigmagent`](https://pypi.org/project/langchain-enigmagent/) | PyPI 0.1.0 | [Agnuxo1/langchain-enigmagent](https://github.com/Agnuxo1/langchain-enigmagent) | LangChain integration: `EnigmAgentClient`, `EnigmAgentSubstitute` Runnable, callback handler, `enigma_secret()` SecretStr helper. |
| [`crewai-tools-enigmagent`](https://pypi.org/project/crewai-tools-enigmagent/) | PyPI 0.1.0 | [Agnuxo1/crewai-tools-enigmagent](https://github.com/Agnuxo1/crewai-tools-enigmagent) | CrewAI tool: `EnigmAgentTool` resolves placeholders at the call boundary. Drop into any `Crew(tools=[...])`. |
| [`llama-index-tools-enigmagent`](https://pypi.org/project/llama-index-tools-enigmagent/) | PyPI 0.1.0 | [Agnuxo1/llama-index-tools-enigmagent](https://github.com/Agnuxo1/llama-index-tools-enigmagent) | LlamaIndex `BaseToolSpec` exposing three tools: `resolve_placeholder`, `substitute_placeholders`, `list_placeholders`. |

---

## Browser extension — 2026-04-19 .. 2026-04-24

### Added
- Chrome / Firefox / Edge MV3 extension.
- Form-submit interception with `{{PLACEHOLDER}}` substitution at submit time.
- Vault tab UI with master-password unlock.
- Argon2id key derivation in browser via `@noble/hashes` bundled.
- Document injection (`{{DOC:filename}}`).

### Fixed
- All known issues from initial release. See [SECURITY.md](SECURITY.md) for the threat model.

---

## Listings & directories — 2026-04-25

EnigmAgent now appears or has open submissions in:

- **MCP Registry** (canonical) — [`io.github.Agnuxo1/enigmagent-mcp`](https://registry.modelcontextprotocol.io/v0/servers?search=enigmagent), status `active`. Cascades to PulseMCP, mcp.so, MCPHub.
- **Glama** — [Security A / Quality A](https://glama.ai/mcp/servers/Agnuxo1/enigmagent-mcp).
- **awesome-mcp-servers** ([punkpeye PR #5354](https://github.com/punkpeye/awesome-mcp-servers/pull/5354)) — open, all checks pass.
- **awesome-mcp-security** ([Puliczek PR #140](https://github.com/Puliczek/awesome-mcp-security/pull/140)) — open.
- **awesome-claude-skills** (ComposioHQ 56K★, travisvn 11.7K★, BehiSecc 8.7K★) — open PRs.
- **awesome-cursorrules** ([PatrickJS PR #268](https://github.com/PatrickJS/awesome-cursorrules/pull/268)) — open, CodeRabbit reviews resolved through round 3.
- **awesome-ai-agents** ([e2b-dev 27K★ PR #853](https://github.com/e2b-dev/awesome-ai-agents/pull/853)) — open.
- **awesome-claude-code-subagents** ([VoltAgent 18K★ PR #237](https://github.com/VoltAgent/awesome-claude-code-subagents/pull/237)) — open.
- **+15 other awesome-* / registry submissions** in flight. See [`platforms/integrations/awesome-lists/awesome-lists-submissions.md`](platforms/integrations/awesome-lists/awesome-lists-submissions.md).

---

## Telemetry & data

EnigmAgent collects no telemetry. The vault never leaves your machine. There is no callback URL, no analytics, no opt-out — there is nothing to opt out of.

---

[Unreleased]: https://github.com/Agnuxo1/EnigmAgent/compare/v1.0.5...HEAD
[npm/enigmagent-mcp 1.0.5]: https://www.npmjs.com/package/enigmagent-mcp/v/1.0.5
[npm/enigmagent-mcp 1.0.4]: https://www.npmjs.com/package/enigmagent-mcp/v/1.0.4
[npm/enigmagent-mcp 1.0.3]: https://www.npmjs.com/package/enigmagent-mcp/v/1.0.3
