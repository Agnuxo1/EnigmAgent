#!/usr/bin/env node
/**
 * EnigmAgent PWA — one-time asset setup.
 *
 * Copies shared assets from the extension directory so the PWA is self-contained.
 * Run this once before serving or deploying:
 *
 *   node setup.js
 *
 * Assets copied (never modified — always re-copyable from source):
 *   ../../extension/style.css    → style.css
 *   ../../extension/lib/argon2id.js → lib/argon2id.js
 *   ../../extension/icons/*      → icons/
 *
 * After running setup.js, serve this directory with any static HTTP server:
 *   npx serve .
 *   python -m http.server 8080
 *   npx http-server . -p 8080
 */

import { copyFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath }         from 'node:url';

const __dir   = dirname(fileURLToPath(import.meta.url));
const extDir  = resolve(__dir, '../../extension');

function cp(src, dst) {
  const dstDir = dirname(dst);
  if (!existsSync(dstDir)) mkdirSync(dstDir, { recursive: true });
  copyFileSync(src, dst);
  console.log(`  ✓ ${src.replace(resolve(__dir, '../../'), '').replace(/\\/g, '/')} → ${dst.replace(__dir, '.').replace(/\\/g, '/')}`);
}

console.log('EnigmAgent PWA — setting up shared assets...\n');

// style.css
cp(join(extDir, 'style.css'), join(__dir, 'style.css'));

// argon2id.js
cp(join(extDir, 'lib', 'argon2id.js'), join(__dir, 'lib', 'argon2id.js'));

// icons (copy all PNGs; generate 192/512 if only 128 is available)
const iconsDir = join(extDir, 'icons');
const pwaIcons = join(__dir, 'icons');
if (!existsSync(pwaIcons)) mkdirSync(pwaIcons, { recursive: true });

try {
  const icons = readdirSync(iconsDir).filter(f => f.endsWith('.png'));
  for (const f of icons) cp(join(iconsDir, f), join(pwaIcons, f));

  // Alias icon-128 → icon-192 and icon-512 if they don't exist
  const src128 = join(iconsDir, 'icon-128.png');
  if (existsSync(src128)) {
    if (!existsSync(join(pwaIcons, 'icon-192.png'))) cp(src128, join(pwaIcons, 'icon-192.png'));
    if (!existsSync(join(pwaIcons, 'icon-512.png'))) cp(src128, join(pwaIcons, 'icon-512.png'));
  }
} catch (err) {
  console.warn('  ⚠  Could not copy icons:', err.message);
}

console.log('\n✅ Setup complete. Serve this directory with:\n   npx serve .\n   python -m http.server 8080\n');
