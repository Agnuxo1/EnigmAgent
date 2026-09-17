# EnigmAgent

Local encrypted credential storage and **operator-approved execution for AI agents**.
The integrated 3.0.0 release contains an authenticated vault, a Node administrator,
a bounded MCP/REST gateway, a Python client and ten native framework integrations.

## Start here

| Goal | Entry point |
|---|---|
| Understand what is released and tested | [Integrated release v3](docs/INTEGRATED_RELEASE_V3.md) |
| Download the versioned distributions | [GitHub releases](https://github.com/Agnuxo1/EnigmAgent/releases) |
| Use a native agent framework | [Python SDK](platforms/python-sdk/README.md) |
| Run the MCP/REST gateway | [Gateway](platforms/mcp-server/README.md) |
| Manage a vault without writing application code | [Administrator](platforms/cli/README.md) |
| Run a source-pinned container | [Container](platforms/docker/README.md) |
| Check security boundaries | [Threat model](docs/THREAT_MODEL.md) and [security policy](SECURITY.md) |
| Inspect earlier source versions | [Preserved versions](versions/) |
| Review integration evidence | [Native runtime evidence](audit/integration-runtime-evidence.json) |

**Package registry versions and browser-store packages are separate publication
channels.** A GitHub source change does not silently update npm, PyPI, a browser
extension or a user's existing installation. Use the versioned release artifacts
and their checksums; inspect a registry's actual version before installing it.

## Why a fixed-operation broker?

A tool that returns a decrypted credential also gives that credential to its
caller. Placeholder syntax alone cannot keep it out of an agent's context.
EnigmAgent therefore separates two modes:

* **Agent mode:** the operator defines fixed GET/HEAD operations. The agent selects
  only an operation name. The broker attaches the credential to the configured
  destination and returns only `{operation, status, ok}`. Upstream response bodies
  and headers are discarded, including reflected or encoded credentials.
* **Explicit trusted-backend mode:** raw resolution requires deliberate opt-in.
  It is incompatible with the operation-broker transport and is not a
  model-isolating interface.

Default MCP mode exposes metadata only. REST always requires authentication.
The broker allows public IPv4 HTTPS destinations. Fixed 127.0.0.1 HTTP destinations
require explicit operator enablement. Redirects, user-selected URLs/headers and
private/reserved egress destinations are not accepted.

## Native integrations

| Framework | Factory key | Tested package | Version |
|---|---|---|---|
| LangChain | `langchain` | `langchain-core` | `1.6.3` |
| LangGraph | `langgraph` | `langgraph` | `1.2.11` |
| LlamaIndex | `llamaindex` | `llama-index-core` | `0.14.24` |
| CrewAI | `crewai` | `crewai` | `1.15.22` |
| Haystack | `haystack` | `haystack-ai` | `3.1.1` |
| Microsoft Agent Framework | `agent_framework` | `agent-framework-core` | `1.18.0` |
| smolagents | `smolagents` | `smolagents` | `1.26.0` |
| Agno | `agno` | `agno` | `3.0.10` |
| PydanticAI | `pydantic_ai` | `pydantic-ai-slim` | `2.44.0` |
| AutoGen Core | `autogen` | `autogen-core` | `0.7.5` |

These are **third-party compatibility integrations maintained in this repository**.
Each is executed against a synthetic encrypted vault and a real authenticated
local service. The tests check native results, available tracing/serialization
surfaces and rejection of unknown operations. They are not claims of upstream
endorsement, upstream merge, model quality or formal noninterference.

LangGraph includes checkpoint inspection. Haystack includes a serialized pipeline
round trip with an explicit trusted-module allowlist. PydanticAI executes a local
FunctionModel-driven agent loop; it does not call a paid model. MCP interoperability
is also checked with the independently installed official Python MCP client.

## Authenticated storage

New vaults use **Argon2id and AES-256-GCM**. Vault format v2 authenticates the complete
entry set together, including names, domains and values. The envelope header is
bound as associated data. Writes are revision-checked and atomically replace the
current file after a flushed temporary write. A failed write does not update the
session's committed in-memory state. Failed unlock attempts lock the old session.

Legacy format v1 is read-only until an explicit migration. Migration verifies all
entry ciphertexts and preserves the original file as a permanent `.v1-backup`, as
well as the rolling `.bak`. Legacy domain metadata was not authenticated by v1;
its historical correctness cannot be recovered cryptographically by migration.
Review old bindings and independently configure approved destinations.

A compromised broker process, administrator or operating system is outside this
boundary. Hostile generated code needs an independently permissioned broker
account/container; sharing an OS identity is not a sandbox. See the threat model
for backup, rollback, Windows permissions and resource-limit qualifications.

## Verify from source

Use Node.js 22 or newer. The full native integration matrix is tested with Python
3.12; the dependency-light client requires Python 3.10 or newer.

```sh
cd platforms/mcp-server
npm ci --ignore-scripts --no-audit --no-fund
npm test
node tests/verify-package.mjs
```

The integrated GitHub workflow additionally executes the Python integrations,
installs built packages in clean environments, and starts the actual Docker image.
Tagged release publication depends on those checks succeeding. No recurring
maintenance task or mass outreach is configured.

## Historical platform code

The browser extension, PWA, native GUI/IDE/mobile wrappers and older integration
prototypes remain available as historical source. They are **not certified by the
Node/Python v3 release tests**, and legacy v1 browser storage is not interchangeable
with the new v2 Node vault. Their original files are also retained in the complete
versioned source archives. [Platform status](platforms/README.md) distinguishes
validated components from historical material instead of advertising every folder
as a completed supported product.

## Contributing and citation

See [CONTRIBUTING.md](CONTRIBUTING.md), [CITATION.cff](CITATION.cff) and the
[integration plan](docs/GATEWAY_V2_INTEGRATION_PLAN.md). Contributions must solve a
real integration need and include reproducible evidence. Do not mass-post issues,
request artificial engagement or re-contact maintainers who declined a proposal.

MIT License. Copyright 2026 Francisco Angulo de Lafuente.
