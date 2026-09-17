/** Cryptographic migration, transaction, corruption and recovery regression tests. */
import assert from 'node:assert/strict';
import { test, before } from 'node:test';
import { mkdtemp, rm, readFile, writeFile, readdir, stat, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  VaultManager, FileStorage, MemoryStorage, b64, deriveKey, encryptString,
  randomBytes, ARGON2_PARAMS, normalizeDomain, originMatches,
} from '../vault-core.js';
const USER = 'fixture-user', PASS = 'synthetic-password-only';
const SECRET = 'SYNTHETIC_VAULT_V2_SENTINEL';
let v2, legacy;
before(async () => {
  const memory = new MemoryStorage(), vault = new VaultManager(memory);
  await vault.create(USER, PASS);
  await vault.addSecret({ name: 'TOKEN', domain: 'example.com', value: SECRET });
  v2 = await memory.load(); vault.lock();
  const salt = randomBytes(16), key = await deriveKey(PASS, USER, salt);
  legacy = { version: 1, kdf: 'argon2id', kdf_params: { ...ARGON2_PARAMS }, salt: b64.enc(salt),
    check: await encryptString(key, `enigmagent-check|${USER}`), entries: [
      { id: 'legacy-entry', name: 'TOKEN', domain: 'example.com', created: '2026-09-17T00:00:00Z',
        ...await encryptString(key, SECRET) },
    ] };
});
async function opened(initial = v2, Storage = MemoryStorage) {
  const storage = new Storage(initial), vault = new VaultManager(storage);
  await vault.unlock(USER, PASS); return { vault, storage };
}
async function folder(t) {
  const path = await mkdtemp(join(tmpdir(), 'enigmagent-storage-'));
  t.after(() => rm(path, { recursive: true, force: true })); return path;
}
function mutateBase64(value) { const bytes = b64.dec(value); bytes[0] ^= 1; return b64.enc(bytes); }

