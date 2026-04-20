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
 *   enigmagent serve --port 39517
 */

const fetch = globalThis.fetch || require("node-fetch");

const runtimeArgs = {};   // populated by AnythingLLM from setup_args

module.exports.runtime = {
  handler: async function ({ secretName, text }) {
    const vaultUrl = (
      runtimeArgs.ENIGMAGENT_URL ||
      process.env.ENIGMAGENT_URL ||
      "http://127.0.0.1:39517"
    ).replace(/\/$/, "");
    const vaultToken = runtimeArgs.ENIGMAGENT_TOKEN || process.env.ENIGMAGENT_TOKEN || "";
    const headers = { Accept: "application/json" };
    if (vaultToken) headers["Authorization"] = `Bearer ${vaultToken}`;

    // Mode 1: resolve {{PLACEHOLDER}} tokens in text
    if (text) {
      const names = [...new Set((text.match(/\{\{([A-Za-z0-9_]+)\}\}/g) || []).map((m) => m.slice(2, -2)))];
      if (!names.length) return text;

      const pairs = await Promise.all(
        names.map(async (name) => {
          try {
            const res = await fetch(`${vaultUrl}/secret/${encodeURIComponent(name)}`, { headers });
            if (!res.ok) return [name, null];
            const data = await res.json();
            return [name, data?.value ?? null];
          } catch {
            return [name, null];
          }
        })
      );
      const map = Object.fromEntries(pairs.filter(([, v]) => v !== null));
      return text.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_, n) => map[n] ?? `{{${n}}}`);
    }

    // Mode 2: get a single secret by name
    if (secretName) {
      try {
        const res = await fetch(`${vaultUrl}/secret/${encodeURIComponent(secretName)}`, { headers });
        if (!res.ok) return `Secret "${secretName}" not found (vault returned ${res.status}).`;
        const data = await res.json();
        return data?.value ?? `Secret "${secretName}" has no value.`;
      } catch (e) {
        return `EnigmAgent vault unreachable: ${e.message}`;
      }
    }

    // Mode 3: list all secret names
    try {
      const res = await fetch(`${vaultUrl}/secrets`, { headers });
      if (!res.ok) return `Vault error: ${res.status}`;
      const data = await res.json();
      const names = (data?.secrets ?? []).map((s) => (typeof s === "string" ? s : s.name));
      return names.length ? names.join(", ") : "No secrets stored.";
    } catch (e) {
      return `EnigmAgent vault unreachable: ${e.message}`;
    }
  },
};
