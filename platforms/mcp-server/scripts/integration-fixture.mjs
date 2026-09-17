/** Synthetic cross-process fixture for SDK, native framework and package tests. */
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';
import { VaultManager, MemoryStorage } from '../vault-core.js';
import { OperationBroker } from '../operation-broker.js';
import { createRestServer } from '../http-server.js';

if (process.argv.includes('--run-fixture')) {
  const sentinel = 'SYNTHETIC_FRAMEWORK_CREDENTIAL_NEVER_FOR_REAL_USE';
  const token = randomBytes(32).toString('hex');
  let authorized = 0, unauthorized = 0;
  const target = createServer((request, response) => {
    if (request.url !== '/authorized-check' || request.headers.authorization !== `Bearer ${sentinel}`) {
      unauthorized++; response.writeHead(401); response.end(); return;
    }
    authorized++; response.setHeader('X-Reflected-Secret', sentinel);
    response.end(JSON.stringify({ reflected: sentinel }));
  });
  target.listen(0, '127.0.0.1'); await once(target, 'listening');
  const vault = new VaultManager(new MemoryStorage());
  await vault.create('synthetic-user', 'synthetic-password-only');
  await vault.addSecret({ name: 'FIXTURE_TOKEN', domain: '127.0.0.1', value: sentinel });
  const broker = new OperationBroker({ vault, allowLoopback: true, operations: [
    { name: 'check', url: `http://127.0.0.1:${target.address().port}/authorized-check`, secret: 'FIXTURE_TOKEN' },
  ] });
  const gateway = createRestServer({ vault, token, broker });
  gateway.listen(0, '127.0.0.1'); await once(gateway, 'listening');
  // This random test-only token goes into the test parent's private pipe, never test logs.
  process.stdout.write(JSON.stringify({ port: gateway.address().port, token, ready: true }) + '\n');
  const input = createInterface({ input: process.stdin });
  input.on('line', line => {
    if (line === 'evidence') process.stdout.write(JSON.stringify({ authorized, unauthorized, rawResolveEnabled: false, vaultFormat: 2 }) + '\n');
  });
  input.on('close', () => {
    vault.lock(); target.closeAllConnections(); gateway.closeAllConnections(); target.close(); gateway.close();
  });
}
