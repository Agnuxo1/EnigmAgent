/**
 * EnigmAgent — HTTP client for the local vault REST API.
 *
 * Used by both the secrets provider (server-side) and the plugin worker.
 * Requires Node.js ≥ 18 (global fetch).
 *
 * The vault server must be started separately:
 *   enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json
 *
 * All requests go to 127.0.0.1 only — the vault is never on the network.
 */

export interface VaultClientConfig {
  host?:      string;   // default: 127.0.0.1
  port?:      number;   // default: 3737
  timeoutMs?: number;   // default: 5000
}

export interface VaultStatus  { status: 'ok' | 'error'; unlocked: boolean }
export interface VaultEntry   { id: string; name: string; domain: string | null; created: string }

// ── Error types ────────────────────────────────────────────────────────────────

export type VaultErrorCode =
  | 'vault_locked'
  | 'not_found'
  | 'no_domain_binding'
  | 'domain_mismatch'
  | 'resolve_error'
  | 'server_unreachable'
  | 'timeout';

export class VaultError extends Error {
  constructor(
    public readonly code: VaultErrorCode,
    message: string,
    public readonly placeholder?: string,
  ) {
    super(message);
    this.name = 'VaultError';
  }
}

// ── Client ─────────────────────────────────────────────────────────────────────

export class VaultClient {
  private readonly baseUrl:   string;
  private readonly timeoutMs: number;

  constructor(cfg: VaultClientConfig = {}) {
    this.baseUrl   = `http://${cfg.host ?? '127.0.0.1'}:${cfg.port ?? 3737}`;
    this.timeoutMs = cfg.timeoutMs ?? 5_000;
  }

  // ── Internal fetch wrapper ─────────────────────────────────────────────────

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        signal: ctrl.signal,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body:    body ? JSON.stringify(body) : undefined,
      });

      const data = await res.json() as T | { error: string; message?: string };

      if (!res.ok) {
        const err = data as { error: string; message?: string };
        throw new VaultError(
          (err.error as VaultErrorCode) ?? 'resolve_error',
          err.message ?? `HTTP ${res.status}`,
        );
      }
      return data as T;
    } catch (err: unknown) {
      if (err instanceof VaultError) throw err;
      const isAbort = err instanceof Error && err.name === 'AbortError';
      throw new VaultError(
        isAbort ? 'timeout' : 'server_unreachable',
        isAbort
          ? `EnigmAgent vault timed out after ${this.timeoutMs}ms`
          : `EnigmAgent vault unreachable at ${this.baseUrl} — run: ` +
            `enigmagent-mcp --mode rest --port ${this.baseUrl.split(':')[2]} ` +
            `--vault ~/.enigmagent/vault.json`,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Check whether the vault server is running and unlocked. */
  async getStatus(): Promise<VaultStatus> {
    return this.request<VaultStatus>('GET', '/status');
  }

  /** List all secrets — names and domains only, never values. */
  async listSecrets(): Promise<VaultEntry[]> {
    const data = await this.request<{ entries: VaultEntry[] }>('GET', '/list');
    return data.entries;
  }

  /**
   * Resolve a single placeholder to its real value.
   *
   * @param placeholder  Name without braces: `GITHUB_TOKEN`, `LOGIN:github.com`, `DOC:policy.md`
   * @param origin       Requesting origin for domain-binding checks. Use `http://localhost`
   *                     for server-side resolution within Paperclip.
   */
  async resolve(placeholder: string, origin: string): Promise<string> {
    const data = await this.request<{ value: string }>('POST', '/resolve', { placeholder, origin });
    if (typeof data.value !== 'string') {
      throw new VaultError('resolve_error', 'Server returned no value', placeholder);
    }
    return data.value;
  }

  /**
   * Resolve multiple placeholders in parallel, capturing per-item errors.
   * Returns a Map of placeholder → value | VaultError.
   */
  async resolveBatch(
    items: Array<{ placeholder: string; origin: string }>,
  ): Promise<Map<string, string | VaultError>> {
    const results = new Map<string, string | VaultError>();
    await Promise.all(
      items.map(async ({ placeholder, origin }) => {
        try {
          results.set(placeholder, await this.resolve(placeholder, origin));
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
