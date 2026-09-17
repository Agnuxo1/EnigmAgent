# Integration delivery and ethical visibility

The previous v2 candidate plan is preserved in the complete v2 source archive.
Version 3 implements ten native framework integrations inside the maintained Python
SDK, rather than opening ten promotional issues or ten unmaintained repositories.
The actual direct dependency versions and runtime results are recorded in
`audit/integration-runtime-evidence.json`.

The delivered projects are LangChain, LangGraph, LlamaIndex, CrewAI, Haystack,
Microsoft Agent Framework, smolagents, Agno, PydanticAI and AutoGen Core. Each native
interface is invoked against a real synthetic encrypted broker, including denial
of an unknown operation. LangGraph state, Haystack serialization and a PydanticAI
agent loop receive dedicated checks. The adapters are technically functional
third-party integrations; no upstream adoption is claimed.

Continue and Cline remain prospective MCP GUI integrations from the old plan. A
successful official MCP-client protocol test is not a substitute for executing
those GUI clients. They are not included in the count of ten validated native
integrations. PydanticAI and AutoGen Core were selected instead because their
native execution paths can be verified reproducibly without a paid model or a
GUI/session claim.

## Contribution routes

| Project | Delivered path | Appropriate visibility/contribution artifact |
|---|---|---|
| LangChain | Native StructuredTool with sync/async execution | Maintained third-party integration example and tested package |
| LangGraph | Compiled graph with checkpoint inspection | Minimal status-only checkpoint example |
| LlamaIndex | Native FunctionTool | Tool example with safe outputs and actual compatibility evidence |
| CrewAI | Native tool execution | Separate optional toolkit example, not a raw-secret agent tool |
| Haystack | Serializable native component and restored pipeline | Component documentation using an explicit trusted-module allowlist |
| Microsoft Agent Framework | Native function-tool execution | Reproducible function-tool example and pinned-version test |
| smolagents | Native Tool | Broker-isolated operation example with explicit OS-boundary limitations |
| Agno | Native Function/FunctionCall | Optional toolkit example with runtime-only connection settings |
| PydanticAI | Native Tool and local FunctionModel agent loop | Dependency-light tested tool example without remote model costs |
| AutoGen Core | Native FunctionTool | Typed operation tool with cancellation-compatible native invocation |

The release README, executable tests, package/image manifests and public evidence
provide immediate discoverability in our own repository. Before any upstream
submission, inspect the target's current contribution rules, exact licence and
existing threads; confirm scope and eligibility. Submit one focused contribution
only where allowed or requested. Do not sign a new CLA/rights agreement, pay a
listing fee, re-contact a declined maintainer or claim endorsement automatically.
Private no-contact records remain outside this public repository.

No external promotional issue/comment was posted as part of this implementation.
A future upstream acceptance must be recorded by its actual PR/merge evidence, not
inferred from this compatibility matrix.
