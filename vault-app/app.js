/*
 * EnigmAgent Vault — local-only secret store.
 * No network calls. All crypto uses Web Crypto (AES-256-GCM, PBKDF2-SHA-256).
 * Argon2id is planned for M1 (needs WASM); PBKDF2 with 600k iters is the OWASP-2023 baseline.
 */

'use strict';

const VAULT_VERSION = 1;
const KDF = { name: 'PBKDF2', hash: 'SHA-256', iterations: 600000 };
const SALT_BYTES = 16;
const NONCE_BYTES = 12;
const KEY_BITS = 256;
const STORAGE_KEY = 'enigmagent.vault.v1';

const enc = new TextEncoder();
const dec = new TextDecoder();

// ---------- crypto helpers ----------

const b64 = {
  enc: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))),
  dec: (s) => {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};

async function deriveKey(password, username, saltBytes) {
  // Mix username into the salt so same-password-different-user still differs.
  const userSalt = await crypto.subtle.digest('SHA-256', enc.encode(username || ''));
  const mixed = new Uint8Array(saltBytes.length + userSalt.byteLength);
  mixed.set(saltBytes, 0);
  mixed.set(new Uint8Array(userSalt), saltBytes.length);

  const baseKey = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: KDF.hash, salt: mixed, iterations: KDF.iterations },
    baseKey,
    { name: 'AES-GCM', length: KEY_BITS },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptString(key, plaintext) {
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, enc.encode(plaintext));
  return { nonce: b64.enc(nonce), ciphertext: b64.enc(ct) };
}

async function decryptString(key, nonceB64, ctB64) {
  const nonce = b64.dec(nonceB64);
  const ct = b64.dec(ctB64);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ct);
  return dec.decode(pt);
}

function randomBytes(n) { return crypto.getRandomValues(new Uint8Array(n)); }
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = randomBytes(16); b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

// ---------- vault state ----------

const state = {
  key: null,           // CryptoKey (in memory only)
  username: null,
  vault: null,         // { version, kdf, kdf_params, salt, entries: [...] }
  selectedId: null,
};

function emptyVault(saltBytes) {
  return {
    version: VAULT_VERSION,
    kdf: 'pbkdf2-sha256',
    kdf_params: { iterations: KDF.iterations },
    salt: b64.enc(saltBytes),
    entries: [],
  };
}

function loadVaultFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveVaultToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.vault));
}

// ---------- vault operations ----------

async function createVault(username, password) {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(password, username, salt);
  state.key = key;
  state.username = username;
  state.vault = emptyVault(salt);

  // Store a known-plaintext check entry so future unlocks can validate the password.
  const check = await encryptString(key, `enigmagent-check:${username}`);
  state.vault.check = check;

  saveVaultToStorage();
}

async function unlockVault(username, password, existingVault) {
  const vault = existingVault || loadVaultFromStorage();
  if (!vault) throw new Error('No vault found. Create one first.');
  const salt = b64.dec(vault.salt);
  const key = await deriveKey(password, username, salt);

  // Validate with the check entry. If missing (legacy), try to decrypt any entry.
  if (vault.check) {
    try {
      const pt = await decryptString(key, vault.check.nonce, vault.check.ciphertext);
      if (pt !== `enigmagent-check:${username}`) throw new Error('mismatch');
    } catch {
      throw new Error('Wrong username or password.');
    }
  } else if (vault.entries.length > 0) {
    try { await decryptString(key, vault.entries[0].nonce, vault.entries[0].ciphertext); }
    catch { throw new Error('Wrong username or password.'); }
  }

  state.key = key;
  state.username = username;
  state.vault = vault;
  if (!existingVault) saveVaultToStorage();
  else saveVaultToStorage(); // persist imported vault
}

function lock() {
  state.key = null;
  state.username = null;
  state.vault = null;
  state.selectedId = null;
}

async function addSecret({ name, domain, value }) {
  if (!state.key) throw new Error('Vault locked.');
  if (!name) throw new Error('Name required.');
  const { nonce, ciphertext } = await encryptString(state.key, value || '');
  const entry = {
    id: uuid(),
    name,
    domain: domain || null,
    created: new Date().toISOString(),
    nonce, ciphertext,
  };
  state.vault.entries.push(entry);
  saveVaultToStorage();
  return entry;
}

