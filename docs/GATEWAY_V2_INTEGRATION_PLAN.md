# EnigmAgent gateway v2: ten-target integration and visibility plan

Research date: 2026-09-17. Status: **qualified candidates, not ten completed integrations**.
The repositories and license identifiers were rechecked through GitHub's public
API; the snapshot is `audit/integration-target-metadata.json`. Upstream README
pages were also reviewed for functional fit. License metadata is not a full legal
review or permission to submit promotional content.

## Contribution objective

Earn discoverability by shipping useful, reproducible integration artifacts in
our own repository. The tested v2 Node client and no-credential demo are current
artifacts. Most framework integrations below require additional implementation
and validation. Existing adapter files are not evidence that upstream projects
adopted, reviewed or support EnigmAgent.

| Priority | Target / primary source | Concrete contribution | Acceptance gate | Current status |
| --- | --- | --- | --- | --- |
| 1 | [Continue](https://github.com/continuedev/continue) | Metadata-only MCP stdio profile and local source installation guide. | Initialize with a pinned client version; verify only the metadata tool is offered and a direct raw call fails. | Owned example first; no upstream contact yet. |
| 2 | [Cline](https://github.com/cline/cline) | Metadata-only MCP configuration with explicit user-controlled tool access. | Record an actual Cline session with synthetic data; verify no raw value appears in tool output or logs. | Owned example first; no adoption claimed. |
| 3 | [LangChain](https://github.com/langchain-ai/langchain) | Authenticated backend credential client, outside model-visible tool return values. | Migrate the Python transport, pin the framework version, and check callbacks/messages for a synthetic sentinel. | Existing adapter needs v2 migration, not automatic certification. |
| 4 | [LangGraph](https://github.com/langchain-ai/langgraph) | Credential acquisition in trusted execution code, not graph state. | Inspect checkpoints, replay, interrupts and tracing; no raw secret in persisted state or model messages. | Prototype only after backend-client migration. |
| 5 | [LlamaIndex](https://github.com/run-llama/llama_index) | Credential-provider integration at connector execution, not query-engine output. | Mock an authenticated connector request; inspect serialized components, events and query results. | No unsupported claim that the old published tool is safe. |
| 6 | [CrewAI](https://github.com/crewAIInc/crewAI) | Trusted tool implementation that uses a credential without returning it to an agent. | Test task output, verbose logs and error paths against synthetic secrets and rejected destinations. | Own adapter and reproducible test before proposal. |
| 7 | [Haystack](https://github.com/deepset-ai/haystack) | Backend component authentication without putting secrets in pipeline outputs. | Test component serialization, pipeline tracing, retries and failure reporting with a sentinel. | Keep Apache notices and inspect exact contribution rules. |
| 8 | [Microsoft Agent Framework](https://github.com/microsoft/agent-framework) | A Python/.NET backend credential middleware sample. | Pin current APIs; verify middleware exceptions, OpenTelemetry and workflow checkpoints contain no secret. | Use current Agent Framework guidance; legacy SK adapters are separate. |
| 9 | [smolagents](https://github.com/huggingface/smolagents) | Separate trusted execution boundary for credential-dependent operations. | Do not expose resolver or token to generated code; test process separation and deny arbitrary destinations. | Design gate: same-process code execution is not secret isolation. |
| 10 | [Agno](https://github.com/agno-agi/agno) | Trusted provider/tool configuration that resolves credentials outside session data. | Test session persistence, tool results, team execution and logging with synthetic data only. | Candidate, not an implemented or upstream-approved integration. |

## Release and visibility sequence

**First: reproducibility.** Keep the README entry point short, link the actual
scope and threat boundaries, run the no-credential demonstration, retain the
old source, and show the CI result for the exact proposed commit. Do not claim a
speedup, full security audit, protected model context or an upstream partnership
without supporting evidence.

**Second: one real adapter at a time.** Record the upstream commit/release tested,
installation command, runtime, synthetic fixture, expected output, limitations,
and license/NOTICE obligations. Tests must inspect logs, persisted state and
model-visible messages as well as the network request. Check in the artifact
only after its validation passes. Raw resolver output must not be offered to
an untrusted model or generated code.

**Third: upstream fit.** Before opening any issue or PR, inspect the target's
current CONTRIBUTING guidance, contribution/AI-use policy, existing discussions,
closed requests, duplicates and our private no-contact register. Follow its
preferred extension mechanism. Honor requests to keep integrations in our own
repository. A past decline overrides this table. Do not sign a CLA or change
license/rights commitments based merely on this candidate list.

**Fourth: a focused submission only when appropriate.** Prefer a tested bug fix,
accepted extension point, requested integration or documented registry process.
Use one concise, project-specific contribution rather than ten introductory
issues. Disclose affiliation and AI assistance where required. If declined, stop:
no repeated pitches, bumps, mass comments, artificial stars or alternative-account
contact. This milestone sends no external outreach.

## Success measures

Count independently reproducible installations, resolved user problems, tests,
usable adapters, accepted contributions and maintainer-requested follow-ups.
Track invitations, submitted PRs and merged PRs separately. Ten researched targets
is not ten connections, partnerships or adoptions. A star count is not a security
or scientific-quality certificate.

## Documentation and attribution controls

Preserve the project's MIT license and third-party notices. For every shipped
adapter, inspect the exact upstream LICENSE/NOTICE at the tested revision and
keep original attribution. Keep private contact history and personal credentials
out of public issues and source archives. Prefer package-native integrations to
unnecessary edits of an upstream core. Publish only claims demonstrated by code,
tests or a verified upstream decision.
