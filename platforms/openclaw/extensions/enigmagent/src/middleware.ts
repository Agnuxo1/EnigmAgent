/**
 * EnigmAgent OpenClaw Plugin — secret resolver middleware.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  SECURITY GUARANTEE                                             │
 * │                                                                 │
 * │  This middleware resolves {{PLACEHOLDER}} patterns in tool      │
 * │  call parameters BEFORE the tool executes. The LLM writes       │
 * │  placeholders; the real secret values are injected by the       │
 * │  gateway at execution time. Secret values NEVER appear in:      │
 * │    • LLM input or output tokens                                 │
 * │    • Agent memory or context                                    │
 * │    • Logs (unless you explicitly log resolved params)           │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Usage in openclaw.plugin.json:
 *   "middleware": ["enigmagent/middleware"]
 *
 * The middleware implements the OpenClaw ToolMiddleware interface and
 * is registered by the plugin entry point (src/index.ts).
 */

import type { ToolParams, ResolvedParams, VaultErrorCode } from './types.js';
import { VaultError } from './types.js';
import { VaultClient } from './vault-client.js';

/**
 * Regular expression that matches {{PLACEHOLDER}} patterns.
 *
 * Supports:
 *   {{GITHUB_TOKEN}}          — plain secret by name
 *   {{LOGIN:github.com}}      — login credentials bound to a domain
 *   {{DOC:company-policy.md}} — stored document contents
 */
const PLACEHOLDER_RE = /\{\{([A-Za-z0-9_:\-.@]+)\}\}/g;

// ── Middleware class ──────────────────────────────────────────────────────────

export interface MiddlewareOptions {
  /** VaultClient to use for resolving. */
  client: VaultClient;
  /**
   * If true: any unresolvable placeholder throws an error that BLOCKS the
   * tool call. This is the safest option — secrets are either resolved or
   * the call fails loudly.
   *
   * If false (default): unresolvable placeholders are left as-is (the
   * literal `{{NAME}}` string remains) and a warning is emitted. This
   * is more permissive and useful during development.
   */
  strictMode?: boolean;
}

export class SecretResolverMiddleware {
  private readonly client: VaultClient;
  private readonly strict: boolean;

  constructor(options: MiddlewareOptions) {
    this.client = options.client;
    this.strict = options.strictMode ?? false;
  }

  /**
   * Scan a set of tool call parameters for `{{PLACEHOLDER}}` patterns,
   * resolve each one against the vault, and return the patched params.
   *
   * @param params   Original tool parameters from the LLM/agent call.
   * @param origin   The tool's target origin (used for domain binding).
   *                 Examples: `https://api.github.com`, `http://localhost`
   */
  async resolve(params: ToolParams, origin: string): Promise<ResolvedParams> {
    // 1. Walk the parameter tree and collect all unique placeholders.
    const found = new Set<string>();
    collectPlaceholders(params, found);

    if (found.size === 0) {
      return { params, resolved: [], failed: [] };
    }

    // 2. Resolve all placeholders in parallel.
    const items = [...found].map((p) => ({ placeholder: p, origin }));
    const results = await this.client.resolveBatch(items);

    // 3. Build the resolved/failed lists.
    const resolved: string[] = [];
    const failed: Array<{ placeholder: string; reason: VaultErrorCode }> = [];

    for (const [placeholder, valueOrError] of results) {
      if (valueOrError instanceof VaultError) {
        failed.push({ placeholder, reason: valueOrError.code });
      } else {
        resolved.push(placeholder);
      }
    }

    // 4. In strict mode, any failure is a hard error.
    if (this.strict && failed.length > 0) {
      const names = failed.map((f) => `{{${f.placeholder}}} (${f.reason})`).join(', ');
      throw new VaultError(
        'resolve_error',
        `EnigmAgent: cannot resolve required secrets: ${names}. ` +
          'Ensure the vault server is running and the secrets exist.',
      );
    }

    // 5. Build patched parameters.
    const patchedParams = substituteValues(params, results);

    return { params: patchedParams, resolved, failed };
  }

