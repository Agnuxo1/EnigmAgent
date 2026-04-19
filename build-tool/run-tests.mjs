#!/usr/bin/env node
/*
 * EnigmAgent — headless Node test harness.
 *
 * Exercises the real crypto pipeline (Argon2id → AES-256-GCM) and the
 * domain-matching / placeholder-parsing logic against the same @noble/hashes
 * version bundled into the extension. Catches regressions before any
 * browser-side smoke test.
 *
 * Run with `npm test` (from build-tool/) or `node run-tests.mjs`.
 */

import { argon2id } from '@noble/hashes/argon2';
import { webcrypto } from 'node:crypto';

const enc = new TextEncoder();
const dec = new TextDecoder();
const subtle = webcrypto.subtle;

const ARGON2_PARAMS = { t: 3, m: 65536, p: 1, dkLen: 32 };
const NONCE_BYTES = 12;
const SALT_BYTES = 16;

const b64 = {
  enc: (buf) => {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return Buffer.from(s, 'binary').toString('base64');
  },
  dec: (s) => new Uint8Array(Buffer.from(s, 'base64')),
};

function randomBytes(n) {
  const b = new Uint8Array(n);
  webcrypto.getRandomValues(b);
  return b;
}

async function deriveKey(password, username, saltBytes) {
  const ctx = enc.encode(`enigma/v1|${username}`);
  const salted = new Uint8Array(saltBytes.length + ctx.length);
  salted.set(saltBytes, 0); salted.set(ctx, saltBytes.length);
  const raw = argon2id(enc.encode(password), salted, ARGON2_PARAMS);
  return subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptString(key, plaintext) {
  const nonce = randomBytes(NONCE_BYTES);
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, enc.encode(plaintext));
  return { nonce: b64.enc(nonce), ciphertext: b64.enc(ct) };
}
async function decryptString(key, nonceB64, ctB64) {
  const pt = await subtle.decrypt(
    { name: 'AES-GCM', iv: b64.dec(nonceB64) }, key, b64.dec(ctB64)
  );
  return dec.decode(pt);
}

// Mirror of extension vault.js originMatches().
function originMatches(origin, domain) {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    const d = domain.toLowerCase();
    return host === d || host.endsWith('.' + d);
  } catch { return false; }
}

const PLACEHOLDER_RE = /\{\{([A-Z0-9_:\-.@]+)\}\}/g;

// ---------- test harness ----------

let passed = 0, failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, err });
    console.log(`  ✗ ${name}`);
    console.log(`       ${err.message}`);
  }
}

function section(title) { console.log(`\n— ${title}`); }

function assertEq(a, b, msg = '') {
  if (a !== b) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}
async function assertThrows(fn, msg = '') {
  let threw = false;
  try { await fn(); } catch { threw = true; }
  if (!threw) throw new Error(msg || 'expected throw');
}

// ---------- tests ----------

