/**
 * EnigmAgent authenticated vault format v2 and transactional local storage.
 *
 * The complete entry set (names, domains, IDs and values) is encrypted and
 * authenticated together. Legacy v1 vaults can be read, but mutations require an
 * explicit migration. No plaintext values are exposed by JSON serialization.
 * Storage writes are serialized, use revision checks and preserve one backup.
 */
import { argon2id as argon2idHash } from '@noble/hashes/argon2';
import { createHash, webcrypto, randomUUID } from 'node:crypto';
import { open, mkdir, rename, rm, lstat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { hostname } from 'node:os';

export const VAULT_VERSION = 2;
export const ARGON2_PARAMS = Object.freeze({ t: 3, m: 65536, p: 1, dkLen: 32 });
export const MAX_VAULT_BYTES = 8 * 1024 * 1024;
export const MAX_SECRET_BYTES = 64 * 1024;
const MAX_ENTRIES = 4096;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const clone = value => structuredClone(value);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Stable error codes deliberately omit filenames, ciphertext and secret values. */
export class VaultError extends Error {
  constructor(code) { super(code); this.name = 'VaultError'; this.code = code; }
}
function fail(code) { throw new VaultError(code); }
function exactKeys(value, required, optional = []) {
  if (!object(value) || required.some(key => !Object.hasOwn(value, key)) ||
      Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) fail('invalid_vault');
}
function boundedString(value, limit, empty = false) {
  return typeof value === 'string' && (empty || value.length > 0) && Buffer.byteLength(value) <= limit;
}

/** Canonical base64 decoding rejects ignored bytes, truncation and alternate encodings. */
export const b64 = {
  enc: bytes => Buffer.from(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes).toString('base64'),
  dec: value => {
    if (typeof value !== 'string' || value.length > MAX_VAULT_BYTES ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) fail('invalid_vault');
    const bytes = Buffer.from(value, 'base64');
    if (bytes.toString('base64') !== value) fail('invalid_vault');
    return new Uint8Array(bytes);
  },
};
export function randomBytes(length) { return webcrypto.getRandomValues(new Uint8Array(length)); }
export function newUUID() { return randomUUID(); }

/** Preserve the original username-bound KDF for explicit v1 migration compatibility. */
export async function deriveKey(password, username, saltBytes) {
  if (!boundedString(password, 4096) || !boundedString(username, 256) || saltBytes?.length !== 16) fail('invalid_credentials');
  const context = encoder.encode(`enigma/v1|${username}`);
  const salt = new Uint8Array(saltBytes.length + context.length);
  salt.set(saltBytes); salt.set(context, saltBytes.length);
  const passwordBytes = encoder.encode(password);
  let raw;
  try {
    raw = argon2idHash(passwordBytes, salt, ARGON2_PARAMS);
    return await webcrypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  } finally {
    passwordBytes.fill(0); raw?.fill(0);
    // Clearing these buffers does not guarantee erasure of JavaScript strings or engine copies.
  }
}

/** Encrypt text with a fresh 96-bit nonce; optional AAD binds the envelope header. */
export async function encryptString(key, plaintext, additionalData) {
  if (typeof plaintext !== 'string') fail('invalid_value');
  const nonce = randomBytes(12);
  const ciphertext = await webcrypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, ...(additionalData ? { additionalData } : {}) }, key, encoder.encode(plaintext));
  return { nonce: b64.enc(nonce), ciphertext: b64.enc(ciphertext) };
}

/** Authenticate before decoding plaintext. Never return partial decrypted content. */
export async function decryptString(key, nonce, ciphertext, additionalData) {
  const iv = b64.dec(nonce), bytes = b64.dec(ciphertext);
  if (iv.length !== 12 || bytes.length < 16) fail('invalid_vault');
  const plaintext = await webcrypto.subtle.decrypt(
    { name: 'AES-GCM', iv, ...(additionalData ? { additionalData } : {}) }, key, bytes);
  try { return decoder.decode(plaintext); } finally { new Uint8Array(plaintext).fill(0); }
}

