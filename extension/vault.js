/*
 * EnigmAgent — vault page script (runs inside the extension origin).
 *
 * Crypto:
 *   password + username → Argon2id(m=64 MiB, t=3, p=1) → 32-byte master key
 *   master key → AES-256-GCM encrypt/decrypt of each entry (per-entry 96-bit nonce)
 *
 * Persistence:
 *   chrome.storage.local (one key: 'vault'). Encrypted JSON blob.
 *
 * Messaging:
 *   Listens for { type: 'bridge-resolve', id, placeholder, origin } from the
 *   background service worker. Replies { type: 'bridge-resolve-reply', id, ... }
 *   via chrome.runtime.sendMessage. Only replies when the vault is unlocked and
 *   the origin matches the domain bound to the requested secret.
 */

'use strict';

const VAULT_VERSION = 1;
const ARGON2_PARAMS = { t: 3, m: 65536, p: 1, dkLen: 32 };
const SALT_BYTES = 16;
const NONCE_BYTES = 12;
const STORAGE_KEY = 'vault';
const REPO_URL = 'https://github.com/agnuxo1/EnigmAgent';

const enc = new TextEncoder();
const dec = new TextDecoder();

// ---------- binary helpers ----------

const b64 = {
  enc: (buf) => {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  },
  dec: (s) => {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};

function randomBytes(n) { return crypto.getRandomValues(new Uint8Array(n)); }
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = randomBytes(16); b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

// ---------- crypto ----------

async function deriveKey(password, username, saltBytes) {
  if (!globalThis.EnigmaCrypto?.argon2id) {
    throw new Error('Argon2id library failed to load.');
  }
  // Bind the key to the username so same password, different user → different key.
  const ctx = enc.encode(`enigma/v1|${username}`);
  const salted = new Uint8Array(saltBytes.length + ctx.length);
  salted.set(saltBytes, 0); salted.set(ctx, saltBytes.length);

  const raw = EnigmaCrypto.argon2id(enc.encode(password), salted, ARGON2_PARAMS);
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptString(key, plaintext) {
  const nonce = randomBytes(NONCE_BYTES);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, enc.encode(plaintext));
  return { nonce: b64.enc(nonce), ciphertext: b64.enc(ct) };
}
async function decryptString(key, nonceB64, ctB64) {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64.dec(nonceB64) }, key, b64.dec(ctB64)
  );
  return dec.decode(pt);
}

// ---------- state ----------

const state = {
  key: null,         // CryptoKey in memory only
  username: null,
  vault: null,       // { version, kdf, kdf_params, salt, check, entries: [...] }
  selectedId: null,
};

function emptyVault(saltBytes) {
  return {
    version: VAULT_VERSION,
    kdf: 'argon2id',
    kdf_params: { ...ARGON2_PARAMS },
    salt: b64.enc(saltBytes),
    check: null,
    entries: [],
  };
}

// ---------- storage ----------

async function loadVault() {
  return new Promise((resolve) => {
    if (!chrome?.storage?.local) return resolve(null);
    chrome.storage.local.get([STORAGE_KEY], (res) => resolve(res?.[STORAGE_KEY] || null));
  });
}
async function saveVault() {
  return new Promise((resolve) => {
    if (!chrome?.storage?.local) return resolve();
    chrome.storage.local.set({ [STORAGE_KEY]: state.vault }, () => resolve());
  });
}

// ---------- vault operations ----------

async function createVault(username, password) {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(password, username, salt);
  state.key = key; state.username = username;
  state.vault = emptyVault(salt);
  state.vault.check = await encryptString(key, `enigmagent-check|${username}`);
  await saveVault();
}

async function unlockVault(username, password, existingVault) {
  const vault = existingVault || await loadVault();
  if (!vault) throw new Error('No vault found on this device. Create one first.');
  if (vault.kdf && vault.kdf !== 'argon2id') {
    throw new Error(`Unsupported KDF: ${vault.kdf}`);
  }
  const key = await deriveKey(password, username, b64.dec(vault.salt));

  // Validate: decrypt the check entry.
  if (vault.check) {
    try {
      const pt = await decryptString(key, vault.check.nonce, vault.check.ciphertext);
      if (pt !== `enigmagent-check|${username}`) throw new Error('mismatch');
    } catch {
      throw new Error('Wrong username or password.');
    }
  } else if (vault.entries.length > 0) {
    try { await decryptString(key, vault.entries[0].nonce, vault.entries[0].ciphertext); }
    catch { throw new Error('Wrong username or password.'); }
  }

  state.key = key; state.username = username; state.vault = vault;
  if (existingVault) await saveVault();
}

