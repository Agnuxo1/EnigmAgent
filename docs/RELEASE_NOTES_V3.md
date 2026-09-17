# EnigmAgent 3.0.0

An integrated Node/Python credential-vault and fixed-operation broker release.

## Included

- Authenticated format-v2 envelopes covering the complete entry set and metadata.
- Explicit v1 migration, permanent original backup, rolling recovery backup,
  optimistic writer conflicts, atomic current-file replacement and failed-unlock locking.
- A bounded authenticated REST gateway and MCP stdio server with raw output disabled
  by default. Broker mode and raw-resolution mode cannot coexist.
- Operator-approved fixed GET/HEAD operations, validated/pinned IPv4 destinations,
  redirect refusal and status-only outputs that discard upstream bodies/headers.
- An administrator that does not accept secret values in command arguments;
  explicit encrypted import/export and recovery without implicit overwrite.
- Standalone Node packages with source equivalence and clean installation checks.
- An authenticated Python client and ten native execution-tested framework factories:
  LangChain, LangGraph, LlamaIndex, CrewAI, Haystack, Microsoft Agent Framework,
  smolagents, Agno, PydanticAI and AutoGen Core.
- Official MCP-client interoperability and a source-pinned non-root Docker image.

## Breaking changes and boundaries

Node.js 22+ is required. The full native Python matrix is tested on Python 3.12.
Legacy v1 vaults are read-only until explicit migration. Their old unauthenticated
metadata cannot be retroactively proven correct. The browser/PWA/native GUI and
IDE/mobile prototypes are not included in this Node/Python release certification.
Raw resolution is an explicit trusted-backend escape hatch, not a model-facing tool.
The broker needs an independently permissioned OS/container boundary for hostile
code-executing agents. Whole-file rollback, OS compromise and perfect memory erasure
are not solved by this release.

## Distribution and verification

This tagged release is gated on Node Windows/Linux, native Python Windows/Linux,
clean distribution installation and actual Docker runtime checks. Assets include
four Node archives, the Python wheel/source archive, the tested container image,
synthetic runtime evidence, SHA-256 checksums and a source-commit manifest.

No npm/PyPI registry, browser store or user's existing installation is silently
updated by this workflow. Native adapters are third-party compatibility code, not
claims of acceptance or endorsement by their upstream maintainers.
