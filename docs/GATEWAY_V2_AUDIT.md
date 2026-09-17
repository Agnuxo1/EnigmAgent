# EnigmAgent gateway 2.0.0: scoped security and compatibility audit

Date: 2026-09-17. Owner repository: `Agnuxo1/EnigmAgent`.
Baseline: `21e26997219ecb2f3d27a492b4802d1b97a4f13d`.

## Scope and status

This milestone changes the bundled `platforms/mcp-server` gateway and adds its
trusted Node client, tests and migration documentation. It does **not** complete
an audit of every EnigmAgent platform or every repository owned by Agnuxo1.
No independent security certification or upstream endorsement is claimed.

Reviewed inputs include the original gateway, its package/registry metadata,
the copied Node vault core, shared core, Python client/tests, build-tool tests,
existing threat documentation, repository workflows and the root Dockerfile.
The 325-file historical source snapshot was archived and compared against Git.
Archiving all files is not the same as auditing every file.

## Reproduced baseline behavior

`audit/gateway-baseline-probe.mjs` was run against the original source with an
actual encrypted temporary vault containing a synthetic sentinel, not a user's
credential. The saved observations are in
`audit/gateway-baseline-2026-09-17.json`.

| Probe on original gateway | Observed result |
| --- | --- |
| `GET /list`, no bearer token | HTTP 200 |
| `POST /resolve`, no bearer token | HTTP 200, synthetic value disclosed |
| Request with untrusted Host header | HTTP 200 |
| Request with untrusted browser Origin header | HTTP 200 |
| Default MCP raw resolver call | Synthetic value returned as tool content |
| JSON `null` on MCP stdin | Process exited |

Acceptance of a browser Origin is a server-side observation, not proof of a
complete browser exfiltration exploit. The original process bound to loopback;
this audit does not assert it was directly reachable from the public Internet.

The original build-tool suite passed 35 tests. Several of those tests duplicate
logic rather than exercise the actual gateway, explaining the missing coverage.
Do not rerun the baseline probe against v2 and label the output an old-version
result. Restore the archived source in an isolated directory when reproducing it.

## Changes and acceptance criteria

| Change | Regression evidence |
| --- | --- |
| Bearer token required for all REST endpoints | Unauthenticated and incorrect-token requests denied before vault access |
| Raw resolution disabled by default | Tool absent; direct MCP calls denied; REST returns `raw_resolve_disabled` |
| Explicit raw mode for trusted clients | Authenticated opt-in resolves synthetic v1-vault data |
| Local Host validation and browser Origin rejection | Wrong Host, duplicate auth and browser-origin tests |
| Bounded incoming messages | Declared/chunked HTTP limits, body deadline, fragmented/oversized stdio tests |
| JSON-RPC input handling | `null`, arrays, invalid envelopes, malformed JSON and session tests |
| Notification behavior | No replies or resolver side effects from notifications |
| Error redaction | Synthetic secrets in exception messages are not returned |
| Ordered EOF handling | Real MCP subprocess drains requests and exits cleanly |
| Trusted Node client | Authentication, no redirect following, sanitized errors, private token fields |
| No-credential demonstration | Encrypted in-memory synthetic vault; no external requests or personal files |

The initial dedicated gateway unit suite contained 51 tests and was run on Linux
(Node 22.16.0) and Windows (Node 22.18.0). The Windows CLI suite adds actual
subprocess tests against v1 encrypted vault files. `npm test` is the authoritative
command for the final suite and its count. The final local Windows run passed
61 tests with no failures or skips; `audit/VALIDATION_SUMMARY.json` records it.
The built tarball was installed into a clean temporary directory and its CLI,
exports and encrypted-vault demonstration passed. npm audit reported zero known
advisories for the gateway production dependency snapshot; this is not a guarantee
that no vulnerabilities exist. CI defines Node 22 on Windows/Linux
and Node 24 on Linux; a workflow definition is not a claim that a run passed.
Read the actual check result associated with the release commit.

## Compatibility and distribution

This is a major gateway version because it intentionally breaks unauthenticated
REST, default plaintext tools, Node 18/20 support and interactive stdin prompts.
The encrypted vault file format and Argon2id/AES-GCM implementation remain v1.
The archived version is available under `versions/enigmagent-mcp-1.0.0/`.

The Node client included here is tested against the new REST interface. Existing
Python, IDE, workflow and independently published adapters are **not** silently
certified: many need authenticated-client migration and tests before use.

`server.json` is explicitly retained as a legacy npm 1.0.0 registry descriptor;
its misleading isolation claim was removed. Updating source does not publish a
new npm package or update an external MCP registry. Package verification checks
all runtime files and excludes the historical archive and audit/test sources.

The root Dockerfile currently installs `enigmagent-mcp@latest` from npm instead
of building this checkout. That distribution is a separate, unresolved release
gate. Do not attribute these source fixes to an existing Docker image. No
production service or personal MCP configuration was changed in this milestone.

A `[source-only]` merge-commit marker now suppresses only automatic Docker
publication. The dedicated gateway tests are not skipped. Manual Docker workflow
dispatch remains available to the maintainer. The marker separates a reviewed
source change from the unresolved npm-latest container distribution; it does not
claim to fix or publish that container.

## Remaining risks and next bounded milestones

1. **Vault persistence and integrity.** Design a versioned migration for
   authenticated entry metadata, strict file validation, atomic/restrictive
   writes, concurrent writers, corruption recovery and failed-unlock state.
   The current core was intentionally not changed without such a migration.
2. **Backend client migration.** Port authentication, loopback-only networking,
   no redirects/proxy leakage, deadlines and error sanitization to the Python
   SDK and each separate adapter. Test their published versions independently.
3. **Model-context isolation.** A trusted outbound execution broker would need
   destination allow-lists, redirect/DNS controls, narrowly scoped operations
   and tests for returned data and logging. A raw resolver, even authenticated,
   is not that broker. Do not market it as one.
4. **Other platforms.** Browser injection, desktop IPC, mobile storage and the
   separate Docker server need their own threat models and integration tests.
5. **Distribution.** Build artifacts from pinned source, verify provenance and
   smoke-test container networking before a new registry/image publication.

All clients holding the REST bearer token are trusted with the entire unlocked
vault. Host/Origin checks do not authenticate a caller's claimed destination.
No claim is made against compromised local processes, operating systems or
trusted recipients. Dropping JavaScript references is not secure memory erasure.

## Primary references

- MCP 2025-06-18 transport framing and security recommendations:
  https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
- GitHub conduct and non-spam restrictions:
  https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies
- Current contribution plan: `docs/GATEWAY_V2_INTEGRATION_PLAN.md`.
