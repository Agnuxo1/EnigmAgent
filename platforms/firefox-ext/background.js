/*
 * EnigmAgent — background script (Firefox MV3 edition).
 *
 * Differences from the Chrome service worker:
 *   • Declared as background.scripts (not service_worker) in Firefox MV3.
 *   • chrome.storage.session is NOT available in Firefox — we use a module-level
 *     variable instead (background scripts in Firefox persist for the session).
 *   • chrome.tabs.query({ url }) is used only to query our own extension pages.
 *     This does NOT require the "tabs" permission — querying own-extension URLs
 *     is always allowed. The "windows" permission covers browser.windows.update().
 *
 * State (in-memory — survives page navigations but resets on browser restart):
 *   _vaultTabId: tab hosting the unlocked vault, or null
 *
 * Routing:
 *   content.js (any page)         ──[resolve-placeholder]──▶ background
 *   background (find vault tab)   ──[bridge-resolve]──▶      vault.js
 *   vault.js (reply with value)   ──sendResponse──▶          background
 *   background (reply)            ──sendResponse──▶          content.js
 */

'use strict';

// In Firefox MV3, background scripts persist for the browser session.
// chrome.storage.session is unavailable in Firefox, so we use a simple variable.
let _vaultTabId = null;

function setVaultTabId(id) { _vaultTabId = id; }
function getVaultTabId()   { return _vaultTabId; }

const RESOLVE_TIMEOUT_MS = 7000;

// ---------- vault tab tracking ----------

async function findVaultTab() {
  // Querying our own extension pages does not require the "tabs" permission.
  const url = chrome.runtime.getURL('vault.html');
  const tabs = await chrome.tabs.query({ url });
  if (tabs.length > 0) {
    setVaultTabId(tabs[0].id);
    return tabs[0].id;
  }
  setVaultTabId(null);
  return null;
}

// ---------- message handling ----------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'vault-unlocked' && sender.tab?.id) {
    setVaultTabId(sender.tab.id);
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === 'vault-locked') {
    setVaultTabId(null);
    sendResponse({ ok: true });
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

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === getVaultTabId()) setVaultTabId(null);
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
    // browser.windows.update requires the "windows" permission (declared in manifest).
    if (tabs[0].windowId != null) await chrome.windows.update(tabs[0].windowId, { focused: true });
    setVaultTabId(tabs[0].id);
    return { ok: true, tabId: tabs[0].id, existed: true };
  }
  const t = await chrome.tabs.create({ url });
  setVaultTabId(t.id);
  return { ok: true, tabId: t.id, existed: false };
}
