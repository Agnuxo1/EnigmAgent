/*
 * EnigmAgent Bridge — background service worker.
 *
 * Responsibilities:
 *   - Route resolve-requests from content scripts to the vault tab.
 *   - Track which tab currently holds an unlocked vault.
 *   - Keep zero state about actual secret values (they pass through as raw strings
 *     only for the brief moment between the vault tab replying and the content
 *     script consuming them).
 */

'use strict';

let vaultTabId = null;
const pending = new Map();   // id -> { resolve, reject, timeout }
let nextId = 1;

// ---------- vault tab registration ----------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'vault-hello' && sender.tab?.id) {
    vaultTabId = sender.tab.id;
    sendResponse({ ok: true });
    return;
  }

  if (msg?.type === 'vault-reply' && msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    clearTimeout(p.timeout);
    pending.delete(msg.id);
    p.resolve(msg.payload);
    sendResponse({ ok: true });
    return;
  }

  if (msg?.type === 'resolve-placeholder') {
    handleResolve(msg.placeholder, msg.origin).then(sendResponse);
    return true; // keep the channel open for async reply
  }

  if (msg?.type === 'status') {
    sendResponse({ vaultTabId, pending: pending.size });
    return;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === vaultTabId) vaultTabId = null;
});

// ---------- core resolve flow ----------

async function handleResolve(placeholder, origin) {
  if (!vaultTabId) {
    return { error: 'vault_not_open', hint: 'Open the EnigmAgent vault tab and unlock it.' };
  }
  const id = nextId++;
  const reply = await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      resolve({ error: 'vault_timeout' });
    }, 5000);
    pending.set(id, { resolve, timeout });

    chrome.tabs.sendMessage(vaultTabId, {
      type: 'bridge-resolve',
      id,
      placeholder,
      origin,
    }).catch((err) => {
      clearTimeout(timeout);
      pending.delete(id);
      resolve({ error: 'vault_unreachable', detail: String(err?.message || err) });
    });
  });
  return reply;
}
