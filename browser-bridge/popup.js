'use strict';

const VAULT_URL = chrome.runtime.getURL('vault-tab.html');

async function refresh() {
  const status = await chrome.runtime.sendMessage({ type: 'status' });
  const dot = document.getElementById('dot');
  const txt = document.getElementById('status');
  if (status?.vaultTabId) {
    dot.classList.add('ok');
    txt.textContent = `Vault open (tab #${status.vaultTabId}). ${status.pending} requests pending.`;
  } else {
    dot.classList.remove('ok');
    txt.textContent = 'Vault not open. Click the button below to launch it.';
  }
}

document.getElementById('open').addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({ url: VAULT_URL });
  if (tabs.length > 0) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: VAULT_URL });
  }
  window.close();
});

refresh();