async function updateSecret(id, patch) {
  const e = state.vault.entries.find(x => x.id === id);
  if (!e) throw new Error('Not found.');
  if (patch.name !== undefined) e.name = patch.name;
  if (patch.domain !== undefined) e.domain = patch.domain || null;
  if (patch.value !== undefined) {
    const { nonce, ciphertext } = await encryptString(state.key, patch.value);
    e.nonce = nonce; e.ciphertext = ciphertext;
  }
  saveVaultToStorage();
}

function deleteSecret(id) {
  state.vault.entries = state.vault.entries.filter(e => e.id !== id);
  saveVaultToStorage();
}

async function revealSecret(id) {
  const e = state.vault.entries.find(x => x.id === id);
  if (!e) throw new Error('Not found.');
  return decryptString(state.key, e.nonce, e.ciphertext);
}

function findByName(name) {
  return state.vault.entries.find(e => e.name.toLowerCase() === name.toLowerCase());
}

// ---------- UI ----------

const $ = (id) => document.getElementById(id);

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $(`view-${name}`).classList.add('active');
}

function setStatus(text, unlocked) {
  const el = $('status');
  el.textContent = text;
  el.classList.toggle('unlocked', !!unlocked);
}

function renderSecrets() {
  const list = $('secret-list');
  list.innerHTML = '';
  if (!state.vault || state.vault.entries.length === 0) {
    list.innerHTML = '<li class="empty">No secrets yet. Click "+ new" or type "add NAME value".</li>';
    return;
  }
  for (const e of state.vault.entries) {
    const li = document.createElement('li');
    if (e.id === state.selectedId) li.classList.add('active');
    li.innerHTML = `<span class="s-name">${escapeHtml(e.name)}</span>` +
                   (e.domain ? `<span class="s-domain">${escapeHtml(e.domain)}</span>` : '');
    li.addEventListener('click', () => openEdit(e.id));
    list.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function addChatMsg(kind, html) {
  const log = $('chat-log');
  const div = document.createElement('div');
  div.className = `msg ${kind}`;
  div.innerHTML = html;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

// ---------- chat command parser ----------

async function runCommand(input) {
  const text = input.trim();
  if (!text) return;
  addChatMsg('you', `<p>${escapeHtml(text)}</p>`);

  // Commands:
  //   list                        → list all secret names
  //   add NAME value...           → add a secret
  //   add NAME @domain value...   → add with domain binding
  //   get NAME                    → decrypt and display (masked by default)
  //   reveal NAME                 → decrypt and display in full
  //   del NAME                    → delete
  //   help                        → help
  const parts = text.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  try {
    if (cmd === 'help' || cmd === '?') {
      addChatMsg('out', `<pre>list                    list all secret names
add NAME value          add a secret
add NAME @domain value  add with domain binding
get NAME                show a masked preview
reveal NAME             show full value
del NAME                delete
help                    this message</pre>`);
      return;
    }
    if (cmd === 'list') {
      if (!state.vault.entries.length) return addChatMsg('out', '<p>No secrets.</p>');
      const rows = state.vault.entries.map(e =>
        `${e.name}${e.domain ? ' @' + e.domain : ''}`
      ).join('\n');
      return addChatMsg('out', `<pre>${escapeHtml(rows)}</pre>`);
    }
    if (cmd === 'add') {
      const name = parts[1];
      if (!name) throw new Error('Usage: add NAME [@domain] value');
      let domain = null;
      let valueStart = 2;
      if (parts[2] && parts[2].startsWith('@')) {
        domain = parts[2].slice(1);
        valueStart = 3;
      }
      const value = parts.slice(valueStart).join(' ');
      if (!value) throw new Error('Value required.');
      await addSecret({ name, domain, value });
      renderSecrets();
      return addChatMsg('out', `<p>Stored <code>${escapeHtml(name)}</code>${domain ? ' bound to <code>' + escapeHtml(domain) + '</code>' : ''}.</p>`);
    }
    if (cmd === 'get' || cmd === 'reveal') {
      const name = parts[1];
      if (!name) throw new Error('Usage: ' + cmd + ' NAME');
      const e = findByName(name);
      if (!e) throw new Error(`No secret named "${name}".`);
      const pt = await revealSecret(e.id);
      const shown = cmd === 'reveal' ? pt : mask(pt);
      return addChatMsg('out', `<p><code>${escapeHtml(e.name)}</code> = <code>${escapeHtml(shown)}</code></p>`);
    }
    if (cmd === 'del' || cmd === 'delete') {
      const name = parts[1];
      const e = findByName(name);
      if (!e) throw new Error(`No secret named "${name}".`);
      deleteSecret(e.id);
      renderSecrets();
      return addChatMsg('out', `<p>Deleted <code>${escapeHtml(name)}</code>.</p>`);
    }
    addChatMsg('err', `<p>Unknown command: <code>${escapeHtml(cmd)}</code>. Try <code>help</code>.</p>`);
  } catch (err) {
    addChatMsg('err', `<p>${escapeHtml(err.message)}</p>`);
  }
}

function mask(s) {
  if (!s) return '';
  if (s.length <= 8) return '•'.repeat(s.length);
  return s.slice(0, 3) + '•'.repeat(Math.max(4, s.length - 6)) + s.slice(-3);
}

// ---------- modal ----------

let modalEditId = null;

function openNew() {
  modalEditId = null;
  $('modal-title').textContent = 'New secret';
  $('m-name').value = ''; $('m-domain').value = ''; $('m-value').value = '';
  $('modal').hidden = false;
  $('m-name').focus();
}

async function openEdit(id) {
  const e = state.vault.entries.find(x => x.id === id);
  if (!e) return;
  state.selectedId = id;
  renderSecrets();
  modalEditId = id;
  $('modal-title').textContent = 'Edit secret';
  $('m-name').value = e.name;
  $('m-domain').value = e.domain || '';
  $('m-value').value = await revealSecret(id);
  $('modal').hidden = false;
  $('m-name').focus();
}

function closeModal() { $('modal').hidden = true; modalEditId = null; }

async function saveModal() {
  const name = $('m-name').value.trim();
  const domain = $('m-domain').value.trim();
  const value = $('m-value').value;
  if (!name) return;
  try {
    if (modalEditId) await updateSecret(modalEditId, { name, domain, value });
    else await addSecret({ name, domain, value });
    renderSecrets();
    closeModal();
  } catch (err) {
    alert(err.message);
  }
}

// ---------- import / export ----------

function exportVault() {
  if (!state.vault) return;
  const blob = new Blob([JSON.stringify(state.vault, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `enigmagent-vault-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function handleVaultFile(file) {
  const text = await file.text();
  try {
    const vault = JSON.parse(text);
    if (!vault.version || !vault.salt) throw new Error('Not a valid vault file.');
    // Stash on the auth form so unlock uses it.
    authForm.importedVault = vault;
    addAuthHint(`Loaded vault file with ${vault.entries?.length ?? 0} entries. Enter credentials to unlock.`);
  } catch (err) {
    addAuthError(err.message);
  }
}

async function handleDocUpload(file) {
  if (!state.key) return;
  if (file.size > 1024 * 1024) {
    addChatMsg('err', '<p>Files larger than 1 MB not yet supported.</p>');
    return;
  }
  const text = await file.text();
  const name = `DOC:${file.name}`;
  await addSecret({ name, domain: null, value: text });
  renderSecrets();
  addChatMsg('out', `<p>Stored document <code>${escapeHtml(name)}</code> (${file.size} bytes).</p>`);
}

// ---------- auth form handling ----------

const authForm = { importedVault: null };

function addAuthError(msg) {
  const el = $('auth-err'); el.textContent = msg; el.hidden = false;
}
function clearAuthError() { $('auth-err').hidden = true; }
function addAuthHint(msg) {
  const el = $('auth-err'); el.textContent = msg; el.hidden = false; el.style.color = 'var(--fg-dim)';
}

async function handleUnlock() {
  clearAuthError();
  const u = $('auth-user').value.trim();
  const p = $('auth-pass').value;
  if (!u || !p) return addAuthError('Username and password required.');
  try {
    await unlockVault(u, p, authForm.importedVault);
    authForm.importedVault = null;
    enterVault();
  } catch (err) {
    addAuthError(err.message);
  }
}

async function handleCreate() {
  clearAuthError();
  const u = $('auth-user').value.trim();
  const p = $('auth-pass').value;
  if (!u || !p) return addAuthError('Username and password required.');
  if (p.length < 8) return addAuthError('Password must be at least 8 characters.');
  if (loadVaultFromStorage()) {
    if (!confirm('A vault already exists on this device. Overwrite it?')) return;
  }
  try {
    await createVault(u, p);
    enterVault();
  } catch (err) {
    addAuthError(err.message);
  }
}

function enterVault() {
  setStatus(`unlocked · ${state.username}`, true);
  showView('vault');
  renderSecrets();
  $('chat-input').focus();
}

function doLock() {
  lock();
  setStatus('locked', false);
  $('auth-user').value = '';
  $('auth-pass').value = '';
  showView('auth');
}

// ---------- wire up ----------

window.addEventListener('DOMContentLoaded', () => {
  // Pre-fill username if a vault already exists locally (UX hint).
  const existing = loadVaultFromStorage();
  if (existing) addAuthHint('Existing vault detected on this device. Enter credentials to unlock.');

  $('btn-unlock').addEventListener('click', handleUnlock);
  $('btn-create').addEventListener('click', handleCreate);
  $('auth-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleUnlock(); });
  $('vault-file').addEventListener('change', (e) => e.target.files[0] && handleVaultFile(e.target.files[0]));

  $('btn-add').addEventListener('click', openNew);
  $('btn-lock').addEventListener('click', doLock);
  $('btn-export').addEventListener('click', exportVault);

  $('m-save').addEventListener('click', saveModal);
  $('m-cancel').addEventListener('click', closeModal);

  $('chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('chat-input');
    const text = input.value;
    input.value = '';
    runCommand(text);
  });
  $('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      $('chat-form').requestSubmit();
    }
  });
  $('doc-upload').addEventListener('change', (e) => e.target.files[0] && handleDocUpload(e.target.files[0]));

  // Drag & drop documents onto the chat log
  const log = $('chat-log');
  log.addEventListener('dragover', (e) => { e.preventDefault(); });
  log.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleDocUpload(f);
  });
});

// ---------- public API for the Browser Bridge ----------
// The extension talks to this tab via window.postMessage.
// Messages:
//   { source: 'enigmagent-bridge', type: 'resolve', placeholder: 'GITHUB_TOKEN', origin: 'github.com' }
// Response:
//   { source: 'enigmagent-vault', type: 'resolved', placeholder, value | error }

window.addEventListener('message', async (e) => {
  const m = e.data;
  if (!m || m.source !== 'enigmagent-bridge') return;
  if (m.type !== 'resolve') return;

  const reply = (payload) => e.source.postMessage(
    { source: 'enigmagent-vault', type: 'resolved', id: m.id, ...payload },
    e.origin
  );

  if (!state.key) return reply({ placeholder: m.placeholder, error: 'vault_locked' });
  const entry = findByName(m.placeholder);
  if (!entry) return reply({ placeholder: m.placeholder, error: 'not_found' });
  if (entry.domain && m.origin && !originMatches(m.origin, entry.domain)) {
    return reply({ placeholder: m.placeholder, error: 'domain_mismatch', expected: entry.domain });
  }
  try {
    const value = await revealSecret(entry.id);
    reply({ placeholder: m.placeholder, value });
  } catch (err) {
    reply({ placeholder: m.placeholder, error: 'decrypt_failed' });
  }
});

function originMatches(origin, domain) {
  try {
    const host = new URL(origin).hostname;
    return host === domain || host.endsWith('.' + domain);
  } catch { return false; }
}
