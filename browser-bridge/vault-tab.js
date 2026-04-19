/*
 * Stub for the extension-hosted vault tab.
 *
 * In M1 the user runs the standalone vault-app at file:// URL. The service
 * worker talks to that tab via window.postMessage (see vault-app/app.js).
 *
 * In M2 this script will host the real vault UI inside the extension's own
 * origin, enabling a direct chrome.runtime message channel without the
 * postMessage shim.
 */

'use strict';

// Announce ourselves to the service worker so it can route resolve-requests here.
chrome.runtime.sendMessage({ type: 'vault-hello' }).catch(() => { /* ignore */ });

// Listen for resolve-requests from the bridge (placeholder lookups from a page).
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== 'bridge-resolve') return;
  // In M2 we'd look up the decrypted value from the in-memory unlocked vault here.
  // For the MVP stub: report that the extension-hosted vault is not ready.
  chrome.runtime.sendMessage({
    type: 'vault-reply',
    id: msg.id,
    payload: { error: 'extension_vault_not_ready', hint: 'Use the standalone vault-app for now.' },
  });
  sendResponse({ ok: true });
});