/** Normalize a hostname only: no URL, credentials, port, wildcard or path is accepted. */
export function normalizeDomain(domain) {
  if (domain === undefined || domain === null || domain === '') return null;
  if (!boundedString(domain, 253) || domain.trim() !== domain || /[\s/@?#\\]/.test(domain) ||
      (domain.includes(':') && !/^\[[0-9a-fA-F:]+\]$/.test(domain))) fail('invalid_domain');
  let parsed;
  try { parsed = new URL(`https://${domain}`); } catch { fail('invalid_domain'); }
  const host = parsed.hostname.toLowerCase();
  if (parsed.port || parsed.username || parsed.password || parsed.pathname !== '/' ||
      host.startsWith('.') || host.endsWith('.') || host.includes('..') ||
      (host !== 'localhost' && !host.includes('.') && !host.startsWith('['))) fail('invalid_domain');
  if (!host.startsWith('[') && !host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) fail('invalid_domain');
  return host;
}

/** Legacy-compatible subdomain matching for trusted resolvers, never origin attestation. */
export function originMatches(origin, domain) {
  try {
    const url = new URL(origin), bound = normalizeDomain(domain);
    if (!bound || !['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.hostname.endsWith('.')) return false;
    return url.hostname === bound || url.hostname.endsWith(`.${bound}`);
  } catch { return false; }
}
function validateName(name) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9_:.@-]{1,128}$/.test(name)) fail('invalid_name');
  return name;
}
function validateEntries(entries, encrypted = false) {
  if (!Array.isArray(entries) || entries.length > MAX_ENTRIES) fail('invalid_vault');
  const names = new Set(), ids = new Set();
  for (const entry of entries) {
    exactKeys(entry, ['id', 'name', 'domain', 'created', ...(encrypted ? ['nonce', 'ciphertext'] : ['value'])]);
    validateName(entry.name);
    if (!boundedString(entry.id, 128) || !boundedString(entry.created, 64) || !Number.isFinite(Date.parse(entry.created)) ||
        names.has(entry.name.toLowerCase()) || ids.has(entry.id)) fail('invalid_vault');
    normalizeDomain(entry.domain); names.add(entry.name.toLowerCase()); ids.add(entry.id);
    if (encrypted) {
      if (b64.dec(entry.nonce).length !== 12 || b64.dec(entry.ciphertext).length < 16) fail('invalid_vault');
    } else if (!boundedString(entry.value, MAX_SECRET_BYTES, true)) fail('invalid_value');
  }
}
function headerAAD(salt) {
  return encoder.encode(`enigmagent-envelope|2|argon2id|t=3|m=65536|p=1|dkLen=32|${salt}`);
}
function validateHeader(data) {
  if (!object(data) || ![1, 2].includes(data.version) || data.kdf !== 'argon2id') fail('unsupported_vault_format');
  exactKeys(data.kdf_params, Object.keys(ARGON2_PARAMS));
  for (const [key, value] of Object.entries(ARGON2_PARAMS)) if (data.kdf_params[key] !== value) fail('unsupported_kdf_parameters');
  if (b64.dec(data.salt).length !== 16) fail('invalid_vault');
  if (data.version === 2) {
    exactKeys(data, ['version', 'kdf', 'kdf_params', 'salt', 'payload']);
    exactKeys(data.payload, ['nonce', 'ciphertext']);
    if (b64.dec(data.payload.nonce).length !== 12 || b64.dec(data.payload.ciphertext).length < 16) fail('invalid_vault');
  } else {
    exactKeys(data, ['version', 'kdf', 'kdf_params', 'salt', 'entries'], ['check']);
    validateEntries(data.entries, true);
    if (data.check) {
      exactKeys(data.check, ['nonce', 'ciphertext']);
      if (b64.dec(data.check.nonce).length !== 12 || b64.dec(data.check.ciphertext).length < 16) fail('invalid_vault');
    } else if (!data.entries.length) fail('unverifiable_legacy_vault');
  }
}

/** Validate every entry and its authentication tag before opening a session. */
async function decodeVault(data, username, password) {
  validateHeader(data);
  const key = await deriveKey(password, username, b64.dec(data.salt));
  let entries;
  try {
    if (data.version === 2) {
      const payload = JSON.parse(await decryptString(key, data.payload.nonce, data.payload.ciphertext, headerAAD(data.salt)));
      exactKeys(payload, ['format', 'username', 'entries']);
      if (payload.format !== 'enigmagent-payload-v2' || payload.username !== username) fail('vault_authentication_failed');
      validateEntries(payload.entries); entries = payload.entries;
    } else {
      if (data.check && await decryptString(key, data.check.nonce, data.check.ciphertext) !== `enigmagent-check|${username}`) fail('vault_authentication_failed');
      entries = [];
      for (const entry of data.entries) {
        entries.push({ id: entry.id, name: entry.name, domain: normalizeDomain(entry.domain), created: entry.created,
          value: await decryptString(key, entry.nonce, entry.ciphertext) });
      }
      validateEntries(entries);
    }
  } catch { fail('vault_authentication_failed'); }
  return { key, entries };
}

