# EnigmAgent integrated release 3.0.0

## Release contract

This release covers the Node vault, administrator, MCP/REST gateway, Node clients,
Python client and the ten native adapters listed below. It does not imply a new
browser-store, mobile-store, desktop binary, npm-registry or PyPI publication.
The tagged GitHub release provides the actual tested package/image artifacts.

The prior source trees are retained in `versions/enigmagent-mcp-1.0.0/` and
`versions/enigmagent-mcp-2.0.0/`. The latter preserves all 347 tracked files from
`8ffd91956517907eeb624e94eb229b01b9ed90ce`, including the earlier archive. Every
archived file was compared byte-for-byte with its original Git blob. Automatic
line-ending conversion was disabled for archive creation.

## Executable components

| Component | Source | Distribution |
|---|---|---|
| Gateway, broker, Node client and administrator | `platforms/mcp-server/` | `enigmagent-mcp-3.0.0.tgz` |
| Standalone administrator | `platforms/cli/` | `enigmagent-cli-3.0.0.tgz` |
| Shared vault implementation | `platforms/shared/` | `enigmagent-core-3.0.0.tgz` |
| Node library with TypeScript definitions | `platforms/npm-library/` | `enigmagent-vault-3.0.0.tgz` |
| Python client and native integrations | `platforms/python-sdk/` | Wheel and source distribution |
| Source-pinned, non-root container | Root `Dockerfile` | Tested Docker image archive |

Node packages include all their runtime files and licences; no import depends on
a neighboring development folder. The canonical vault code and its packaged
copies are compared exactly in the test suite. Package tests also inspect every
archived source file and run a fresh offline installation.

## Agent execution boundary

The operator configures an operation's name, URL, method, secret name, header and
optional fixed prefix. The caller supplies **only the operation name**. A
connection token grants access to the configured operation set; it is not a
per-user, per-operation or multi-tenant authorization system.

Allowed methods are GET and HEAD. There is no user-selected request body or
arbitrary command execution. The broker pins a validated DNS IPv4 address for the
request and retains ordinary HTTPS certificate validation. Responses contain only
an operation identifier, integer HTTP status and a derived success boolean.
Response bodies and headers are discarded. A malicious endpoint still controls
its status/timing; this is not a mathematical no-information-flow guarantee.

Broker mode cannot share a transport with `--allow-raw-resolve`. For untrusted
code-executing agents, run the broker with a separate operating-system identity
or container and do not expose its filesystem, master password, debugger, process
memory or Docker socket to the agent. The Python adapters read only connection
settings at invocation time, not the master password. Framework tracing settings
and host isolation remain operator responsibilities.

## Storage and migration

Format v2 encrypts and authenticates `{format, username, entries}` as one payload.
Associated data binds the version, KDF parameters and salt. It detects changes to
entry names/domains/order/removal when those changes alter the authenticated
payload. It does not detect replay of an entire previously valid vault without an
external trusted version anchor. Revision checks prevent lost updates between
cooperating active writers, not all filesystem attacks.

A v1 vault must have an authentication check or at least one authenticatable entry;
an empty v1 vault without a verifier is rejected. Every legacy entry is decrypted
and validated before a session opens. Unknown KDF parameters, malformed envelopes,
duplicate identifiers/names and excessive sizes fail closed. Legacy domain
metadata remains historically unauthenticated; review it before use.

The administrator provides `create`, `list`, `add`, `rename`, `domain`, `del`, `get`,
`export`, `import`, `migrate` and `recover`. It does not put secret values in command
arguments. `get` is fully redacted; `reveal` and `resolve` need an explicit
`--allow-raw-output`. `add --value-stdin` is opt-in and bounded. Interactive
password/value entry is hidden. The obsolete broad `run` command was removed.

`create`, `import` and `export` never overwrite an existing target. The first v1
migration writes the original bytes to `.v1-backup`; that permanent backup is not
replaced by later v2 edits. A different pre-existing backup blocks migration
rather than being overwritten. A rolling `.bak` also preserves the previous
committed file. Backups contain credential material and require the same access
controls as the main vault.

`recover` authenticates `.bak` before replacing the main file and retains damaged
original bytes in a uniquely named `.damaged-*` file. It is explicit, not an
automatic fallback. A process crash can leave a `.lock` directory: the code never
steals it based on a timer. Stop all writers and inspect the lock before an
administrator removes a confirmed stale lock. Partial failed backup creation also
requires operator inspection; the original vault is not overwritten on that
failure. Directory fsync is used on POSIX, not claimed on Windows. POSIX mode bits
do not configure Windows ACLs. Use a trusted local directory, not an untrusted or
unvalidated network filesystem.

## Resource limits and transport policy

Vault files are limited to 8 MiB, plaintext envelopes to 4 MiB, individual values to
64 KiB and entry counts to 4096. MCP requests and REST JSON bodies are limited to
16 KiB; gateway client responses to 8 MiB. The broker discards at most 1 MiB from a
destination response, limits concurrent operations to four and enforces deadlines.
HTTP header limits, method checks, host checks and browser-origin rejection apply
before vault access. REST requires a randomly generated 32-256-character URL-safe
token. Token syntax validation does not prove entropy; generate it randomly.

The default listener is loopback. `--bind 0.0.0.0` exists for an explicitly isolated
container deployment; the provided Compose configuration publishes only host
127.0.0.1:3737. Do not expose that mapping to a public interface. The default Docker
command is MCP stdio, not an automatically exposed network service.

## Framework compatibility

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

The factories live in `enigmagent.adapters`; their required native SDK is optional
until that factory is imported. The `all` extra pins the ten tested direct SDK
versions. Transitive dependency resolution may differ by operating system; CI
records the actual native versions and executes both Windows and Linux jobs.

The ten runtime tests each perform an authorized operation and a denied unknown
operation. They inspect native result/configuration/tracing surfaces as applicable.
The synthetic endpoint deliberately reflects a credential in its response so the
broker's discard policy is tested. LangGraph checkpoints, Haystack serialized
pipelines and a PydanticAI FunctionModel-driven local agent loop are included.
The official MCP Python client is tested independently against the stdio server.

These tests are compatibility/security regressions, not a comparative AI benchmark,
external penetration-test certification, upstream acceptance or proof that every
possible framework log/hook can never reveal data. A framework or host compromised
with access to the broker remains outside the tested trust boundary.

## Validation and distribution

`npm test` discovers the complete Node test suite rather than a hard-coded subset.
`tests/verify-package.mjs` checks the gateway manifest. `scripts/package-node.py`
builds all four Node archives, checks source equivalence and installs them in a
fresh environment. `scripts/verify-python-package.py` checks wheel source files
and performs a clean offline installation. `scripts/test-container.py` starts the
actual image with synthetic credentials and verifies authentication, default raw
denial, version, host-only port publishing and non-root image configuration.

The integrated CI workflow runs Node 22 on Windows/Linux and Node 24 on Linux,
Python native-framework jobs on Windows/Linux, standalone package tests and the
real Docker test. A version-tagged release can be published only after those jobs
succeed. Release assets have a source manifest and SHA-256 checksums. No package
registry or browser store is silently updated by this workflow.

## Historical surfaces not included in this release validation

Browser/PWA and native GUI, IDE, mobile wrappers remain separate historical
products. They were not validated by the v3 native-framework suite. In particular,
the old browser format is v1, renderer/DOM exposure differs from server-side
operation execution, and UI-process/IPC permissions need separate review. Do not
point an old wrapper at a new vault and infer compatibility from its folder name.
The old Docker-specific unprotected REST implementation has been removed from the
active entry point; Docker now uses the same gateway source as the tested package.
