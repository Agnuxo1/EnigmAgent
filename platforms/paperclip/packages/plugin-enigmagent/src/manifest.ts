/**
 * EnigmAgent Paperclip Plugin — manifest.
 *
 * Declares tools, capabilities, and instance configuration schema
 * for the Paperclip plugin registry.
 */

export const manifest = {
  id:          '@enigmagent/paperclip-plugin',
  apiVersion:  1 as const,
  version:     '0.2.0',
  displayName: 'EnigmAgent Vault',
  description:
    'Encrypted local vault for Paperclip agents. Resolves {{ secret.KEY }} ' +
    'references at execution time — credentials never appear in LLM context.',
  categories:  ['connector'] as const,

  capabilities: [
    'agent.tools.register',  // register tools agents can call
    'http.outbound',         // call http://127.0.0.1:3737
    'secrets.read',          // read Paperclip's own secret store (for fallback)
    'activity.log',          // emit resolution events to activity log
  ],

  entrypoints: {
    worker: './dist/worker.js',
  },

  /**
   * Per-instance configuration fields shown in the Paperclip plugin UI.
   * Values are stored in the DB and passed to the worker as ctx.config.get().
   */
  instanceConfigSchema: {
    type: 'object' as const,
    properties: {
      host: {
        type:        'string',
        title:       'Vault API host',
        description: 'Host of the EnigmAgent REST API. Never change to 0.0.0.0.',
        default:     '127.0.0.1',
      },
      port: {
        type:        'integer',
        title:       'Vault API port',
        description: 'Port of the EnigmAgent REST API.',
        default:     3737,
        minimum:     1024,
        maximum:     65535,
      },
      strictMode: {
        type:        'boolean',
        title:       'Strict mode',
        description:
          'If enabled, any tool call containing an unresolvable {{ secret.* }} ' +
          'reference is blocked with an error. Recommended for production.',
        default: false,
      },
      timeoutMs: {
        type:        'integer',
        title:       'Request timeout (ms)',
        description: 'Per-request timeout when contacting the vault server.',
        default:     5000,
        minimum:     500,
        maximum:     30000,
      },
      origin: {
        type:        'string',
        title:       'Resolution origin',
        description:
          'Origin passed to the vault for domain-binding checks. ' +
          'Add secrets with this domain: enigmagent add NAME @localhost <value>',
        default: 'http://localhost',
      },
    },
  },

  /** Tools that agents can call. Namespaced automatically by Paperclip: @enigmagent/paperclip-plugin:vault_status */
  tools: [
    {
      name:        'vault_status',
      displayName: 'Vault Status',
      description:
        'Check whether the EnigmAgent vault server is running and the vault is unlocked. ' +
        'Call this before any task that needs credentials to confirm {{ secret.KEY }} ' +
        'references will resolve correctly.',
      parametersSchema: {
        type:       'object',
        properties: {},
        required:   [],
      },
    },
    {
      name:        'vault_list',
      displayName: 'Vault List',
      description:
        'List all secrets stored in the EnigmAgent vault by name and domain binding. ' +
        'Never returns actual values. Use the names shown here as {{ secret.NAME }} ' +
        'references in your tool arguments — Paperclip resolves them automatically ' +
        'at execution time so the real values never appear in your context.',
      parametersSchema: {
        type:       'object',
        properties: {},
        required:   [],
      },
    },
  ],
} as const;

export type Manifest = typeof manifest;
