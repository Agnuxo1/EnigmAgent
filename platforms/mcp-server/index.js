#!/usr/bin/env node
/** EnigmAgent v3 gateway. Passwords never share stdin with MCP protocol messages. */
import { resolve } from 'node:path';
import { open } from 'node:fs/promises';
import { OperationBroker } from './operation-broker.js';
import { VaultManager, FileStorage } from './vault-core.js';
import { SERVER_VERSION, validateToken } from './gateway-policy.js';
import { createRestServer } from './http-server.js';
import { createMcpHandler, serveStdio } from './mcp-server.js';

const HELP = `EnigmAgent ${SERVER_VERSION}
Usage: enigmagent-mcp [--mode mcp|rest] [--vault PATH] [--port PORT]
                     [--operations CONFIG.json] [--allow-loopback-operations]
                     [--bind 127.0.0.1|0.0.0.0] [--allow-raw-resolve] [--help] [--version]
Default: MCP stdio, metadata only. REST is a separate JSON API, not MCP over HTTP.
Required environment: ENIGMAGENT_USER and ENIGMAGENT_PASS.
REST also requires ENIGMAGENT_API_TOKEN (32-256 random URL-safe characters).
ENIGMAGENT_VAULT overrides --vault. PORT defaults to 3737; 0 selects a free port.
--allow-raw-resolve permits plaintext secret responses. Trusted clients only.
A broker configuration cannot be combined with raw resolution. IPv4 HTTPS egress only.
--allow-loopback-operations explicitly permits fixed 127.0.0.1 HTTP operations.
--bind 0.0.0.0 is for deliberately isolated containers; publish only to host loopback.
No interactive credential prompt: stdio is reserved for protocol traffic.
`;

/** Parse strict options before deriving a key or starting a listener. */
function options(argv) {
  const config = { mode: 'mcp', port: 3737, vault: './enigmagent-vault.json', allowRawResolve: false, allowLoopback: false, bind: '127.0.0.1' };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (seen.has(flag)) throw new Error('Duplicate option');
    seen.add(flag);
    if (flag === '--help') { config.help = true; continue; }
    if (flag === '--version') { config.version = true; continue; }
    if (flag === '--allow-loopback-operations') { config.allowLoopback = true; continue; }
    if (flag === '--allow-raw-resolve') { config.allowRawResolve = true; continue; }
    if (!['--mode', '--port', '--vault', '--operations', '--bind'].includes(flag) || !argv[i + 1] || argv[i + 1].startsWith('--')) {
      throw new Error('Unknown option or missing value');
    }
    const value = argv[++i];
    if (flag === '--port') {
      if (!/^\d{1,5}$/.test(value) || Number(value) > 65535) throw new Error('Invalid port');
      config.port = Number(value);
    } else config[flag.slice(2)] = value;
  }
  if (!['mcp', 'rest'].includes(config.mode)) throw new Error('Invalid mode');
  if (!['127.0.0.1', '0.0.0.0'].includes(config.bind) || (config.operations && config.allowRawResolve) ||
      (config.allowLoopback && !config.operations)) throw new Error('Invalid security policy');
  return config;
}

/** Run one transport and lock the vault on EOF, error or termination. */
async function main() {
  let config;
  try { config = options(process.argv.slice(2)); }
  catch { process.stderr.write('Invalid command line. Use --help.\n'); process.exitCode = 2; return; }
  if (config.help) { process.stdout.write(HELP); return; }
  if (config.version) { process.stdout.write(SERVER_VERSION + '\n'); return; }
  const username = process.env.ENIGMAGENT_USER;
  let password = process.env.ENIGMAGENT_PASS;
  let token = process.env.ENIGMAGENT_API_TOKEN;
  delete process.env.ENIGMAGENT_PASS; delete process.env.ENIGMAGENT_API_TOKEN;
  if (!username || !password) {
    process.stderr.write('ENIGMAGENT_USER and ENIGMAGENT_PASS are required. No credentials are read from protocol stdin.\n');
    process.exitCode = 2; return;
  }
  if (config.mode === 'rest') {
    try { validateToken(token); }
    catch { process.stderr.write('REST requires a random ENIGMAGENT_API_TOKEN (32-256 URL-safe characters).\n'); process.exitCode = 2; return; }
  }
  const vault = new VaultManager(new FileStorage(resolve(process.env.ENIGMAGENT_VAULT || config.vault)));
  let server;
  const stop = () => {
    vault.lock();
    if (server) { server.closeAllConnections(); server.close(() => process.exit(0)); }
    else process.exit(0);
  };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try {
    let broker = null;
    if (config.operations) {
      const file = await open(resolve(config.operations), 'r');
      let contents;
      try {
        if (!(await file.stat()).isFile()) throw new Error('Configuration is not a file');
        const buffer = Buffer.alloc(65537);
        const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
        if (bytesRead > 65536) throw new Error('Configuration is too large');
        contents = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, bytesRead)));
      } finally { await file.close(); }
      broker = new OperationBroker({ vault, operations: contents, allowLoopback: config.allowLoopback });
    }
    await vault.unlock(username, password);
    if (broker && vault.formatVersion !== 2) throw new Error('Migrate the legacy vault before enabling a broker');
    password = undefined; // Drops a reference; JavaScript cannot guarantee memory erasure.
    if (config.allowRawResolve) process.stderr.write('WARNING: raw secret responses enabled; callers may expose them to a model.\n');
    if (config.mode === 'rest') {
      server = createRestServer({ vault, token, allowRawResolve: config.allowRawResolve, broker }); token = undefined;
      await new Promise((ready, reject) => {
        server.once('error', reject); server.listen(config.port, config.bind, ready);
      });
      process.stderr.write(`[EnigmAgent] Listening on http://${config.bind}:${server.address().port}; authentication required.\n`);
      server.on('error', () => { vault.lock(); server.closeAllConnections(); server.close(); process.exitCode = 1; });
    } else {
      process.stderr.write('[EnigmAgent] Listening on stdio.\n');
      const ok = await serveStdio({ input: process.stdin, output: process.stdout,
        handler: createMcpHandler({ vault, allowRawResolve: config.allowRawResolve, broker }) });
      vault.lock();
      if (!ok) { process.stdin.destroy(); process.exitCode = 1; }
    }
  } catch {
    vault.lock(); process.stderr.write('Gateway startup or transport failed. Check configuration and vault credentials.\n');
    process.exitCode = 1;
    if (server) { server.closeAllConnections(); server.close(); }
  }
}
await main();
