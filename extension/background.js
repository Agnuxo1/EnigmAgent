/*
 * EnigmAgent — background service worker.
 *
 * State (all transient, survives service-worker restarts via chrome.storage.session):
 *   vaultTabId:  tab hosting the unlocked vault, or null
 *
 * Routing:
 *   content.js  (any page)            ──[resolve-placeholder]──▶  background
 *   background  (find vault tab)      ──[bridge-resolve]──▶        vault.js
 *   vault.js    (reply with value)    ──sendResponse──▶            background
 *   background  (reply)               ──sendResponse──▶            content.js
 */

'use strict';

const SESSION_KEY = 'vaultTabId';
const RESOLVE_TIMEOUT_MS = 7000;

// ---------- vault tab tracking ----------

async function setVaultTabId(id) {
  try { await chrome.storage.session.set({ [SESSION_KEY]: id }); } catch {}
}
async function getVaultTabId() {
  try {
    const r = await chrome.storage.session.get([SESSION_KEY]);
    return r?.[SESSION_KEY] ?? null;
  } catch { return null; }
}

async function findVaultTab() {
  // Query only our own vault page — no `tabs` permission required.
  const url = chrome.runtime.getURL('vault.html');
  const tabs = await chrome.tabs.query({ url });
  if (tabs.length > 0) {
    await setVaultTabId(tabs[0].id);
    return tabs[0].id;
  }
  await setVaultTabId(null);
  return null;
}

// ---------- message handling ----------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'vault-unlocked' && sender.tab?.id) {
    setVaultTabId(sender.tab.id).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'vault-locked') {
    setVaultTabId(null).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'status') {
    (async () => {
      const id = await findVaultTab();
      sendResponse({ vaultTabId: id, vaultUrl: chrome.runtime.getURL('vault.html') });
    })();
    return true;
  }
  if (msg.type === 'resolve-placeholder') {
    handleResolve(msg.placeholder, msg.origin).then(sendResponse);
    return true;
  }
  if (msg.type === 'open-vault') {
    openOrFocusVault().then(sendResponse);
    return true;
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const current = await getVaultTabId();
  if (tabId === current) await setVaultTabId(null);
});

// ---------- resolve flow ----------

async function handleResolve(placeholder, origin) {
  if (typeof placeholder !== 'string' || !/^[A-Z0-9_:\-.@]+$/i.test(placeholder)) {
    return { error: 'bad_placeholder' };
  }
  const tabId = await findVaultTab();
  if (tabId == null) {
    return { error: 'vault_not_open', hint: 'Open the EnigmAgent vault tab and unlock it.' };
  }

  const replyPromise = new Promise((resolve) => {
    const to = setTimeout(() => resolve({ error: 'vault_timeout' }), RESOLVE_TIMEOUT_MS);
    chrome.tabs.sendMessage(
      tabId,
      { type: 'bridge-resolve', placeholder, origin },
      (reply) => {
        clearTimeout(to);
        if (chrome.runtime.lastError) {
          return resolve({ error: 'vault_unreachable', detail: chrome.runtime.lastError.message });
        }
        resolve(reply || { error: 'no_reply' });
      }
    );
  });

  return replyPromise;
}

async function openOrFocusVault() {
  const url = chrome.runtime.getURL('vault.html');
  const tabs = await chrome.tabs.query({ url });
  if (tabs.length > 0) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    if (tabs[0].windowId != null) await chrome.windows.update(tabs[0].windowId, { focused: true });
    await setVaultTabId(tabs[0].id);
    return { ok: true, tabId: tabs[0].id, existed: true };
  }
  const t = await chrome.tabs.create({ url });
  await setVaultTabId(t.id);
  return { ok: true, tabId: t.id, existed: false };
}
