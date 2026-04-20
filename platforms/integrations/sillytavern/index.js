/**
 * EnigmAgent extension for SillyTavern
 * ======================================
 * Resolves {{PLACEHOLDER}} tokens in prompts and messages using the
 * local EnigmAgent vault before they are sent to the LLM backend.
 *
 * Requirements:
 *   - EnigmAgent vault server running: enigmagent serve --port 39517
 *   - SillyTavern 1.11+ (uses eventSource and slash command API)
 *
 * Install:
 *   Copy this folder to SillyTavern/public/scripts/extensions/enigmagent/
 *   Then enable it in Extensions > EnigmAgent.
 */

import { eventSource, event_types, saveSettingsDebounced } from "../../../../script.js";
import { getContext } from "../../../extensions.js";
import { registerSlashCommand } from "../../../slash-commands.js";

const EXT_NAME = "EnigmAgent";
const DEFAULT_SETTINGS = {
  enabled: true,
  vaultUrl: "http://127.0.0.1:39517",
  vaultToken: "",
  resolveInSystem: true,
};

let settings = { ...DEFAULT_SETTINGS };
const _cache = new Map();

// ── Vault API ─────────────────────────────────────────────────────────────────

async function fetchSecret(name) {
  if (_cache.has(name)) return _cache.get(name);

  const url = `${settings.vaultUrl.replace(/\/$/, "")}/secret/${encodeURIComponent(name)}`;
  const headers = { Accept: "application/json" };
  if (settings.vaultToken) headers["Authorization"] = `Bearer ${settings.vaultToken}`;

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
  if (!text || typeof text !== "string") return text;
  const names = [...new Set(text.match(/\{\{([A-Za-z0-9_]+)\}\}/g)?.map((m) => m.slice(2, -2)) ?? [])];
  if (!names.length) return text;

  const pairs = await Promise.all(names.map(async (n) => [n, await fetchSecret(n)]));
  const map = Object.fromEntries(pairs.filter(([, v]) => v !== null));

  return text.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_, n) => map[n] ?? `{{${n}}}`);
}

// ── SillyTavern event hooks ───────────────────────────────────────────────────

// Intercept the prompt just before it is sent to the LLM
eventSource.on(event_types.GENERATE_BEFORE_COMBINE_PROMPTS, async (data) => {
  if (!settings.enabled) return;
  if (data.finalPrompt) data.finalPrompt = await resolveText(data.finalPrompt);
});

// Also resolve in the system prompt if configured
eventSource.on(event_types.CHAT_COMPLETION_SETTINGS_READY, async (data) => {
  if (!settings.enabled || !settings.resolveInSystem) return;
  if (data?.messages) {
    for (const msg of data.messages) {
      if (typeof msg.content === "string") {
        msg.content = await resolveText(msg.content);
      }
    }
  }
});

// ── Slash commands ────────────────────────────────────────────────────────────

registerSlashCommand(
  "vault-resolve",
  async (_, text) => {
    const result = await resolveText(text);
    return result;
  },
  ["vr"],
  "Resolve {{PLACEHOLDER}} tokens in <text> using the EnigmAgent vault.",
  true,
  true,
);

registerSlashCommand(
  "vault-status",
  async () => {
    try {
      const res = await fetch(`${settings.vaultUrl.replace(/\/$/, "")}/health`, {
        headers: settings.vaultToken ? { Authorization: `Bearer ${settings.vaultToken}` } : {},
        signal: AbortSignal.timeout(3000),
      });
      const data = await res.json();
      return `EnigmAgent vault: ${data?.status ?? "ok"} (secrets: ${data?.count ?? "?"})`;
    } catch (e) {
      return `EnigmAgent vault unreachable: ${e.message}`;
    }
  },
  ["vs"],
  "Check the EnigmAgent vault connection status.",
  false,
  true,
);

// ── Settings UI ───────────────────────────────────────────────────────────────

async function loadSettings() {
  const ctx = getContext();
  settings = Object.assign({ ...DEFAULT_SETTINGS }, ctx.extensionSettings?.[EXT_NAME] ?? {});
  renderSettings();
}

function renderSettings() {
  $("#enigmagent_enabled").prop("checked", settings.enabled);
  $("#enigmagent_vault_url").val(settings.vaultUrl);
  $("#enigmagent_vault_token").val(settings.vaultToken);
  $("#enigmagent_resolve_system").prop("checked", settings.resolveInSystem);
}

function saveSettings() {
  const ctx = getContext();
  if (!ctx.extensionSettings) ctx.extensionSettings = {};
  ctx.extensionSettings[EXT_NAME] = { ...settings };
  saveSettingsDebounced();
}

// Inject settings HTML into the extensions panel
const settingsHtml = `
<div id="enigmagent-settings">
  <div class="inline-drawer">
    <div class="inline-drawer-toggle inline-drawer-header">
      <b>EnigmAgent Vault</b>
      <div class="inline-drawer-icon fa-solid fa-circle-chevron-down"></div>
    </div>
    <div class="inline-drawer-content">
      <label class="checkbox_label">
        <input id="enigmagent_enabled" type="checkbox" />
        <span>Enable placeholder resolution</span>
      </label>
      <label class="checkbox_label">
        <input id="enigmagent_resolve_system" type="checkbox" />
        <span>Resolve in system prompt</span>
      </label>
      <div class="flex-container">
        <label for="enigmagent_vault_url">Vault URL</label>
        <input id="enigmagent_vault_url" type="text" class="text_pole" placeholder="http://127.0.0.1:39517" />
      </div>
      <div class="flex-container">
        <label for="enigmagent_vault_token">Token (optional)</label>
        <input id="enigmagent_vault_token" type="password" class="text_pole" placeholder="leave empty for localhost" />
      </div>
      <div class="flex-container">
        <input id="enigmagent_test_btn" class="menu_button" type="button" value="Test Connection" />
        <span id="enigmagent_status"></span>
      </div>
    </div>
  </div>
</div>`;

$("#extensions_settings").append(settingsHtml);

// Wire up change events
$(document).on("change", "#enigmagent_enabled", function () {
  settings.enabled = $(this).prop("checked");
  saveSettings();
});
$(document).on("change", "#enigmagent_resolve_system", function () {
  settings.resolveInSystem = $(this).prop("checked");
  saveSettings();
});
$(document).on("input", "#enigmagent_vault_url", function () {
  settings.vaultUrl = $(this).val();
  _cache.clear();
  saveSettings();
});
$(document).on("input", "#enigmagent_vault_token", function () {
  settings.vaultToken = $(this).val();
  _cache.clear();
  saveSettings();
});
$(document).on("click", "#enigmagent_test_btn", async function () {
  const $status = $("#enigmagent_status");
  $status.text("Testing…");
  try {
    const res = await fetch(`${settings.vaultUrl.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    $status.text(`Connected — ${data?.status ?? "ok"}`).css("color", "#6abf69");
  } catch (e) {
    $status.text(`Failed: ${e.message}`).css("color", "#dc5050");
  }
});

// Init
loadSettings();
