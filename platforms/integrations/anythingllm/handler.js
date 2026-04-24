/**
 * EnigmAgent Vault — AnythingLLM Agent Tool
 * ==========================================
 * Enables AnythingLLM agents to retrieve secrets from the local
 * EnigmAgent AES-256-GCM encrypted vault.
 *
 * Install:
 *   Place this folder in AnythingLLM's agent-plugins directory, or
 *   submit to the AnythingLLM Hub via hub.useanything.com.
 *
 * Requirements:
 *   enigmagent-mcp --mode rest --port 3737 --vault ./vault.json
 *
 * REST API endpoints used:
 *   GET  /status
 *   GET  /list
 *   POST /resolve  {"placeholder": "NAME", "origin": "https://..."}
 */

const fetch = globalThis.fetch || require("node-fetch");

const runtimeArgs = {};   // populated by AnythingLLM from setup_args

module.exports.runtime = {
  handler: async function ({ secretName, text }) {
    const vaultUrl = (
      runtimeArgs.ENIGMAGENT_URL ||
      process.env.ENIGMAGENT_URL ||
      "http://127.0.0.1:3737"
    ).replace(/\/$/, "");

    const origin =
      runtimeArgs.ENIGMAGENT_ORIGIN ||
      process.env.ENIGMAGENT_ORIGIN ||
      "http://localhost";

    const jsonHeaders = { "Content-Type": "application/json", Accept: "application/json" };

    /**
     * Resolve a single secret name via POST /resolve.
     */
    async function resolveSecret(name) {
      try {
        const res = await fetch(`${vaultUrl}/resolve`, {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({ placeholder: name, origin }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data?.value ?? null;
      } catch {
        return null;
      }
    }

    // Mode 1: resolve {{PLACEHOLDER}} tokens in text
    if (text) {
      const names = [...new Set((text.match(/\{\{([A-Za-z0-9_]+)\}\}/g) || []).map((m) => m.slice(2, -2)))];
      if (!names.length) return text;

      const pairs = await Promise.all(
        names.map(async (name) => [name, await resolveSecret(name)])
      );
      const map = Object.fromEntries(pairs.filter(([, v]) => v !== null));
      return text.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_, n) => map[n] ?? `{{${n}}}`);
    }

    // Mode 2: get a single secret by name
    if (secretName) {
      const value = await resolveSecret(secretName);
      if (value !== null) return value;
      return `Secret "${secretName}" not found in vault.`;
    }

    // Mode 3: list all secret names via GET /list
    try {
      const res = await fetch(`${vaultUrl}/list`, { headers: jsonHeaders });
      if (!res.ok) return `Vault error: ${res.status}`;
      const data = await res.json();
      const entries = data?.entries ?? [];
      const names = entries.map((e) => (typeof e === "string" ? e : e.name));
      return names.length ? names.join(", ") : "No secrets stored.";
    } catch (e) {
      return `EnigmAgent vault unreachable: ${e.message}`;
    }
  },
};
