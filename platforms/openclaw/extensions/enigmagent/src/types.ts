/**
 * EnigmAgent OpenClaw Plugin — type definitions.
 *
 * All interfaces that cross the plugin boundary:
 *   VaultClient ↔ EnigmAgent REST API
 *   SecretResolverMiddleware ↔ OpenClaw tool execution pipeline
 */

// ── Vault client configuration ────────────────────────────────────────────────

export interface VaultClientConfig {
  /** Host where the EnigmAgent server is running. Default: 127.0.0.1 */
  host?: string;
  /** Port of the EnigmAgent REST API. Default: 3737 */
  port?: number;
  /** Request timeout in milliseconds. Default: 5000 */
  timeoutMs?: number;
}

// ── REST API response shapes ───────────────────────────────────────────────────

export interface VaultStatus {
  /** Whether the server process is reachable and the vault is unlocked */
  status: 'ok' | 'error';
  /** True when vault is unlocked and ready to resolve secrets */
  unlocked: boolean;
}

export interface VaultEntry {
  id: string;
  name: string;
  domain: string | null;
  created: string;
}

export interface VaultListResponse {
  entries: VaultEntry[];
}

export interface VaultResolveResponse {
  value: string;
}

export interface VaultErrorResponse {
  error: VaultErrorCode;
  message?: string;
}

// ── Error codes (mirror the EnigmAgent REST API codes) ────────────────────────

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

// ── Middleware types ───────────────────────────────────────────────────────────

/**
 * A record of tool call parameters (string keys, any JSON-compatible value).
 * The middleware resolves `{{PLACEHOLDER}}` patterns in string values.
 */
export type ToolParams = Record<string, unknown>;

/** Result returned by the secret resolver middleware */
export interface ResolvedParams {
  /** Parameter map with all `{{PLACEHOLDER}}` patterns replaced by real values */
  params: ToolParams;
  /** List of placeholder names that were resolved during this call */
  resolved: string[];
  /** List of placeholder names that could not be resolved (vault locked, not found, etc.) */
  failed: Array<{ placeholder: string; reason: VaultErrorCode }>;
}

// ── Tool definitions (for OpenClaw agent tools) ───────────────────────────────

export interface VaultStatusToolResult {
  running: boolean;
  unlocked: boolean;
  message: string;
}

export interface VaultListToolResult {
  count: number;
  entries: Array<{
    name: string;
    domain: string | null;
    created: string;
  }>;
}

// ── Plugin configuration (from openclaw.plugin.json or environment) ───────────

export interface EnigmAgentPluginConfig {
  vault: VaultClientConfig;
  /** If true, tool calls that contain unresolvable placeholders are BLOCKED.
   *  If false (default), unresolvable placeholders are left as-is and logged. */
  strictMode: boolean;
  /** Origins to allow for domain-unbound secrets. Use with care. */
  trustedOrigins?: string[];
}