/** Seal names, domains and the complete entry set together, including an empty vault. */
async function encodeVault(key, username, salt, entries) {
  validateEntries(entries);
  const plaintext = JSON.stringify({ format: 'enigmagent-payload-v2', username, entries });
  if (Buffer.byteLength(plaintext) > MAX_VAULT_BYTES / 2) fail('vault_too_large');
  return { version: 2, kdf: 'argon2id', kdf_params: { ...ARGON2_PARAMS }, salt,
    payload: await encryptString(key, plaintext, headerAAD(salt)) };
}
function metadata({ id, name, domain, created }) { return { id, name, domain, created }; }

/**
 * Private in-memory session. Failed writes never change its committed state.
 * Locked or superseded asynchronous operations cannot reopen the session.
 */
export class VaultManager {
  #storage; #key = null; #username = null; #entries = []; #envelope = null;
  #revision = null; #epoch = 0; #tail = Promise.resolve();
  constructor(storage = new MemoryStorage()) {
    if (typeof storage.loadSnapshot !== 'function' || typeof storage.save !== 'function') fail('invalid_storage_adapter');
    this.#storage = storage;
  }
  get isUnlocked() { return this.#key !== null; }
  get username() { return this.#username; }
  get formatVersion() { return this.#envelope?.version ?? null; }
  get vault() { this.#require(); return clone(this.#envelope); }
  #require() { if (!this.isUnlocked) fail('vault_locked'); }
  #current(epoch) { this.#require(); if (this.#epoch !== epoch) fail('session_changed'); }
  lock() { this.#epoch++; this.#key = null; this.#username = null; this.#entries = []; this.#envelope = null; this.#revision = null; }

  /** Create without overwriting any existing or corrupt file. */
  async create(username, password) {
    this.lock(); const epoch = this.#epoch;
    const snapshot = await this.#storage.loadSnapshot();
    if (snapshot.data !== null) fail('vault_exists');
    const salt = b64.enc(randomBytes(16));
    const key = await deriveKey(password, username, b64.dec(salt));
    const envelope = await encodeVault(key, username, salt, []);
    if (this.#epoch !== epoch) fail('session_changed');
    const revision = await this.#storage.save(envelope, { expectedRevision: snapshot.revision });
    if (this.#epoch !== epoch) fail('session_changed');
    this.#key = key; this.#username = username; this.#envelope = envelope; this.#entries = []; this.#revision = revision;
  }

  /** Legacy input is read-only until migrate(); imported data cannot replace a file implicitly. */
  async unlock(username, password, vaultData) {
    this.lock(); const epoch = this.#epoch;
    if (vaultData !== undefined) fail('explicit_import_required');
    const snapshot = await this.#storage.loadSnapshot();
    if (snapshot.data === null) fail('vault_not_found');
    const { key, entries } = await decodeVault(snapshot.data, username, password);
    if (this.#epoch !== epoch) fail('session_changed');
    this.#key = key; this.#username = username; this.#entries = entries;
    this.#envelope = clone(snapshot.data); this.#revision = snapshot.revision;
  }

  /** Queue one mutation and commit memory only after optimistic disk commit succeeds. */
  #mutate(change, migration = false) {
    const epoch = this.#epoch;
    const task = this.#tail.then(async () => {
      this.#current(epoch);
      if (!migration && this.formatVersion !== 2) fail('migration_required');
      const entries = clone(this.#entries);
      const result = change(entries);
      const envelope = await encodeVault(this.#key, this.#username, this.#envelope.salt, entries);
      this.#current(epoch);
      const revision = await this.#storage.save(envelope, { expectedRevision: this.#revision });
      this.#current(epoch);
      this.#entries = entries; this.#envelope = envelope; this.#revision = revision;
      return result;
    });
    this.#tail = task.catch(() => {});
    return task;
  }

  /** Explicit v1 -> v2 migration preserves the old file in the storage backup. */
  async migrate() {
    this.#require();
    if (this.formatVersion === 2) return { migrated: false, version: 2 };
    return this.#mutate(() => ({ migrated: true, version: 2 }), true);
  }
  async addSecret({ name, domain = null, value }) {
    validateName(name); domain = normalizeDomain(domain);
    if (!boundedString(value, MAX_SECRET_BYTES, true)) fail('invalid_value');
    return this.#mutate(entries => {
      if (entries.some(entry => entry.name.toLowerCase() === name.toLowerCase())) fail('duplicate_name');
      const entry = { id: newUUID(), name, domain, created: new Date().toISOString(), value };
      entries.push(entry); return metadata(entry);
    });
  }
  async updateSecret(id, patch) {
    if (!object(patch) || Object.keys(patch).some(key => !['name', 'domain', 'value'].includes(key))) fail('invalid_patch');
    const checked = clone(patch);
    if (checked.name !== undefined) validateName(checked.name);
    if (checked.domain !== undefined) checked.domain = normalizeDomain(checked.domain);
    if (checked.value !== undefined && !boundedString(checked.value, MAX_SECRET_BYTES, true)) fail('invalid_value');
    return this.#mutate(entries => {
      const entry = entries.find(item => item.id === id); if (!entry) fail('not_found');
      if (checked.name !== undefined && entries.some(item => item.id !== id && item.name.toLowerCase() === checked.name.toLowerCase())) fail('duplicate_name');
      Object.assign(entry, checked); return metadata(entry);
    });
  }
  async deleteSecret(id) {
    return this.#mutate(entries => {
      const index = entries.findIndex(entry => entry.id === id); if (index < 0) fail('not_found');
      entries.splice(index, 1);
    });
  }
  async revealSecret(id) {
    this.#require(); const entry = this.#entries.find(item => item.id === id);
    if (!entry) fail('not_found'); return entry.value;
  }
  #find(name) {
    this.#require(); validateName(name); const lower = name.toLowerCase();
    if (lower.startsWith('login:')) return this.#entries.find(entry => entry.domain === lower.slice(6));
    if (lower.startsWith('doc:')) return this.#entries.find(entry => entry.name.toLowerCase() === `doc_${name.slice(4)}`.toLowerCase());
    return this.#entries.find(entry => entry.name.toLowerCase() === lower);
  }
  findByName(name) { const entry = this.#find(name); return entry ? metadata(entry) : null; }
  async resolve(placeholder, origin) {
    const entry = this.#find(placeholder); if (!entry) fail('not_found');
    if (!entry.domain) fail('no_domain_binding');
    if (!originMatches(origin, entry.domain)) fail('domain_mismatch');
    return entry.value;
  }
  list() { this.#require(); return this.#entries.map(metadata); }

  /** Export only the encrypted envelope to a new destination without overwriting it. */
  async exportTo(path) {
    this.#require(); const data = clone(this.#envelope);
    const destination = new FileStorage(path);
    await destination.save(data, { expectedRevision: null });
  }

  /** Restore a verified backup explicitly and retain damaged bytes in a separate file. */
  async recoverBackup(username, password) {
    this.lock(); const epoch = this.#epoch;
    if (typeof this.#storage.recoverBackup !== 'function') fail('backup_not_supported');
    await this.#storage.recoverBackup(async data => {
      const verified = await decodeVault(data, username, password);
      if (this.#epoch !== epoch) fail('session_changed');
      return verified;
    });
    if (this.#epoch !== epoch) fail('session_changed');
    await this.unlock(username, password);
  }
}

/** Read a regular non-symlink file into a fixed upper bound. Missing is not corruption. */
async function readBytes(path, missing = false) {
  let handle;
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.nlink > 1) fail('unsafe_storage_file');
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > MAX_VAULT_BYTES) fail('vault_too_large');
    const buffer = Buffer.alloc(Math.min(MAX_VAULT_BYTES + 1, stat.size + 1));
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await handle.read(buffer, size, buffer.length - size, size);
      if (!bytesRead) break; size += bytesRead;
    }
    if (size > MAX_VAULT_BYTES || size > stat.size) fail('storage_changed');
    return buffer.subarray(0, size);
  } catch (error) {
    if (error.code === 'ENOENT' && missing) return null;
    if (error instanceof VaultError) throw error;
    fail('storage_read_failed');
  } finally { await handle?.close(); }
}
function parseBytes(bytes) {
  try { return JSON.parse(decoder.decode(bytes)); } catch { fail('corrupt_vault'); }
}
async function syncDirectory(path) {
  if (process.platform === 'win32') return; // Windows directory fsync is not supported here.
  let handle;
  try { handle = await open(path, constants.O_RDONLY); await handle.sync(); }
  finally { await handle?.close(); }
}

