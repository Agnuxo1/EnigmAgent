/** Real fixed-destination HTTP tests. No external service or real credential is used. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer, request } from 'node:http';
import { once } from 'node:events';
import { OperationBroker, isPublicIPv4 } from '../operation-broker.js';
import { createRestServer } from '../http-server.js';
import { createMcpHandler } from '../mcp-server.js';
const SECRET = 'SYNTHETIC_BROKER_SENTINEL';
const TOKEN = 'fixture_'.repeat(8);
const vault = () => ({ isUnlocked: true, formatVersion: 2, calls: 0, list: () => [],
  async resolve(name, origin) { this.calls++; assert.equal(name, 'TOKEN'); assert(origin.startsWith('http://127.0.0.1:')); return SECRET; } });
async function target(t, handler) {
  const server = createServer(handler); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return { server, url: `http://127.0.0.1:${server.address().port}/check` };
}
const configuration = url => [{ name: 'check', url, secret: 'TOKEN', method: 'GET' }];
function brokerFor(v, url, options = {}) { return new OperationBroker({ vault: v, operations: configuration(url), allowLoopback: true, ...options }); }
function call(port, path, body, token = TOKEN) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method: body === undefined ? 'GET' : 'POST', agent: false,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }, res => {
      let text = ''; res.on('data', bytes => text += bytes); res.on('end', () => resolve({ status: res.statusCode, text }));
    });
    req.on('error', reject); req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
test('broker attaches the secret only to the approved destination and discards reflections', async t => {
  let seen = 0;
  const { url } = await target(t, (req, res) => {
    seen++; assert.equal(req.url, '/check'); assert.equal(req.headers.authorization, `Bearer ${SECRET}`);
    res.setHeader('X-Reflected-Secret', SECRET); res.end(JSON.stringify({ secret: SECRET, encoded: Buffer.from(SECRET).toString('base64') }));
  });
  const broker = brokerFor(vault(), url);
  assert.deepEqual(await broker.execute('check'), { operation: 'check', status: 200, ok: true });
  assert.equal(seen, 1); assert.deepEqual(broker.list(), [{ name: 'check' }]); assert.equal(JSON.stringify(broker), '{}');
});
test('unlisted operations cannot change destinations or invoke the vault', async t => {
  let seen = 0; const { url } = await target(t, (_req, res) => { seen++; res.end(); });
  const v = vault(), broker = brokerFor(v, url);
  for (const name of ['other', url, '../check', '', null]) await assert.rejects(broker.execute(name), { code: 'operation_not_allowed' });
  assert.equal(seen, 0); assert.equal(v.calls, 0);
});
test('loopback and plain HTTP require explicit operator opt-in', () => {
  assert.throws(() => new OperationBroker({ vault: vault(), operations: configuration('http://127.0.0.1/check') }));
  for (const url of ['http://example.com/check', 'https://10.0.0.1/check', 'https://169.254.169.254/latest',
      'https://user:pass@example.com/check', 'https://example.com/check#fragment', 'https://[::1]/check']) {
    assert.throws(() => brokerFor(vault(), url));
  }
});
test('private, reserved and unsupported egress addresses fail closed', () => {
  for (const ip of ['0.0.0.0', '10.1.2.3', '100.64.0.1', '100.127.255.255', '127.0.0.1', '169.254.169.254',
      '172.16.0.1', '172.31.255.255', '192.168.1.1', '192.0.2.1', '192.0.0.1', '198.18.0.1', '198.51.100.1',
      '203.0.113.1', '224.0.0.1', '255.255.255.255', '::1', '::ffff:8.8.8.8', 'not-an-ip']) assert.equal(isPublicIPv4(ip), false, ip);
  for (const ip of ['8.8.8.8', '1.1.1.1', '100.63.255.255', '172.15.255.255', '172.32.0.1']) assert.equal(isPublicIPv4(ip), true, ip);
});
test('a hostname resolving to loopback is denied before resolving a credential', async () => {
  const v = vault(), broker = new OperationBroker({ vault: v, operations: configuration('https://localhost/check') });
  await assert.rejects(broker.execute('check'), { code: 'destination_not_allowed' }); assert.equal(v.calls, 0);
});
test('redirects are not followed even to a second local service', async t => {
  let secondSeen = 0; const second = await target(t, (_req, res) => { secondSeen++; res.end(SECRET); });
  const first = await target(t, (_req, res) => { res.writeHead(302, { Location: second.url }); res.end(SECRET); });
  await assert.rejects(brokerFor(vault(), first.url).execute('check'), { code: 'redirect_not_allowed' });
  assert.equal(secondSeen, 0);
});
test('the broker rejects oversized responses and absolute-deadline overruns', async t => {
  const large = await target(t, (_req, res) => res.end(Buffer.alloc(1024 * 1024 + 1)));
  await assert.rejects(brokerFor(vault(), large.url).execute('check'), { code: 'operation_response_too_large' });
  const slow = await target(t, (_req, _res) => {});
  await assert.rejects(brokerFor(vault(), slow.url, { timeoutMs: 80 }).execute('check'), { code: 'operation_timeout' });
});
test('credential/header failures expose only a fixed code', async t => {
  const { url } = await target(t, (_req, res) => res.end()); const v = vault();
  v.resolve = async () => { throw new Error(SECRET); };
  await assert.rejects(brokerFor(v, url).execute('check'), error => error.code === 'operation_failed' && !String(error).includes(SECRET));
  v.resolve = async () => `${SECRET}\r\nX-Injected: true`;
  await assert.rejects(brokerFor(v, url).execute('check'), { code: 'invalid_credential_header' });
});
test('legacy or locked vaults cannot execute broker operations', async t => {
  const { url } = await target(t, (_req, res) => res.end()); const v = vault(), broker = brokerFor(v, url);
  v.formatVersion = 1; await assert.rejects(broker.execute('check'), { code: 'migration_required' });
  v.isUnlocked = false; await assert.rejects(broker.execute('check'), { code: 'vault_locked' }); assert.equal(v.calls, 0);
});
test('broker and raw resolver cannot share the same authenticated transport', async t => {
  const { url } = await target(t, (_req, res) => res.end()); const v = vault(), broker = brokerFor(v, url);
  assert.throws(() => createRestServer({ vault: v, token: TOKEN, broker, allowRawResolve: true }));
  assert.throws(() => createMcpHandler({ vault: v, broker, allowRawResolve: true }));
});
test('real REST broker rejects injected request parameters and raw resolver calls', async t => {
  let seen = 0; const { url } = await target(t, (_req, res) => { seen++; res.end(SECRET); });
  const v = vault(), broker = brokerFor(v, url), server = createRestServer({ vault: v, token: TOKEN, broker });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const port = server.address().port;
  assert.deepEqual(JSON.parse((await call(port, '/operations')).text), { operations: [{ name: 'check' }] });
  const success = await call(port, '/execute', { operation: 'check' }); assert.equal(success.status, 200);
  assert.equal(success.text, '{"operation":"check","status":200,"ok":true}');
  for (const body of [{ operation: 'check', url: 'http://attacker.invalid' }, { operation: 'check', secret: 'TOKEN' }, null, [], {}]) {
    assert.equal((await call(port, '/execute', body)).status, 400);
  }
  assert.equal((await call(port, '/resolve', { placeholder: 'TOKEN', origin: 'https://example.com' })).status, 403);
  assert.equal((await call(port, '/execute', { operation: 'check' }, 'bad')).status, 401); assert.equal(seen, 1);
});
test('MCP exposes and executes broker tools without returning reflected secrets', async t => {
  const { url } = await target(t, (_req, res) => res.end(SECRET)); const v = vault();
  const handle = createMcpHandler({ vault: v, broker: brokerFor(v, url) });
  const rpc = (method, params, id = 1) => JSON.stringify({ jsonrpc: '2.0', id, method, params });
  await handle(rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } }));
  await handle('{"jsonrpc":"2.0","method":"notifications/initialized"}');
  const names = (await handle(rpc('tools/list'))).result.tools.map(tool => tool.name);
  assert(names.includes('enigmagent_execute')); assert(!names.includes('enigmagent_resolve'));
  const result = await handle(rpc('tools/call', { name: 'enigmagent_execute', arguments: { operation: 'check' } }));
  assert(!JSON.stringify(result).includes(SECRET)); assert.equal(JSON.parse(result.result.content[0].text).status, 200);
});
test('concurrency is bounded and the broker recovers after timed-out operations', async t => {
  const { url } = await target(t, (_req, _res) => {}); const broker = brokerFor(vault(), url, { timeoutMs: 150 });
  const pending = Array.from({ length: 4 }, () => broker.execute('check').catch(error => error.code));
  await assert.rejects(broker.execute('check'), { code: 'broker_busy' });
  assert.deepEqual(await Promise.all(pending), Array(4).fill('operation_timeout'));
  await assert.rejects(broker.execute('check'), { code: 'operation_timeout' });
});
