/**
 * EnigmAgent OpenClaw Plugin — agent-callable tools.
 *
 * These tools let an agent inspect the vault's state and list available
 * secrets. They intentionally NEVER return actual secret values — secrets
 * are only injected inline via the middleware (src/middleware.ts).
 *
 * Tools exposed:
 *   enigmagent_vault_status  — check if vault server is running & unlocked
 *   enigmagent_vault_list    — list secret names and domains (no values)
 *
 * Usage in agent prompts:
 *   "Check if the vault is ready before attempting to push code."
 *   "List the available secrets so I know what credentials I have access to."
 *
 * Compatible with the OpenClaw AgentTool interface from
 * @openclaw/plugin-sdk/tools.
 */

import type { VaultStatusToolResult, VaultListToolResult } from './types.js';
import { VaultError } from './types.js';
import type { VaultClient } from './vault-client.js';

// ── Tool definitions ──────────────────────────────────────────────────────────

/**
 * OpenClaw AgentTool shape.
 * Matches @openclaw/plugin-sdk/tools AgentTool<TInput, TOutput>.
 */
export interface AgentTool<TInput = Record<string, unknown>, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute(input: TInput): Promise<TOutput>;
}

// ── enigmagent_vault_status ───────────────────────────────────────────────────

export function createVaultStatusTool(client: VaultClient): AgentTool<Record<string, never>, VaultStatusToolResult> {
  return {
    name: 'enigmagent_vault_status',
    description:
      'Check whether the EnigmAgent vault server is running and the vault is unlocked. ' +
      'Call this before any operation that requires secrets to ensure the vault is ready. ' +
      'Returns running=true/false and unlocked=true/false.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    async execute(_input) {
      try {
        const status = await client.getStatus();
        const unlocked = status.unlocked;
        return {
          running: true,
          unlocked,
          message: unlocked
            ? 'Vault is running and unlocked. Secret references ({{NAME}}) will be resolved.'
            : 'Vault server is running but locked. Unlock it with: enigmagent-mcp --mode rest --vault <path>',
        };
      } catch (err) {
        if (err instanceof VaultError && err.code === 'server_unreachable') {
          return {
            running: false,
            unlocked: false,
            message:
              'EnigmAgent server is not running. Start it with: ' +
              'enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json',
          };
        }
        throw err;
      }
    },
  };
}

// ── enigmagent_vault_list ─────────────────────────────────────────────────────

export function createVaultListTool(client: VaultClient): AgentTool<Record<string, never>, VaultListToolResult> {
  return {
    name: 'enigmagent_vault_list',
    description:
      'List all secrets available in the EnigmAgent vault by name and domain binding. ' +
      'Never returns actual secret values. Use the names shown here as {{PLACEHOLDER}} ' +
      'references in tool parameters — they will be resolved automatically at execution time. ' +
      'Example: if a secret named GITHUB_TOKEN is listed, reference it as {{GITHUB_TOKEN}} ' +
      'in any bash command, HTTP header, or form field.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    async execute(_input) {
      const entries = await client.listSecrets();
      return {
        count: entries.length,
        entries: entries.map(({ name, domain, created }) => ({
          name,
          domain,
          created,
        })),
      };
    },
  };
}

// ── Convenience factory ───────────────────────────────────────────────────────

/**
 * Create all EnigmAgent tools pre-wired to a VaultClient.
 * Pass the result directly to `definePlugin({ tools })`.
 */
export function createAllTools(client: VaultClient): AgentTool[] {
  return [
    createVaultStatusTool(client),
    createVaultListTool(client),
  ];
}
