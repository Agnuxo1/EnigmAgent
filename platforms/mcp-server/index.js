#!/usr/bin/env node
/**
 * EnigmAgent MCP Server
 *
 * Exposes the EnigmAgent vault as:
 *   1. An MCP (Model Context Protocol) stdio server — for Open WebUI, AnythingLLM, LM Studio, etc.
 *   2. A local REST API on http://localhost:PORT — for custom integrations
 *
 * The vault must be unlocked before resolution. The master key lives in
 * process memory only and is cleared when the server stops.
 *
 * Usage:
 *   # Start MCP server (stdio, for LLM tool use)
 *   enigmagent-mcp --vault ./my.vault.json
 *
 *   # Start REST API server
 *   enigmagent-mcp --mode rest --port 3737 --vault ./my.vault.json
 *
 * The vault is unlocked interactively at startup (or via env vars for CI).
 *
 * Environment variables:
 *   ENIGMAGENT_VAULT   Path to vault file (overrides --vault)
 *   ENIGMAGENT_USER    Username (skips interactive prompt)
 *   ENIGMAGENT_PASS    Password (skips interactive prompt — use only in secure envs)
 *
 * MCP tools exposed:
 *   enigmagent_resolve  — resolve a {{PLACEHOLDER}} to its real value
 *   enigmagent_list     — list secret names and domains (no values)
 */

import { createServer }  from 'node:http';
import { resolve }       from 'node:path';
import { createInterface } from 'node:readline';
import { VaultManager, FileStorage } from './vault-core.js';

// ── CLI argument parsing ──────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag, fallback = null) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : fallback;
};

const MODE       = getArg('--mode', 'mcp');          // 'mcp' | 'rest'
const PORT       = parseInt(getArg('--port', '3737'), 10);
const VAULT_PATH = process.env.ENIGMAGENT_VAULT || getArg('--vault', './enigmagent-vault.json');

if (!VAULT_PATH) {
  console.error('Usage: enigmagent-mcp --vault <path> [--mode mcp|rest] [--port 3737]');
  process.exit(1);
}

// ── Vault unlock ─────────────────────────────────────────────────────────────

const vault = new VaultManager(new FileStorage(resolve(VAULT_PATH)));

async function promptCredentials() {
  if (process.env.ENIGMAGENT_USER && process.env.ENIGMAGENT_PASS) {
    return {
      username: process.env.ENIGMAGENT_USER,
      password: process.env.ENIGMAGENT_PASS,
    };
  }
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const ask = (q) => new Promise((res) => rl.question(q, res));

  const username = process.env.ENIGMAGENT_USER || await ask('Username: ');
  const password = process.env.ENIGMAGENT_PASS || await ask('Password: ');
  rl.close();
  return { username, password };
}

// ── MCP protocol (stdio, JSON-RPC 2.0) ───────────────────────────────────────

function mcpResponse(id, result) {
  return JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n';
}
function mcpError(id, code, message, data) {
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code, message, data } }) + '\n';
}

const MCP_TOOLS = [
  {
    name:        'enigmagent_resolve',
    description: 'Resolve a secret placeholder from the EnigmAgent vault. Returns the decrypted value. Domain binding is enforced: the origin must match the secret\'s bound domain.',
    inputSchema: {
      type: 'object',
      required: ['placeholder', 'origin'],
      properties: {
        placeholder: {
          type: 'string',
          description: 'The secret name to resolve. Supports {{NAME}}, {{LOGIN:domain}}, {{DOC:filename}} syntax (pass without the braces).',
        },
        origin: {
          type: 'string',
          description: 'The requesting origin URL (e.g. https://api.example.com). Must match the secret\'s domain binding.',
        },
      },
    },
  },
  {
    name:        'enigmagent_list',
    description: 'List all secret names and their bound domains. Never returns actual secret values.',
    inputSchema: { type: 'object', properties: {} },
  },
];

