#!/usr/bin/env node
/**
 * EnigmAgent CLI
 *
 * Manage your encrypted vault from the terminal or shell scripts.
 * The vault format is identical to the browser extension — export/import works.
 *
 * Usage:
 *   enigmagent create   [-v <vault>]           — create a new vault
 *   enigmagent unlock   [-v <vault>]           — interactive unlock (keeps running)
 *   enigmagent add      NAME @domain VALUE     — add a secret
 *   enigmagent get      NAME -o <origin>        — get (masked) value
 *   enigmagent reveal   NAME -o <origin>        — reveal full value
 *   enigmagent resolve  "{{NAME}}" -o <origin>  — resolve a placeholder template
 *   enigmagent list     [-v <vault>]           — list secrets
 *   enigmagent del      NAME                   — delete a secret
 *   enigmagent rename   OLD NEW                — rename a secret
 *   enigmagent domain   NAME @newdomain        — reassign domain binding
 *   enigmagent export   [-v <vault>] [-o out]  — export vault to file
 *   enigmagent import   <file>                 — import from vault file
 *
 * Vault path: $ENIGMAGENT_VAULT env var or --vault / -v flag
 *             (default: ~/.enigmagent/vault.json)
 * Credentials: $ENIGMAGENT_USER / $ENIGMAGENT_PASS or interactive prompts
 */

import { createInterface } from 'node:readline';
import { resolve, join }   from 'node:path';
import { homedir }         from 'node:os';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { VaultManager, FileStorage } from '../../shared/vault-core.js';

// ── Helpers ─────────────────────────────────���────────────────────────��────────

const args = process.argv.slice(2);
const getFlag = (f, fallback = null) => {
  const i = args.indexOf(f);
  return i !== -1 ? args[i + 1] : fallback;
};
const hasFlag = (f) => args.includes(f);

const VAULT_PATH = process.env.ENIGMAGENT_VAULT
  || getFlag('--vault') || getFlag('-v')
  || join(homedir(), '.enigmagent', 'vault.json');

const ORIGIN = getFlag('--origin') || getFlag('-o') || 'https://cli.enigmagent.local';

async function prompt(question, silent = false) {
  if (process.env.ENIGMAGENT_USER && question.includes('sername')) return process.env.ENIGMAGENT_USER;
  if (process.env.ENIGMAGENT_PASS && question.includes('assword')) return process.env.ENIGMAGENT_PASS;

  const rl = createInterface({ input: process.stdin, output: process.stderr });
  if (silent) {
    // Attempt to hide password on supported terminals
    process.stderr.write(question);
    process.stdin.setRawMode?.(true);
  }
  return new Promise((res) => {
    if (silent) {
      let pwd = '';
      process.stdin.on('data', (chunk) => {
        const ch = chunk.toString();
        if (ch === '\r' || ch === '\n') { process.stdin.setRawMode?.(false); process.stderr.write('\n'); rl.close(); res(pwd); }
        else if (ch === '\u0003') process.exit(1); // Ctrl+C
        else { pwd += ch; process.stderr.write('*'); }
      });
      process.stdin.resume();
    } else {
      rl.question(question, (answer) => { rl.close(); res(answer); });
    }
  });
}

async function getCredentials() {
  const username = await prompt('Username: ');
  const password = await prompt('Password: ', true);
  return { username, password };
}

function mask(s) {
  if (!s) return '';
  if (s.length <= 8) return '•'.repeat(s.length);
  return s.slice(0, 3) + '•'.repeat(Math.max(4, s.length - 6)) + s.slice(-3);
}

const PLACEHOLDER_RE = /\{\{([A-Za-z0-9_:\-.@]+)\}\}/g;

// ── Command implementations ───────────────────────────────────────────────────

