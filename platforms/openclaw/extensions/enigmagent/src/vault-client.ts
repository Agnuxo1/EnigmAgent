/**
 * EnigmAgent OpenClaw Plugin — vault HTTP client.
 *
 * Communicates with the EnigmAgent REST API running on localhost.
 * The server must be started separately before OpenClaw starts:
 *
 *   enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json
 *
 * All requests are to 127.0.0.1 only — the vault API is never exposed
 * to the network.
 */

import type {
  VaultClientConfig,
  VaultStatus,
  VaultEntry,
  VaultResolveResponse,
  VaultErrorResponse,
  VaultErrorCode,
} from './types.js';
import { VaultError } from './types.js';

const DEFAULT_HOST    = '127.0.0.1';
const DEFAULT_PORT    = 3737;
const DEFAULT_TIMEOUT = 5_000;

export class VaultClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: VaultClientConfig = {}) {
    const host = config.host ?? DEFAULT_HOST;
    const port = config.port ?? DEFAULT_PORT;
    this.baseUrl   = `http://${host}:${port}`;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT;
  }

  // ── Low-level request helper ──────────────────────────────────────────────

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        signal: controller.signal,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await res.json() as T | VaultErrorResponse;

      if (!res.ok) {
        const err = data as VaultErrorResponse;
        throw new VaultError(
          err.error as VaultErrorCode ?? 'resolve_error',
          err.message ?? `HTTP ${res.status}`,
        );
      }
      return data as T;
    } catch (err: unknown) {
      if (err instanceof VaultError) throw err;

      const isAbort = err instanceof Error && err.name === 'AbortError';
      const code: VaultErrorCode = isAbort ? 'timeout' : 'server_unreachable';
      throw new VaultError(
        code,
        isAbort
          ? `EnigmAgent server timed out after ${this.timeoutMs}ms`
          : `EnigmAgent server unreachable at ${this.baseUrl} — is it running?`,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Check whether the vault server is running and the vault is unlocked.
   */
  async getStatus(): Promise<VaultStatus> {
    return this.request<VaultStatus>('GET', '/status');
  }

  /**
   * List all secrets by name and domain — never returns actual values.
   */
  async listSecrets(): Promise<VaultEntry[]> {
    const res = await this.request<{ entries: VaultEntry[] }>('GET', '/list');
    return res.entries;
  }

  /**
   * Resolve a single `{{PLACEHOLDER}}` to its real value.
   *
   * @param placeholder  The name without braces: e.g. `GITHUB_TOKEN`,
   *                     `LOGIN:github.com`, `DOC:report.md`
   * @param origin       The requesting origin, used for domain binding checks.
   *                     Pass the URL of the tool/service being called.
   *                     Use `http://localhost` for local operations.
   */
  async resolve(placeholder: string, origin: string): Promise<string> {
    const res = await this.request<VaultResolveResponse>('POST', '/resolve', {
      placeholder,
      origin,
    });
    return res.value;
  }

  /**
   * Resolve multiple placeholders in a single batch (sequential, fail-fast off).
   *
   * Returns a map of `{ placeholder → value | VaultError }`.
   * Errors are captured per-placeholder rather than thrown, so a single
   * missing secret does not block the entire tool call.
   */
  async resolveBatch(
    items: Array<{ placeholder: string; origin: string }>,
  ): Promise<Map<string, string | VaultError>> {
    const results = new Map<string, string | VaultError>();
    await Promise.all(
      items.map(async ({ placeholder, origin }) => {
        try {
          const value = await this.resolve(placeholder, origin);
          results.set(placeholder, value);
        } catch (err) {
          results.set(
            placeholder,
            err instanceof VaultError
              ? err
              : new VaultError('resolve_error', String(err), placeholder),
          );
        }
      }),
    );
    return results;
  }
}
