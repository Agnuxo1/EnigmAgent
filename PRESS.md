# EnigmAgent — Press Kit

> Single-page reference for journalists, newsletter editors, podcast hosts, and integrators covering the EnigmAgent launch. Copy-paste friendly. Last updated: April 2026.

[![npm version](https://img.shields.io/npm/v/enigmagent-mcp.svg)](https://www.npmjs.com/package/enigmagent-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-active-brightgreen)](https://registry.modelcontextprotocol.io)
[![Glama Security](https://img.shields.io/badge/Glama%20Security-A-brightgreen)](https://glama.ai/mcp/servers/enigmagent)
[![Awesome MCP](https://img.shields.io/badge/awesome--mcp--servers-listed-blue)](https://github.com/punkpeye/awesome-mcp-servers)

---

## 1. One-line descriptions (ranked)

**12 words — elevator pitch**
EnigmAgent is a local encrypted vault that keeps API keys out of LLM prompts.

**25 words — tweet pitch**
EnigmAgent is a local-first MCP server that stores secrets in an AES-256-GCM vault and substitutes `{{TOKENS}}` at the boundary, so LLM agents never see raw keys.

**50 words — LinkedIn pitch**
EnigmAgent is an open-source MCP server (MIT) that solves the "lethal trifecta" of leaky LLM agents: it keeps every API key in an Argon2id-derived AES-256-GCM vault on the user's machine, and substitutes placeholder tokens like `{{OPENAI_KEY}}` only at the point a tool actually fires. Zero cloud. Zero telemetry.

**100 words — article opening**
A solo developer in Spain has shipped what may be the simplest answer yet to one of the most quietly-dangerous problems in agentic AI: every LLM client today reads your secrets in plaintext. EnigmAgent, released as an MCP server under MIT, replaces the usual `OPENAI_API_KEY=sk-…` pattern with `{{OPENAI_KEY}}` placeholders that resolve only at the boundary, after the model has emitted its tool call. The vault uses AES-256-GCM with per-entry nonces and an Argon2id-derived key. It runs locally, has zero dependencies beyond `@noble/hashes`, and installs in one command: `npx enigmagent-mcp`.

---

## 2. The numbers (factual, verifiable)

| Item | Value |
|---|---|
| Package | `enigmagent-mcp` v1.0.3 on npm |
| License | MIT |
| Runtime deps | 1 — `@noble/hashes` (zero transitive network code) |
| Install | `npx enigmagent-mcp` |
| Core LOC | ~250 (vault + resolver) |
| KDF | Argon2id, m=64 MiB, t=3 iterations, p=1 |
| Cipher | AES-256-GCM, 96-bit nonce per entry |
| Glama security score | **A** |
| Glama build verification | `019dc281` — status `success` |
| MCP Registry | v1.0.2 published, status `active` |
| Listings | `punkpeye/awesome-mcp-servers`, MCP Registry, Glama; ~30 awesome-list submissions in flight |
| Confirmed clients | Claude Desktop, Cursor, Continue.dev, Cline, Open WebUI, AnythingLLM, LM Studio, Zed, LibreChat, n8n (community node), LangChain (PyPI bridge) |
| Author | Francisco Angulo de Lafuente — solo dev, Spain |
| Cloud surface | None |
| Telemetry | None |

---

## 3. Founder quotes (first person, ~50 words each)

**a) Personal frustration**
> "I had three terminals open with three different `.env` files and I'd just pasted my OpenAI key into a Cursor chat by accident for the second time that week. EnigmAgent started as a one-evening rage fix. The vault came after I realised everyone else was doing the same thing." — Francisco Angulo de Lafuente

**b) Ecosystem hygiene (the lethal trifecta)**
> "Agents read tools, tools read prompts, prompts read keys. That is the lethal trifecta and the whole MCP ecosystem ships it as the default. EnigmAgent does one boring thing well: it cuts the chain at the boundary, so a compromised model or tool never sees a raw secret." — Francisco Angulo de Lafuente

**c) Larger work — OpenCLAW vision**
> "EnigmAgent is the smallest brick in OpenCLAW: a decentralised research stack where agents publish, validate and benchmark each other without a server. If we want a million autonomous agents to be safe to run, the floor has to be raised across every primitive — starting with secrets." — Francisco Angulo de Lafuente

---

## 4. Screenshot inventory

| Asset | Status | Location / notes |
|---|---|---|
| Repo README hero | exists | commit `a1deaf0` — `github.com/Agnuxo1/EnigmAgent` |
| Glama listing page | exists | `glama.ai/mcp/servers/enigmagent` |
| Chrome extension UI | exists | `platforms/store-listings/chrome/` |
| Demo GIF (token substitution live) | **needed** | 6–8 second screen recording: terminal showing a model emitting `{{OPENAI_KEY}}`, EnigmAgent resolver replacing it, response returning. Loop-friendly. |
| Architecture diagram | **needed** | Mermaid version below; SVG render to be exported for press use. |
| Logo / hero image | **needed** | Source material exists at `extension/icons/` (16/48/128 PNG). Suggested composition: the 128px shield icon centered on a dark-navy gradient with the wordmark "EnigmAgent" in a monospace face, tagline "vault for the agent age" beneath. 1600×900 hero, 1200×630 OG card, 512×512 square. |

---

## 5. The interviewer's question bank

Ten questions a journalist would actually ask, with prepared ~80-word answers.

**1. Why now?**
The MCP standard hit critical mass around the start of 2026. Suddenly every editor, every IDE, and every agent framework speaks the same protocol — and the same plaintext-`.env` pattern got copied everywhere with it. EnigmAgent had to ship before millions of agents were running with the wrong default. The right moment for security primitives is always the moment before the ecosystem hardens around the wrong defaults.

**2. Why solo?**
I have been building OpenCLAW alone for two years — a decentralised research network for AI agents. EnigmAgent fell out of that work as a tool I needed for myself. A solo developer can ship a 250-LOC primitive in a weekend; a team would have spent that weekend deciding on a logo. The plan has always been: ship the smallest useful thing, then let the community shape what comes next.

**3. What's the business model?**
There isn't one, and that is deliberate. EnigmAgent is MIT, runs locally, has no telemetry, and will never have a cloud component charging per seat. My day job is OpenCLAW, where the economic model is decentralised. EnigmAgent is infrastructure — the same way Argon2 is infrastructure. If someone builds an enterprise vault on top of it, good. The primitive stays free.

**4. What's the threat model in plain English?**
A modern coding agent reads your prompt, your repo, your environment, and your tools. If any of those leak — through a malicious MCP server, a prompt injection, a logged transcript, a screenshot — your API keys leak with them. EnigmAgent assumes the prompt is a public surface. Keys live in an encrypted vault and get spliced in only at the moment a tool actually executes. The model never sees them.

**5. What does this NOT solve?**
It does not stop a tool from misusing a key once the substitution has happened — if you authorise an agent to spend money, it can spend money. It does not protect you from a compromised local machine where the vault is unlocked. And it does not replace per-key scoping at the provider level. It is one layer of a defence-in-depth stack, not a magic shield.

**6. How is this different from a password manager?**
A password manager guards human access to credentials behind a UI. EnigmAgent guards machine access to credentials behind a protocol — MCP. It is designed for the moment a language model emits `{{OPENAI_KEY}}` inside a tool call and something needs to resolve that placeholder before the network request fires. Password managers do not speak that language. EnigmAgent does, and only that.

**7. Can a regular developer use this?**
`npx enigmagent-mcp`, set a passphrase, add the entries you want. Then in Claude Desktop, Cursor, Continue.dev, Cline, Open WebUI, AnythingLLM, LM Studio, Zed, LibreChat — any MCP-aware client — you replace `sk-…` with `{{OPENAI_KEY}}` in your config and you are done. There is no account, no dashboard, no signup. The whole onboarding is one command and a passphrase.

**8. What's the OpenCLAW connection?**
OpenCLAW / P2PCLAW is a decentralised research network where AI agents publish papers, validate each other's work, and run benchmarks without a central server. EnigmAgent, BenchClaw (eval harness), and PaperClaw (research network) are the three primitives that platform stands on. EnigmAgent is the secrets layer. If autonomous agents are going to do real science, they cannot do it with their keys printed on the side of every prompt.

**9. What's next on the roadmap?**
Three things: hardware-backed vaults (Secure Enclave on macOS, TPM on Windows/Linux), per-tool scoping so a vault entry can declare "this key is only resolvable by the github-mcp tool", and audit logging so users can see exactly which placeholder was resolved by which tool at which timestamp. None of these change the core 250-LOC primitive — they extend it.

**10. How can the AI security community help?**
Three asks. Audit the vault code — it is 250 lines, the surface is small, eyes are welcome. Stress-test the substitution boundary with prompt-injection attacks and report what breaks. And help me write the threat model document properly: I am a solo developer, not a credentialed cryptographer, and the difference between "looks secure" and "is secure" is exactly the kind of review I cannot do alone.

---

## 6. Press contact

- **Name:** Francisco Angulo de Lafuente
- **Email:** lareliquia.angulo@gmail.com
- **GitHub:** [Agnuxo1](https://github.com/Agnuxo1)
- **Project:** [github.com/Agnuxo1/EnigmAgent](https://github.com/Agnuxo1/EnigmAgent)
- **Location:** Spain (CET / CEST)
- **Response window:** typically within 24 hours, weekdays
- **Permission to quote:** all three founder quotes in section 3 are pre-approved for editorial use without further consent. New quotes available on request.

---

## 7. Architecture summary (mermaid)

```mermaid
flowchart LR
    User[User passphrase] -->|Argon2id m=64MiB t=3 p=1| Key[256-bit key]
    Key --> Vault[(AES-256-GCM vault\nlocal disk)]

    LLM[LLM / Agent] -->|tool_call with placeholders\n{{OPENAI_KEY}}| MCP[EnigmAgent MCP server]
    Vault -->|decrypt on demand| MCP
    MCP -->|substituted call\nsk-...real...| API[External API]
    API -->|response| MCP
    MCP -->|response only\nno secrets| LLM

    classDef secret fill:#1f2937,stroke:#f59e0b,color:#fff
    classDef boundary fill:#0f766e,stroke:#fff,color:#fff
    class Vault,Key secret
    class MCP boundary
```

The critical property: the dotted line between LLM and MCP carries placeholders only. The line between MCP and API carries real secrets. The two never cross.

---

## 8. Legal / boilerplate

- **License:** MIT — full text at [LICENSE](https://github.com/Agnuxo1/EnigmAgent/blob/main/LICENSE).
- **Trademark / brand usage:** the name "EnigmAgent" and the shield logo may be used freely for editorial coverage, reviews, talks, podcasts, newsletters, and listings. Please do not put the logo on physical merchandise for resale, or imply official endorsement of an unrelated product. Modified logos are fine for parody and commentary.
- **Privacy posture:** zero cloud. Zero telemetry. The package makes no outbound network calls of its own. The vault file lives on the user's disk; the project never sees it.
- **Disclosure:** solo developer, no funding, no investors, no commercial partnerships, no paid placements. The author is the sole maintainer and has not received compensation from any of the client projects EnigmAgent integrates with.

---

## 9. If you're doing X, here's what you need

- **AI security researchers** — start with the vault and resolver: `github.com/Agnuxo1/EnigmAgent` (~250 LOC, MIT). Threat model in `SECURITY.md`.
- **Newsletter editors (TLDR, Console.dev, AlphaSignal)** — the 25-word pitch in section 1, the npm badge, and the demo GIF when ready: `npmjs.com/package/enigmagent-mcp`.
- **Podcast hosts (Latent Space, Practical AI)** — Francisco is available for remote interviews in CET/CEST. Email above. Suggested angle: the lethal-trifecta framing (question 4) plus the OpenCLAW vision (question 8).
- **Indie developers** — one command, one passphrase, one config edit: `INTEGRATIONS.md` walks through all 10 supported clients.
- **Enterprise dev leads** — read `SECURITY.md` and `PRIVACY.md`. The roadmap entry on hardware-backed vaults (Secure Enclave / TPM) is the relevant next step for procurement-grade deployments.
- **Journalists** — this document. Quote any of section 3 directly. For new quotes or technical deep-dives, email Francisco.

---

*EnigmAgent — vault for the agent age. Local. Encrypted. MIT.*
