# EnigmAgent

[![npm version](https://img.shields.io/npm/v/enigmagent-mcp?label=npm&color=cb3837)](https://www.npmjs.com/package/enigmagent-mcp)
[![npm downloads](https://img.shields.io/npm/dw/enigmagent-mcp?label=downloads)](https://www.npmjs.com/package/enigmagent-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Crypto](https://img.shields.io/badge/crypto-Argon2id%20%2B%20AES--256--GCM-green.svg)](docs/THREAT_MODEL.md)
[![Glama MCP](https://glama.ai/mcp/servers/Agnuxo1/enigmagent-mcp/badges/score.svg)](https://glama.ai/mcp/servers/Agnuxo1/enigmagent-mcp)
[![GitHub stars](https://img.shields.io/github/stars/Agnuxo1/EnigmAgent?style=social)](https://github.com/Agnuxo1/EnigmAgent)

**統合：** [![n8n-nodes-enigmagent](https://img.shields.io/npm/v/n8n-nodes-enigmagent?label=n8n%20node&color=ea4b71)](https://www.npmjs.com/package/n8n-nodes-enigmagent) · [![langchain-enigmagent](https://img.shields.io/pypi/v/langchain-enigmagent?label=langchain&color=1c3c3c)](https://pypi.org/project/langchain-enigmagent/) · [![llama-index-tools-enigmagent](https://img.shields.io/pypi/v/llama-index-tools-enigmagent?label=llamaindex&color=00d4aa)](https://pypi.org/project/llama-index-tools-enigmagent/) · [![crewai-tools-enigmagent](https://img.shields.io/pypi/v/crewai-tools-enigmagent?label=crewai&color=ff5a1f)](https://pypi.org/project/crewai-tools-enigmagent/) · [Claude Desktop](INTEGRATIONS.md#claude-desktop) · [Cursor](INTEGRATIONS.md#cursor) · [Continue.dev](INTEGRATIONS.md#continuedev) · [Cline](INTEGRATIONS.md#cline-vs-code) · [Open WebUI](INTEGRATIONS.md#open-webui) · [さらに →](INTEGRATIONS.md)

> **先週、Claude にプライベート GitHub リポジトリに修正をプッシュするよう依頼しました。そのためには、Claude が個人アクセストークンを必要としました。3 つの選択肢があり、すべてが最悪でした：トークンをチャットに貼り付ける（そしてプロバイダーのログに永遠に残る）、エージェントに午前 3 時に独自に再利用できる長期トークンを与える、または諦めて手動で行う。**

EnigmAgent は 4 番目の選択肢です。

AI エージェントが `{{GITHUB_TOKEN}}` と入力します。プレースホルダーはモデルを離れ、会話、ログ、コンテキストウィンドウを通過し — ツールが実際に資格情報を必要とする瞬間にのみ、EnigmAgent が呼び出しを傍受し、AES-256-GCM でローカルに実際のトークンを復号化して注入します。平文は 1 イベントループティックのみ存在します。モデルは決してそれを見ません。プロバイダーも決して見ません。ターミナルのスクロールバックも決して見ません。

```bash
npx enigmagent-mcp --vault ./my.vault.json
```

これが **Claude Desktop、Cursor、Continue.dev、Cline、Open WebUI、AnythingLLM、LM Studio** の完全なインストールです。別のブラウザ拡張機能が、タブ内で実行されるすべてをカバーします。

> ⭐ **後悔するトークンを貼り付けたことがあるなら、このリポジトリにスターをつけてください。**

---

## 30 秒 Claude Desktop セットアップ

`~/Library/Application Support/Claude/claude_desktop_config.json`（macOS）または `%APPDATA%\Claude\claude_desktop_config.json`（Windows）に追加：

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

Claude Desktop を再起動。2 つの新しいツールが表示されます：`enigmagent_resolve` と `enigmagent_list`。Claude に尋ねてください：

> *"ボルトエントリをリストし、Authorization ヘッダーに `{{GITHUB_TOKEN}}` を入れて GitHub API を呼び出してください。"*

実際のトークンが会話に入ることはありません。同じパターンが [Cursor](#cursor) と [Continue.dev](#continuedev) で機能します。

---

## 仕組み

AI エージェントが `{{GITHUB_TOKEN}}` と入力します。EnigmAgent がツール呼び出しを傍受し、ドメイン一致を確認し、実際のトークンを復号化し、要求を再発行します。平文の値はメモリに約 1 イベントループティックのみ存在します。クリップボードに書き込まれることも、ログに記録されることも、他のタブやスクリプトや LLM コンテキストに表示されることもありません。

---

## インストールパス

### MCP サーバー（AI エージェント推奨）

```bash
npx enigmagent-mcp --vault ./my.vault.json     # Claude/Cursor/等の MCP stdio
npx enigmagent-mcp --mode rest --port 3737     # カスタム統合のためのローカル REST API
```

### ブラウザ拡張機能（Web フォーム内の資格情報用）

**Chrome / Edge / Brave**

1. [最新リリース ZIP](https://github.com/Agnuxo1/EnigmAgent/releases) をダウンロードして解凍します。
2. `chrome://extensions` に移動し、**デベロッパーモード**を有効にします（右上トグル）。
3. **パッケージ化されていない拡張機能を読み込む**をクリックし、`extension/` フォルダを選択します。

---

## セキュリティモデル

| 層 | 実装 |
|---|---|
| パスワードからキーへの導出 | **Argon2id** (m=64 MiB, t=3, p=1) — `@noble/hashes@1.4.0` |
| シークレット暗号化 | **AES-256-GCM**、エントリごとに 96 ビット nonce |
| キー素材 | プロセスメモリのみに存在 — ディスクには決して書き込まれません |
| ドメイン強制 | すべてのシークレットがドメインに固定されます；一致しない場合は拒否 |

完全な脅威モデル：[docs/THREAT_MODEL.md](docs/THREAT_MODEL.md)

---

## ライセンス

MIT — [LICENSE](LICENSE) を参照。

## ビルド者

**[Francisco Angulo de Lafuente](https://github.com/Agnuxo1)** — 独立研究者および開発者。35 年以上のソフトウェア経験。[P2PCLAW](https://p2pclaw.com)（分散型科学ネットワーク）、[BenchClaw](https://github.com/Agnuxo1/BenchClaw)（エージェント評価）、[PaperClaw](https://www.npmjs.com/package/paperclaw)（自主研究出版）も構築しています。
