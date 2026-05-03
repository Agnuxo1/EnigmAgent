# EnigmAgent

[![npm version](https://img.shields.io/npm/v/enigmagent-mcp?label=npm&color=cb3837)](https://www.npmjs.com/package/enigmagent-mcp)
[![npm downloads](https://img.shields.io/npm/dw/enigmagent-mcp?label=downloads)](https://www.npmjs.com/package/enigmagent-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Crypto](https://img.shields.io/badge/crypto-Argon2id%20%2B%20AES--256--GCM-green.svg)](docs/THREAT_MODEL.md)
[![Glama MCP](https://glama.ai/mcp/servers/Agnuxo1/enigmagent-mcp/badges/score.svg)](https://glama.ai/mcp/servers/Agnuxo1/enigmagent-mcp)
[![GitHub stars](https://img.shields.io/github/stars/Agnuxo1/EnigmAgent?style=social)](https://github.com/Agnuxo1/EnigmAgent)

**集成：** [![n8n-nodes-enigmagent](https://img.shields.io/npm/v/n8n-nodes-enigmagent?label=n8n%20node&color=ea4b71)](https://www.npmjs.com/package/n8n-nodes-enigmagent) · [![langchain-enigmagent](https://img.shields.io/pypi/v/langchain-enigmagent?label=langchain&color=1c3c3c)](https://pypi.org/project/langchain-enigmagent/) · [![llama-index-tools-enigmagent](https://img.shields.io/pypi/v/llama-index-tools-enigmagent?label=llamaindex&color=00d4aa)](https://pypi.org/project/llama-index-tools-enigmagent/) · [![crewai-tools-enigmagent](https://img.shields.io/pypi/v/crewai-tools-enigmagent?label=crewai&color=ff5a1f)](https://pypi.org/project/crewai-tools-enigmagent/) · [Claude Desktop](INTEGRATIONS.md#claude-desktop) · [Cursor](INTEGRATIONS.md#cursor) · [Continue.dev](INTEGRATIONS.md#continuedev) · [Cline](INTEGRATIONS.md#cline-vs-code) · [Open WebUI](INTEGRATIONS.md#open-webui) · [更多 →](INTEGRATIONS.md)

> **上周我让 Claude 向私有 GitHub 仓库推送修复。为此，Claude 需要我的个人访问令牌。我有三个选项，都很糟糕：将令牌粘贴到聊天中（并永远留在提供商日志中），给代理一个可在凌晨 3 点自行重复使用的长期令牌，或者放弃并手动操作。**

EnigmAgent 是第四个选项。

您的 AI 代理输入 `{{GITHUB_TOKEN}}`。占位符离开模型，穿过对话、日志、上下文窗口——只有在您的工具实际需要凭证的那一刻，EnigmAgent 才会拦截调用，使用 AES-256-GCM 在本地解密真实令牌并注入。明文仅存在一个事件循环周期。模型永远看不到它。提供商永远看不到它。您的终端回滚永远看不到它。

```bash
npx enigmagent-mcp --vault ./my.vault.json
```

这就是 **Claude Desktop、Cursor、Continue.dev、Cline、Open WebUI、AnythingLLM 和 LM Studio** 的全部安装。单独的浏览器扩展覆盖所有在标签页中运行的内容。

> ⭐ **如果您曾经粘贴过令后悔的令牌，请收藏此仓库。**

---

## 30 秒 Claude Desktop 设置

添加到 `~/Library/Application Support/Claude/claude_desktop_config.json`（macOS）或 `%APPDATA%\Claude\claude_desktop_config.json`（Windows）：

```json
{
  "mcpServers": {
    "enigmagent": {
      "command": "npx",
      "args": ["-y", "enigmagent-mcp", "--vault", "/absolute/path/to/my.vault.json"]
    }
  }
}
```

重启 Claude Desktop。出现两个新工具：`enigmagent_resolve` 和 `enigmagent_list`。现在问 Claude：

> *"列出我的保险库条目，然后使用 Authorization 标头中的 `{{GITHUB_TOKEN}}` 调用我的 GitHub API。"*

真实令牌永远不会进入对话。相同模式适用于 [Cursor](#cursor) 和 [Continue.dev](#continuedev)。

---

## 工作原理

您的 AI 代理输入 `{{GITHUB_TOKEN}}`。EnigmAgent 拦截工具调用，检查域匹配，解密真实令牌，重新发出请求。明文值在内存中仅存在约一个事件循环周期。它永远不会被写入剪贴板、永远不会被记录、永远不会被任何其他标签页、脚本或 LLM 上下文看到。

---

## 安装路径

### MCP 服务器（AI 代理推荐）

```bash
npx enigmagent-mcp --vault ./my.vault.json     # MCP stdio 用于 Claude/Cursor/等。
npx enigmagent-mcp --mode rest --port 3737     # 用于自定义集成的本地 REST API
```

### 浏览器扩展（用于网页表单中的凭证）

**Chrome / Edge / Brave**

1. 下载 [最新发布 ZIP](https://github.com/Agnuxo1/EnigmAgent/releases) 并解压。
2. 转到 `chrome://extensions` 并启用**开发者模式**（右上角切换）。
3. 点击**加载已解压**并选择 `extension/` 文件夹。

---

## 安全模型

| 层 | 实现 |
|---|---|
| 密码到密钥派生 | **Argon2id** (m=64 MiB, t=3, p=1) — `@noble/hashes@1.4.0` |
| 秘密加密 | **AES-256-GCM**，每个条目 96 位 nonce |
| 密钥材料 | 仅存在于进程内存中 — 永远不会写入磁盘 |
| 域强制 | 每个秘密固定到一个域；解析器拒绝不匹配的源 |
| 交付到站点 | 原生 `value` setter + `input`/`change` 事件 — 从不使用剪贴板 |

完整威胁模型：[docs/THREAT_MODEL.md](docs/THREAT_MODEL.md)

---

## 许可证

MIT — 参见 [LICENSE](LICENSE)。

## 构建者

**[Francisco Angulo de Lafuente](https://github.com/Agnuxo1)** — 独立研究员和开发者。35 年以上的软件经验。还构建 [P2PCLAW](https://p2pclaw.com)（去中心化科学网络）、[BenchClaw](https://github.com/Agnuxo1/BenchClaw)（代理评估）和 [PaperClaw](https://www.npmjs.com/package/paperclaw)（自主研究发布）。
