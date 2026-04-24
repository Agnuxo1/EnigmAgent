/**
 * EnigmAgent Plugin for LM Studio
 * =================================
 * Exposes an LM Studio tool that resolves {{PLACEHOLDER}} references from
 * the local EnigmAgent vault before text reaches the model.
 *
 * Usage:
 *   1. Install: npm install && npm run build
 *   2. Register in LM Studio: Plugins → Add Plugin → point to this directory
 *   3. Start vault: enigmagent-mcp --mode rest --port 3737
 *
 * The plugin registers two tools available to any LM Studio model:
 *   - enigmagent_resolve  — resolve {{PLACEHOLDER}} tokens in a string
 *   - enigmagent_list     — list available secret names (never values)
 */

import http from "http";

// ── Configuration ──────────────────────────────────────────────────────────
const VAULT_HOST  = process.env.ENIGMAGENT_HOST  ?? "127.0.0.1";
const VAULT_PORT  = parseInt(process.env.ENIGMAGENT_PORT  ?? "3737", 10);
const VAULT_TOKEN = process.env.ENIGMAGENT_TOKEN ?? "";

// ── Vault HTTP helpers ─────────────────────────────────────────────────────

function vaultGet(path: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: VAULT_HOST,
      port:     VAULT_PORT,
      path,
      method:   "GET",
      headers:  {
        "Accept": "application/json",
        ...(VAULT_TOKEN ? { "Authorization": `Bearer ${VAULT_TOKEN}` } : {}),
      },
      timeout: 3000,
    };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Invalid JSON from vault: ${data}`)); }
      });
    });
    req.on("error",   reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Vault request timed out")); });
    req.end();
  });
}

async function fetchSecret(name: string): Promise<string | null> {
  try {
    const data = await vaultGet(`/secret/${encodeURIComponent(name)}`) as Record<string, unknown>;
    return typeof data?.value === "string" ? data.value : null;
  } catch {
    return null;
  }
}

async function listSecretNames(): Promise<string[]> {
  try {
    const data = await vaultGet("/list") as { entries?: Array<{ name: string }> };
    return (data?.entries ?? []).map((e) => e.name);
  } catch {
    return [];
  }
}

async function resolveText(text: string): Promise<string> {
  const pattern = /\{\{([A-Za-z0-9_]+)\}\}/g;
  const names   = [...new Set(Array.from(text.matchAll(pattern), (m) => m[1]))];
  if (names.length === 0) return text;

  const pairs = await Promise.all(
    names.map(async (n) => [n, await fetchSecret(n)] as [string, string | null])
  );
  const map = Object.fromEntries(pairs.filter(([, v]) => v !== null) as [string, string][]);
  return text.replace(pattern, (_, n) => map[n] ?? `{{${n}}}`);
}

// ── LM Studio Plugin Definition ────────────────────────────────────────────

/**
 * Tool definitions that LM Studio exposes to the model.
 * LM Studio reads the exported `tools` array from the plugin entry point.
 */
export const tools = [
  {
    name:        "enigmagent_resolve",
    description: "Resolve {{PLACEHOLDER}} tokens in text using the local EnigmAgent encrypted vault. " +
                 "Returns the input text with all known placeholders replaced by their vault values. " +
                 "Unknown placeholders are left as-is.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type:        "string",
          description: "Text containing zero or more {{SECRET_NAME}} placeholders to resolve.",
        },
      },
      required: ["text"],
    },
    async execute({ text }: { text: string }): Promise<{ resolved: string; changed: boolean }> {
      const resolved = await resolveText(text);
      return { resolved, changed: resolved !== text };
    },
  },

  {
    name:        "enigmagent_list",
    description: "List the names of all secrets currently stored in the local EnigmAgent vault. " +
                 "Returns only names — never values. Use this to discover what {{PLACEHOLDER}} tokens are available.",
    parameters: {
      type:       "object",
      properties: {},
      required:   [],
    },
    async execute(): Promise<{ names: string[]; placeholders: string[] }> {
      const names = await listSecretNames();
      return {
        names,
        placeholders: names.map((n) => `{{${n}}}`),
      };
    },
  },

  {
    name:        "enigmagent_status",
    description: "Check whether the local EnigmAgent vault is running and unlocked.",
    parameters: {
      type:       "object",
      properties: {},
      required:   [],
    },
    async execute(): Promise<{ running: boolean; unlocked: boolean; message: string }> {
      try {
        const data = await vaultGet("/status") as { unlocked?: boolean };
        const unlocked = data?.unlocked === true;
        return {
          running:  true,
          unlocked,
          message:  unlocked
            ? "Vault is RUNNING and UNLOCKED. {{PLACEHOLDER}} resolution is active."
            : "Vault is running but LOCKED — restart enigmagent-mcp to unlock.",
        };
      } catch {
        return {
          running:  false,
          unlocked: false,
          message:  `Vault is NOT reachable at ${VAULT_HOST}:${VAULT_PORT}. ` +
                    `Start with: enigmagent-mcp --mode rest --port ${VAULT_PORT}`,
        };
      }
    },
  },
];

/** Plugin metadata read by LM Studio at load time. */
export const plugin = {
  name:        "EnigmAgent Vault",
  version:     "1.0.0",
  description: "Resolve {{PLACEHOLDER}} secrets from your local EnigmAgent encrypted vault.",
  author:      "EnigmAgent",
  homepage:    "https://enigmagent.com",
};
