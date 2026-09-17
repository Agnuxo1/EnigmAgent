/** Trusted backend client. Do not expose resolve() as a model-facing tool. */
import { request } from 'node:http';
import { isObject, validateResolveArguments, validateToken } from './gateway-policy.js';

const ERROR_CODES = new Set(['unauthorized', 'vault_locked', 'not_found', 'raw_resolve_disabled',
  'no_domain_binding', 'domain_mismatch', 'vault_error', 'invalid_arguments', 'request_too_large']);

/** A stable error code without response bodies, secret values or request headers. */
export class VaultClientError extends Error {
  constructor(code) { super(code); this.name = 'VaultClientError'; this.code = code; }
}

/**
 * Loopback-only client: no configurable remote host, automatic proxy or redirects.
 * Authentication is kept in a private field, not a serializable public property.
 * Raw returned values are the trusted application's responsibility.
 */
export class VaultClient {
  #token;
  #port;
  #timeout;
  constructor({ token, port = 3737, timeoutMs = 5000 } = {}) {
    this.#token = validateToken(token);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new TypeError('Invalid port');
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw new TypeError('Invalid timeout');
    this.#port = port; this.#timeout = timeoutMs;
  }

  /** Perform one bounded local request. Redirects are errors, never followed. */
  #call(path, payload) {
    return new Promise((resolve, reject) => {
      let finished = false, timer;
      const finish = (error, value) => {
        if (finished) return;
        finished = true; clearTimeout(timer);
        if (error) reject(error); else resolve(value);
      };
      const body = payload === undefined ? undefined : JSON.stringify(payload);
      const req = request({ hostname: '127.0.0.1', port: this.#port, path,
        method: body === undefined ? 'GET' : 'POST', agent: false,
        headers: { Authorization: `Bearer ${this.#token}`, Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }) },
      }, response => {
        let chunks = [], bytes = 0;
        response.on('data', chunk => {
          bytes += chunk.length;
          if (bytes > 1024 * 1024) {
            finish(new VaultClientError('response_too_large')); response.destroy(); req.destroy();
          } else chunks.push(chunk);
        });
        response.on('error', () => finish(new VaultClientError('transport_error')));
        response.on('aborted', () => finish(new VaultClientError('transport_error')));
        response.on('end', () => {
          if (finished) return;
          let value;
          try {
            value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
            if (!isObject(value)) throw new Error('Invalid response');
          } catch { finish(new VaultClientError('invalid_response')); return; }
          if (response.statusCode !== 200) {
            finish(new VaultClientError(ERROR_CODES.has(value.error) ? value.error : 'unexpected_response'));
          } else finish(null, value);
          chunks = [];
        });
      });
      timer = setTimeout(() => { finish(new VaultClientError('timeout')); req.destroy(); }, this.#timeout);
      req.on('error', () => finish(new VaultClientError('transport_error')));
      req.end(body);
    });
  }

  /** Retrieve status without any secret material. */
  async status() {
    const value = await this.#call('/status');
    if (typeof value.unlocked !== 'boolean') throw new VaultClientError('invalid_response');
    return value;
  }

  /** Retrieve metadata only. Names and domains may still be sensitive. */
  async list() {
    const value = await this.#call('/list');
    if (!Array.isArray(value.entries)) throw new VaultClientError('invalid_response');
    return value.entries.map(({ id, name, domain, created }) => ({ id, name, domain, created }));
  }

  /** Resolve inside a trusted backend, never inside a model-visible tool response. */
  async resolve(placeholder, origin) {
    const args = validateResolveArguments({ placeholder, origin });
    const value = await this.#call('/resolve', args);
    if (typeof value.value !== 'string') throw new VaultClientError('invalid_response');
    return value.value;
  }
}
