/** Test the actual administrative executable with a temporary synthetic vault. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { VaultManager, FileStorage } from '../vault-core.js';
const cli = fileURLToPath(new URL('../vault-cli.js', import.meta.url));
const SENTINEL = 'SYNTHETIC_PIPE_VALUE --preserve-spaces-and-dashes';
async function temporary(t) {
  const folder = await mkdtemp(join(tmpdir(), 'enigmagent-admin-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: folder, TMP: folder,
    HOME: folder, USERPROFILE: folder, ENIGMAGENT_USER: 'test-user', ENIGMAGENT_PASS: 'synthetic-password-only',
    ENIGMAGENT_VAULT: join(folder, 'vault.json') };
  return { folder, env };
}
function run(args, env, input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Administrator test timeout')); }, 30000);
    child.stdout.on('data', bytes => stdout += bytes); child.stderr.on('data', bytes => stderr += bytes);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
    child.stdin.on('error', () => {}); child.stdin.end(input);
  });
}
function safe(result) {
  if (result.stdout.includes(SENTINEL) || result.stderr.includes(SENTINEL)) throw new Error('Administrator disclosed synthetic secret');
}
test('administrator create/add/rename/domain/export/import/delete are executable end-to-end', async t => {
  const { folder, env } = await temporary(t);
  let result = await run(['create'], env); assert.equal(result.code, 0); safe(result);
  result = await run(['add', 'TOKEN', '--domain', 'example.com', '--value-stdin'], env, SENTINEL + '\n');
  assert.equal(result.code, 0); safe(result);
  result = await run(['get', 'TOKEN'], env); assert.equal(result.stdout, '[redacted]\n');
  result = await run(['rename', 'TOKEN', 'RENAMED'], env); assert.equal(result.code, 0); safe(result);
  result = await run(['domain', 'RENAMED', 'other.example'], env); assert.equal(result.code, 0);
  result = await run(['list'], env); assert.equal(JSON.parse(result.stdout).entries[0].domain, 'other.example'); safe(result);
  const exported = join(folder, 'export.json');
  result = await run(['export', '--output', exported], env); assert.equal(result.code, 0); safe(result);
  const imported = join(folder, 'imported.json');
  result = await run(['import', '--source', exported], { ...env, ENIGMAGENT_VAULT: imported }); assert.equal(result.code, 0);
  const vault = new VaultManager(new FileStorage(imported));
  await vault.unlock('test-user', 'synthetic-password-only');
  assert.equal(await vault.resolve('RENAMED', 'https://other.example'), SENTINEL); vault.lock();
  result = await run(['del', 'RENAMED'], env); assert.equal(result.code, 0); safe(result);
  assert.equal(JSON.parse((await run(['list'], env)).stdout).entries.length, 0);
  if ((await readFile(env.ENIGMAGENT_VAULT, 'utf8')).includes(SENTINEL)) throw new Error('Plaintext reached the vault file');
});
test('administrator refuses plaintext arguments, raw output without consent and obsolete run mode', async t => {
  const { env } = await temporary(t);
  for (const args of [['add', 'TOKEN', '--domain', 'example.com', SENTINEL], ['reveal', 'TOKEN'],
    ['resolve', 'TOKEN', '--origin', 'https://example.com'], ['run', '--', 'node'], ['create', '--unknown']]) {
    const result = await run(args, env); assert.notEqual(result.code, 0); safe(result);
  }
});
test('administrator never overwrites an existing vault or export', async t => {
  const { folder, env } = await temporary(t);
  assert.equal((await run(['create'], env)).code, 0);
  const previous = await readFile(env.ENIGMAGENT_VAULT);
  assert.notEqual((await run(['create'], env)).code, 0);
  assert.deepEqual(await readFile(env.ENIGMAGENT_VAULT), previous);
  const output = join(folder, 'existing.json'); await writeFile(output, 'keep-existing-bytes');
  assert.notEqual((await run(['export', '--output', output], env)).code, 0);
  assert.equal(await readFile(output, 'utf8'), 'keep-existing-bytes');
});
test('administrator explicit raw output respects domain binding and never logs a value to stderr', async t => {
  const { env } = await temporary(t); assert.equal((await run(['create'], env)).code, 0);
  assert.equal((await run(['add', 'TOKEN', '--domain', 'example.com', '--value-stdin'], env, SENTINEL)).code, 0);
  let result = await run(['resolve', 'TOKEN', '--origin', 'https://other.example', '--allow-raw-output'], env);
  assert.notEqual(result.code, 0); safe(result);
  result = await run(['resolve', 'TOKEN', '--origin', 'https://example.com', '--allow-raw-output'], env);
  assert.equal(result.code, 0); assert.equal(result.stdout, SENTINEL + '\n'); assert.equal(result.stderr, '');
});
test('administrator help and version do not access a vault or request credentials', async t => {
  const { folder } = await temporary(t);
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, HOME: folder, USERPROFILE: folder };
  assert.equal((await run(['--version'], env)).stdout, '3.0.0\n');
  const result = await run(['--help'], env); assert.equal(result.code, 0); assert(result.stdout.includes('migrate'));
});
test('all shipped core and administrator copies match the canonical gateway exactly', async () => {
  const root = new URL('../../', import.meta.url);
  const core = await readFile(new URL('../vault-core.js', import.meta.url));
  for (const path of ['shared/vault-core.js', 'npm-library/src/vault-core.js', 'cli/lib/vault-core.js']) {
    assert.deepEqual(await readFile(new URL(path, root)), core, path);
  }
  assert.deepEqual(await readFile(new URL('cli/lib/vault-cli.js', root)), await readFile(new URL('../vault-cli.js', import.meta.url)));
  assert.deepEqual(await readFile(new URL('cli/lib/gateway-policy.js', root)), await readFile(new URL('../gateway-policy.js', import.meta.url)));
});
