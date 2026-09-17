/**
 * Trusted fixed-operation credential broker.
 *
 * Callers choose an operator-defined operation name, never a URL, header, secret
 * name, request body or response selector. Credentials are attached only after
 * destination validation. Response bodies and headers are discarded; only a
 * numeric HTTP status and derived success flag leave the broker.
 * This is a process/data-flow boundary, not a sandbox against a compromised OS.
 */
import { lookup } from 'node:dns/promises';
import { isIPv4 } from 'node:net';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { VaultError } from './vault-core.js';
import { isObject } from './gateway-policy.js';

const operationName = value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value);
const deny = code => { throw new VaultError(code); };
const ipNumber = address => address.split('.').reduce((value, octet) => (value * 256 + Number(octet)) >>> 0, 0);
const DENIED_NETWORKS = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
];

/** Deliberately IPv4-only egress; unsupported address families fail closed. */
export function isPublicIPv4(address) {
  if (!isIPv4(address)) return false;
  const value = ipNumber(address);
  return !DENIED_NETWORKS.some(([network, bits]) => {
    const mask = (0xffffffff << (32 - bits)) >>> 0;
    return ((value & mask) >>> 0) === ((ipNumber(network) & mask) >>> 0);
  });
}

/** Validate the complete operator-owned configuration once at process startup. */
function validateOperation(config, allowLoopback) {
  if (!isObject(config) || Object.keys(config).some(key => !['name', 'url', 'method', 'secret', 'header', 'prefix'].includes(key)) ||
      !operationName(config.name) || typeof config.url !== 'string' || config.url.length > 2048 ||
      typeof config.secret !== 'string' || !/^[A-Za-z0-9_:.@-]{1,128}$/.test(config.secret)) deny('invalid_operation_configuration');
  let url;
  try { url = new URL(config.url); } catch { deny('invalid_operation_configuration'); }
  const local = url.hostname === '127.0.0.1';
  if (url.username || url.password || url.hash || url.hostname.endsWith('.') || url.hostname.startsWith('[') ||
      (url.protocol !== 'https:' && !(allowLoopback && local && url.protocol === 'http:'))) deny('invalid_operation_configuration');
  const method = config.method || 'GET';
  const header = config.header || 'Authorization';
  const prefix = config.prefix === undefined ? 'Bearer ' : config.prefix;
  if (typeof header !== 'string' || typeof prefix !== 'string' || !['GET', 'HEAD'].includes(method) || !['authorization', 'x-api-key', 'api-key', 'x-auth-token'].includes(header.toLowerCase()) ||
      !['', 'Bearer ', 'Token ', 'Basic '].includes(prefix)) deny('invalid_operation_configuration');
  if (isIPv4(url.hostname) && !isPublicIPv4(url.hostname) && !(allowLoopback && local)) deny('destination_not_allowed');
  return Object.freeze({ name: config.name, url, method, secret: config.secret, header, prefix, local });
}

