/** Shared validation and disclosure policy for the local vault gateway. */
export const MAX_MESSAGE_BYTES = 16 * 1024;
export const SERVER_VERSION = '2.0.0';
export const PROTOCOL_VERSIONS = ['2025-06-18', '2024-11-05'];

/** Test for a JSON object rather than an array, null or primitive. */
export function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Return only public error codes; never serialize arbitrary exception messages. */
export function publicError(error) {
  const allowed = new Set(['vault_locked', 'not_found', 'no_domain_binding', 'domain_mismatch']);
  const candidate = error?.code || error?.message;
  return allowed.has(candidate) ? candidate : 'vault_error';
}

/** Require a high-entropy token format; operators must generate it randomly. */
export function validateToken(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{32,256}$/.test(token)) {
    throw new Error('ENIGMAGENT_API_TOKEN requires 32-256 randomly generated URL-safe characters.');
  }
  return token;
}

/** Validate before vault access. The origin is caller-declared, not an attestation. */
export function validateResolveArguments(args) {
  if (!isObject(args) || Object.keys(args).some(k => !['placeholder', 'origin'].includes(k))) {
    throw new TypeError('invalid_arguments');
  }
  if (typeof args.placeholder !== 'string' || !/^[A-Za-z0-9_:.@\-]{1,128}$/.test(args.placeholder)) {
    throw new TypeError('invalid_arguments');
  }
  if (typeof args.origin !== 'string' || args.origin.length > 2048) throw new TypeError('invalid_arguments');
  let origin;
  try { origin = new URL(args.origin); } catch { throw new TypeError('invalid_arguments'); }
  if (!['http:', 'https:'].includes(origin.protocol) || !origin.hostname || origin.username || origin.password) {
    throw new TypeError('invalid_arguments');
  }
  return { placeholder: args.placeholder, origin: origin.origin };
}

/** Project public metadata explicitly, even when a vault implementation adds fields. */
export function listMetadata(vault) {
  return vault.list().map(({ id, name, domain, created }) => ({ id, name, domain, created }));
}
