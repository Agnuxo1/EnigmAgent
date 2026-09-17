#!/usr/bin/env node
/** Human-operated vault administration. Secrets are never accepted as CLI arguments. */
import { createInterface } from 'node:readline/promises';
import { StringDecoder } from 'node:string_decoder';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { VaultManager, FileStorage, MemoryStorage, MAX_SECRET_BYTES, VaultError } from './vault-core.js';
import { SERVER_VERSION } from './gateway-policy.js';

const HELP = `EnigmAgent vault administrator ${SERVER_VERSION}
Usage: enigmagent-vault COMMAND [arguments] [options]

  create                         Create a new authenticated v2 vault; never overwrite.
  list                           List secret names and bound domains, not values.
  add NAME --domain HOST         Read a secret interactively or with --value-stdin.
  rename NAME NEW_NAME           Rename an entry atomically.
  domain NAME HOST               Change an authenticated domain binding.
  del NAME                       Delete an entry; the prior file remains in .bak.
  get NAME                       Check an entry exists, with fully redacted output.
  reveal NAME --allow-raw-output  Explicit human-only plaintext output.
  resolve NAME --origin URL --allow-raw-output
                                 Trusted explicit plaintext resolution with domain checks.
  export --output NEW_FILE       Export the encrypted envelope; never overwrite.
  import --source FILE           Verify and import to a new destination vault.
  migrate                        Explicitly migrate verified v1 entries to v2.
  recover                        Verify .bak and retain damaged bytes before restoring.

  --vault PATH                   Destination/current vault path.
  --value-stdin                  Read the secret, not the password, from stdin.
  --migrate-legacy               Explicit v1 migration during import.
  --help / --version             Show this help / version.

ENIGMAGENT_VAULT overrides --vault. The default is ~/.enigmagent/vault.json.
ENIGMAGENT_USER and ENIGMAGENT_PASS bypass terminal prompts. No protocol server is
started. Migration cannot prove that old unauthenticated domain metadata was
never modified: review your legacy bindings first. v2 is not a v1 browser export.
`;

/** Strict parsing prevents flags or file paths from becoming part of a stored secret. */
function parse(argv) {
  const config = { command: argv[0], positional: [], vault: join(homedir(), '.enigmagent', 'vault.json') };
  const booleanFlags = new Set(['--allow-raw-output', '--value-stdin', '--migrate-legacy']);
  const valueFlags = new Set(['--vault', '--domain', '--origin', '--output', '--source']);
  const seen = new Set();
  for (let i = 1; i < argv.length; i++) {
    const value = argv[i];
    if (!value.startsWith('-')) { config.positional.push(value); continue; }
    if (seen.has(value)) throw new VaultError('invalid_arguments');
    seen.add(value);
    if (booleanFlags.has(value)) config[value.slice(2)] = true;
    else if (valueFlags.has(value) && argv[i + 1] && !argv[i + 1].startsWith('-')) config[value.slice(2)] = argv[++i];
    else throw new VaultError('invalid_arguments');
  }
  const count = { create: 0, list: 0, add: 1, rename: 2, domain: 2, del: 1, get: 1, reveal: 1,
    resolve: 1, export: 0, import: 0, migrate: 0, recover: 0 }[config.command];
  if (count === undefined || config.positional.length !== count) throw new VaultError('invalid_arguments');
  if (config.command === 'add' && !config.domain || config.command === 'resolve' && !config.origin ||
      config.command === 'export' && !config.output || config.command === 'import' && !config.source) throw new VaultError('invalid_arguments');
  if (['reveal', 'resolve'].includes(config.command) && !config['allow-raw-output']) throw new VaultError('raw_output_not_enabled');
  if (config['value-stdin'] && config.command !== 'add' || config['migrate-legacy'] && config.command !== 'import') throw new VaultError('invalid_arguments');
  return config;
}

/** Read a hidden terminal value with correct UTF-8, backspace and listener cleanup. */
function hiddenInput(prompt, maxBytes = 4096) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') throw new VaultError('interactive_terminal_required');
  const input = process.stdin, previousRaw = input.isRaw, previouslyPaused = input.isPaused();
  const decoder = new StringDecoder('utf8');
  process.stderr.write(prompt); input.setRawMode(true); input.resume();
  return new Promise((resolve, reject) => {
    let value = '', settled = false;
    const finish = (error) => {
      if (settled) return; settled = true;
      input.removeListener('data', onData); input.removeListener('error', onError); input.removeListener('end', onEnd);
      input.setRawMode(Boolean(previousRaw)); if (previouslyPaused) input.pause(); process.stderr.write('\n');
      if (error) reject(error); else resolve(value);
    };
    const onError = () => finish(new VaultError('input_failed'));
    const onEnd = () => finish(new VaultError('input_closed'));
    const onData = bytes => {
      for (const character of decoder.write(bytes)) {
        if (character === '\r' || character === '\n') { finish(); return; }
        if (character === '\u0003' || character === '\u0004') { finish(new VaultError('input_cancelled')); return; }
        if (character === '\u007f' || character === '\b') { value = [...value].slice(0, -1).join(''); continue; }
        if (character < ' ' || character === '\u001b') continue;
        value += character;
        if (Buffer.byteLength(value) > maxBytes) { finish(new VaultError('input_too_large')); return; }
      }
    };
    input.on('data', onData); input.on('error', onError); input.on('end', onEnd);
  });
}

