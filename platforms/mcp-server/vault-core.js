/**
 * EnigmAgent — shared vault core for Node.js platforms.
 *
 * Pure logic: key derivation, encryption/decryption, vault CRUD.
 * No browser APIs, no DOM, no chrome.* APIs.
 *
 * Used by: mcp-server, cli, npm-library, docker
 *
 * Requires Node.js >= 18 (globalThis.crypto.subtle + crypto.randomUUID).
 * Uses @noble/hashes/argon2 directly (not the browser IIFE bundle).
 */

import { argon2id as argon2idHash } from '@noble/hashes/argon2';

export const VAULT_VERSION = 1;
export const ARGON2_PARAMS = { t: 3, m: 65536, p: 1, dkLen: 32 };
const SALT_BYTES  = 16;
const NONCE_BYTES = 12;

const enc = new TextEncoder();
const dec = new TextDecoder();

// ---------- binary helpers ----------

export const b64 = {
  enc: (buf) => Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString('base64'),
  dec: (s)   => new Uint8Array(Buffer.from(s, 'base64')),
};

export function randomBytes(n) {
  const buf = new Uint8Array(n);
  // Node 18+ has globalThis.crypto.getRandomValues
  crypto.getRandomValues(buf);
  return buf;
}

export function newUUID() {
  return crypto.randomUUID();
}

// ---------- crypto ----------

/**
 * Derive a 256-bit AES-GCM key from (password, username, salt) using Argon2id.
 * Parameters are intentionally heavy: m=64 MiB, t=3 iterations.
 */
export async function deriveKey(password, username, saltBytes) {
  const ctx    = enc.encode(`enigma/v1|${username}`);
  const salted = new Uint8Array(saltBytes.length + ctx.length);
  salted.set(saltBytes, 0); salted.set(ctx, saltBytes.length);

  const raw = argon2idHash(enc.encode(password), salted, ARGON2_PARAMS);
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptString(key, plaintext) {
  const nonce = randomBytes(NONCE_BYTES);
  const ct    = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce }, key, enc.encode(plaintext)
  );
  return { nonce: b64.enc(nonce), ciphertext: b64.enc(ct) };
}

export async function decryptString(key, nonceB64, ctB64) {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64.dec(nonceB64) }, key, b64.dec(ctB64)
  );
  return dec.decode(pt);
}

// ---------- domain matching (same rule as extension/vault.js) ----------------

export function originMatches(origin, domain) {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    const d    = domain.toLowerCase();
    return host === d || host.endsWith('.' + d);
  } catch { return false; }
}

// ---------- VaultManager class -----------------------------------------------

export class VaultManager {
  /**
   * @param {object} storageAdapter
   *   { load(): Promise<object|null>, save(vault): Promise<void> }
   *   See FileStorage and MemoryStorage below.
   */
  constructor(storageAdapter) {
    this._storage  = storageAdapter || new MemoryStorage();
    this.key       = null;
    this.username  = null;
    this.vault     = null;
  }

  get isUnlocked() { return this.key !== null; }

  _requireUnlocked() {
    if (!this.key) throw new Error('vault_locked');
  }

  // ── Storage ───────────────────────────────────────────────────────────────
  async _load()      { return this._storage.load(); }
  async _save()      { return this._storage.save(this.vault); }

  // ── Create ────────────────────────────────────────────────────────────────
  async create(username, password) {
    const salt  = randomBytes(SALT_BYTES);
    const key   = await deriveKey(password, username, salt);
    this.key      = key;
    this.username = username;
    this.vault    = {
      version:    VAULT_VERSION,
      kdf:        'argon2id',
      kdf_params: { ...ARGON2_PARAMS },
      salt:       b64.enc(salt),
      check:      null,
      entries:    [],
    };
    this.vault.check = await encryptString(key, `enigmagent-check|${username}`);
    await this._save();
  }

  // ── Unlock ────────────────────────────────────────────────────────────────
  async unlock(username, password, vaultData) {
    const vault = vaultData || await this._load();
    if (!vault) throw new Error('No vault found. Create one first with: enigmagent create');
    if (vault.kdf && vault.kdf !== 'argon2id') throw new Error(`Unsupported KDF: ${vault.kdf}`);

    const key = await deriveKey(password, username, b64.dec(vault.salt));
    if (vault.check) {
      try {
        const pt = await decryptString(key, vault.check.nonce, vault.check.ciphertext);
        if (pt !== `enigmagent-check|${username}`) throw new Error('mismatch');
      } catch { throw new Error('Wrong username or password.'); }
    } else if (vault.entries.length > 0) {
      try { await decryptString(key, vault.entries[0].nonce, vault.entries[0].ciphertext); }
      catch { throw new Error('Wrong username or password.'); }
    }
    this.key = key; this.username = username; this.vault = vault;
    if (vaultData) await this._save();
  }

