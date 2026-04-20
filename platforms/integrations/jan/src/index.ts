/**
 * EnigmAgent Extension for Jan.ai
 * =================================
 * Intercepts outgoing messages and resolves {{PLACEHOLDER}} tokens
 * using the local EnigmAgent vault before they reach the LLM engine.
 *
 * Requirements:
 *   - Jan.ai 0.4+
 *   - enigmagent serve --port 39517 (vault must be running)
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
const VAULT_TOKEN_KEY = "enigmagent.vaultToken";

const _cache = new Map<string, string>();

export default class EnigmAgentExtension extends AssistantExtension {
  private vaultUrl = "http://127.0.0.1:39517";
  private vaultToken = "";

  async onLoad() {
    const config = await this.getConfiguration?.();
    this.vaultUrl = (config?.[VAULT_URL_KEY] as string) || "http://127.0.0.1:39517";
    this.vaultToken = (config?.[VAULT_TOKEN_KEY] as string) || "";

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
    const names = [...new Set(text.match(/\{\{([A-Za-z0-9_]+)\}\}/g)?.map((m) => m.slice(2, -2)) ?? [])];
    if (!names.length) return text;

    const pairs = await Promise.all(names.map(async (n) => [n, await this.fetchSecret(n)] as const));
    const map = Object.fromEntries(pairs.filter(([, v]) => v !== null)) as Record<string, string>;

    return text.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_, n) => map[n] ?? `{{${n}}}`);
  }

  private async fetchSecret(name: string): Promise<string | null> {
    if (_cache.has(name)) return _cache.get(name)!;

    const url = `${this.vaultUrl.replace(/\/$/, "")}/secret/${encodeURIComponent(name)}`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.vaultToken) headers["Authorization"] = `Bearer ${this.vaultToken}`;

    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(3000) });
      if (!res.ok) return null;
      const data = await res.json();
      const value = data?.value ?? null;
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
        description: "Base URL of the EnigmAgent REST API.",
        type: "string",
        default: "http://127.0.0.1:39517",
      },
      {
        key: VAULT_TOKEN_KEY,
        title: "Vault Token",
        description: "Bearer token (optional — leave empty for localhost).",
        type: "string",
        default: "",
        inputType: "password",
      },
    ];
  }
}