/** Write and flush a new restrictive file, then replace the directory entry atomically. */
async function atomicReplace(path, bytes) {
  const temp = `${path}.tmp-${randomUUID()}`;
  let handle;
  try {
    try { const target = await lstat(path); if (!target.isFile() || target.isSymbolicLink() || target.nlink > 1) fail('unsafe_storage_file'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    handle = await open(temp, 'wx', 0o600);
    await handle.writeFile(bytes); await handle.sync(); await handle.close(); handle = undefined;
    await rename(temp, path); await syncDirectory(dirname(path));
  } finally { await handle?.close(); await rm(temp, { force: true }).catch(() => {}); }
}

/**
 * Local filesystem storage: atomic replacement, one verified-session backup and
 * a mkdir lock for cooperating writers. A stale lock is never deleted on a timer.
 * The containing directory must be trusted. POSIX modes do not configure Windows ACLs.
 */
export class FileStorage {
  constructor(path) {
    Object.defineProperty(this, 'path', { value: resolvePath(path), enumerable: true, writable: false });
  }
  async loadSnapshot() {
    const bytes = await readBytes(this.path, true);
    return bytes === null ? { data: null, revision: null } : { data: parseBytes(bytes), revision: digest(bytes) };
  }
  async load() { return (await this.loadSnapshot()).data; }
  async #locked(fn) {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const lock = `${this.path}.lock`, deadline = Date.now() + 2000;
    let acquired = false;
    while (!acquired) {
      try { await mkdir(lock, { mode: 0o700 }); acquired = true; }
      catch (error) {
        if (error.code !== 'EEXIST') fail('storage_lock_failed');
        if (Date.now() >= deadline) fail('storage_busy');
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    }
    try {
      const owner = await open(`${lock}/owner.json`, 'wx', 0o600);
      try { await owner.writeFile(JSON.stringify({ pid: process.pid, host: hostname(), nonce: randomUUID() })); }
      finally { await owner.close(); }
      return await fn();
    } finally { await rm(lock, { recursive: true, force: true }); }
  }
  async save(data, { expectedRevision } = {}) {
    if (expectedRevision !== null && !/^[a-f0-9]{64}$/.test(expectedRevision || '')) fail('revision_required');
    const bytes = Buffer.from(JSON.stringify(data, null, 2) + '\n');
    if (bytes.length > MAX_VAULT_BYTES) fail('vault_too_large');
    return this.#locked(async () => {
      const previous = await readBytes(this.path, true);
      if ((previous === null ? null : digest(previous)) !== expectedRevision) fail('storage_conflict');
      if (previous !== null && data.version === 2 && parseBytes(previous).version === 1) {
        // Preserve the original v1 file permanently, not just until the next write.
        const historical = `${this.path}.v1-backup`;
        let backup;
        try {
          backup = await open(historical, 'wx', 0o600);
          await backup.writeFile(previous); await backup.sync();
        } catch (error) {
          if (error.code !== 'EEXIST') throw error;
          const existing = await readBytes(historical);
          if (!existing.equals(previous)) fail('legacy_backup_conflict');
        } finally { await backup?.close(); }
      }
      if (previous !== null) await atomicReplace(`${this.path}.bak`, previous);
      await atomicReplace(this.path, bytes);
      return digest(bytes);
    });
  }
  async recoverBackup(verify) {
    return this.#locked(async () => {
      const backup = await readBytes(`${this.path}.bak`);
      await verify(parseBytes(backup));
      const previous = await readBytes(this.path, true);
      if (previous !== null) {
        const damaged = `${this.path}.damaged-${Date.now()}-${randomUUID()}`;
        const handle = await open(damaged, 'wx', 0o600);
        try { await handle.writeFile(previous); await handle.sync(); } finally { await handle.close(); }
      }
      await atomicReplace(this.path, backup);
    });
  }
}

/** Copy-on-read/write in-memory storage with the same optimistic revision contract. */
export class MemoryStorage {
  #data;
  constructor(initial = null) { this.#data = clone(initial); }
  async loadSnapshot() {
    return { data: clone(this.#data), revision: this.#data === null ? null : digest(JSON.stringify(this.#data)) };
  }
  async load() { return clone(this.#data); }
  async save(data, { expectedRevision } = {}) {
    const current = this.#data === null ? null : digest(JSON.stringify(this.#data));
    if (expectedRevision === undefined) fail('revision_required');
    if (current !== expectedRevision) fail('storage_conflict');
    this.#data = clone(data); return digest(JSON.stringify(this.#data));
  }
}
