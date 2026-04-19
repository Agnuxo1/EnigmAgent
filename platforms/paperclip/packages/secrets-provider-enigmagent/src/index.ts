/**
 * EnigmAgent — Paperclip secrets provider.
 *
 * Plugs into Paperclip's `{{ secret.KEY }}` resolution pipeline so that
 * every `{{ secret.GITHUB_TOKEN }}` reference in agent tool calls is
 * resolved by the encrypted local EnigmAgent vault — not by environment
 * variables or a shared secrets file.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  SECURITY GUARANTEE                                                 │
 * │                                                                     │
 * │  Agent (LLM) writes:   curl -H "Authorization: Bearer               │
 * │                        {{ secret.GITHUB_TOKEN }}" …               │
 * │  Paperclip resolves:   calls EnigmAgentSecretsProvider.resolve()   │
 * │                        → vault decrypts → real token               │
 * │  Tool executes:        curl with real Bearer token                  │
 * │  LLM receives:         the HTTP response body — never the token    │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ## Integration (add to server/src/secrets/index.ts)
 *
 * ```typescript
 * import { EnigmAgentSecretsProvider } from '@enigmagent/paperclip-secrets-provider';
 *
 * case 'enigmagent':
 *   return new EnigmAgentSecretsProvider({
 *     host:      process.env.ENIGMAGENT_HOST,
 *     port:      process.env.ENIGMAGENT_PORT ? parseInt(process.env.ENIGMAGENT_PORT) : undefined,
 *     timeoutMs: process.env.ENIGMAGENT_TIMEOUT_MS ? parseInt(process.env.ENIGMAGENT_TIMEOUT_MS) : undefined,
 *     origin:    process.env.ENIGMAGENT_ORIGIN ?? 'http://localhost',
 *   });
 * ```
 *
 * ## Environment variables
 *
 *   PAPERCLIP_SECRETS_PROVIDER=enigmagent
 *   ENIGMAGENT_HOST=127.0.0.1     (default)
 *   ENIGMAGENT_PORT=3737          (default)
 *   ENIGMAGENT_TIMEOUT_MS=5000    (default)
 *   ENIGMAGENT_ORIGIN=http://localhost  (default — domain binding check origin)
 */

import { VaultClient, VaultError, type VaultClientConfig } from './vault-client.js';

// ── SecretsProvider interface (mirrors server/src/secrets/index.ts) ────────────

/**
 * Interface matching Paperclip's SecretsProvider contract.
 *
 * The server calls `provider.resolve(key)` when it encounters
 * `{{ secret.KEY }}` in agent tool parameters.
 * Returns the plaintext value, or `undefined` if the secret is not found.
 */
export interface SecretsProvider {
  /**
   * Resolve a secret key to its plaintext value.
   * @param key  The key name after `secret.` — e.g. for `{{ secret.GITHUB_TOKEN }}` the key is `GITHUB_TOKEN`.
   * @returns    The resolved value, or `undefined` if the secret does not exist.
   */
  resolve(key: string): Promise<string | undefined>;
}

// ── Configuration ──────────────────────────────────────────────────────────────

export interface EnigmAgentProviderConfig extends VaultClientConfig {
  /**
   * Origin string used for domain-binding checks when resolving secrets.
   *
   * All secrets resolved through Paperclip's server-side pipeline are
   * considered to originate from `http://localhost` — the Paperclip
   * server itself, not a remote caller.
   *
   * Add your secrets with `@localhost` domain binding:
   *   `enigmagent add GITHUB_TOKEN @localhost ghp_...`
   *
   * @default "http://localhost"
   */
  origin?: string;

  /**
   * If `true`, log a debug message each time a secret is successfully resolved.
   * Secret values are NEVER logged — only the key name and resolution time.
   * @default false
   */
  debugLogging?: boolean;
}

// ── Provider implementation ────────────────────────────────────────────────────

export class EnigmAgentSecretsProvider implements SecretsProvider {
  private readonly client:  VaultClient;
  private readonly origin:  string;
  private readonly debug:   boolean;

