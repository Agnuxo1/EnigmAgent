/**
 * EnigmAgent OpenClaw Plugin — CLI command handlers.
 *
 * Adds these commands to the OpenClaw CLI (`openclaw <command>`):
 *
 *   openclaw enigmagent:status   — check vault server status
 *   openclaw enigmagent:list     — list secret names (no values)
 *   openclaw enigmagent:start    — print startup instructions
 *
 * These are registered via definePlugin({ cliCommands }) in src/index.ts.
 * They use @openclaw/plugin-sdk/cli interfaces.
 */

import { VaultClient } from './vault-client.js';
import type { VaultClientConfig } from './types.js';
import { VaultError } from './types.js';

// ── OpenClaw CLI command interface (from @openclaw/plugin-sdk/cli) ─────────────

export interface CliCommand {
  name: string;
  description: string;
  args?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
  options?: Array<{
    flags: string;
    description: string;
    defaultValue?: string | boolean;
  }>;
  action(
    args: Record<string, string>,
    options: Record<string, string | boolean>,
  ): Promise<void>;
}

// ── enigmagent:status ─────────────────────────────────────────────────────────

export function createStatusCommand(config: VaultClientConfig = {}): CliCommand {
  const client = new VaultClient(config);
  return {
    name: 'enigmagent:status',
    description: 'Check whether the EnigmAgent vault server is running and the vault is unlocked.',
    options: [
      { flags: '--port <port>', description: 'REST API port (default: 3737)', defaultValue: '3737' },
      { flags: '--host <host>', description: 'REST API host (default: 127.0.0.1)', defaultValue: '127.0.0.1' },
    ],
    async action(_args, opts) {
      const c = new VaultClient({
        host:    String(opts.host ?? config.host ?? '127.0.0.1'),
        port:    parseInt(String(opts.port ?? config.port ?? '3737'), 10),
        timeoutMs: config.timeoutMs,
      });
      try {
        const status = await c.getStatus();
        if (status.unlocked) {
          console.log('✅ EnigmAgent vault is running and UNLOCKED.');
          console.log('   Secret references ({{NAME}}) will be resolved automatically.');
        } else {
          console.log('🔒 EnigmAgent server is running but the vault is LOCKED.');
          console.log('   Restart with: enigmagent-mcp --mode rest --vault ~/.enigmagent/vault.json');
        }
      } catch (err) {
        if (err instanceof VaultError && err.code === 'server_unreachable') {
          console.error('❌ EnigmAgent server is NOT running.');
          console.error('');
          console.error('Start it with:');
          console.error('  enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json');
          console.error('');
          console.error('Or see the setup guide:');
          console.error('  https://github.com/agnuxo1/EnigmAgent#mcp-server');
          process.exitCode = 1;
        } else {
          throw err;
        }
      }
    },
  };
}

// ── enigmagent:list ───────────────────────────────────────────────────────────

export function createListCommand(config: VaultClientConfig = {}): CliCommand {
  return {
    name: 'enigmagent:list',
    description:
      'List all secret names and their domain bindings. ' +
      'Actual secret values are never shown.',
    options: [
      { flags: '--port <port>', description: 'REST API port (default: 3737)', defaultValue: '3737' },
      { flags: '--host <host>', description: 'REST API host (default: 127.0.0.1)', defaultValue: '127.0.0.1' },
      { flags: '--json', description: 'Output as JSON', defaultValue: false },
    ],
    async action(_args, opts) {
      const client = new VaultClient({
        host:    String(opts.host ?? config.host ?? '127.0.0.1'),
        port:    parseInt(String(opts.port ?? config.port ?? '3737'), 10),
        timeoutMs: config.timeoutMs,
      });
      const entries = await client.listSecrets();

      if (opts.json) {
        console.log(JSON.stringify(entries, null, 2));
        return;
      }

      if (entries.length === 0) {
        console.log('(no secrets in vault)');
        console.log('');
        console.log('Add secrets with:');
        console.log('  enigmagent add GITHUB_TOKEN @github.com <value>');
        return;
      }

      console.log(`\nEnigmAgent vault — ${entries.length} secret(s):\n`);
      console.log('  NAME'.padEnd(32) + 'DOMAIN');
      console.log('  ' + '─'.repeat(56));
      for (const e of entries) {
        const domain = e.domain ? `@${e.domain}` : '(unbound — matches any origin)';
        console.log(`  ${e.name.padEnd(30)} ${domain}`);
      }
      console.log('');
      console.log('Use secrets in tool calls as {{SECRET_NAME}} — they will be resolved');
      console.log('automatically before the tool executes. The LLM never sees the values.');
    },
  };
}

// ── enigmagent:start ──────────────────────────────────────────────────────────

export function createStartCommand(): CliCommand {
  return {
    name: 'enigmagent:start',
    description:
      'Print the command to start the EnigmAgent vault server. ' +
      'The server must be running before OpenClaw can resolve secrets.',
    options: [
      { flags: '--vault <path>', description: 'Path to vault file', defaultValue: '~/.enigmagent/vault.json' },
      { flags: '--port <port>',  description: 'REST API port',       defaultValue: '3737' },
    ],
    async action(_args, opts) {
      const vaultPath = opts.vault ?? '~/.enigmagent/vault.json';
      const port      = opts.port  ?? '3737';

      console.log('\nEnigmAgent vault server setup:');
      console.log('');
      console.log('1. Install the EnigmAgent MCP server:');
      console.log('   npm install -g enigmagent-mcp');
      console.log('');
      console.log('2. Create a vault (first time only):');
      console.log(`   enigmagent create --vault ${vaultPath}`);
      console.log('');
      console.log('3. Start the REST API server (run in a separate terminal or as a service):');
      console.log(`   enigmagent-mcp --mode rest --port ${port} --vault ${vaultPath}`);
      console.log('');
      console.log('4. Add secrets (examples):');
      console.log('   enigmagent add GITHUB_TOKEN @github.com <your-token>');
      console.log('   enigmagent add OPENAI_KEY @api.openai.com <your-key>');
      console.log('   enigmagent add LOGIN:gmail.com @gmail.com <your-password>');
      console.log('   enigmagent add DOC_company-policy.md @localhost <document-contents>');
      console.log('');
      console.log('5. Verify the server is running:');
      console.log('   openclaw enigmagent:status');
      console.log('');
      console.log('6. Reference secrets in agent tool calls:');
      console.log('   {{GITHUB_TOKEN}}          → resolved to the real token at execution time');
      console.log('   {{LOGIN:gmail.com}}        → resolved to the Gmail password');
      console.log('   {{DOC:company-policy.md}}  → resolved to the full document text');
      console.log('');
      console.log('The vault server binds to 127.0.0.1 only. Secret values never leave');
      console.log('your machine and never pass through the LLM.');
    },
  };
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createAllCliCommands(config: VaultClientConfig = {}): CliCommand[] {
  return [
    createStatusCommand(config),
    createListCommand(config),
    createStartCommand(),
  ];
}