  // ── Lock ──────────────────────────────────────────────────────────────────
  lock() {
    this.key = null; this.username = null; this.vault = null;
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  async addSecret({ name, domain, value }) {
    this._requireUnlocked();
    if (!name) throw new Error('Name is required.');
    if (!/^[A-Z0-9_:\-.@]+$/i.test(name)) throw new Error('Invalid secret name: use A-Z 0-9 _ : - . @');
    if (this.vault.entries.some(e => e.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(`Secret "${name}" already exists.`);
    }
    const { nonce, ciphertext } = await encryptString(this.key, value || '');
    const entry = {
      id:      newUUID(),
      name,
      domain:  domain || null,
      created: new Date().toISOString(),
      nonce,
      ciphertext,
    };
    this.vault.entries.push(entry);
    await this._save();
    return entry;
  }

  async updateSecret(id, patch) {
    this._requireUnlocked();
    const e = this.vault.entries.find(x => x.id === id);
    if (!e) throw new Error('not_found');
    if (patch.name   !== undefined) e.name   = patch.name;
    if (patch.domain !== undefined) e.domain = patch.domain || null;
    if (patch.value  !== undefined) {
      const { nonce, ciphertext } = await encryptString(this.key, patch.value);
      e.nonce = nonce; e.ciphertext = ciphertext;
    }
    await this._save();
  }

  async deleteSecret(id) {
    this._requireUnlocked();
    this.vault.entries = this.vault.entries.filter(e => e.id !== id);
    await this._save();
  }

  async revealSecret(id) {
    this._requireUnlocked();
    const e = this.vault.entries.find(x => x.id === id);
    if (!e) throw new Error('not_found');
    return decryptString(this.key, e.nonce, e.ciphertext);
  }

  findByName(name) {
    this._requireUnlocked();
    const lower = name.toLowerCase();
    if (lower.startsWith('login:')) {
      const dom = lower.slice(6);
      return this.vault.entries.find(e => e.domain?.toLowerCase() === dom) || null;
    }
    if (lower.startsWith('doc:')) {
      const raw     = name.slice(4).replace(/[^A-Za-z0-9_.\-]/g, '_');
      const docName = 'DOC_' + raw;
      return this.vault.entries.find(e => e.name.toLowerCase() === docName.toLowerCase()) || null;
    }
    return this.vault.entries.find(e => e.name.toLowerCase() === lower) || null;
  }

  // ── High-level resolve (used by MCP server and content-script bridge) ─────
  async resolve(placeholder, origin) {
    this._requireUnlocked();
    const entry = this.findByName(placeholder);
    if (!entry)         throw Object.assign(new Error('not_found'),        { code: 'not_found',        placeholder });
    if (!entry.domain)  throw Object.assign(new Error('no_domain_binding'),{ code: 'no_domain_binding', placeholder });
    if (!originMatches(origin, entry.domain)) {
      throw Object.assign(
        new Error(`domain_mismatch: bound to ${entry.domain}`),
        { code: 'domain_mismatch', expected: entry.domain, placeholder }
      );
    }
    return this.revealSecret(entry.id);
  }

  // ── List entries (no values) ──────────────────────────────────────────────
  list() {
    this._requireUnlocked();
    return this.vault.entries.map(({ id, name, domain, created }) => ({ id, name, domain, created }));
  }
}

// ---------- Storage adapters -------------------------------------------------

/** File-based storage — vault persisted as JSON on disk. */
export class FileStorage {
  constructor(vaultPath) {
    this.path = vaultPath;
  }
  async load() {
    const { existsSync, readFileSync } = await import('node:fs');
    if (!existsSync(this.path)) return null;
    try { return JSON.parse(readFileSync(this.path, 'utf8')); }
    catch { return null; }
  }
  async save(vault) {
    const { writeFileSync, mkdirSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    mkdirSync(dirname(resolve(this.path)), { recursive: true });
    writeFileSync(this.path, JSON.stringify(vault, null, 2), 'utf8');
  }
}

/** In-memory storage — data lost on process exit. Useful for testing. */
export class MemoryStorage {
  constructor(initialVault) { this._vault = initialVault || null; }
  async load() { return this._vault; }
  async save(vault) { this._vault = vault; }
}