const commands = {

  async create() {
    if (existsSync(VAULT_PATH)) {
      const rl = createInterface({ input: process.stdin, output: process.stderr });
      const answer = await new Promise(res => rl.question(`Vault already exists at ${VAULT_PATH}. Overwrite? (yes/no): `, res));
      rl.close();
      if (answer.toLowerCase() !== 'yes') { console.log('Aborted.'); return; }
    }
    const { username, password } = await getCredentials();
    if (password.length < 8) { console.error('Password must be at least 8 characters.'); process.exit(1); }
    const vault = new VaultManager(new FileStorage(VAULT_PATH));
    process.stderr.write('Creating vault with Argon2id key derivation (this takes ~2s)…\n');
    await vault.create(username, password);
    console.log(`✓ Vault created at ${VAULT_PATH}`);
  },

  async list() {
    const vault = new VaultManager(new FileStorage(VAULT_PATH));
    const { username, password } = await getCredentials();
    process.stderr.write('Unlocking…\n');
    await vault.unlock(username, password);
    const entries = vault.list();
    if (!entries.length) { console.log('(no secrets)'); return; }
    for (const e of entries) {
      console.log(`${e.name.padEnd(28)} ${e.domain ? '@' + e.domain : '(unbound)'}`);
    }
    vault.lock();
  },

  async add() {
    const name = args[1];
    if (!name) { console.error('Usage: enigmagent add NAME @domain VALUE'); process.exit(1); }
    let domain = null, valueStart = 2;
    if (args[2]?.startsWith('@')) { domain = args[2].slice(1); valueStart = 3; }
    const value = args.slice(valueStart).filter(a => !a.startsWith('-')).join(' ');
    if (!value) { console.error('Value is required.'); process.exit(1); }

    const vault = new VaultManager(new FileStorage(VAULT_PATH));
    const { username, password } = await getCredentials();
    process.stderr.write('Unlocking…\n');
    await vault.unlock(username, password);
    await vault.addSecret({ name, domain, value });
    vault.lock();
    console.log(`✓ Stored "${name}"${domain ? ` bound to @${domain}` : ' (no domain binding)'}`);
  },

  async reveal() {
    const name = args[1];
    if (!name) { console.error('Usage: enigmagent reveal NAME [-o origin]'); process.exit(1); }
    const vault = new VaultManager(new FileStorage(VAULT_PATH));
    const { username, password } = await getCredentials();
    await vault.unlock(username, password);
    const entry = vault.findByName(name);
    if (!entry) { console.error(`Secret "${name}" not found.`); process.exit(1); }
    const pt = await vault.revealSecret(entry.id);
    vault.lock();
    console.log(pt);
  },

  async get() {
    const name = args[1];
    if (!name) { console.error('Usage: enigmagent get NAME [-o origin]'); process.exit(1); }
    const vault = new VaultManager(new FileStorage(VAULT_PATH));
    const { username, password } = await getCredentials();
    await vault.unlock(username, password);
    const entry = vault.findByName(name);
    if (!entry) { console.error(`Secret "${name}" not found.`); process.exit(1); }
    const pt = await vault.revealSecret(entry.id);
    vault.lock();
    console.log(mask(pt));
  },

  async resolve() {
    const template = args[1];
    if (!template) { console.error('Usage: enigmagent resolve "{{NAME}}" [-o origin]'); process.exit(1); }
    const vault = new VaultManager(new FileStorage(VAULT_PATH));
    const { username, password } = await getCredentials();
    await vault.unlock(username, password);

    PLACEHOLDER_RE.lastIndex = 0;
    const matches = [...template.matchAll(PLACEHOLDER_RE)];
    PLACEHOLDER_RE.lastIndex = 0;
    let out = template;
    for (const m of matches) {
      const value = await vault.resolve(m[1], ORIGIN);
      out = out.split(m[0]).join(value);
    }
    vault.lock();
    console.log(out);
  },

  async del() {
    const name = args[1];
    if (!name) { console.error('Usage: enigmagent del NAME'); process.exit(1); }
    const vault = new VaultManager(new FileStorage(VAULT_PATH));
    const { username, password } = await getCredentials();
    await vault.unlock(username, password);
    const entry = vault.findByName(name);
    if (!entry) { console.error(`Secret "${name}" not found.`); process.exit(1); }
    await vault.deleteSecret(entry.id);
    vault.lock();
    console.log(`✓ Deleted "${name}"`);
  },

  async rename() {
    const [,oldName, newName] = args;
    if (!oldName || !newName) { console.error('Usage: enigmagent rename OLD NEW'); process.exit(1); }
    const vault = new VaultManager(new FileStorage(VAULT_PATH));
    const { username, password } = await getCredentials();
    await vault.unlock(username, password);
    const entry = vault.findByName(oldName);
    if (!entry) { console.error(`Secret "${oldName}" not found.`); process.exit(1); }
    await vault.updateSecret(entry.id, { name: newName });
    vault.lock();
    console.log(`✓ Renamed "${oldName}" → "${newName}"`);
  },

  async domain() {
    const [,name, dom] = args;
    if (!name || !dom) { console.error('Usage: enigmagent domain NAME @newdomain'); process.exit(1); }
    const vault = new VaultManager(new FileStorage(VAULT_PATH));
    const { username, password } = await getCredentials();
    await vault.unlock(username, password);
    const entry = vault.findByName(name);
    if (!entry) { console.error(`Secret "${name}" not found.`); process.exit(1); }
    await vault.updateSecret(entry.id, { domain: dom.replace(/^@/, '') });
    vault.lock();
    console.log(`✓ "${name}" now bound to @${dom.replace(/^@/, '')}`);
  },

  async export() {
    const outPath = getFlag('--output') || getFlag('-o') || `enigmagent-vault-${new Date().toISOString().slice(0,10)}.json`;
    const vault = new VaultManager(new FileStorage(VAULT_PATH));
    const { username, password } = await getCredentials();
    await vault.unlock(username, password);
    writeFileSync(outPath, JSON.stringify(vault.vault, null, 2), 'utf8');
    vault.lock();
    console.log(`✓ Exported vault to ${outPath}`);
  },

  async import() {
    const srcPath = args[1];
    if (!srcPath || !existsSync(srcPath)) { console.error('Usage: enigmagent import <vault-file>'); process.exit(1); }
    const fileVault = JSON.parse(readFileSync(srcPath, 'utf8'));
    const vault = new VaultManager(new FileStorage(VAULT_PATH));
    const { username, password } = await getCredentials();
    process.stderr.write('Verifying vault file credentials…\n');
    await vault.unlock(username, password, fileVault);
    vault.lock();
    console.log(`✓ Vault imported to ${VAULT_PATH}`);
  },

  /**
   * enigmagent run [--env VAR=SECRET ...] -- <command> [args...]
   *
   * Unlock the vault, inject secrets as environment variables,
   * then run any command. Secrets are available as $SECRET_NAME.
   *
   * Examples:
   *   enigmagent run -- twine upload dist/*
   *     → injects ALL vault secrets as env vars (PYPI_TOKEN=xxx, etc.)
   *
   *   enigmagent run --env TWINE_PASSWORD=PYPI_TOKEN -- twine upload -u __token__ dist/*
   *     → maps PYPI_TOKEN → TWINE_PASSWORD specifically
   *
   *   enigmagent run -- npm publish
   *     → injects NPM_TOKEN etc. from vault
   *
   * {{PLACEHOLDER}} patterns in command args are also resolved inline.
   */
  async run() {
    const sepIdx = args.indexOf('--');
    if (sepIdx === -1 || sepIdx >= args.length - 1) {
      console.error([
        'Usage:',
        '  enigmagent run -- <command> [args...]',
        '  enigmagent run --env VAR=SECRET [--env VAR2=SECRET2] -- <command> [args...]',
        '',
        'Examples:',
        '  enigmagent run -- twine upload dist/*',
        '  enigmagent run --env TWINE_PASSWORD=PYPI_TOKEN -- twine upload -u __token__ dist/*',
        '  enigmagent run -- npm publish',
      ].join('\n'));
      process.exit(1);
    }

    // Parse --env VAR=SECRET mappings (between "run" and "--")
    const envMappings = [];
    for (let i = 1; i < sepIdx; i++) {
      if (args[i] === '--env' && args[i + 1]) {
        const eqIdx = args[i + 1].indexOf('=');
        if (eqIdx === -1) { console.error(`--env requires VAR=SECRET format, got: ${args[i+1]}`); process.exit(1); }
        envMappings.push({
          varName:    args[i + 1].slice(0, eqIdx),
          secretName: args[i + 1].slice(eqIdx + 1),
        });
        i++;
      }
    }

    const cmdArgs = args.slice(sepIdx + 1);

    // Unlock vault
    const vault = new VaultManager(new FileStorage(VAULT_PATH));
    const { username, password } = await getCredentials();
    process.stderr.write('Unlocking vault…\n');
    await vault.unlock(username, password);

    // Build env: current process env + vault secrets
    const env = { ...process.env };

    if (envMappings.length > 0) {
      // Explicit mappings only
      for (const { varName, secretName } of envMappings) {
        const entry = vault.findByName(secretName);
        if (!entry) {
          console.error(`Secret "${secretName}" not found in vault.`);
          vault.lock(); process.exit(1);
        }
        env[varName] = await vault.revealSecret(entry.id);
        process.stderr.write(`  → ${varName} = ${secretName} ✓\n`);
      }
    } else {
      // Inject ALL secrets by their vault name
      const entries = vault.list();
      for (const e of entries) {
        env[e.name] = await vault.revealSecret(e.id);
        process.stderr.write(`  → ${e.name} injected ✓\n`);
      }
    }

    // Resolve {{PLACEHOLDER}} tokens in command args
    const resolvedArgs = [];
    for (const arg of cmdArgs) {
      let resolved = arg;
      PLACEHOLDER_RE.lastIndex = 0;
      for (const m of [...arg.matchAll(PLACEHOLDER_RE)]) {
        const entry = vault.findByName(m[1]);
        if (entry) {
          resolved = resolved.split(m[0]).join(await vault.revealSecret(entry.id));
        }
      }
      PLACEHOLDER_RE.lastIndex = 0;
      resolvedArgs.push(resolved);
    }

    vault.lock();

    // Spawn subprocess with injected env
    const { spawn } = await import('node:child_process');
    const [exe, ...exeArgs] = resolvedArgs;
    process.stderr.write(`\nRunning: ${exe} ${exeArgs.join(' ')}\n\n`);

    const child = spawn(exe, exeArgs, { env, stdio: 'inherit', shell: true });
    child.on('close', (code) => process.exit(code ?? 0));
    child.on('error', (err) => {
      console.error(`Failed to start: ${err.message}`);
      process.exit(1);
    });
  },

  help() {
    console.log(`
EnigmAgent CLI v0.3.0
Usage: enigmagent <command> [options]

Commands:
  create              Create a new vault
  list                List all secret names and domains
  add NAME @dom VAL   Add a domain-bound secret
  get NAME            Show masked value
  reveal NAME         Show full value (stdout)
  resolve "{{NAME}}"  Resolve a {{PLACEHOLDER}} template
  del NAME            Delete a secret
  rename OLD NEW      Rename a secret
  domain NAME @dom    Change domain binding
  export              Export vault to JSON file
  import <file>       Import vault from JSON file

  run -- <cmd>        Run any command with vault secrets injected as env vars
                      enigmagent run -- twine upload dist/*
                      enigmagent run --env TWINE_PASSWORD=PYPI_TOKEN -- twine upload -u __token__ dist/*
                      enigmagent run -- npm publish

Options:
  --vault, -v <path>    Vault file path (default: ~/.enigmagent/vault.json)
  --origin, -o <url>    Origin for domain-binding check (default: https://cli.enigmagent.local)

Environment:
  ENIGMAGENT_VAULT    Vault file path
  ENIGMAGENT_USER     Username (skip prompt)
  ENIGMAGENT_PASS     Password (skip prompt — use only in secure CI environments)
    `);
  },
};

// ── Entry point ───────────────────────────────────────────────────────────────

const cmd = args[0];
if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') {
  commands.help(); process.exit(0);
}
if (!commands[cmd]) {
  console.error(`Unknown command: ${cmd}. Run "enigmagent help" for usage.`);
  process.exit(1);
}
commands[cmd]().catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
