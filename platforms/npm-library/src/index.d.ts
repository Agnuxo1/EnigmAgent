/**
 * @enigmagent/vault — TypeScript definitions
 */

export interface ArgonParams {
  t: number;
  m: number;
  p: number;
  dkLen: number;
}

export interface VaultEntry {
  id: string;
  name: string;
  domain: string | null;
  created: string;
  nonce: string;
  ciphertext: string;
}

export interface VaultData {
  version: number;
  kdf: 'argon2id';
  kdf_params: ArgonParams;
  salt: string;
  check: { nonce: string; ciphertext: string } | null;
  entries: VaultEntry[];
}

export interface SecretListEntry {
  id: string;
  name: string;
  domain: string | null;
  created: string;
}

export interface StorageAdapter {
  load(): Promise<VaultData | null>;
  save(vault: VaultData): Promise<void>;
}

/** File-based storage — persists vault as JSON on disk. */
export class FileStorage implements StorageAdapter {
  constructor(vaultPath: string);
  load(): Promise<VaultData | null>;
  save(vault: VaultData): Promise<void>;
}

/** In-memory storage — data is lost when the process exits. Useful for testing. */
export class MemoryStorage implements StorageAdapter {
  constructor(initialVault?: VaultData | null);
  load(): Promise<VaultData | null>;
  save(vault: VaultData): Promise<void>;
}

/** High-level vault manager. */
export class VaultManager {
  constructor(storage: StorageAdapter);

  /** True when the vault is unlocked (key held in memory). */
  readonly isUnlocked: boolean;
  readonly username: string | null;
  readonly vault: VaultData | null;

  /** Create a brand-new vault. Overwrites any existing file. */
  create(username: string, password: string): Promise<void>;

  /** Unlock an existing vault. Throws on wrong credentials. */
  unlock(username: string, password: string, vaultData?: VaultData): Promise<void>;

  /** Clear the in-memory key. Vault data is NOT written. */
  lock(): void;

  /** Add a new secret. Domain binding is strongly recommended. */
  addSecret(opts: { name: string; domain?: string | null; value: string }): Promise<VaultEntry>;

  /** Update an existing secret by ID. */
  updateSecret(id: string, patch: Partial<{ name: string; domain: string | null; value: string }>): Promise<void>;

  /** Permanently delete a secret by ID. */
  deleteSecret(id: string): Promise<void>;

  /** Decrypt and return the plaintext value of a secret. */
  revealSecret(id: string): Promise<string>;

  /**
   * Find an entry by name (case-insensitive).
   * Also handles LOGIN:domain and DOC:filename syntax.
   */
  findByName(name: string): VaultEntry | null;

  /**
   * Resolve a placeholder against origin.
   * Enforces domain binding: origin must match the secret's bound domain.
   * Throws with .code property set to: vault_locked | not_found | no_domain_binding | domain_mismatch
   */
  resolve(placeholder: string, origin: string): Promise<string>;

  /** List all entries without revealing values. */
  list(): SecretListEntry[];
}

// ── Low-level crypto exports ──────────────────────────────────────────────────

export const VAULT_VERSION: number;
export const ARGON2_PARAMS: ArgonParams;

export const b64: {
  enc(buf: Uint8Array | ArrayBuffer): string;
  dec(s: string): Uint8Array;
};

export function randomBytes(n: number): Uint8Array;
export function newUUID(): string;

export function deriveKey(password: string, username: string, saltBytes: Uint8Array): Promise<CryptoKey>;
export function encryptString(key: CryptoKey, plaintext: string): Promise<{ nonce: string; ciphertext: string }>;
export function decryptString(key: CryptoKey, nonce: string, ciphertext: string): Promise<string>;

/** Returns true if origin's hostname matches domain (exact or subdomain). */
export function originMatches(origin: string, domain: string): boolean;
