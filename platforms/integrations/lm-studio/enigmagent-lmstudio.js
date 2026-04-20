/**
 * EnigmAgent Integration for LM Studio
 * ========================================
 * LM Studio exposes an OpenAI-compatible REST API at http://localhost:1234/v1
 * This module wraps the fetch calls to resolve {{PLACEHOLDER}} tokens before
 * sending to LM Studio's local inference engine.
 *
 * Works in:
 *   - Browser devtools / user scripts injected into LM Studio's chat UI
 *   - Node.js scripts that call LM Studio programmatically
 *   - Any environment that uses the openai npm package with a custom baseURL
 *
 * Requirements:
 *   enigmagent serve --port 39517  (vault must be running)
 *
 * Node.js usage:
 *   const { createLMStudioClient } = require('./enigmagent-lmstudio')
 *   const client = createLMStudioClient()
 *   const response = await client.chat.completions.create({
 *     model: 'lmstudio-community/Meta-Llama-3-8B-Instruct-GGUF',
 *     messages: [{ role: 'user', content: 'Use {{OPENAI_KEY}} to...' }]
 *   })
 */

const VAULT_URL = process.env.ENIGMAGENT_URL || "http://127.0.0.1:39517";
const VAULT_TOKEN = process.env.ENIGMAGENT_TOKEN || "";
const LM_STUDIO_URL = process.env.LM_STUDIO_URL || "http://localhost:1234/v1";

const _cache = new Map();

async function fetchSecret(name) {
  if (_cache.has(name)) return _cache.get(name);
  const url = `${VAULT_URL.replace(/\/$/, "")}/secret/${encodeURIComponent(name)}`;
  const headers = { Accept: "application/json" };
  if (VAULT_TOKEN) headers["Authorization"] = `Bearer ${VAULT_TOKEN}`;
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

async function resolveText(text) {
  if (typeof text !== "string") return text;
  const names = [...new Set((text.match(/\{\{([A-Za-z0-9_]+)\}\}/g) || []).map((m) => m.slice(2, -2)))];
  if (!names.length) return text;
  const pairs = await Promise.all(names.map(async (n) => [n, await fetchSecret(n)]));
  const map = Object.fromEntries(pairs.filter(([, v]) => v !== null));
  return text.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_, n) => map[n] ?? `{{${n}}}`);
}

async function resolveMessages(messages) {
  return Promise.all(
    messages.map(async (msg) => {
      if (typeof msg.content === "string") {
        return { ...msg, content: await resolveText(msg.content) };
      }
      return msg;
    })
  );
}

/**
 * Create an OpenAI-compatible client pre-configured for LM Studio
 * with EnigmAgent vault resolution.
 */
function createLMStudioClient(options = {}) {
  const { OpenAI } = require("openai");
  const vaultUrl = options.vaultUrl || VAULT_URL;
  const vaultToken = options.vaultToken || VAULT_TOKEN;

  const client = new OpenAI({
    baseURL: options.lmStudioUrl || LM_STUDIO_URL,
    apiKey: "lm-studio",  // LM Studio doesn't require a real key
  });

  // Wrap the completions.create method
  const originalCreate = client.chat.completions.create.bind(client.chat.completions);
  client.chat.completions.create = async function (params, ...rest) {
    if (params.messages) {
      params = { ...params, messages: await resolveMessages(params.messages) };
    }
    return originalCreate(params, ...rest);
  };

  return client;
}

module.exports = { createLMStudioClient, resolveText, resolveMessages, fetchSecret };

// ── Example ───────────────────────────────────────────────────────────────────
if (require.main === module) {
  (async () => {
    const client = createLMStudioClient();
    const res = await client.chat.completions.create({
      model: "local-model",
      messages: [{ role: "user", content: "My API key is {{OPENAI_KEY}}. Summarize what it can do." }],
      temperature: 0.7,
    });
    console.log(res.choices[0].message.content);
  })();
}
