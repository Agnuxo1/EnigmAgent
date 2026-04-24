/**
 * @enigmagent/vault — npm library
 *
 * Re-exports everything from the shared vault-core with a clean public API.
 * Use this package to embed EnigmAgent-compatible vault management in any
 * Node.js / Deno / Bun project.
 *
 * import { VaultManager, FileStorage, MemoryStorage } from '@enigmagent/vault';
 *
 * const vault = new VaultManager(new FileStorage('./my.vault.json'));
 * await vault.create('alice', 'strong-password');
 * await vault.addSecret({ name: 'API_KEY', domain: 'example.com', value: 'secret' });
 * const value = await vault.resolve('API_KEY', 'https://api.example.com');
 */

export {
  VaultManager,
  FileStorage,
  MemoryStorage,
  deriveKey,
  encryptString,
  decryptString,
  originMatches,
  VAULT_VERSION,
  ARGON2_PARAMS,
  b64,
  randomBytes,
  newUUID,
} from './vault-core.js';
