const fs = require('fs');
const src = fs.readFileSync('../extension/lib/argon2id.js', 'utf8');
// The IIFE attaches to globalThis.EnigmaCrypto
eval(src);
const enc = new TextEncoder();
const key = globalThis.EnigmaCrypto.argon2id(
  enc.encode('password'),
  enc.encode('somesalt12345678'),
  { t: 3, m: 65536, p: 1, dkLen: 32 }
);
console.log('bundle works, digest length:', key.length);
console.log('first 8 hex:', Buffer.from(key).toString('hex').slice(0, 16));
console.log('matches native:', Buffer.from(key).toString('hex').slice(0, 16) === '546b74c705111461');
