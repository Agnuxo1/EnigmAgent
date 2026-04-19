#!/usr/bin/env node
/**
 * Setup: copies PWA assets into tauri-app/dist/ (the Tauri frontend root).
 * Run once: node setup.js
 */
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir  = dirname(fileURLToPath(import.meta.url));
const root   = resolve(__dir, '../../');
const dist   = join(__dir, 'dist');

if (!existsSync(dist)) mkdirSync(dist, { recursive: true });

const pwa = join(root, 'platforms', 'pwa');
const ext = join(root, 'extension');

// Copy PWA files
['index.html','vault-pwa.js','sw.js','manifest.webmanifest'].forEach(f =>
  copyFileSync(join(pwa, f), join(dist, f)));

// Copy shared assets
copyFileSync(join(ext, 'style.css'), join(dist, 'style.css'));
mkdirSync(join(dist,'lib'), { recursive: true });
copyFileSync(join(ext,'lib','argon2id.js'), join(dist,'lib','argon2id.js'));
mkdirSync(join(dist,'icons'), { recursive: true });
const i128 = join(ext,'icons','icon-128.png');
['icon-128.png','icon-192.png','icon-512.png'].forEach(f => copyFileSync(i128, join(dist,'icons',f)));

// Copy Tauri icons
const tIcons = join(__dir,'src-tauri','icons');
if (!existsSync(tIcons)) mkdirSync(tIcons, { recursive: true });
['icon-16.png','icon-48.png','icon-128.png'].forEach(f =>
  copyFileSync(join(ext,'icons',f.replace('icon-','icon-')), join(tIcons, f)));
// Aliases for Tauri icon paths
copyFileSync(i128, join(tIcons,'32x32.png'));
copyFileSync(i128, join(tIcons,'128x128.png'));
copyFileSync(i128, join(tIcons,'128x128@2x.png'));

console.log('✅ Tauri app assets ready. Run: npm run dev   OR   npm run build');
