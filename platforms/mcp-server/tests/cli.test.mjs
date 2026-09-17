/** Exercise actual CLI subprocesses and the unchanged v1 encrypted vault format. */
import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { VaultManager, FileStorage } from '../vault-core.js';
import { VaultClient } from '../client.js';

const cli = fileURLToPath(new URL('../index.js', import.meta.url));
const secret = 'SYNTHETIC_END_TO_END_VALUE';
let dir, env;
const children = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'enigmagent-e2e-'));
  const file = join(dir, 'fixture.json');
  env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: dir, TMP: dir,
    HOME: dir, USERPROFILE: dir, ENIGMAGENT_USER: 'fixture-user', ENIGMAGENT_PASS: 'fixture-password-only',
    ENIGMAGENT_API_TOKEN: randomBytes(32).toString('hex'), ENIGMAGENT_VAULT: file };
  const vault = new VaultManager(new FileStorage(file));
  await vault.create(env.ENIGMAGENT_USER, env.ENIGMAGENT_PASS);
  await vault.addSecret({ name: 'TEST_TOKEN', domain: 'example.com', value: secret });
  vault.lock();
});
after(async () => {
  for (const child of children) if (child.exitCode === null && child.signalCode === null) {
    const done = once(child, 'exit'); child.kill(); await done;
  }
  if (dir) await rm(dir, { recursive: true, force: true });
});
async function launch(args) {
  const child = spawn(process.execPath, [cli, ...args], { env, stdio: ['pipe','pipe','pipe'] });
  children.push(child);
  const state = { child, stdout: '', stderr: '' };
  child.stdout.on('data', b => state.stdout += b); child.stderr.on('data', b => state.stderr += b);
  for (let i=0; i<600 && !state.stderr.includes('Listening'); i++) {
    if (child.exitCode !== null) throw new Error('Fixture startup failed');
    await delay(50);
  }
  assert(state.stderr.includes('Listening'), 'Fixture startup timed out');
  return state;
}
const initialize = { jsonrpc: '2.0', id: 1, method: 'initialize', params: {
  protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'fixture', version: '1' } } };
const initialized = { jsonrpc: '2.0', method: 'notifications/initialized' };

for (const raw of [false, true]) test(`real REST and client preserve v1 vault compatibility, raw=${raw}`, async () => {
  const state = await launch(['--mode','rest','--port','0', ...(raw ? ['--allow-raw-resolve'] : [])]);
  const port = Number(/127\.0\.0\.1:(\d+)/.exec(state.stderr)[1]);
  const client = new VaultClient({ token: env.ENIGMAGENT_API_TOKEN, port });
  assert.equal((await client.status()).version, '2.0.0');
  assert.equal((await client.list())[0].name, 'TEST_TOKEN');
  assert(!JSON.stringify(client).includes(env.ENIGMAGENT_API_TOKEN));
  if (raw) {
    assert.equal(await client.resolve('TEST_TOKEN','https://example.com'), secret);
    await assert.rejects(client.resolve('TEST_TOKEN','https://other.invalid'), e => e.code === 'domain_mismatch');
  } else await assert.rejects(client.resolve('TEST_TOKEN','https://example.com'), e => e.code === 'raw_resolve_disabled');
  await assert.rejects(new VaultClient({ token: 'wrong_'.repeat(8), port }).status(), e => e.code === 'unauthorized');
  assert(!state.stderr.includes(secret)); assert.equal(state.stdout, '');
});
for (const raw of [false, true]) test(`real MCP survives null, drains EOF and enforces policy, raw=${raw}`, async () => {
  const state = await launch(raw ? ['--allow-raw-resolve'] : []);
  const messages = [initialize, initialized, null,
    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'enigmagent_resolve', arguments: { placeholder:'TEST_TOKEN', origin:'https://example.com' } } },
    { jsonrpc: '2.0', id: 3, method: 'ping' }];
  const done = once(state.child, 'exit');
  state.child.stdin.end(messages.map(JSON.stringify).join('\n')+'\n');
  await done;
  assert.equal(state.child.exitCode, 0);
  const output = state.stdout.trim().split('\n').map(JSON.parse);
  assert.equal(output.length, 4);
  assert.equal(output.find(m=>m.id===null).error.code, -32600);
  assert.deepEqual(output.find(m=>m.id===3).result, {});
  const resolution = output.find(m=>m.id===2);
  if (raw) assert.equal(resolution.result.content[0].text, secret);
  else { assert.equal(resolution.error.code,-32602); assert(!state.stdout.includes(secret)); }
  assert(!state.stderr.includes(secret));
});
test('CLI validates modes, missing values and ports without prompting', () => {
  for (const args of [['--mode','typo'],['--vault'],['--port','3737oops'],['--port','65536'],['--unknown']]) {
    const child = spawnSync(process.execPath,[cli,...args],{env,encoding:'utf8',timeout:3000});
    assert.equal(child.status,2); assert.equal(child.stdout,'');
  }
});
test('CLI requires credentials and REST authentication before opening a vault', () => {
  for (const [args, overrides] of [[[],{ENIGMAGENT_PASS:''}], [['--mode','rest'],{ENIGMAGENT_API_TOKEN:''}]]) {
    const child=spawnSync(process.execPath,[cli,...args],{env:{...env,...overrides},encoding:'utf8',timeout:3000});
    assert.equal(child.status,2); assert(!child.stderr.includes('Listening'));
  }
});
test('CLI help and version do not require credentials', () => {
  for(const args of [['--version'],['--help']]) {
    const child=spawnSync(process.execPath,[cli,...args],{env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot},encoding:'utf8',timeout:3000});
    assert.equal(child.status,0); assert(child.stdout.includes('2.0.0'));
  }
});
test('client does not follow redirects or leak arbitrary server errors', async t => {
  let requests=0;
  const server=createServer((_req,res)=>{requests++;res.writeHead(302,{Location:'http://127.0.0.1:1/steal'});res.end(JSON.stringify({error:secret}));});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
  await assert.rejects(new VaultClient({token:env.ENIGMAGENT_API_TOKEN,port:server.address().port}).status(),e=>e.code==='unexpected_response'&&!e.message.includes(secret));
  assert.equal(requests,1);
});

test('no-credential demonstration succeeds without personal files or external services', () => {
  const demo = fileURLToPath(new URL('../demo.mjs', import.meta.url));
  const child = spawnSync(process.execPath, [demo], { env: { PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot }, encoding: 'utf8', timeout: 30000 });
  assert.equal(child.status, 0);
  const report = JSON.parse(child.stdout);
  assert.equal(report.demo, 'passed');
  assert.equal(report.rawResolveEnabled, false);
  assert.equal(report.externalNetworkCalls, 0);
  assert(!child.stdout.includes('SYNTHETIC_DEMO_VALUE'));
});
