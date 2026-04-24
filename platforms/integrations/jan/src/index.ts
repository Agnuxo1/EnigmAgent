/**
 * EnigmAgent Extension for Jan.ai
 * =================================
 * Intercepts outgoing messages and resolves {{PLACEHOLDER}} tokens
 * using the local EnigmAgent vault before they reach the LLM engine.
 *
 * REST API (enigmagent-mcp --mode rest --port 3737 --vault ./vault.json):
 *   GET  /status
 *   GET  /list
 *   POST /resolve  {"placeholder": "NAME", "origin": "https://..."}
 *
 * Install:
 *   npm run package
 *   → drop the .tgz into Jan > Settings > Extensions > Install from file
 */

import {
  AssistantExtension,
  MessageRequest,
  MessageRequestType,
  events,
  EventName,
  AppConfiguration,
} from "@janhq/core";

const EXTENSION_ID = "enigmagent";
const VAULT_URL_KEY = "enigmagent.vaultUrl";
const VAULT_ORIGIN_KEY = "enigmagent.origin";

const _cache = new Map<string, string>();

export default class EnigmAgentExtension extends AssistantExtension {
  private vaultUrl = "http://127.0.0.1:3737";
  private origin = "http://localhost";

  async onLoad() {
    const config = await this.getConfiguration?.();
    this.vaultUrl = (config?.[VAULT_URL_KEY] as string) || "http://127.0.0.1:3737";
    this.origin = (config?.[VAULT_ORIGIN_KEY] as string) || "http://localhost";

    // Hook into message sending
    events.on(EventName.OnMessageSent, this.onMessageSent.bind(this));
    console.log(`[EnigmAgent] Extension loaded. Vault: ${this.vaultUrl}`);
  }

  async onUnload() {
    events.off(EventName.OnMessageSent, this.onMessageSent.bind(this));
    _cache.clear();
  }

  private async onMessageSent(request: MessageRequest) {
    if (request.type !== MessageRequestType.Chat) return;
    const msgs = request.messages;
    if (!msgs?.length) return;

    for (const msg of msgs) {
      if (typeof msg.content === "string") {
        msg.content = await this.resolve(msg.content);
      }
    }
  }

  private async resolve(text: string): Promise<string> {
    const names = [
      ...new Set(
        text.match(/\{\{([A-Za-z0-9_]+)\}\}/g)?.map((m) => m.slice(2, -2)) ?? []
      ),
    ];
    if (!names.length) return text;

    const pairs = await Promise.all(
      names.map(async (n) => [n, await this.fetchSecret(n)] as const)
    );
    const map = Object.fromEntries(
      pairs.filter(([, v]) => v !== null)
    ) as Record<string, string>;

    return text.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_, n) => map[n] ?? `{{${n}}}`);
  }

  /** Resolve via POST /resolve (the actual EnigmAgent REST API endpoint). */
  private async fetchSecret(name: string): Promise<string | null> {
    if (_cache.has(name)) return _cache.get(name)!;

    const url = `${this.vaultUrl.replace(/\/$/, "")}/resolve`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeholder: name, origin: this.origin }),
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const value: string | null = data?.value ?? null;
      if (value) _cache.set(name, value);
      return value;
    } catch {
      return null;
    }
  }

  // Settings schema shown in Jan's extension configuration panel
  getSettingsSchema() {
    return [
      {
        key: VAULT_URL_KEY,
        title: "Vault URL",
        description:
          "Base URL of the EnigmAgent REST API (start with: enigmagent-mcp --mode rest --port 3737 --vault ./vault.json).",
        type: "string",
        default: "http://127.0.0.1:3737",
      },
      {
        key: VAULT_ORIGIN_KEY,
        title: "Origin",
        description:
          "Origin URL sent for domain-binding validation. Must match the secret's configured domain.",
        type: "string",
        default: "http://localhost",
      },
    ];
  }
}
