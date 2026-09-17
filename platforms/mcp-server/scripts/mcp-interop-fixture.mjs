/** Official MCP client interoperability fixture with synthetic credentials only. */
import { createServer } from 'node:http';
import { once } from 'node:events';
import { VaultManager, MemoryStorage } from '../vault-core.js';
import { OperationBroker } from '../operation-broker.js';
import { createMcpHandler, serveStdio } from '../mcp-server.js';
if (process.argv.includes('--run-fixture')) {
  const sentinel = 'SYNTHETIC_MCP_SENTINEL';
  const target = createServer((request, response) => {
    response.statusCode = request.headers.authorization === `Bearer ${sentinel}` ? 200 : 401;
    response.end(sentinel);
  });
  target.listen(0, '127.0.0.1'); await once(target, 'listening');
  const vault = new VaultManager(new MemoryStorage());
  try {
    await vault.create('test-user', 'synthetic-password-only');
    await vault.addSecret({ name: 'TOKEN', domain: '127.0.0.1', value: sentinel });
    const broker = new OperationBroker({ vault, allowLoopback: true, operations: [
      { name: 'check', url: `http://127.0.0.1:${target.address().port}/check`, secret: 'TOKEN' },
    ] });
    await serveStdio({ input: process.stdin, output: process.stdout, handler: createMcpHandler({ vault, broker }) });
  } finally { vault.lock(); target.closeAllConnections(); target.close(); }
}
