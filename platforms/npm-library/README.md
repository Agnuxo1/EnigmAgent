# @enigmagent/vault

EnigmAgent vault library for Node.js, Deno and Bun.

Embed AES-256-GCM + Argon2id encrypted secret management in any server-side project.
Vault files are compatible with the EnigmAgent browser extension and PWA.

## Install

```bash
npm install @enigmagent/vault
```

## Usage

```js
import { VaultManager, FileStorage, MemoryStorage } from '@enigmagent/vault';

// ── Create and use a vault ──────────────────────────────────────────────────
const vault = new VaultManager(new FileStorage('./my.vault.json'));

// Create (first time)
await vault.create('alice', 'strong-password');

// Add secrets
await vault.addSecret({ name: 'API_KEY',      domain: 'api.example.com',  value: 'sk-...' });
await vault.addSecret({ name: 'GITHUB_TOKEN', domain: 'github.com',       value: 'ghp_...' });
await vault.addSecret({ name: 'OPENAI_KEY',   domain: 'api.openai.com',   value: 'sk-proj-...' });

// List (no values)
console.log(vault.list());
// [ { id: '...', name: 'API_KEY', domain: 'api.example.com', created: '...' }, ... ]

// Resolve (with domain binding check)
const value = await vault.resolve('API_KEY', 'https://api.example.com');
console.log(value); // → 'sk-...'

// Lock when done
vault.lock();

// ── Re-open existing vault ──────────────────────────────────────────────────
const vault2 = new VaultManager(new FileStorage('./my.vault.json'));
await vault2.unlock('alice', 'strong-password');
const token = await vault2.resolve('GITHUB_TOKEN', 'https://github.com');
vault2.lock();
```

## API

### `new VaultManager(storage)`

| Method | Description |
|---|---|
| `create(username, password)` | Create a new vault. Overwrites existing. |
| `unlock(username, password, [vaultData])` | Unlock. Throws on wrong credentials. |
| `lock()` | Clear the in-memory key. |
| `addSecret({ name, domain?, value })` | Add a secret. Domain binding recommended. |
| `updateSecret(id, patch)` | Update name / domain / value. |
| `deleteSecret(id)` | Permanently delete. |
| `revealSecret(id)` | Decrypt and return plaintext. |
| `findByName(name)` | Find entry. Supports `LOGIN:domain` and `DOC:filename`. |
| `resolve(placeholder, origin)` | Resolve + enforce domain binding. |
| `list()` | Return `[{id, name, domain, created}]` — no values. |
| `isUnlocked` | `true` when key is in memory. |

### Storage adapters

```js
new FileStorage('./vault.json')   // persists to file
new MemoryStorage()               // in-memory only (lost on process exit)
new MemoryStorage(existingVault)  // seed with existing vault object
```

### Low-level crypto

```js
import { deriveKey, encryptString, decryptString, originMatches } from '@enigmagent/vault';
```

## Security

- **KDF:** Argon2id (m=64 MiB, t=3, p=1) — intentionally slow
- **Cipher:** AES-256-GCM with random 96-bit nonce per entry
- **Domain binding:** `resolve()` enforces that `origin` hostname matches the secret's domain
- **No telemetry:** all operations are local, no network calls