  constructor(cfg: EnigmAgentProviderConfig = {}) {
    this.client = new VaultClient({
      host:      cfg.host,
      port:      cfg.port,
      timeoutMs: cfg.timeoutMs,
    });
    this.origin = cfg.origin        ?? 'http://localhost';
    this.debug  = cfg.debugLogging  ?? false;
  }

  /**
   * Resolve `key` against the EnigmAgent vault.
   *
   * Called by Paperclip whenever it encounters `{{ secret.KEY }}` in
   * agent tool parameters, agent config fields, or webhook payloads.
   *
   * @param key  Secret name, e.g. `GITHUB_TOKEN`, `LOGIN:github.com`, `DOC:policy.md`
   * @returns    Plaintext secret value, or `undefined` if not found / vault locked.
   */
  async resolve(key: string): Promise<string | undefined> {
    const start = Date.now();
    try {
      const value = await this.client.resolve(key, this.origin);

      if (this.debug) {
        console.debug(
          `[EnigmAgent] resolved {{ secret.${key} }} in ${Date.now() - start}ms`,
        );
      }
      return value;
    } catch (err: unknown) {
      if (err instanceof VaultError) {
        // Distinguish "secret doesn't exist" (return undefined) from
        // hard errors (vault locked, server down) which should propagate.
        if (err.code === 'not_found') {
          return undefined;
        }
        if (err.code === 'vault_locked') {
          console.error(
            `[EnigmAgent] vault is locked — cannot resolve {{ secret.${key} }}. ` +
            'Start the vault server to unlock it.',
          );
          return undefined;
        }
        if (err.code === 'server_unreachable') {
          console.error(
            `[EnigmAgent] vault server unreachable — ${err.message}`,
          );
          return undefined;
        }
      }
      // Unexpected error — log and return undefined rather than crashing.
      console.error(`[EnigmAgent] unexpected error resolving {{ secret.${key} }}:`, err);
      return undefined;
    }
  }

  /** Check vault connectivity and lock state. */
  async healthCheck(): Promise<{ ok: boolean; unlocked: boolean; message: string }> {
    try {
      const status = await this.client.getStatus();
      return {
        ok:       true,
        unlocked: status.unlocked,
        message:  status.unlocked
          ? 'EnigmAgent vault is running and unlocked.'
          : 'EnigmAgent vault is running but LOCKED — restart the server to unlock.',
      };
    } catch (err) {
      return {
        ok:       false,
        unlocked: false,
        message:  err instanceof VaultError
          ? err.message
          : `EnigmAgent health check failed: ${String(err)}`,
      };
    }
  }
}

// ── Factory (for server/src/secrets/index.ts integration) ─────────────────────

/**
 * Create an EnigmAgentSecretsProvider from environment variables.
 *
 * Reads:
 *   ENIGMAGENT_HOST        → host (default: 127.0.0.1)
 *   ENIGMAGENT_PORT        → port (default: 3737)
 *   ENIGMAGENT_TIMEOUT_MS  → timeoutMs (default: 5000)
 *   ENIGMAGENT_ORIGIN      → origin (default: http://localhost)
 *   ENIGMAGENT_DEBUG       → debugLogging (default: false)
 */
export function createEnigmAgentSecretsProvider(
  overrides: EnigmAgentProviderConfig = {},
): EnigmAgentSecretsProvider {
  return new EnigmAgentSecretsProvider({
    host:         overrides.host         ?? process.env['ENIGMAGENT_HOST'],
    port:         overrides.port         ?? (process.env['ENIGMAGENT_PORT'] ? parseInt(process.env['ENIGMAGENT_PORT']!) : undefined),
    timeoutMs:    overrides.timeoutMs    ?? (process.env['ENIGMAGENT_TIMEOUT_MS'] ? parseInt(process.env['ENIGMAGENT_TIMEOUT_MS']!) : undefined),
    origin:       overrides.origin       ?? process.env['ENIGMAGENT_ORIGIN'],
    debugLogging: overrides.debugLogging ?? (process.env['ENIGMAGENT_DEBUG'] === 'true'),
  });
}

// ── Re-exports ─────────────────────────────────────────────────────────────────

export { VaultClient, VaultError } from './vault-client.js';
export type { VaultClientConfig, VaultStatus, VaultEntry, VaultErrorCode } from './vault-client.js';
