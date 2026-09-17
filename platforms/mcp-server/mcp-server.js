/** Minimal MCP stdio with bounded messages and explicit raw-secret opt-in. */
import { once } from 'node:events';
import {
  MAX_MESSAGE_BYTES, SERVER_VERSION, PROTOCOL_VERSIONS, isObject,
  listMetadata, publicError, validateResolveArguments, validateOperationArguments,
} from './gateway-policy.js';
const result = (id, value) => ({ jsonrpc: '2.0', id, result: value });
const error = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
const validId = id => (typeof id === 'string' && id.length <= 128) || Number.isSafeInteger(id);
const listTool = {
  name: 'enigmagent_list',
  description: 'List secret names and bound domains, never values. Names may be sensitive metadata.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
};
const resolveTool = {
  name: 'enigmagent_resolve',
  description: 'DANGER: returns a plaintext secret to this client and potentially its model context. Trusted clients only. The origin is caller-declared, not an attestation.',
  inputSchema: {
    type: 'object', required: ['placeholder', 'origin'], additionalProperties: false,
    properties: {
      placeholder: { type: 'string', minLength: 1, maxLength: 128 },
      origin: { type: 'string', minLength: 1, maxLength: 2048 },
    },
  },
};

/** Create a session. Notifications never invoke tools or receive replies. */
export function createMcpHandler({ vault, allowRawResolve = false, broker = null }) {
  if (typeof allowRawResolve !== 'boolean') throw new TypeError('Raw resolution policy must be boolean');
  if (broker && allowRawResolve) throw new TypeError('Broker and raw resolution cannot share a transport');
  const brokerTools = broker ? [
    { name: 'enigmagent_operations', description: 'List operator-approved operation names, without credentials.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'enigmagent_execute', description: 'Execute a fixed operator-approved authenticated request. Returns HTTP status only. No response body, header, URL or credential is returned.',
      inputSchema: { type: 'object', required: ['operation'], additionalProperties: false,
        properties: { operation: { type: 'string', enum: broker.list().map(item => item.name) } } } },
  ] : [];
  let initialized = false, ready = false;
  return async function handle(line) {
    let request;
    try { request = JSON.parse(line); } catch { return error(null, -32700, 'Parse error'); }
    if (!isObject(request) || request.jsonrpc !== '2.0') return error(null, -32600, 'Invalid Request');
    const hasId = Object.hasOwn(request, 'id');
    if (hasId && !validId(request.id)) return error(null, -32600, 'Invalid Request');
    // We never make requests. Ignore unsolicited responses without creating error loops.
    if (!Object.hasOwn(request, 'method') && hasId &&
        (Object.hasOwn(request, 'result') || Object.hasOwn(request, 'error'))) return null;
    if (typeof request.method !== 'string' || request.method.length > 128) {
      return error(hasId ? request.id : null, -32600, 'Invalid Request');
    }
    if (!hasId) {
      if (request.method === 'notifications/initialized' && initialized) ready = true;
      return null;
    }
    const { id, method, params } = request;
    if (method === 'initialize') {
      if (initialized) return error(id, -32600, 'Already initialized');
      if (!isObject(params) || typeof params.protocolVersion !== 'string' ||
          !isObject(params.capabilities) || !isObject(params.clientInfo) ||
          typeof params.clientInfo.name !== 'string' || typeof params.clientInfo.version !== 'string') {
        return error(id, -32602, 'Invalid params');
      }
      initialized = true;
      const protocolVersion = PROTOCOL_VERSIONS.includes(params.protocolVersion)
        ? params.protocolVersion : PROTOCOL_VERSIONS[0];
      return result(id, { protocolVersion, capabilities: { tools: {} },
        serverInfo: { name: 'enigmagent', version: SERVER_VERSION },
        instructions: allowRawResolve
          ? 'Raw secrets enabled. Never expose returned values to an untrusted model or log.'
          : broker ? 'Use only pre-approved operations. Credentials remain in the broker; results contain status only.'
          : 'Metadata only. Raw resolution is disabled by operator policy.',
      });
    }
    if (method === 'ping') return result(id, {});
    if (!ready) return error(id, -32002, 'Session not initialized');
    if (method === 'tools/list') return result(id, { tools: allowRawResolve ? [listTool, resolveTool] : [listTool, ...brokerTools] });
    if (method !== 'tools/call') return error(id, -32601, 'Method not found');
    if (!isObject(params) || typeof params.name !== 'string') return error(id, -32602, 'Invalid params');
    const args = params.arguments === undefined ? {} : params.arguments;
    if (params.name !== 'enigmagent_list' && !(allowRawResolve && params.name === 'enigmagent_resolve') &&
        !(broker && ['enigmagent_operations', 'enigmagent_execute'].includes(params.name))) {
      return error(id, -32602, 'Unknown or disabled tool');
    }
    let validated;
    try {
      if (params.name === 'enigmagent_resolve') validated = validateResolveArguments(args);
      else if (params.name === 'enigmagent_execute') validated = validateOperationArguments(args);
      else if (!isObject(args) || Object.keys(args).length) throw new TypeError('Invalid args');
    } catch { return error(id, -32602, 'Invalid tool arguments'); }
    try {
      const text = params.name === 'enigmagent_list' ? JSON.stringify(listMetadata(vault))
        : params.name === 'enigmagent_operations' ? JSON.stringify(broker.list())
        : params.name === 'enigmagent_execute' ? JSON.stringify(await broker.execute(validated))
        : await vault.resolve(validated.placeholder, validated.origin);
      if (typeof text !== 'string') throw new Error('Invalid vault result');
      return result(id, { content: [{ type: 'text', text }] });
    } catch (cause) {
      return result(id, { content: [{ type: 'text', text: publicError(cause) }], isError: true });
    }
  };
}

/** Honor backpressure so slow readers cannot grow an unbounded output queue. */
async function send(output, message) {
  if (message && !output.write(JSON.stringify(message) + '\n')) await once(output, 'drain');
}

/** Read bounded UTF-8 frames sequentially, without unbounded readline buffers. */
export async function serveStdio({ input, output, handler }) {
  let parts = [], bytes = 0;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  for await (const chunk of input) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    let start = 0;
    while (start < data.length) {
      const newline = data.indexOf(10, start);
      const end = newline < 0 ? data.length : newline;
      const segment = data.subarray(start, end);
      bytes += segment.length;
      if (bytes > MAX_MESSAGE_BYTES) {
        await send(output, error(null, -32600, 'Message too large')); return false;
      }
      parts.push(segment);
      if (newline >= 0) {
        let text;
        try { text = decoder.decode(Buffer.concat(parts)); }
        catch {
          await send(output, error(null, -32700, 'Invalid UTF-8'));
          parts = []; bytes = 0; start = newline + 1; continue;
        }
        parts = []; bytes = 0;
        if (text.trim()) await send(output, await handler(text));
      }
      start = newline < 0 ? data.length : newline + 1;
    }
  }
  if (bytes) { await send(output, error(null, -32700, 'Incomplete message')); return false; }
  return true;
}