/** Pipe mode is opt-in and bounded; it never consumes an interactive password stream. */
async function secretInput(config) {
  if (!config['value-stdin']) return hiddenInput('Secret value (hidden): ', MAX_SECRET_BYTES);
  let chunks = [], length = 0;
  for await (const chunk of process.stdin) {
    length += chunk.length;
    if (length > MAX_SECRET_BYTES + 2) throw new VaultError('input_too_large');
    chunks.push(chunk);
  }
  const value = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)).replace(/\r?\n$/, '');
  if (Buffer.byteLength(value) > MAX_SECRET_BYTES) throw new VaultError('input_too_large');
  return value;
}
async function credentials() {
  let username = process.env.ENIGMAGENT_USER, password = process.env.ENIGMAGENT_PASS;
  delete process.env.ENIGMAGENT_PASS;
  if (!username) {
    if (!process.stdin.isTTY) throw new VaultError('credentials_required');
    const reader = createInterface({ input: process.stdin, output: process.stderr });
    try { username = await reader.question('Username: '); } finally { reader.close(); }
  }
  if (!password) password = await hiddenInput('Master password (hidden): ');
  return { username, password };
}

/** Execute one fully bounded administrative operation, then lock in all outcomes. */
async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || ['--help', '-h', 'help'].includes(argv[0])) { process.stdout.write(HELP); return; }
  if (argv[0] === '--version') { process.stdout.write(SERVER_VERSION + '\n'); return; }
  let vault;
  try {
    const config = parse(argv);
    const path = resolve(process.env.ENIGMAGENT_VAULT || config.vault);
    vault = new VaultManager(new FileStorage(path));
    let { username, password } = await credentials();
    if (config.command === 'create') {
      if (password.length < 12) throw new VaultError('password_too_short');
      await vault.create(username, password);
      process.stdout.write(JSON.stringify({ created: true, version: 2 }) + '\n'); return;
    }
    if (config.command === 'recover') {
      await vault.recoverBackup(username, password);
      process.stdout.write(JSON.stringify({ recovered: true, version: vault.formatVersion }) + '\n'); return;
    }
    if (config.command === 'import') {
      const target = await new FileStorage(path).loadSnapshot();
      if (target.data !== null) throw new VaultError('vault_exists');
      const imported = await new FileStorage(config.source).load();
      const memory = new VaultManager(new MemoryStorage(imported));
      try {
        await memory.unlock(username, password);
        if (memory.formatVersion === 1) {
          if (!config['migrate-legacy']) throw new VaultError('migration_required');
          await memory.migrate();
        }
        await memory.exportTo(path);
      } finally { memory.lock(); }
      process.stdout.write('{"imported":true,"version":2}\n'); return;
    }
    await vault.unlock(username, password); password = undefined;
    const [name, other] = config.positional;
    let entry;
    if (['rename', 'domain', 'del', 'get', 'reveal'].includes(config.command)) {
      entry = vault.findByName(name); if (!entry) throw new VaultError('not_found');
    }
    switch (config.command) {
      case 'list': process.stdout.write(JSON.stringify({ entries: vault.list() }) + '\n'); break;
      case 'add': await vault.addSecret({ name, domain: config.domain, value: await secretInput(config) }); process.stdout.write('{"stored":true}\n'); break;
      case 'rename': await vault.updateSecret(entry.id, { name: other }); process.stdout.write('{"renamed":true}\n'); break;
      case 'domain': await vault.updateSecret(entry.id, { domain: other }); process.stdout.write('{"updated":true}\n'); break;
      case 'del': await vault.deleteSecret(entry.id); process.stdout.write('{"deleted":true}\n'); break;
      case 'get': process.stdout.write('[redacted]\n'); break;
      case 'reveal': process.stdout.write(await vault.revealSecret(entry.id) + '\n'); break;
      case 'resolve': process.stdout.write(await vault.resolve(name, config.origin) + '\n'); break;
      case 'export': await vault.exportTo(config.output); process.stdout.write('{"exported":true}\n'); break;
      case 'migrate': process.stdout.write(JSON.stringify(await vault.migrate()) + '\n'); break;
    }
  } catch (error) {
    process.stderr.write(`Vault operation failed: ${error instanceof VaultError ? error.code : 'operation_failed'}.\n`);
    process.exitCode = 1;
  } finally { vault?.lock(); }
}
await main();