async function main() {
  section('crypto round-trip');

  await test('Argon2id produces 32-byte key', async () => {
    const k = argon2id(enc.encode('pw'), enc.encode('saltsaltsaltsalt'), ARGON2_PARAMS);
    assertEq(k.length, 32, 'dkLen');
  });

  await test('encrypt/decrypt returns the plaintext', async () => {
    const salt = randomBytes(SALT_BYTES);
    const key = await deriveKey('correct horse battery staple', 'alice', salt);
    const payload = 'ghp_' + 'a'.repeat(36);
    const { nonce, ciphertext } = await encryptString(key, payload);
    const back = await decryptString(key, nonce, ciphertext);
    assertEq(back, payload);
  });

  await test('wrong password is rejected (AES-GCM auth tag)', async () => {
    const salt = randomBytes(SALT_BYTES);
    const key = await deriveKey('pw1', 'alice', salt);
    const bad = await deriveKey('pw2', 'alice', salt);
    const { nonce, ciphertext } = await encryptString(key, 'secret');
    await assertThrows(() => decryptString(bad, nonce, ciphertext));
  });

  await test('different username with same password derives different key', async () => {
    const salt = randomBytes(SALT_BYTES);
    const ka = await deriveKey('pw', 'alice', salt);
    const kb = await deriveKey('pw', 'bob', salt);
    const { nonce, ciphertext } = await encryptString(ka, 'x');
    await assertThrows(() => decryptString(kb, nonce, ciphertext));
  });

  await test('tampered ciphertext is rejected', async () => {
    const salt = randomBytes(SALT_BYTES);
    const key = await deriveKey('pw', 'alice', salt);
    const { nonce, ciphertext } = await encryptString(key, 'secret');
    const bad = b64.dec(ciphertext);
    bad[0] ^= 0x01;
    await assertThrows(() => decryptString(key, nonce, b64.enc(bad)));
  });

  await test('tampered nonce is rejected', async () => {
    const salt = randomBytes(SALT_BYTES);
    const key = await deriveKey('pw', 'alice', salt);
    const { nonce, ciphertext } = await encryptString(key, 'secret');
    const badNonce = b64.dec(nonce); badNonce[0] ^= 0x80;
    await assertThrows(() => decryptString(key, b64.enc(badNonce), ciphertext));
  });

  await test('nonces are never reused across encryptions of the same value', async () => {
    const salt = randomBytes(SALT_BYTES);
    const key = await deriveKey('pw', 'alice', salt);
    const a = await encryptString(key, 'same');
    const b = await encryptString(key, 'same');
    assert(a.nonce !== b.nonce, 'nonce must be random per encryption');
    assert(a.ciphertext !== b.ciphertext, 'ciphertext must differ (GCM with fresh nonce)');
  });

  await test('unicode round-trip (emoji + accents)', async () => {
    const salt = randomBytes(SALT_BYTES);
    const key = await deriveKey('contraseña', 'álvaro', salt);
    const pt = 'Hola 🌍 — token: ghp_⚡';
    const { nonce, ciphertext } = await encryptString(key, pt);
    assertEq(await decryptString(key, nonce, ciphertext), pt);
  });

  section('vault file format');

  await test('full vault round-trip through JSON', async () => {
    const salt = randomBytes(SALT_BYTES);
    const key = await deriveKey('hunter2hunter2', 'alice', salt);
    const check = await encryptString(key, 'enigmagent-check|alice');
    const entry = await encryptString(key, 'ghp_realtoken');
    const vault = {
      version: 1,
      kdf: 'argon2id',
      kdf_params: ARGON2_PARAMS,
      salt: b64.enc(salt),
      check,
      entries: [{
        id: 'test-id',
        name: 'GITHUB_TOKEN',
        domain: 'github.com',
        created: new Date().toISOString(),
        nonce: entry.nonce,
        ciphertext: entry.ciphertext,
      }],
    };
    const serialized = JSON.stringify(vault);
    const parsed = JSON.parse(serialized);

    // Unlock path: re-derive and validate.
    const key2 = await deriveKey('hunter2hunter2', 'alice', b64.dec(parsed.salt));
    const chk = await decryptString(key2, parsed.check.nonce, parsed.check.ciphertext);
    assertEq(chk, 'enigmagent-check|alice');

    const e = parsed.entries[0];
    assertEq(await decryptString(key2, e.nonce, e.ciphertext), 'ghp_realtoken');
  });

  section('domain binding');

  await test('exact match passes', () => {
    assert(originMatches('https://github.com', 'github.com'));
    assert(originMatches('https://github.com:443/path', 'github.com'));
  });
  await test('subdomain passes', () => {
    assert(originMatches('https://api.github.com', 'github.com'));
    assert(originMatches('https://foo.bar.github.com', 'github.com'));
  });
  await test('sibling/phishing domains are rejected', () => {
    assert(!originMatches('https://g1thub.com', 'github.com'));
    assert(!originMatches('https://evil.com/github.com', 'github.com'));
    assert(!originMatches('https://github.com.evil.com', 'github.com'));
  });
  await test('case is normalized', () => {
    assert(originMatches('https://GitHub.COM', 'GITHUB.com'));
  });
  await test('bad inputs return false (no throw)', () => {
    assertEq(originMatches('not-a-url', 'github.com'), false);
    assertEq(originMatches('', 'github.com'), false);
  });

  section('placeholder grammar');

  const validNames = [
    'GITHUB_TOKEN', 'github_token', 'LOGIN:github.com',
    'DOC:contract.md', 'Token.Main', 'my-secret-42', 'NIF', 'A', 'a',
  ];
  const invalidNames = ['', 'with space', 'no{braces}', 'héllo', 'a/b'];

  for (const name of validNames) {
    await test(`valid placeholder "{{${name}}}"`, () => {
      const m = `{{${name}}}`.match(/^\{\{([A-Z0-9_:\-.@]+)\}\}$/i);
      assert(m && m[1] === name);
    });
  }
  for (const name of invalidNames) {
    await test(`invalid placeholder "{{${name}}}" rejected`, () => {
      const m = `{{${name}}}`.match(/^\{\{([A-Z0-9_:\-.@]+)\}\}$/i);
      assert(!m);
    });
  }

  await test('multiple placeholders in one field are all extracted', () => {
    const template = 'user={{GITHUB_USERNAME}}&token={{GITHUB_TOKEN}}';
    const matches = [...template.matchAll(PLACEHOLDER_RE)].map(m => m[1]);
    assertEq(matches.join(','), 'GITHUB_USERNAME,GITHUB_TOKEN');
  });

  section('bundle byte-equivalence');

  await test('bundled argon2id.js produces same output as @noble/hashes source', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const bundleSrc = fs.readFileSync(
      path.resolve('../extension/lib/argon2id.js'), 'utf8'
    );
    const sandbox = {};
    const f = new Function('globalThis', bundleSrc);
    f.call(sandbox, sandbox);
    assert(sandbox.EnigmaCrypto?.argon2id, 'EnigmaCrypto.argon2id must exist after load');

    const pw = enc.encode('password');
    const salt = enc.encode('somesalt12345678');
    const fromBundle = sandbox.EnigmaCrypto.argon2id(pw, salt, ARGON2_PARAMS);
    const fromSource = argon2id(pw, salt, ARGON2_PARAMS);
    assertEq(
      Buffer.from(fromBundle).toString('hex'),
      Buffer.from(fromSource).toString('hex'),
      'bundle vs source digest'
    );
  });

  // ---------- summary ----------

  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  • ${f.name}: ${f.err.stack || f.err.message}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
