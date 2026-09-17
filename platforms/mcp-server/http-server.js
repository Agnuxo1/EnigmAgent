/** Authenticated, bounded, machine-to-machine REST. This is not MCP over HTTP. */
import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import {
  MAX_MESSAGE_BYTES, SERVER_VERSION, listMetadata, publicError,
  validateResolveArguments, validateToken, validateOperationArguments,
} from './gateway-policy.js';

const digest = value => createHash('sha256').update(value).digest();

/** Send JSON without caches, CORS permission or arbitrary exception details. */
function respond(response, status, value) {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Connection': 'close',
  });
  response.end(JSON.stringify(value));
}

/** Count sensitive headers before Node's duplicate-header normalization. */
function headerCount(request, name) {
  let count = 0;
  for (let i = 0; i < request.rawHeaders.length; i += 2) {
    if (request.rawHeaders[i].toLowerCase() === name) count++;
  }
  return count;
}

/** Read at most a fixed byte budget, with an absolute deadline and UTF-8 validation. */
function readJson(request, limit, timeoutMs) {
  return new Promise((resolve, reject) => {
    let chunks = [], bytes = 0, settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      request.removeListener('data', onData); request.removeListener('end', onEnd);
      chunks = [];
      if (error) { request.resume(); reject(error); } else resolve(value);
    };
    const onData = chunk => {
      bytes += chunk.length;
      if (bytes > limit) finish({ status: 413, code: 'request_too_large' }); else chunks.push(chunk);
    };
    const onEnd = () => {
      try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
        finish(null, JSON.parse(text));
      } catch { finish({ status: 400, code: 'invalid_json' }); }
    };
    const timer = setTimeout(() => finish({ status: 408, code: 'request_timeout' }), timeoutMs);
    request.on('data', onData); request.on('end', onEnd);
    request.on('aborted', () => finish({ status: 400, code: 'request_aborted' }));
    request.on('error', () => finish({ status: 400, code: 'request_error' }));
  });
}

/**
 * Construct a REST server. Start using listen(port, '127.0.0.1').
 * A bearer token authorizes the whole vault, not individual tenants. Raw resolution
 * is disabled by default and cannot be enabled by a request or tool argument.
 */
export function createRestServer({ vault, token, allowRawResolve = false, bodyTimeoutMs = 5000, broker = null }) {
  if (typeof allowRawResolve !== 'boolean') throw new TypeError('Raw resolution policy must be boolean');
  if (broker && allowRawResolve) throw new TypeError('Broker and raw resolution cannot share a transport');
  const tokenDigest = digest(validateToken(token));
  if (!Number.isInteger(bodyTimeoutMs) || bodyTimeoutMs < 1 || bodyTimeoutMs > 60000) {
    throw new TypeError('Invalid body timeout');
  }
  const server = createServer({ maxHeaderSize: 8192 }, async (request, response) => {
    try {
      const port = server.address()?.port;
      const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
      if (port === 80) { hosts.add('127.0.0.1'); hosts.add('localhost'); }
      if (headerCount(request, 'host') !== 1 || !hosts.has(request.headers.host?.toLowerCase())) {
        return respond(response, 403, { error: 'invalid_host' });
      }
      // Browser front ends are intentionally unsupported. CORS is not authentication.
      if (request.headers.origin !== undefined || request.headers['sec-fetch-site'] === 'cross-site') {
        return respond(response, 403, { error: 'browser_origin_not_allowed' });
      }
      const auth = /^Bearer ([A-Za-z0-9_-]{32,256})$/i.exec(request.headers.authorization || '');
      if (headerCount(request, 'authorization') !== 1 || !auth || !timingSafeEqual(digest(auth[1]), tokenDigest)) {
        return respond(response, 401, { error: 'unauthorized' });
      }
      const route = request.url;
      if (!['/status', '/list', '/resolve', '/operations', '/execute'].includes(route)) return respond(response, 404, { error: 'not_found' });
      const method = ['/resolve', '/execute'].includes(route) ? 'POST' : 'GET';
      if (request.method !== method) return respond(response, 405, { error: 'method_not_allowed' });
      if (route === '/status') {
        return respond(response, 200, { status: 'ok', unlocked: vault.isUnlocked,
          version: SERVER_VERSION, rawResolveEnabled: allowRawResolve, brokerEnabled: Boolean(broker), vaultFormat: vault.formatVersion ?? null });
      }
      if (!vault.isUnlocked) return respond(response, 423, { error: 'vault_locked' });
      if (route === '/list') return respond(response, 200, { entries: listMetadata(vault) });
      if (route === '/operations') return broker
        ? respond(response, 200, { operations: broker.list() }) : respond(response, 404, { error: 'not_found' });
      if (route === '/execute' && !broker) return respond(response, 404, { error: 'not_found' });
      if (route === '/resolve' && !allowRawResolve) return respond(response, 403, { error: 'raw_resolve_disabled' });
      if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers['content-type'] || '') ||
          request.headers['content-encoding'] !== undefined) {
        return respond(response, 415, { error: 'unsupported_media_type' });
      }
      if (Number(request.headers['content-length'] || 0) > MAX_MESSAGE_BYTES) {
        return respond(response, 413, { error: 'request_too_large' });
      }
      let payload;
      try { payload = await readJson(request, MAX_MESSAGE_BYTES, bodyTimeoutMs); }
      catch (error) { return respond(response, error.status, { error: error.code }); }
      if (route === '/execute') {
        let operation;
        try { operation = validateOperationArguments(payload); }
        catch { return respond(response, 400, { error: 'invalid_arguments' }); }
        return respond(response, 200, await broker.execute(operation));
      }
      let args;
      try { args = validateResolveArguments(payload); }
      catch { return respond(response, 400, { error: 'invalid_arguments' }); }
      const value = await vault.resolve(args.placeholder, args.origin);
      if (typeof value !== 'string') throw new Error('Invalid vault result');
      respond(response, 200, { value });
    } catch (error) {
      const code = publicError(error);
      const status = code === 'vault_locked' ? 423 : code === 'not_found' ? 404 : code === 'vault_error' ? 500 : 403;
      respond(response, status, { error: code });
    }
  });
  server.headersTimeout = 10000; server.requestTimeout = 10000; server.timeout = 10000;
  server.keepAliveTimeout = 1000; server.maxConnections = 32; server.maxRequestsPerSocket = 1;
  server.on('clientError', (_error, socket) => {
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
    else socket.destroy();
  });
  return server;
}
