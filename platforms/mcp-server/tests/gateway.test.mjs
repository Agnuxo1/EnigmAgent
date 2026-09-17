/** Security contract tests use synthetic data and real loopback sockets only. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { request } from 'node:http';
import { once } from 'node:events';
import { Readable, Writable } from 'node:stream';
import { createRestServer } from '../http-server.js';
import { createMcpHandler, serveStdio } from '../mcp-server.js';
import { MAX_MESSAGE_BYTES, validateResolveArguments, validateToken } from '../gateway-policy.js';

const TOKEN = 'test_'.repeat(10);
const SECRET = 'SYNTHETIC_SECRET_NOT_A_CREDENTIAL';
const args = { placeholder: 'AUDIT_TOKEN', origin: 'https://example.com' };
function fakeVault() {
  return {
    isUnlocked: true, calls: 0,
    list: () => [{ id: 'test', name: 'AUDIT_TOKEN', domain: 'example.com', created: '2026-09-17', value: SECRET }],
    async resolve(name, origin) {
      this.calls++;
      if (origin !== 'https://example.com') throw Object.assign(new Error('private detail'), { code: 'domain_mismatch' });
      return SECRET;
    },
  };
}
async function fixture(t, extra = {}) {
  const vault = fakeVault();
  const server = createRestServer({ vault, token: TOKEN, ...extra });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return { server, vault, port: server.address().port };
}
function http(port, path = '/status', { method = 'GET', headers = {}, body, token = TOKEN, chunked = false } = {}) {
  return new Promise((resolve, reject) => {
    const h = { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers };
    if (body !== undefined && !h['Content-Type']) h['Content-Type'] = 'application/json';
    if (body !== undefined && !chunked) h['Content-Length'] = Buffer.byteLength(body);
    const req = request({ host: '127.0.0.1', port, path, method, headers: h, agent: false }, res => {
      let text = '';
      res.on('data', b => text += b); res.on('end', () => resolve({ status: res.statusCode, text, headers: res.headers }));
    });
    req.setTimeout(3000, () => req.destroy(new Error('Test timeout'))); req.on('error', reject);
    if (chunked) { req.write(body); req.end(); } else req.end(body);
  });
}
const rpc = (method, params, id = 1) => JSON.stringify({ jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) });
async function session(vault = fakeVault(), allowRawResolve = false) {
  const handle = createMcpHandler({ vault, allowRawResolve });
  const hello = await handle(rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } }));
  assert.equal(hello.result.serverInfo.version, '3.0.0');
  assert.equal(await handle(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })), null);
  return handle;
}
async function stream(chunks, handler) {
  let text = '';
  const output = new Writable({ write(chunk, _encoding, done) { text += chunk; done(); } });
  const ok = await serveStdio({ input: Readable.from(chunks), output, handler });
  return { ok, messages: text.trim() ? text.trim().split('\n').map(JSON.parse) : [] };
}

for (const path of ['/status', '/list', '/resolve']) test(`REST authenticates ${path}`, async t => {
  const { port } = await fixture(t, { allowRawResolve: true });
  const response = await http(port, path, { token: '', method: path === '/resolve' ? 'POST' : 'GET', body: path === '/resolve' ? JSON.stringify(args) : undefined });
  assert.equal(response.status, 401); assert(!response.text.includes(SECRET));
});
for (const token of ['wrong', 'wrong_'.repeat(8)]) test(`REST rejects invalid token length ${token.length}`, async t => {
  const { port } = await fixture(t); assert.equal((await http(port, '/status', { token })).status, 401);
});
for (const Host of ['attacker.invalid', '127.0.0.1:1', 'localhost.attacker.invalid']) test(`REST rejects Host ${Host}`, async t => {
  const { port } = await fixture(t); assert.equal((await http(port, '/status', { headers: { Host } })).status, 403);
});
for (const Origin of ['https://attacker.invalid', 'null', 'http://127.0.0.1']) test(`REST rejects browser Origin ${Origin}`, async t => {
  const { port } = await fixture(t); assert.equal((await http(port, '/status', { headers: { Origin } })).status, 403);
});
test('REST rejects duplicate authentication headers', async t => {
  const { port } = await fixture(t);
  assert.equal((await http(port, '/status', { headers: { Authorization: [`Bearer ${TOKEN}`, `Bearer ${TOKEN}`] } })).status, 401);
});
test('REST status and metadata have no-store and no CORS permission', async t => {
  const { port } = await fixture(t);
  const status = await http(port); assert.equal(status.status, 200);
  assert.equal(JSON.parse(status.text).rawResolveEnabled, false);
  const list = await http(port, '/list'); assert.equal(list.status, 200);
  assert(!list.text.includes(SECRET)); assert.equal(list.headers['cache-control'], 'no-store');
  assert.equal(list.headers['access-control-allow-origin'], undefined);
});
test('REST raw resolution is disabled by default', async t => {
  const { port, vault } = await fixture(t);
  const res = await http(port, '/resolve', { method: 'POST', body: JSON.stringify(args) });
  assert.equal(res.status, 403); assert.equal(vault.calls, 0);
});
test('REST opt-in permits authenticated trusted resolution', async t => {
  const { port } = await fixture(t, { allowRawResolve: true });
  const res = await http(port, '/resolve', { method: 'POST', body: JSON.stringify(args) });
  assert.equal(res.status, 200); assert.equal(JSON.parse(res.text).value, SECRET);
});
test('REST preserves domain denial and locked-vault state', async t => {
  const { port, vault } = await fixture(t, { allowRawResolve: true });
  const res = await http(port, '/resolve', { method: 'POST', body: JSON.stringify({ ...args, origin: 'https://other.example' }) });
  assert.equal(res.status, 403); assert.equal(JSON.parse(res.text).error, 'domain_mismatch');
  vault.isUnlocked = false; assert.equal((await http(port, '/list')).status, 423);
});
test('REST does not return arbitrary exception details', async t => {
  const { port, vault } = await fixture(t, { allowRawResolve: true });
  vault.resolve = async () => { throw new Error(SECRET); };
  const res = await http(port, '/resolve', { method: 'POST', body: JSON.stringify(args) });
  assert.equal(res.status, 500); assert.equal(res.text, '{"error":"vault_error"}');
});
for (const body of ['{', 'null', '[]', '42', '{}', JSON.stringify({ ...args, origin: 'ftp://example.com' }), JSON.stringify({ ...args, origin: 'https://user:password@example.com' }), JSON.stringify({ ...args, placeholder: '../bad' }), JSON.stringify({ ...args, extra: true })]) {
  test(`REST rejects malformed resolver input ${body.slice(0, 50)}`, async t => {
    const { port, vault } = await fixture(t, { allowRawResolve: true });
    assert.equal((await http(port, '/resolve', { method: 'POST', body })).status, 400);
    assert.equal(vault.calls, 0);
  });
}
test('REST rejects non-JSON bodies and wrong methods', async t => {
  const { port } = await fixture(t, { allowRawResolve: true });
  assert.equal((await http(port, '/resolve', { method: 'POST', body: '{}', headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await http(port, '/resolve')).status, 405);
  assert.equal((await http(port, 'http://attacker.invalid/status')).status, 404);
});
for (const chunked of [false, true]) test(`REST bounds ${chunked ? 'chunked' : 'declared'} bodies`, async t => {
  const { port, vault } = await fixture(t, { allowRawResolve: true });
  const res = await http(port, '/resolve', { method: 'POST', body: 'x'.repeat(MAX_MESSAGE_BYTES + 1), chunked });
  assert.equal(res.status, 413); assert.equal(vault.calls, 0);
});
test('REST incomplete body has an absolute deadline', async t => {
  const { port } = await fixture(t, { allowRawResolve: true, bodyTimeoutMs: 60 });
  const code = await new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path: '/resolve', method: 'POST', agent: false,
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' } }, res => {
      res.resume(); res.on('end', () => { resolve(res.statusCode); req.destroy(); });
    });
    req.on('error', reject); req.write('{');
  });
  assert.equal(code, 408);
});

test('MCP requires initialization before tool calls', async () => {
  const handle = createMcpHandler({ vault: fakeVault() });
  assert.equal((await handle(rpc('tools/list'))).error.code, -32002);
});
test('MCP default tools exclude raw resolution and direct calls cannot enable it', async () => {
  const vault = fakeVault(), handle = await session(vault);
  assert.deepEqual((await handle(rpc('tools/list'))).result.tools.map(t => t.name), ['enigmagent_list']);
  const res = await handle(rpc('tools/call', { name: 'enigmagent_resolve', arguments: args }));
  assert.equal(res.error.code, -32602); assert.equal(vault.calls, 0);
});
test('MCP metadata strips value fields', async () => {
  const handle = await session();
  assert(!JSON.stringify(await handle(rpc('tools/call', { name: 'enigmagent_list' }))).includes(SECRET));
});
test('MCP opt-in returns raw values only after explicit enablement', async () => {
  const handle = await session(fakeVault(), true);
  assert.equal((await handle(rpc('tools/call', { name: 'enigmagent_resolve', arguments: args }))).result.content[0].text, SECRET);
});
test('MCP notifications never reply or invoke resolver', async () => {
  const vault = fakeVault(), handle = await session(vault, true);
  assert.equal(await handle(JSON.stringify({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'enigmagent_resolve', arguments: args } })), null);
  assert.equal(vault.calls, 0);
});
for (const value of ['null', '[]', '1', 'true', '{}', '{"jsonrpc":"1.0","id":1,"method":"ping"}', '{"jsonrpc":"2.0","id":null,"method":"ping"}']) {
  test(`MCP handles invalid request ${value} without crashing`, async () => {
    const handle = await session(); assert.equal((await handle(value)).error.code, -32600);
    assert.deepEqual((await handle(rpc('ping'))).result, {});
  });
}
test('MCP malformed JSON has a parse error', async () => {
  const handle = await session(); assert.equal((await handle('{')).error.code, -32700);
});
test('MCP raw errors are sanitized', async () => {
  const vault = fakeVault(); vault.resolve = async () => { throw new Error(SECRET); };
  const handle = await session(vault, true);
  const res = await handle(rpc('tools/call', { name: 'enigmagent_resolve', arguments: args }));
  assert(res.result.isError); assert.equal(res.result.content[0].text, 'vault_error');
});
test('MCP validates tool arguments before vault access', async () => {
  const vault = fakeVault(), handle = await session(vault, true);
  for (const bad of [null, [], {}, { ...args, origin: 'file:///tmp/file' }]) {
    assert.equal((await handle(rpc('tools/call', { name: 'enigmagent_resolve', arguments: bad }))).error.code, -32602);
  }
  assert.equal(vault.calls, 0);
});
test('MCP rejects duplicate initialization and negotiates a supported version', async () => {
  const handle = createMcpHandler({ vault: fakeVault() });
  const message = rpc('initialize', { protocolVersion: 'unsupported', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
  assert.equal((await handle(message)).result.protocolVersion, '2025-06-18');
  assert.equal((await handle(message)).error.code, -32600);
});
test('stdio reassembles partial UTF-8 frames and preserves ordering', async () => {
  const handler = createMcpHandler({ vault: fakeVault() });
  const data = Buffer.from(rpc('ping', { text: 'Unicode: \u00e9' }, 1) + '\n' + rpc('ping', {}, 2) + '\n');
  const { ok, messages } = await stream([...data].map(b => Buffer.from([b])), handler);
  assert(ok); assert.deepEqual(messages.map(m => m.id), [1, 2]);
});
test('stdio terminates oversized messages before dispatch', async () => {
  let calls = 0;
  const result = await stream([Buffer.alloc(MAX_MESSAGE_BYTES + 1, 97)], async () => { calls++; });
  assert.equal(result.ok, false); assert.equal(calls, 0); assert.equal(result.messages[0].error.code, -32600);
});
test('stdio reports invalid UTF-8 and continues with next valid frame', async () => {
  const res = await stream([Buffer.from([255, 10]), Buffer.from(rpc('ping') + '\n')], createMcpHandler({ vault: fakeVault() }));
  assert.equal(res.messages[0].error.code, -32700); assert.equal(res.messages[1].id, 1);
});
test('stdio rejects unterminated final frames', async () => {
  const res = await stream([Buffer.from(rpc('ping'))], createMcpHandler({ vault: fakeVault() }));
  assert.equal(res.ok, false); assert.equal(res.messages[0].error.code, -32700);
});
test('configuration and resolver validators reject unsafe inputs', () => {
  for (const token of [undefined, '', 'short', 'x'.repeat(257), 'x'.repeat(32) + '\n']) assert.throws(() => validateToken(token));
  assert.equal(validateToken(TOKEN), TOKEN);
  for (const placeholder of ['', 'a/b', 'a b', '{{TOKEN}}', 'a'.repeat(129)]) {
    assert.throws(() => validateResolveArguments({ ...args, placeholder }));
  }
});

test('raw-resolution policy rejects ambiguous non-boolean configuration', () => {
  for (const allowRawResolve of ['false', 'true', 0, 1, null, []]) {
    assert.throws(() => createRestServer({ vault: fakeVault(), token: TOKEN, allowRawResolve }));
    assert.throws(() => createMcpHandler({ vault: fakeVault(), allowRawResolve }));
  }
});