/** Run a bounded asynchronous action with an absolute timeout. */
async function deadline(action, milliseconds) {
  let timer;
  try {
    return await Promise.race([action(), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new VaultError('operation_timeout')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

/**
 * Broker token holders may repeat allowed operations; this is not per-user RBAC.
 * Run the broker as a separately permissioned service for untrusted generated code.
 */
export class OperationBroker {
  #vault; #operations; #timeout; #active = 0; #allowLoopback;
  constructor({ vault, operations, allowLoopback = false, timeoutMs = 5000 }) {
    if (!vault || !Array.isArray(operations) || !operations.length || operations.length > 64 ||
        typeof allowLoopback !== 'boolean' || !Number.isInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 30000) deny('invalid_operation_configuration');
    this.#vault = vault; this.#timeout = timeoutMs; this.#allowLoopback = allowLoopback;
    this.#operations = new Map();
    for (const config of operations) {
      const operation = validateOperation(config, allowLoopback);
      if (this.#operations.has(operation.name)) deny('duplicate_operation');
      this.#operations.set(operation.name, operation);
    }
  }
  list() { return [...this.#operations.keys()].map(name => ({ name })); }

  /** Invoke only a pre-approved request; no arbitrary input reaches the destination. */
  async execute(name) {
    if (!operationName(name) || !this.#operations.has(name)) deny('operation_not_allowed');
    if (!this.#vault.isUnlocked) deny('vault_locked');
    if (this.#vault.formatVersion !== 2) deny('migration_required');
    if (this.#active >= 4) deny('broker_busy');
    this.#active++;
    const operation = this.#operations.get(name), started = Date.now();
    try {
      const records = isIPv4(operation.url.hostname) ? [{ address: operation.url.hostname, family: 4 }]
        : await deadline(() => lookup(operation.url.hostname, { all: true, family: 4, verbatim: true }), this.#timeout);
      if (!records.length || records.some(record => !isPublicIPv4(record.address) &&
          !(this.#allowLoopback && operation.local && record.address === '127.0.0.1'))) deny('destination_not_allowed');
      const address = records[0].address;
      const value = await this.#vault.resolve(operation.secret, operation.url.origin);
      if (typeof value !== 'string' || !value || Buffer.byteLength(value) > 8192 || /[\x00-\x1f\x7f]/.test(value)) deny('invalid_credential_header');
      const remaining = this.#timeout - (Date.now() - started);
      if (remaining <= 0) deny('operation_timeout');
      return await this.#send(operation, address, value, remaining);
    } catch (error) {
      const allowed = ['vault_locked', 'migration_required', 'operation_not_allowed', 'operation_timeout',
        'destination_not_allowed', 'not_found', 'no_domain_binding', 'domain_mismatch', 'invalid_credential_header',
        'redirect_not_allowed', 'operation_response_too_large', 'broker_busy'];
      throw new VaultError(allowed.includes(error?.code) ? error.code : 'operation_failed');
    } finally { this.#active--; }
  }

  /** Pin the validated address, retain HTTPS certificate validation, never follow redirects. */
  #send(operation, address, credential, timeoutMs) {
    return new Promise((resolve, reject) => {
      let done = false, timer;
      const finish = (error, result) => {
        if (done) return; done = true; clearTimeout(timer);
        if (error) reject(new VaultError(error)); else resolve(result);
      };
      const transport = operation.url.protocol === 'https:' ? httpsRequest : httpRequest;
      const req = transport(operation.url, {
        method: operation.method, agent: false, family: 4, autoSelectFamily: false,
        maxHeaderSize: 8192,
        headers: { [operation.header]: `${operation.prefix}${credential}`, Accept: 'application/json', Connection: 'close' },
        lookup(_host, options, callback) {
          if (options.all) callback(null, [{ address, family: 4 }]); else callback(null, address, 4);
        },
      }, response => {
        if (response.statusCode >= 300 && response.statusCode < 400) {
          finish('redirect_not_allowed'); response.destroy(); req.destroy(); return;
        }
        let bytes = 0;
        response.on('data', chunk => {
          bytes += chunk.length;
          if (bytes > 1024 * 1024) { finish('operation_response_too_large'); response.destroy(); req.destroy(); }
          // Deliberately discard all bytes, including any reflected credential.
        });
        response.on('error', () => finish('operation_failed'));
        response.on('aborted', () => finish('operation_failed'));
        response.on('end', () => {
          const status = response.statusCode;
          if (!Number.isInteger(status) || status < 100 || status > 599) { finish('operation_failed'); return; }
          finish(null, { operation: operation.name, status, ok: status >= 200 && status < 300 });
        });
      });
      timer = setTimeout(() => { finish('operation_timeout'); req.destroy(); }, timeoutMs);
      req.on('error', () => finish('operation_failed'));
      req.end();
    });
  }
}
