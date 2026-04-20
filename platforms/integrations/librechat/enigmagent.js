/**
 * EnigmAgent Custom Tool for LibreChat
 * ======================================
 * Exposes the local EnigmAgent vault as a function tool that LLMs can call
 * to retrieve secrets by name.
 *
 * Install:
 *   1. Place this file in api/app/clients/tools/structured/EnigmAgent.js
 *   2. Register it in api/app/clients/tools/index.js (see README)
 *   3. Make sure enigmagent serve --port 39517 is running.
 *
 * Usage:
 *   The LLM can call `enigmagent_get_secret` with { "name": "OPENAI_KEY" }
 *   to receive the vault value. Combine with domain-binding for extra safety.
 */

const { StructuredTool } = require("langchain/tools");
const { z } = require("zod");

class EnigmAgentGetSecret extends StructuredTool {
  constructor(fields = {}) {
    super(fields);
    this.name = "enigmagent_get_secret";
    this.description =
      "Retrieve a secret value from the local EnigmAgent AES-256-GCM encrypted vault. " +
      "Use this to get API keys, tokens, or passwords stored in the vault. " +
      "Input: the secret name. Output: the secret value.";
    this.schema = z.object({
      name: z.string().describe("The secret name as stored in the EnigmAgent vault (e.g. OPENAI_KEY)."),
    });
    this.vaultUrl = (fields.vaultUrl || process.env.ENIGMAGENT_URL || "http://127.0.0.1:39517").replace(/\/$/, "");
    this.vaultToken = fields.vaultToken || process.env.ENIGMAGENT_TOKEN || "";
  }

  async _call({ name }) {
    const url = `${this.vaultUrl}/secret/${encodeURIComponent(name)}`;
    const headers = { Accept: "application/json" };
    if (this.vaultToken) headers["Authorization"] = `Bearer ${this.vaultToken}`;

    const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      return `Error: secret "${name}" not found (vault returned ${res.status}).`;
    }
    const data = await res.json();
    return data?.value ?? `Error: secret "${name}" has no value.`;
  }
}

class EnigmAgentListSecrets extends StructuredTool {
  constructor(fields = {}) {
    super(fields);
    this.name = "enigmagent_list_secrets";
    this.description =
      "List all secret names stored in the local EnigmAgent vault (names only — values are never returned).";
    this.schema = z.object({});
    this.vaultUrl = (fields.vaultUrl || process.env.ENIGMAGENT_URL || "http://127.0.0.1:39517").replace(/\/$/, "");
    this.vaultToken = fields.vaultToken || process.env.ENIGMAGENT_TOKEN || "";
  }

  async _call() {
    const url = `${this.vaultUrl}/secrets`;
    const headers = { Accept: "application/json" };
    if (this.vaultToken) headers["Authorization"] = `Bearer ${this.vaultToken}`;

    const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return `Error: vault returned ${res.status}`;
    const data = await res.json();
    const names = (data?.secrets ?? []).map((s) => s.name || s);
    return names.length ? names.join(", ") : "No secrets stored.";
  }
}

module.exports = { EnigmAgentGetSecret, EnigmAgentListSecrets };