async function handleMcpRequest(line) {
  let req;
  try { req = JSON.parse(line); } catch { return null; }

  const { id, method, params } = req;

  if (method === 'initialize') {
    return mcpResponse(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'enigmagent', version: '0.2.0' },
    });
  }
  if (method === 'tools/list') {
    return mcpResponse(id, { tools: MCP_TOOLS });
  }
  if (method === 'tools/call') {
    const { name, arguments: toolArgs } = params || {};
    try {
      if (name === 'enigmagent_resolve') {
        const value = await vault.resolve(toolArgs.placeholder, toolArgs.origin);
        return mcpResponse(id, {
          content: [{ type: 'text', text: value }],
        });
      }
      if (name === 'enigmagent_list') {
        const entries = vault.list();
        const text = entries.map(e => `${e.name.padEnd(28)} ${e.domain ? '@' + e.domain : '(unbound)'}`).join('\n');
        return mcpResponse(id, { content: [{ type: 'text', text: text || '(no secrets)' }] });
      }
      return mcpError(id, -32601, `Unknown tool: ${name}`);
    } catch (err) {
      return mcpResponse(id, {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true,
      });
    }
  }
  if (method === 'ping') return mcpResponse(id, {});
  return mcpError(id, -32601, `Method not found: ${method}`);
}

function startMcpMode() {
  process.stderr.write(`[EnigmAgent MCP] Vault unlocked. Listening on stdin (JSON-RPC 2.0 / MCP).\n`);
  const rl = createInterface({ input: process.stdin });
  rl.on('line', async (line) => {
    if (!line.trim()) return;
    const response = await handleMcpRequest(line);
    if (response) process.stdout.write(response);
  });
  rl.on('close', () => { vault.lock(); process.exit(0); });
}

// ── REST API ──────────────────────────────────────────────────────────────────

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '127.0.0.1');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, code, data) {
  cors(res);
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function startRestMode() {
  const server = createServer(async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const url = new URL(req.url, `http://localhost:${PORT}`);

    // GET /status — vault health check
    if (req.method === 'GET' && url.pathname === '/status') {
      return json(res, 200, { status: 'ok', unlocked: vault.isUnlocked });
    }

    // GET /list — list secrets (no values)
    if (req.method === 'GET' && url.pathname === '/list') {
      if (!vault.isUnlocked) return json(res, 401, { error: 'vault_locked' });
      return json(res, 200, { entries: vault.list() });
    }

    // POST /resolve — resolve a placeholder
    if (req.method === 'POST' && url.pathname === '/resolve') {
      if (!vault.isUnlocked) return json(res, 401, { error: 'vault_locked' });
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { placeholder, origin } = JSON.parse(body);
          if (!placeholder) return json(res, 400, { error: 'placeholder is required' });
          if (!origin)      return json(res, 400, { error: 'origin is required' });
          const value = await vault.resolve(placeholder, origin);
          json(res, 200, { value });
        } catch (err) {
          const code = err.code || 'resolve_error';
          json(res, 403, { error: code, message: err.message });
        }
      });
      return;
    }

    json(res, 404, { error: 'not_found' });
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.error(`[EnigmAgent REST] Listening on http://127.0.0.1:${PORT}`);
    console.error(`  GET  /status     — vault health check`);
    console.error(`  GET  /list       — list secret names`);
    console.error(`  POST /resolve    — { "placeholder": "NAME", "origin": "https://..." }`);
  });

  process.on('SIGINT', () => { vault.lock(); server.close(() => process.exit(0)); });
  process.on('SIGTERM', () => { vault.lock(); server.close(() => process.exit(0)); });
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  try {
    process.stderr.write(`[EnigmAgent MCP] Vault: ${resolve(VAULT_PATH)}\n`);
    const { username, password } = await promptCredentials();
    process.stderr.write(`[EnigmAgent MCP] Unlocking vault (Argon2id — takes ~2s)…\n`);
    await vault.unlock(username, password);
    process.stderr.write(`[EnigmAgent MCP] Vault unlocked for: ${username}\n`);

    if (MODE === 'rest') {
      startRestMode();
    } else {
      startMcpMode();
    }
  } catch (err) {
    process.stderr.write(`[EnigmAgent MCP] Fatal: ${err.message}\n`);
    process.exit(1);
  }
})();
