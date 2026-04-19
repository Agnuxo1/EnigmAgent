#!/usr/bin/env node
/**
 * One-time setup: copies PWA assets into the electron-app/pwa/ directory.
 * Run: node setup.js
 */
import { cpSync, copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath }         from 'node:url';

const __dir  = dirname(fileURLToPath(import.meta.url));
const root   = resolve(__dir, '../../');
const pwaOut = join(__dir, 'pwa');
if (!existsSync(pwaOut)) mkdirSync(pwaOut, { recursive: true });

// Copy PWA source files
const pwaSrc = join(root, 'platforms', 'pwa');
['index.html','vault-pwa.js','sw.js','manifest.webmanifest'].forEach(f =>
  copyFileSync(join(pwaSrc, f), join(pwaOut, f)));

// Copy shared extension assets
copyFileSync(join(root, 'extension', 'style.css'),          join(pwaOut, 'style.css'));
mkdirSync(join(pwaOut, 'lib'), { recursive: true });
copyFileSync(join(root, 'extension', 'lib', 'argon2id.js'), join(pwaOut, 'lib', 'argon2id.js'));

// Copy icons
const iconsOut = join(pwaOut, 'icons');
mkdirSync(iconsOut, { recursive: true });
const icon128 = join(root, 'extension', 'icons', 'icon-128.png');
['icon-128.png','icon-192.png','icon-512.png'].forEach(f => copyFileSync(icon128, join(iconsOut, f)));

// Copy icons for resources/
const resOut = join(__dir, 'resources');
mkdirSync(resOut, { recursive: true });
['icon-16.png','icon-48.png','icon-128.png'].forEach(f =>
  copyFileSync(join(root, 'extension', 'icons', f), join(resOut, f)));

console.log('✅ Electron app assets ready. Run: npm start');
