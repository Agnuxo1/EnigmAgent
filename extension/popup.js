'use strict';

async function refresh() {
  const status = await chrome.runtime.sendMessage({ type: 'status' });
  const dot = document.getElementById('dot');
  const txt = document.getElementById('status');
  if (status?.vaultTabId) {
    dot.classList.add('ok');
    txt.textContent = 'Vault tab open. Make sure it is unlocked.';
  } else {
    dot.classList.remove('ok');
    txt.textContent = 'Vault not open. Click below to launch it.';
  }
}

document.getElementById('open').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'open-vault' });
  window.close();
});

refresh();
