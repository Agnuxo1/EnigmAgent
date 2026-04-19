/**
 * EnigmAgent OpenClaw Plugin — entry point.
 *
 * Registers:
 *   • Secret resolver middleware (resolves {{PLACEHOLDER}} in tool params)
 *   • Agent tools: enigmagent_vault_status, enigmagent_vault_list
 *   • CLI commands: enigmagent:status, enigmagent:list, enigmagent:start
 *
 * Configuration is read from the OpenClaw project's environment or from
 * the `enigmagent` section of openclaw.config.json:
 *
 *   {
 *     "enigmagent": {
 *       "port": 3737,
 *       "host": "127.0.0.1",
 *       "strictMode": true
 *     }
 *   }
 *
 * Environment variables (override config file):
 *   ENIGMAGENT_PORT        REST API port (default: 3737)
 *   ENIGMAGENT_HOST        REST API host (default: 127.0.0.1)
 *   ENIGMAGENT_STRICT      "true" to enable strict mode (default: false)
 */

import type { EnigmAgentPluginConfig } from './types.js';
import { VaultClient }                 from './vault-client.js';
import { createToolMiddleware }        from './middleware.js';
import { createAllTools }              from './tools.js';
import { createAllCliCommands }        from './cli.js';

// ── Re-exports for consumers who want individual pieces ───────────────────────

export { VaultClient }               from './vault-client.js';
export { SecretResolverMiddleware, createToolMiddleware } from './middleware.js';
export { createVaultStatusTool, createVaultListTool, createAllTools } from './tools.js';
export { createAllCliCommands }      from './cli.js';
export * from './types.js';

// ── Plugin factory ────────────────────────────────────────────────────────────

/**
 * Read runtime configuration from environment variables + optional defaults.
 */
function resolveConfig(defaults: Partial<EnigmAgentPluginConfig> = {}): EnigmAgentPluginConfig {
  const vault = defaults.vault ?? {};
  return {
    vault: {
      host:      process.env.ENIGMAGENT_HOST ?? vault.host ?? '127.0.0.1',
      port:      process.env.ENIGMAGENT_PORT
                   ? parseInt(process.env.ENIGMAGENT_PORT, 10)
                   : (vault.port ?? 3737),
      timeoutMs: vault.timeoutMs ?? 5_000,
    },
    strictMode:     process.env.ENIGMAGENT_STRICT === 'true'
                      ? true
                      : (defaults.strictMode ?? false),
    trustedOrigins: defaults.trustedOrigins,
  };
}

/**
 * OpenClaw plugin definition.
 *
 * Call this inside your openclaw.config.ts / plugin registration file:
 *
 * ```typescript
 * import { createEnigmAgentPlugin } from '@your-org/openclaw-enigmagent';
 *
 * export default defineOpenClawConfig({
 *   plugins: [
 *     createEnigmAgentPlugin({ strictMode: true }),
 *   ],
 * });
 * ```
 *
 * Or, if you're directly adding this to the openclaw/openclaw monorepo,
 * import and re-export from `extensions/enigmagent/src/index.ts`.
 */
export function createEnigmAgentPlugin(
  config: Partial<EnigmAgentPluginConfig> = {},
) {
  const resolved = resolveConfig(config);
  const client   = new VaultClient(resolved.vault);

  return {
    /** Plugin metadata */
    meta: {
      name:        'enigmagent',
      version:     '0.2.0',
      description: 'EnigmAgent encrypted vault — resolves {{SECRET}} references in tool calls at execution time. Secret values never reach the LLM.',
      author:      'agnuxo1 <https://github.com/agnuxo1>',
      homepage:    'https://github.com/agnuxo1/EnigmAgent',
      license:     'MIT',
    },

    /**
     * Tool execution middleware.
     * Intercepts every tool call and resolves {{PLACEHOLDER}} in params
     * before forwarding to the actual tool.
     */
    middleware: [
      createToolMiddleware(client, { strictMode: resolved.strictMode }),
    ],

    /**
     * Agent-callable tools — inspects vault state, never returns values.
     */
    tools: createAllTools(client),

    /**
     * CLI commands (`openclaw enigmagent:*`).
     */
    cliCommands: createAllCliCommands(resolved.vault),
  };
}

/** Default export for OpenClaw auto-discovery (openclaw.plugin.json → "main") */
export default createEnigmAgentPlugin;