  /**
   * Convenience: resolve params and return the patched copy.
   * Throws only in strict mode. Useful for inline use in tool wrappers.
   */
  async patch(params: ToolParams, origin: string): Promise<ToolParams> {
    const { params: patched } = await this.resolve(params, origin);
    return patched;
  }
}

// ── Parameter tree walkers ────────────────────────────────────────────────────

/**
 * Recursively scan a value tree and collect every unique {{PLACEHOLDER}} name.
 * Only inspects strings, objects, and arrays (ignores numbers, booleans, null).
 */
function collectPlaceholders(value: unknown, out: Set<string>): void {
  if (typeof value === 'string') {
    let match: RegExpExecArray | null;
    PLACEHOLDER_RE.lastIndex = 0;
    while ((match = PLACEHOLDER_RE.exec(value)) !== null) {
      out.add(match[1]);
    }
  } else if (Array.isArray(value)) {
    for (const item of value) collectPlaceholders(item, out);
  } else if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value)) collectPlaceholders(v, out);
  }
}

/**
 * Deep-clone a value tree, replacing every `{{NAME}}` occurrence with the
 * resolved value from `results`. Leaves unresolved placeholders as-is when
 * the entry is a VaultError.
 */
function substituteValues(
  value: unknown,
  results: Map<string, string | VaultError>,
): unknown {
  if (typeof value === 'string') {
    return value.replace(PLACEHOLDER_RE, (_match, name: string) => {
      const resolved = results.get(name);
      return resolved instanceof VaultError || resolved === undefined
        ? `{{${name}}}`  // leave unchanged
        : resolved;
    });
  }
  if (Array.isArray(value)) {
    return value.map((item) => substituteValues(item, results));
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = substituteValues(v, results);
    }
    return out;
  }
  // numbers, booleans, null — untouched
  return value;
}

// ── OpenClaw ToolMiddleware adapter ───────────────────────────────────────────

/**
 * OpenClaw tool middleware interface.
 * Matches the shape expected by @openclaw/plugin-sdk/middleware.
 */
export interface OpenClawToolCall {
  tool: string;
  params: ToolParams;
  /** The remote origin this tool call targets, if known. */
  origin?: string;
}

export interface OpenClawMiddlewareContext {
  call: OpenClawToolCall;
  next: (call: OpenClawToolCall) => Promise<unknown>;
}

/**
 * createToolMiddleware returns a function compatible with OpenClaw's
 * `definePlugin({ middleware })` API.
 *
 * The middleware intercepts every tool call, resolves any `{{PLACEHOLDER}}`
 * patterns in its parameters, and forwards the patched call to the next
 * handler in the pipeline.
 *
 * @example
 * ```typescript
 * import { definePlugin } from '@openclaw/plugin-sdk/plugin-entry';
 * import { createToolMiddleware } from './middleware.js';
 *
 * export default definePlugin({
 *   middleware: [createToolMiddleware(client, { strictMode: true })],
 * });
 * ```
 */
export function createToolMiddleware(
  client: VaultClient,
  options: Omit<MiddlewareOptions, 'client'> = {},
) {
  const resolver = new SecretResolverMiddleware({ client, ...options });

  return async (ctx: OpenClawMiddlewareContext): Promise<unknown> => {
    const { call, next } = ctx;

    // Determine the origin for domain-binding checks.
    // Prefer an explicit origin from the call; fall back to localhost.
    const origin = call.origin ?? 'http://localhost';

    const { params: resolvedParams, resolved, failed } = await resolver.resolve(
      call.params,
      origin,
    );

    // Emit a debug trace (no secret values — only placeholder names).
    if (resolved.length > 0) {
      console.debug(
        `[EnigmAgent] resolved ${resolved.length} secret(s) for tool "${call.tool}": ` +
          resolved.map((n) => `{{${n}}}`).join(', '),
      );
    }
    if (failed.length > 0) {
      console.warn(
        `[EnigmAgent] unresolved placeholder(s) for tool "${call.tool}": ` +
          failed.map((f) => `{{${f.placeholder}}} (${f.reason})`).join(', '),
      );
    }

    return next({ ...call, params: resolvedParams });
  };
}
