// Bundle entry point — exports only what the vault needs from @noble/hashes.
// Built with esbuild into a single IIFE attached to `window.EnigmaCrypto`.
import { argon2id } from '@noble/hashes/argon2';

globalThis.EnigmaCrypto = {
  argon2id: (password, salt, opts) => argon2id(password, salt, opts),
  version: '@noble/hashes@1.4.0',
};
