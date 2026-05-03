# EnigmAgent

[![npm version](https://img.shields.io/npm/v/enigmagent-mcp?label=npm&color=cb3837)](https://www.npmjs.com/package/enigmagent-mcp)
[![npm downloads](https://img.shields.io/npm/dw/enigmagent-mcp?label=downloads)](https://www.npmjs.com/package/enigmagent-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Crypto](https://img.shields.io/badge/crypto-Argon2id%20%2B%20AES--256--GCM-green.svg)](docs/THREAT_MODEL.md)
[![Glama MCP](https://glama.ai/mcp/servers/Agnuxo1/enigmagent-mcp/badges/score.svg)](https://glama.ai/mcp/servers/Agnuxo1/enigmagent-mcp)
[![GitHub stars](https://img.shields.io/github/stars/Agnuxo1/EnigmAgent?style=social)](https://github.com/Agnuxo1/EnigmAgent)

**Интеграции:** [![n8n-nodes-enigmagent](https://img.shields.io/npm/v/n8n-nodes-enigmagent?label=n8n%20node&color=ea4b71)](https://www.npmjs.com/package/n8n-nodes-enigmagent) · [![langchain-enigmagent](https://img.shields.io/pypi/v/langchain-enigmagent?label=langchain&color=1c3c3c)](https://pypi.org/project/langchain-enigmagent/) · [![llama-index-tools-enigmagent](https://img.shields.io/pypi/v/llama-index-tools-enigmagent?label=llamaindex&color=00d4aa)](https://pypi.org/project/llama-index-tools-enigmagent/) · [![crewai-tools-enigmagent](https://img.shields.io/pypi/v/crewai-tools-enigmagent?label=crewai&color=ff5a1f)](https://pypi.org/project/crewai-tools-enigmagent/) · [Claude Desktop](INTEGRATIONS.md#claude-desktop) · [Cursor](INTEGRATIONS.md#cursor) · [Continue.dev](INTEGRATIONS.md#continuedev) · [Cline](INTEGRATIONS.md#cline-vs-code) · [Open WebUI](INTEGRATIONS.md#open-webui) · [ещё →](INTEGRATIONS.md)

> **На прошлой неделе я попросил Claude отправить исправление в приватный репозиторий GitHub. Для этого Claude нужен был мой персональный токен доступа. У меня было три варианта, и все были ужасны: вставить токен в чат (и навсегда оставить в логах провайдера), дать агенту долгосрочный токен, которым он может самостоятельно пользоваться в 3 часа ночи, или сдаться и сделать всё вручную.**

EnigmAgent — это четвёртый вариант.

Ваш ИИ-агент вводит `{{GITHUB_TOKEN}}`. Заполнитель покидает модель, проходит через разговор, логи, контекстное окно — и только в момент, когда вашему инструменту действительно нужны учётные данные, EnigmAgent перехватывает вызов, расшифровывает реальный токен локально с помощью AES-256-GCM и внедряет его. Открытый текст существует один тик цикла событий. Модель его никогда не видит. Провайдер его никогда не видит. Ваш терминал scrollback его никогда не видит.

```bash
npx enigmagent-mcp --vault ./my.vault.json
```

Это вся установка для **Claude Desktop, Cursor, Continue.dev, Cline, Open WebUI, AnythingLLM и LM Studio.** Отдельное браузерное расширение охватывает всё, что работает во вкладке.

> ⭐ **Поставьте звезду этому репозиторию, если вы когда-либо вставляли токен, о котором пожалели.**

---

## 30-секундная настройка Claude Desktop

Добавьте в `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) или `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

Перезапустите Claude Desktop. Появятся два новых инструмента: `enigmagent_resolve` и `enigmagent_list`. Теперь спросите Claude:

> *"Перечисли записи моего хранилища, затем вызови мой GitHub API с `{{GITHUB_TOKEN}}` в заголовке Authorization."*

Реальный токен никогда не попадает в разговор. Тот же паттерн работает для [Cursor](#cursor) и [Continue.dev](#continuedev).

---

## Как это работает

Ваш ИИ-агент вводит `{{GITHUB_TOKEN}}`. EnigmAgent перехватывает вызов инструмента, проверяет совпадение домена, расшифровывает реальный токен и перевыдаёт запрос. Значение открытого текста существует в памяти примерно один тик цикла событий. Оно никогда не записывается в буфер обмена, никогда не логируется и никогда не видно другой вкладке, скрипту или контексту LLM.

---

## Пути установки

### MCP сервер (рекомендуется для ИИ-агентов)

```bash
npx enigmagent-mcp --vault ./my.vault.json     # MCP stdio для Claude/Cursor/др.
npx enigmagent-mcp --mode rest --port 3737     # локальный REST API для пользовательских интеграций
```

### Браузерное расширение (для учётных данных внутри веб-форм)

**Chrome / Edge / Brave**

1. Скачайте [последний ZIP-релиз](https://github.com/Agnuxo1/EnigmAgent/releases) и распакуйте.
2. Перейдите в `chrome://extensions` и включите **Режим разработчика** (переключатель в правом верхнем углу).
3. Нажмите **Загрузить распакованное** и выберите папку `extension/`.

---

## Модель безопасности

| Уровень | Реализация |
|---|---|
| Деривация ключа из пароля | **Argon2id** (m=64 MiB, t=3, p=1) — `@noble/hashes@1.4.0` |
| Шифрование секретов | **AES-256-GCM**, 96-битный nonce на запись |
| Ключевой материал | Существует только в памяти процесса — никогда не записывается на диск |
| Принудительное привязка домена | Каждый секрет прикреплён к домену; резолвер отказывает при несовпадении |

Полная модель угроз: [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md)

---

## Лицензия

MIT — см. [LICENSE](LICENSE).

## Создатель

**[Francisco Angulo de Lafuente](https://github.com/Agnuxo1)** — независимый исследователь и разработчик. 35+ лет в программном обеспечении. Также создаёт [P2PCLAW](https://p2pclaw.com) (децентрализованная научная сеть), [BenchClaw](https://github.com/Agnuxo1/BenchClaw) (оценка агентов) и [PaperClaw](https://www.npmjs.com/package/paperclaw) (автономное научное издательство).
