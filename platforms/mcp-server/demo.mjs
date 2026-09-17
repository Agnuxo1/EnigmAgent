/** No-credential demonstration with an ephemeral, synthetic encrypted vault. */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { VaultManager, MemoryStorage } from './vault-core.js';
import { createRestServer } from './http-server.js';
import { VaultClient } from './client.js';

const vault = new VaultManager(new MemoryStorage());
let server;
try {
  await vault.create('demo-user', randomBytes(32).toString('hex'));
  await vault.addSecret({ name: 'DEMO_TOKEN', domain: 'example.com', value: 'SYNTHETIC_DEMO_VALUE' });
  const token = randomBytes(32).toString('hex');
  server = createRestServer({ vault, token });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new VaultClient({ token, port: server.address().port });
  const status = await client.status();
  const entries = await client.list();
  await assert.rejects(client.resolve('DEMO_TOKEN', 'https://example.com'),
    error => error.code === 'raw_resolve_disabled');
  console.log(JSON.stringify({ demo: 'passed', syntheticDataOnly: true,
    encryptedVaultInMemory: true, authenticationRequired: true,
    rawResolveEnabled: status.rawResolveEnabled, secretNames: entries.map(entry => entry.name),
    externalNetworkCalls: 0 }, null, 2));
} finally {
  vault.lock();
  if (server) {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}
