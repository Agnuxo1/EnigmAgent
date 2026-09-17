/** EnigmAgent v3 Node.js vault API. No browser compatibility is implied. */
export interface ArgonParams { t: number; m: number; p: number; dkLen: number; }
export interface Ciphertext { nonce: string; ciphertext: string; }
export interface SecretListEntry { id: string; name: string; domain: string | null; created: string; }
export interface LegacyEntry extends SecretListEntry, Ciphertext {}
export interface LegacyVaultData {
  version: 1; kdf: 'argon2id'; kdf_params: ArgonParams; salt: string;
  check?: Ciphertext | null; entries: LegacyEntry[];
}
export interface AuthenticatedVaultData {
  version: 2; kdf: 'argon2id'; kdf_params: ArgonParams; salt: string; payload: Ciphertext;
}
export type VaultData = LegacyVaultData | AuthenticatedVaultData;
export interface StorageSnapshot { data: VaultData | null; revision: string | null; }
export interface SaveOptions { expectedRevision: string | null; }
export interface StorageAdapter {
  loadSnapshot(): Promise<StorageSnapshot>;
  save(vault: VaultData, options: SaveOptions): Promise<string>;
  recoverBackup?(verify: (vault: VaultData) => Promise<unknown>): Promise<void>;
}
export class VaultError extends Error { constructor(code: string); readonly code: string; }
export class FileStorage implements StorageAdapter {
  constructor(vaultPath: string);
  readonly path: string;
  load(): Promise<VaultData | null>;
  loadSnapshot(): Promise<StorageSnapshot>;
  save(vault: VaultData, options: SaveOptions): Promise<string>;
  recoverBackup(verify: (vault: VaultData) => Promise<unknown>): Promise<void>;
}
export class MemoryStorage implements StorageAdapter {
  constructor(initial?: VaultData | null);
  load(): Promise<VaultData | null>;
  loadSnapshot(): Promise<StorageSnapshot>;
  save(vault: VaultData, options: SaveOptions): Promise<string>;
}
export class VaultManager {
  constructor(storage?: StorageAdapter);
  readonly isUnlocked: boolean;
  readonly username: string | null;
  readonly formatVersion: 1 | 2 | null;
  /** Returns an encrypted clone; throws when locked. */
  readonly vault: VaultData;
  /** Creates a new v2 vault, never overwriting an existing or corrupt file. */
  create(username: string, password: string): Promise<void>;
  /** Unlocks v1 read-only or v2. Failed attempts lock any previous session. */
  unlock(username: string, password: string): Promise<void>;
  lock(): void;
  migrate(): Promise<{ migrated: boolean; version: 2 }>;
  addSecret(options: { name: string; domain?: string | null; value: string }): Promise<SecretListEntry>;
  updateSecret(id: string, patch: Partial<{ name: string; domain: string | null; value: string }>): Promise<SecretListEntry>;
  deleteSecret(id: string): Promise<void>;
  revealSecret(id: string): Promise<string>;
  findByName(name: string): SecretListEntry | null;
  resolve(placeholder: string, origin: string): Promise<string>;
  list(): SecretListEntry[];
  exportTo(path: string): Promise<void>;
  recoverBackup(username: string, password: string): Promise<void>;
}
export const VAULT_VERSION: 2;
export const ARGON2_PARAMS: Readonly<ArgonParams>;
export const MAX_VAULT_BYTES: number;
export const MAX_SECRET_BYTES: number;
export const b64: { enc(bytes: Uint8Array | ArrayBuffer): string; dec(value: string): Uint8Array; };
export function randomBytes(length: number): Uint8Array;
export function newUUID(): string;
export function deriveKey(password: string, username: string, salt: Uint8Array): Promise<CryptoKey>;
export function encryptString(key: CryptoKey, plaintext: string, additionalData?: Uint8Array): Promise<Ciphertext>;
export function decryptString(key: CryptoKey, nonce: string, ciphertext: string, additionalData?: Uint8Array): Promise<string>;
export function normalizeDomain(domain?: string | null): string | null;
export function originMatches(origin: string, domain: string): boolean;
