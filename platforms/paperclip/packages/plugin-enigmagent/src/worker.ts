/**
 * EnigmAgent Paperclip Plugin — worker entry point.
 *
 * Runs as an out-of-process worker (JSON-RPC via @paperclipai/plugin-sdk).
 * Registers:
 *   • vault_status  — check vault server readiness
 *   • vault_list    — list secret names and domains (never values)
 *
 * Tools are auto-namespaced by Paperclip:
 *   @enigmagent/paperclip-plugin:vault_status
 *   @enigmagent/paperclip-plugin:vault_list
 */

import { definePlugin, runWorker } from '@paperclipai/plugin-sdk';
import { VaultClient, VaultError }  from './vault-client.js';
import { manifest }                 from './manifest.js';

// ── Plugin definition ─────────────────────────────────────────────────────────

const plugin = definePlugin({

  async setup(ctx) {

    // ── Read instance configuration ─────────────────────────────────────────
    const cfg = await ctx.config.get() as {
      host?:       string;
      port?:       number;
      strictMode?: boolean;
      timeoutMs?:  number;
      origin?:     string;
    };

    const host       = process.env['ENIGMAGENT_HOST']      ?? cfg.host       ?? '127.0.0.1';
    const port       = process.env['ENIGMAGENT_PORT']
                         ? parseInt(process.env['ENIGMAGENT_PORT']!)
                         : (cfg.port ?? 3737);
    const timeoutMs  = cfg.timeoutMs  ?? 5_000;
    const origin     = cfg.origin     ?? 'http://localhost';

    ctx.logger.info('EnigmAgent plugin starting', { host, port });

    const client = new VaultClient({ host, port, timeoutMs });

    // ── Health check on startup ─────────────────────────────────────────────
    try {
      const status = await client.getStatus();
      if (status.unlocked) {
        ctx.logger.info('EnigmAgent vault is unlocked and ready.');
      } else {
        ctx.logger.warn(
          'EnigmAgent vault server is running but LOCKED. ' +
          '{{ secret.KEY }} references will not resolve until the vault is unlocked. ' +
          'Run: enigmagent-mcp --mode rest --port ' + port +
          ' --vault ~/.enigmagent/vault.json',
        );
      }
    } catch (err) {
      ctx.logger.warn(
        'EnigmAgent vault server is not reachable at startup. ' +
        '{{ secret.KEY }} references will fail until the server is running. ' +
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // ── Tool: vault_status ──────────────────────────────────────────────────

    ctx.tools.register(
      'vault_status',
      {
        displayName:      manifest.tools[0].displayName,
        description:      manifest.tools[0].description,
        parametersSchema: manifest.tools[0].parametersSchema,
      },
      async (_params, runCtx) => {
        ctx.logger.debug('vault_status called', { agentId: runCtx.agentId });

        try {
          const status = await client.getStatus();
          const unlocked = status.unlocked;

          const message = unlocked
            ? 'Vault is running and UNLOCKED. All {{ secret.KEY }} references will ' +
              'be resolved automatically before tool execution.'
            : 'Vault server is running but LOCKED. Restart it to unlock:\n' +
              `  enigmagent-mcp --mode rest --port ${port} --vault ~/.enigmagent/vault.json`;

          await ctx.activity.log({
            type:    'enigmagent.vault_status_check',
            message: `Vault status checked: ${unlocked ? 'unlocked' : 'locked'}`,
          });

          return {
            content: message,
            data: { running: true, unlocked, host, port },
          };
        } catch (err) {
          const msg =
            'EnigmAgent server is NOT running.\n\n' +
            'Start it with:\n' +
            `  enigmagent-mcp --mode rest --port ${port} --vault ~/.enigmagent/vault.json\n\n` +
            'For full setup instructions, see the plugin README.';

          return {
            content: msg,
            data:    { running: false, unlocked: false, error: String(err) },
          };
        }
      },
    );

    // ── Tool: vault_list ───────────────────────────────────────────────────

    ctx.tools.register(
      'vault_list',
      {
        displayName:      manifest.tools[1].displayName,
        description:      manifest.tools[1].description,
        parametersSchema: manifest.tools[1].parametersSchema,
      },
      async (_params, runCtx) => {
        ctx.logger.debug('vault_list called', { agentId: runCtx.agentId });

        try {
          const entries = await client.listSecrets();

          if (entries.length === 0) {
            return {
              content:
                'No secrets in vault.\n\n' +
                'Add secrets with:\n' +
                '  enigmagent add GITHUB_TOKEN @localhost ghp_...\n' +
                '  enigmagent add LOGIN:github.com @localhost <password>\n' +
                '  enigmagent add DOC_policy.md @localhost "$(cat policy.md)"',
              data: { count: 0, entries: [] },
            };
          }

          const rows = entries.map(
            (e) =>
              `  ${e.name.padEnd(32)} ${e.domain ? `@${e.domain}` : '(unbound)'}`,
          );

          const content =
            `${entries.length} secret(s) in vault:\n\n` +
            `  ${'NAME'.padEnd(32)} DOMAIN\n` +
            `  ${'─'.repeat(52)}\n` +
            rows.join('\n') +
            '\n\n' +
            'Use as {{ secret.NAME }} in tool arguments.\n' +
            'Example: curl -H "Authorization: Bearer {{ secret.GITHUB_TOKEN }}" ...';

          return {
            content,
            data: {
              count:   entries.length,
              entries: entries.map(({ name, domain, created }) => ({ name, domain, created })),
            },
          };
        } catch (err) {
          if (err instanceof VaultError && err.code === 'vault_locked') {
            return {
              content:
                'Vault is locked — cannot list secrets.\n' +
                'Start the vault server to unlock it.',
              data: { error: 'vault_locked' },
            };
          }
          const msg = err instanceof Error ? err.message : String(err);
          ctx.logger.error('vault_list error', { error: msg });
          return { content: `Error: ${msg}`, data: { error: msg } };
        }
      },
    );

    ctx.logger.info('EnigmAgent plugin ready. Tools registered: vault_status, vault_list');
  },

});

export default plugin;
runWorker(plugin, import.meta.url);