function lock() {
  state.key = null; state.username = null; state.vault = null; state.selectedId = null;
}

async function addSecret({ name, domain, value }) {
  if (!state.key) throw new Error('Vault is locked.');
  if (!name) throw new Error('Name is required.');
  if (!/^[A-Z0-9_:\-.@]+$/i.test(name)) {
    throw new Error('Name may only contain letters, digits, and _ : - . @');
  }
  if (state.vault.entries.some(e => e.name.toLowerCase() === name.toLowerCase())) {
    throw new Error(`A secret named "${name}" already exists.`);
  }
  const { nonce, ciphertext } = await encryptString(state.key, value || '');
  const entry = {
    id: uuid(), name, domain: domain || null,
    created: new Date().toISOString(), nonce, ciphertext,
  };
  state.vault.entries.push(entry);
  await saveVault();
  return entry;
}
async function updateSecret(id, patch) {
  if (!state.key) throw new Error('Vault is locked.');
  const e = state.vault.entries.find(x => x.id === id);
  if (!e) throw new Error('Not found.');
  if (patch.name !== undefined) {
    if (!/^[A-Z0-9_:\-.@]+$/i.test(patch.name)) {
      throw new Error('Name may only contain letters, digits, and _ : - . @');
    }
    const conflict = state.vault.entries.find(x => x.id !== id && x.name.toLowerCase() === patch.name.toLowerCase());
    if (conflict) throw new Error(`A secret named "${patch.name}" already exists.`);
    e.name = patch.name;
  }
  if (patch.domain !== undefined) e.domain = patch.domain || null;
  if (patch.value !== undefined) {
    const { nonce, ciphertext } = await encryptString(state.key, patch.value);
    e.nonce = nonce; e.ciphertext = ciphertext;
  }
  await saveVault();
}
async function deleteSecret(id) {
  state.vault.entries = state.vault.entries.filter(e => e.id !== id);
  await saveVault();
}
async function revealSecret(id) {
  const e = state.vault.entries.find(x => x.id === id);
  if (!e) throw new Error('Not found.');
  return decryptString(state.key, e.nonce, e.ciphertext);
}
function findByName(name) {
  const lower = name.toLowerCase();

  // LOGIN:domain — first secret whose domain matches (case-insensitive)
  // Lets an agent write {{LOGIN:github.com}} without knowing the secret name.
  if (lower.startsWith('login:')) {
    const dom = lower.slice(6);
    return state.vault.entries.find(e => e.domain?.toLowerCase() === dom);
  }

  // DOC:filename — document stored via the upload button (name prefix DOC_)
  // Lets an agent embed a full document with {{DOC:report.md}}.
  if (lower.startsWith('doc:')) {
    const raw = name.slice(4).replace(/[^A-Za-z0-9_.\-]/g, '_');
    const docName = 'DOC_' + raw;
    return state.vault.entries.find(e => e.name.toLowerCase() === docName.toLowerCase());
  }

  return state.vault.entries.find(e => e.name.toLowerCase() === lower);
}