test('v2 authenticates and hides all entry metadata on disk', async () => {
  const encoded = JSON.stringify(v2);
  for (const value of [SECRET, 'example.com', 'TOKEN', USER]) assert(!encoded.includes(value));
  const { vault } = await opened();
  assert.equal(vault.formatVersion, 2); assert.equal(await vault.resolve('TOKEN', 'https://example.com'), SECRET);
  assert(!JSON.stringify(vault).includes(SECRET)); assert(!JSON.stringify(vault.vault).includes(SECRET));
  assert.equal(vault.key, undefined); assert.equal(vault.findByName('TOKEN').value, undefined);
});
test('editing metadata requires a successful authenticated rewrite', async () => {
  const { vault, storage } = await opened(); const entry = vault.list()[0];
  await vault.updateSecret(entry.id, { name: 'RENAMED', domain: 'other.example', value: 'changed' });
  vault.lock(); await vault.unlock(USER, PASS);
  assert.equal(await vault.resolve('RENAMED', 'https://other.example'), 'changed');
  await assert.rejects(vault.resolve('RENAMED', 'https://example.com'), { code: 'domain_mismatch' });
  assert(!(JSON.stringify(await storage.load())).includes('other.example'));
});
for (const field of ['nonce', 'ciphertext']) test(`tampering envelope ${field} is rejected before unlock`, async () => {
  const data = structuredClone(v2); data.payload[field] = mutateBase64(data.payload[field]);
  const vault = new VaultManager(new MemoryStorage(data));
  await assert.rejects(vault.unlock(USER, PASS), { code: 'vault_authentication_failed' });
  assert.equal(vault.isUnlocked, false);
});
test('tampering the salt, version or KDF cannot downgrade authentication', async () => {
  for (const change of [d => d.salt = mutateBase64(d.salt), d => d.version = 1,
      d => d.kdf_params.m = 8, d => d.entries = []]) {
    const data = structuredClone(v2); change(data); const vault = new VaultManager(new MemoryStorage(data));
    await assert.rejects(vault.unlock(USER, PASS)); assert.equal(vault.isUnlocked, false);
  }
});
test('wrong-password and malformed unlock attempts lock a previously unlocked session', async () => {
  const { vault } = await opened();
  await assert.rejects(vault.unlock(USER, 'incorrect'), { code: 'vault_authentication_failed' });
  assert.equal(vault.isUnlocked, false); assert.throws(() => vault.list(), { code: 'vault_locked' });
});
test('empty v2 vault authenticates its password', async () => {
  const storage = new MemoryStorage(), vault = new VaultManager(storage);
  await vault.create(USER, PASS); vault.lock();
  await assert.rejects(vault.unlock(USER, 'incorrect'), { code: 'vault_authentication_failed' });
  await vault.unlock(USER, PASS); assert.deepEqual(vault.list(), []);
});
test('legacy empty vault without a verifier fails closed', async () => {
  const data = { ...legacy, check: null, entries: [] };
  await assert.rejects(new VaultManager(new MemoryStorage(data)).unlock(USER, PASS), { code: 'unverifiable_legacy_vault' });
});
test('legacy metadata, duplicate IDs/names and malformed parameters are rejected', async () => {
  for (const change of [d => d.entries.push({ ...d.entries[0] }), d => d.entries[0].name = 'bad/name',
      d => d.entries[0].domain = 'https://example.com', d => d.kdf_params.p = 2,
      d => d.salt = 'not canonical base64']) {
    const data = structuredClone(legacy); change(data);
    await assert.rejects(new VaultManager(new MemoryStorage(data)).unlock(USER, PASS));
  }
});
test('legacy v1 is read-only until explicit migration and migration preserves values', async () => {
  const { vault, storage } = await opened(legacy); const before = await storage.load();
  assert.equal(vault.formatVersion, 1);
  assert.equal(await vault.resolve('TOKEN', 'https://example.com'), SECRET);
  await assert.rejects(vault.addSecret({ name: 'SECOND', domain: 'example.com', value: 'test' }), { code: 'migration_required' });
  assert.deepEqual(await storage.load(), before);
  assert.deepEqual(await vault.migrate(), { migrated: true, version: 2 });
  assert.deepEqual(await vault.migrate(), { migrated: false, version: 2 });
  vault.lock(); await vault.unlock(USER, PASS);
  assert.equal(await vault.resolve('TOKEN', 'https://example.com'), SECRET);
});
test('legacy authentication checks every entry rather than only the first', async () => {
  const data = structuredClone(legacy);
  data.entries.push({ ...data.entries[0], id: 'second', name: 'SECOND', ciphertext: mutateBase64(data.entries[0].ciphertext) });
  await assert.rejects(new VaultManager(new MemoryStorage(data)).unlock(USER, PASS), { code: 'vault_authentication_failed' });
});
test('failed persistence never changes committed in-memory state', async () => {
  class FailingStorage extends MemoryStorage { async save() { throw new Error('synthetic write failure'); } }
  const { vault } = await opened(v2, FailingStorage); const before = vault.vault;
  await assert.rejects(vault.updateSecret(vault.list()[0].id, { value: 'not committed' }));
  assert.deepEqual(vault.vault, before); assert.equal(await vault.resolve('TOKEN', 'https://example.com'), SECRET);
});
test('concurrent mutations within one session are serialized without lost entries', async () => {
  const { vault } = await opened();
  await Promise.all(Array.from({ length: 12 }, (_, i) => vault.addSecret({ name: `TOKEN_${i}`, domain: 'example.com', value: `fixture_${i}` })));
  assert.equal(vault.list().length, 13); vault.lock(); await vault.unlock(USER, PASS);
  assert.equal(vault.list().length, 13);
});
test('independent sessions sharing one storage instance cannot silently overwrite', async () => {
  const storage = new MemoryStorage(v2), first = new VaultManager(storage), second = new VaultManager(storage);
  await first.unlock(USER, PASS); await second.unlock(USER, PASS);
  await first.addSecret({ name: 'FIRST', domain: null, value: '1' });
  await assert.rejects(second.addSecret({ name: 'SECOND', domain: null, value: '2' }), { code: 'storage_conflict' });
  assert.equal(second.list().length, 1); await second.unlock(USER, PASS); assert.equal(second.list().length, 2);
});
test('duplicate rename and invalid patch leave all data unchanged', async () => {
  const { vault } = await opened(); const second = await vault.addSecret({ name: 'SECOND', value: '2' });
  const before = vault.vault;
  for (const patch of [{ name: 'token' }, { name: '' }, { value: 5 }, { domain: 'example.com:443' }, { unknown: true }]) {
    await assert.rejects(vault.updateSecret(second.id, patch)); assert.deepEqual(vault.vault, before);
  }
});
test('locking during an asynchronous save cannot reopen the session', async () => {
  let release, started;
  const saving = new Promise(resolve => { started = resolve; });
  class PausedStorage extends MemoryStorage {
    async save(data, options) { started(); await new Promise(resolve => { release = resolve; }); return super.save(data, options); }
  }
  const { vault } = await opened(v2, PausedStorage);
  const pending = vault.addSecret({ name: 'QUEUED', value: 'fixture' });
  await saving; vault.lock(); release();
  await assert.rejects(pending, { code: 'vault_locked' }); assert.equal(vault.isUnlocked, false);
});
test('public snapshots and metadata cannot mutate internal state', async () => {
  const { vault, storage } = await opened();
  const envelope = vault.vault; envelope.payload.ciphertext = 'changed';
  const entries = vault.list(); entries[0].domain = 'attacker.example';
  const stored = await storage.load(); stored.payload.nonce = 'changed';
  assert.equal(await vault.resolve('TOKEN', 'https://example.com'), SECRET);
  assert.notEqual(vault.vault.payload.ciphertext, 'changed');
});
test('create never overwrites an existing vault', async () => {
  const storage = new MemoryStorage(v2), vault = new VaultManager(storage);
  await assert.rejects(vault.create(USER, PASS), { code: 'vault_exists' }); assert.deepEqual(await storage.load(), v2);
});
test('legacy import via unlock cannot overwrite an existing destination', async () => {
  const { vault, storage } = await opened();
  await assert.rejects(vault.unlock(USER, PASS, legacy), { code: 'explicit_import_required' });
  assert.deepEqual(await storage.load(), v2); assert.equal(vault.isUnlocked, false);
});
test('atomic migration preserves exact old bytes and restrictive file modes', async t => {
  const dir = await folder(t), path = join(dir, 'vault.json'); const old = JSON.stringify(legacy);
  await writeFile(path, old); const vault = new VaultManager(new FileStorage(path));
  await vault.unlock(USER, PASS); await vault.migrate();
  assert.equal(await readFile(`${path}.bak`, 'utf8'), old);
  assert.equal(await readFile(`${path}.v1-backup`, 'utf8'), old);
  await vault.addSecret({ name: 'AFTER_MIGRATION', value: 'synthetic' });
  assert.equal(await readFile(`${path}.v1-backup`, 'utf8'), old);
  assert.equal(JSON.parse(await readFile(path, 'utf8')).version, 2);
  assert(!(await readdir(dir)).some(name => name.includes('.tmp-') || name.endsWith('.lock')));
  if (process.platform !== 'win32') assert.equal((await stat(path)).mode & 0o777, 0o600);
});
test('filesystem writers detect conflicts and preserve the successful writer', async t => {
  const dir = await folder(t), path = join(dir, 'vault.json'); await writeFile(path, JSON.stringify(v2));
  const a = new VaultManager(new FileStorage(path)), b = new VaultManager(new FileStorage(path));
  await a.unlock(USER, PASS); await b.unlock(USER, PASS);
  const outcomes = await Promise.allSettled([a.addSecret({ name: 'A', value: 'a' }), b.addSecret({ name: 'B', value: 'b' })]);
  assert.equal(outcomes.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find(item => item.status === 'rejected').reason.code, 'storage_conflict');
  const reader = new VaultManager(new FileStorage(path)); await reader.unlock(USER, PASS); assert.equal(reader.list().length, 2);
});
test('corrupt files are not treated as missing and cannot be overwritten by create', async t => {
  const dir = await folder(t), path = join(dir, 'vault.json'); await writeFile(path, '{truncated');
  const vault = new VaultManager(new FileStorage(path));
  await assert.rejects(vault.create(USER, PASS), { code: 'corrupt_vault' });
  assert.equal(await readFile(path, 'utf8'), '{truncated');
});
test('explicit recovery verifies backup credentials and retains damaged bytes', async t => {
  const dir = await folder(t), path = join(dir, 'vault.json');
  await writeFile(path, '{truncated'); await writeFile(`${path}.bak`, JSON.stringify(v2));
  const vault = new VaultManager(new FileStorage(path));
  await assert.rejects(vault.recoverBackup(USER, 'wrong')); assert.equal(await readFile(path, 'utf8'), '{truncated');
  await vault.recoverBackup(USER, PASS); assert.equal(await vault.resolve('TOKEN', 'https://example.com'), SECRET);
  const damaged = (await readdir(dir)).find(name => name.includes('.damaged-'));
  assert(damaged); assert.equal(await readFile(join(dir, damaged), 'utf8'), '{truncated');
});
test('an unverified backup is never restored', async t => {
  const dir = await folder(t), path = join(dir, 'vault.json'); await writeFile(path, '{original damage');
  const bad = structuredClone(v2); bad.payload.ciphertext = mutateBase64(bad.payload.ciphertext);
  await writeFile(`${path}.bak`, JSON.stringify(bad));
  await assert.rejects(new VaultManager(new FileStorage(path)).recoverBackup(USER, PASS));
  assert.equal(await readFile(path, 'utf8'), '{original damage');
});
test('export writes encrypted data only and refuses existing destinations', async t => {
  const dir = await folder(t), path = join(dir, 'export.json'); const { vault } = await opened();
  await vault.exportTo(path); assert(!(await readFile(path, 'utf8')).includes(SECRET));
  await assert.rejects(vault.exportTo(path), { code: 'storage_conflict' });
  const restored = new VaultManager(new FileStorage(path)); await restored.unlock(USER, PASS);
  assert.equal(await restored.resolve('TOKEN', 'https://example.com'), SECRET);
});
test('existing locks are not stolen or silently deleted', async t => {
  const dir = await folder(t), path = join(dir, 'vault.json'); await mkdir(`${path}.lock`);
  await assert.rejects(new FileStorage(path).save(v2, { expectedRevision: null }), { code: 'storage_busy' });
  assert((await stat(`${path}.lock`)).isDirectory());
});
test('oversized and non-regular input files are rejected', async t => {
  const dir = await folder(t), path = join(dir, 'oversize');
  await writeFile(path, Buffer.alloc(8 * 1024 * 1024 + 1));
  await assert.rejects(new FileStorage(path).load(), { code: 'vault_too_large' });
  await assert.rejects(new FileStorage(dir).load(), { code: 'unsafe_storage_file' });
});
test('domain parsing rejects URLs, ports, credentials and wildcard bindings', () => {
  for (const domain of ['example.com:443', 'example.com:80', 'https://example.com', '*.example.com',
      'user@example.com', 'example.com/path', '.com', 'com', 'example..com', 'example.com.', ' example.com']) assert.throws(() => normalizeDomain(domain));
  assert.equal(normalizeDomain('EXAMPLE.COM'), 'example.com');
  assert.equal(originMatches('https://api.example.com', 'example.com'), true);
  for (const origin of ['ftp://example.com', 'https://example.com.evil.invalid', 'https://user:pass@example.com', 'https://example.com.']) {
    assert.equal(originMatches(origin, 'example.com'), false);
  }
});
test('canonical base64 rejects ambiguous encodings', () => {
  for (const value of ['AA', 'AA== ', 'AB==', '!', 'AA===']) assert.throws(() => b64.dec(value));
});

test('an existing different permanent legacy backup is never overwritten', async t => {
  const dir = await folder(t), path = join(dir, 'vault.json');
  await writeFile(path, JSON.stringify(legacy)); await writeFile(`${path}.v1-backup`, 'preserve-old-backup');
  const vault = new VaultManager(new FileStorage(path)); await vault.unlock(USER, PASS);
  await assert.rejects(vault.migrate(), { code: 'legacy_backup_conflict' });
  assert.equal(vault.formatVersion, 1);
  assert.equal(await readFile(`${path}.v1-backup`, 'utf8'), 'preserve-old-backup');
  assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), legacy);
});
