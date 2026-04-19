/**
 * EnigmAgent — server-side secrets provider integration patch.
 *
 * This file shows EXACTLY what to add to server/src/secrets/index.ts
 * (or equivalent secrets factory) to register the EnigmAgent provider.
 *
 * ═══════════════════════════════════════════════════════════════════
 * HOW TO APPLY
 * ═══════════════════════════════════════════════════════════════════
 *
 * 1. Add the package dependency in packages/server/package.json:
 *
 *      "@enigmagent/paperclip-secrets-provider": "workspace:*"
 *    or if publishing:
 *      "@enigmagent/paperclip-secrets-provider": "^0.2.0"
 *
 * 2. Find the secrets provider factory (likely in server/src/secrets/index.ts
 *    or server/src/config.ts). It will look similar to this:
 *
 *    ┌────────────────────────────────────────────────────────────────┐
 *    │  function createSecretsProvider(config) {                      │
 *    │    switch (config.secretsProvider) {                           │
 *    │      case 'env':  return new EnvSecretsProvider();             │
 *    │      case 'file': return new FileSecretsProvider(config);      │
 *    │      case 'kms':  return new KmsSecretsProvider(config);       │
 *    │      default:     return new EnvSecretsProvider();             │
 *    │    }                                                           │
 *    │  }                                                             │
 *    └────────────────────────────────────────────────────────────────┘
 *
 * 3. Add the import at the top:
 */

// ── ADD THIS IMPORT ────────────────────────────────────────────────────────────
import {
  EnigmAgentSecretsProvider,
  createEnigmAgentSecretsProvider,
} from '@enigmagent/paperclip-secrets-provider';

// ── ADD THIS CASE to the createSecretsProvider switch statement ────────────────
//
// case 'enigmagent':
//   return createEnigmAgentSecretsProvider();
//
// ── The full switch after the patch should look like ──────────────────────────

function createSecretsProvider_PATCHED(config: { secretsProvider: string }) {
  switch (config.secretsProvider) {
    case 'env':
      // existing implementation
      break;
    case 'file':
      // existing implementation
      break;
    case 'kms':
      // existing implementation
      break;

    // ── NEW CASE ──────────────────────────────────────────────────────────────
    case 'enigmagent':
      return createEnigmAgentSecretsProvider();
    // ─────────────────────────────────────────────────────────────────────────

    default:
      // existing fallback
      break;
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * ENVIRONMENT VARIABLES TO ADD TO .env.example
 * ═══════════════════════════════════════════════════════════════════
 *
 * # EnigmAgent secrets provider
 * # Set PAPERCLIP_SECRETS_PROVIDER=enigmagent to enable
 * PAPERCLIP_SECRETS_PROVIDER=enigmagent
 * ENIGMAGENT_HOST=127.0.0.1
 * ENIGMAGENT_PORT=3737
 * ENIGMAGENT_TIMEOUT_MS=5000
 * ENIGMAGENT_ORIGIN=http://localhost
 * ENIGMAGENT_DEBUG=false
 *
 * ═══════════════════════════════════════════════════════════════════
 * HOW IT WORKS AFTER THE PATCH
 * ═══════════════════════════════════════════════════════════════════
 *
 * 1. User sets PAPERCLIP_SECRETS_PROVIDER=enigmagent in their .env
 * 2. Paperclip starts its secrets provider as EnigmAgentSecretsProvider
 * 3. Agent runs a tool call with {{ secret.GITHUB_TOKEN }} in a parameter
 * 4. Paperclip's existing resolveSecretsInParams() calls provider.resolve('GITHUB_TOKEN')
 * 5. EnigmAgentSecretsProvider calls POST http://127.0.0.1:3737/resolve
 *    { "placeholder": "GITHUB_TOKEN", "origin": "http://localhost" }
 * 6. EnigmAgent vault decrypts and returns the real token
 * 7. Paperclip substitutes the real value into the tool parameter
 * 8. Tool executes with the real token
 * 9. LLM receives the tool result — never the raw token value
 *
 * ═══════════════════════════════════════════════════════════════════
 * ADDING TO server/src/config.ts (PAPERCLIP_SECRETS_PROVIDER enum)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Find the secrets provider type definition and add 'enigmagent':
 *
 *   type SecretsProviderType = 'env' | 'file' | 'kms' | 'enigmagent';
 *                                                        ^^^^^^^^^^^
 *
 * And in the Zod schema (if used):
 *
 *   secretsProvider: z.enum(['env', 'file', 'kms', 'enigmagent']).default('env'),
 *                                                    ^^^^^^^^^^^
 */

export { EnigmAgentSecretsProvider, createEnigmAgentSecretsProvider };