// ---------- UI helpers ----------

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
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
function authMsg(kind, text) {
  const el = $('auth-msg');
  el.hidden = false;
  el.textContent = text;
  el.className = kind;
}
function renderSecrets() {
  const list = $('secret-list');
  list.innerHTML = '';
  if (!state.vault || state.vault.entries.length === 0) {
    list.innerHTML = '<li class="empty">No secrets yet.<br>Click <strong>+ new</strong> or type <code>add NAME @domain VALUE</code> in the chat.</li>';
    return;
  }
  const sorted = [...state.vault.entries].sort((a, b) => a.name.localeCompare(b.name));
  for (const e of sorted) {
    const li = document.createElement('li');
    if (e.id === state.selectedId) li.classList.add('active');
    li.innerHTML = `<span class="s-name">${escapeHtml(e.name)}</span>` +
                   (e.domain ? `<span class="s-domain">${escapeHtml(e.domain)}</span>` : '<span class="s-domain">(no domain binding — avoid)</span>');
    li.addEventListener('click', () => openEdit(e.id));
    list.appendChild(li);
  }
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

const HELP_TEXT = `Commands
────────────────────────────────────────────────
list                          list all stored secret names
add NAME @domain value        add a domain-bound secret (recommended)
add NAME value                add without domain binding (not recommended)
get NAME                      show a masked preview of the value
reveal NAME                   show the full value (use with care)
rename OLD NEW                rename a secret
domain NAME @newdomain        reassign the bound domain
del NAME                      permanently delete a secret
help                          show this reference

Secret reference syntax (use in form fields)
────────────────────────────────────────────────
{{MY_TOKEN}}                  resolve by exact secret name
{{LOGIN:github.com}}          resolve first secret bound to that domain
{{DOC:report.md}}             embed a stored document by filename`;

async function runCommand(input) {
  const text = input.trim();
  if (!text) return;
  addChatMsg('you', `<p>${escapeHtml(text)}</p>`);

  const parts = text.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  try {
    if (cmd === 'help' || cmd === '?') {
      return addChatMsg('out', `<pre>${escapeHtml(HELP_TEXT)}</pre>`);
    }
    if (cmd === 'list') {
      if (!state.vault.entries.length) return addChatMsg('out', '<p>No secrets.</p>');
      const rows = state.vault.entries.map(e =>
        `${e.name.padEnd(28)} ${e.domain ? '@' + e.domain : '(unbound)'}`
      ).join('\n');
      return addChatMsg('out', `<pre>${escapeHtml(rows)}</pre>`);
    }
    if (cmd === 'add') {
      const name = parts[1];
      if (!name) throw new Error('Usage: add NAME [@domain] value');
      let domain = null, valueStart = 2;
      if (parts[2]?.startsWith('@')) { domain = parts[2].slice(1); valueStart = 3; }
      const value = parts.slice(valueStart).join(' ');
      if (!value) throw new Error('Value is required.');
      await addSecret({ name, domain, value });
      renderSecrets();
      return addChatMsg('out', `<p>Stored <code>${escapeHtml(name)}</code>${domain ? ' bound to <code>' + escapeHtml(domain) + '</code>' : ' <strong>without domain binding</strong> — set one with <code>domain ' + escapeHtml(name) + ' @example.com</code>'}.</p>`);
    }
    if (cmd === 'get' || cmd === 'reveal') {
      const name = parts[1];
      if (!name) throw new Error(`Usage: ${cmd} NAME`);
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
      await deleteSecret(e.id);
      renderSecrets();
      return addChatMsg('out', `<p>Deleted <code>${escapeHtml(name)}</code>.</p>`);
    }
    if (cmd === 'rename') {
      const [_, oldName, newName] = parts;
      if (!oldName || !newName) throw new Error('Usage: rename OLD NEW');
      if (!/^[A-Z0-9_:\-.@]+$/i.test(newName)) {
        throw new Error('New name may only contain letters, digits, and _ : - . @');
      }
      const e = findByName(oldName);
      if (!e) throw new Error(`No secret named "${oldName}".`);
      if (state.vault.entries.some(x => x.id !== e.id && x.name.toLowerCase() === newName.toLowerCase())) {
        throw new Error(`A secret named "${newName}" already exists.`);
      }
      e.name = newName;
      await saveVault();
      renderSecrets();
      return addChatMsg('out', `<p>Renamed to <code>${escapeHtml(newName)}</code>.</p>`);
    }
    if (cmd === 'domain') {
      const [_, name, dom] = parts;
      if (!name || !dom) throw new Error('Usage: domain NAME @example.com');
      const e = findByName(name);
      if (!e) throw new Error(`No secret named "${name}".`);
      e.domain = dom.replace(/^@/, '');
      await saveVault();
      renderSecrets();
      return addChatMsg('out', `<p><code>${escapeHtml(name)}</code> now bound to <code>${escapeHtml(e.domain)}</code>.</p>`);
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
  a.download = `enigmagent-vault-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  addChatMsg('out', '<p>Vault exported. The file is still encrypted — keep your password to reopen it.</p>');
}

const pendingImport = { vault: null };

async function handleVaultFile(file) {
  const text = await file.text();
  try {
    const vault = JSON.parse(text);
    if (!vault.version || !vault.salt) throw new Error('Not a valid EnigmAgent vault file.');
    pendingImport.vault = vault;
    authMsg('info', `Loaded vault file with ${vault.entries?.length ?? 0} entries. Enter the credentials used when it was created.`);
  } catch (err) {
    authMsg('err', err.message);
  }
}

async function handleDocUpload(file) {
  if (!state.key) return;
  if (file.size > 1024 * 1024) {
    return addChatMsg('err', '<p>Files larger than 1 MB are not supported yet.</p>');
  }
  const text = await file.text();
  const name = `DOC_${file.name.replace(/[^A-Za-z0-9_.-]/g, '_')}`;
  try {
    await addSecret({ name, domain: null, value: text });
    renderSecrets();
    addChatMsg('out', `<p>Stored document as <code>${escapeHtml(name)}</code> (${file.size} bytes).</p>`);
  } catch (err) {
    addChatMsg('err', `<p>${escapeHtml(err.message)}</p>`);
  }
}

// ---------- auth flow ----------

async function handleUnlock() {
  const u = $('auth-user').value.trim();
  const p = $('auth-pass').value;
  if (!u || !p) return authMsg('err', 'Username and password required.');

  $('btn-unlock').disabled = true; $('btn-create').disabled = true;
  $('auth-progress').hidden = false;
  try {
    await unlockVault(u, p, pendingImport.vault);
    pendingImport.vault = null;
    enterVault();
  } catch (err) {
    authMsg('err', err.message);
  } finally {
    $('btn-unlock').disabled = false; $('btn-create').disabled = false;
    $('auth-progress').hidden = true;
  }
}

async function handleCreate() {
  const u = $('auth-user').value.trim();
  const p = $('auth-pass').value;
  if (!u || !p) return authMsg('err', 'Username and password required.');
  if (p.length < 8) return authMsg('err', 'Password must be at least 8 characters.');

  const existing = await loadVault();
  if (existing) {
    if (!confirm('A vault already exists on this device. Overwrite it? All existing secrets will be lost.')) return;
  }
  $('btn-unlock').disabled = true; $('btn-create').disabled = true;
  $('auth-progress').hidden = false;
  try {
    await createVault(u, p);
    enterVault();
  } catch (err) {
    authMsg('err', err.message);
  } finally {
    $('btn-unlock').disabled = false; $('btn-create').disabled = false;
    $('auth-progress').hidden = true;
  }
}

function enterVault() {
  setStatus(`unlocked · ${state.username}`, true);
  showView('vault');
  renderSecrets();
  $('chat-input').focus();
  // Announce to the service worker that this tab is the unlocked vault.
  try { chrome.runtime.sendMessage({ type: 'vault-unlocked' }); } catch {}
}

function doLock() {
  lock();
  setStatus('locked', false);
  $('auth-user').value = '';
  $('auth-pass').value = '';
  $('auth-msg').hidden = true;
  showView('auth');
  try { chrome.runtime.sendMessage({ type: 'vault-locked' }); } catch {}
}

// ---------- wiring ----------

window.addEventListener('DOMContentLoaded', async () => {
  $('repo-link').href = REPO_URL;

  const existing = await loadVault();
  if (existing) authMsg('info', 'Existing vault found on this device. Enter credentials to unlock.');

  $('btn-unlock').addEventListener('click', handleUnlock);
  $('btn-create').addEventListener('click', handleCreate);
  $('auth-pass').addEventListener('keydown', e => { if (e.key === 'Enter') handleUnlock(); });
  $('vault-file').addEventListener('change', e => e.target.files[0] && handleVaultFile(e.target.files[0]));

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
  $('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      $('chat-form').requestSubmit();
    }
  });
  $('doc-upload').addEventListener('change', e => e.target.files[0] && handleDocUpload(e.target.files[0]));

  const log = $('chat-log');
  log.addEventListener('dragover', e => e.preventDefault());
  log.addEventListener('drop', e => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleDocUpload(f);
  });

  // Auto-lock on browser shutdown (the CryptoKey is already non-extractable and
  // the service worker is stateless, but this extra signal lets the badge update
  // on other tabs).
  window.addEventListener('beforeunload', () => {
    try { chrome.runtime.sendMessage({ type: 'vault-locked' }); } catch {}
  });
});

// ---------- bridge protocol ----------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== 'bridge-resolve') return;

  (async () => {
    if (!state.key) return { error: 'vault_locked' };
    const entry = findByName(msg.placeholder);
    if (!entry) return { error: 'not_found', placeholder: msg.placeholder };
    if (!entry.domain) return { error: 'no_domain_binding', placeholder: msg.placeholder };
    if (!originMatches(msg.origin, entry.domain)) {
      return { error: 'domain_mismatch', placeholder: msg.placeholder, expected: entry.domain };
    }
    try {
      const value = await revealSecret(entry.id);
      return { value };
    } catch {
      return { error: 'decrypt_failed' };
    }
  })().then(sendResponse);

  return true; // keep the channel open for async reply
});

function originMatches(origin, domain) {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    const d = domain.toLowerCase();
    return host === d || host.endsWith('.' + d);
  } catch { return false; }
}
