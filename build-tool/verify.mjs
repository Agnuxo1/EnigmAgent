import { argon2id } from '@noble/hashes/argon2';
import { bytesToHex } from '@noble/hashes/utils';

// Standard Argon2 test vector
const password = new TextEncoder().encode('password');
const salt = new TextEncoder().encode('somesalt12345678');
const key = argon2id(password, salt, { t: 3, m: 65536, p: 1, dkLen: 32 });
console.log('argon2id works, digest length:', key.length);
console.log('first 8 hex:', bytesToHex(key).slice(0, 16));
