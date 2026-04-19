#!/usr/bin/env node
/**
 * Setup: copies PWA assets to platforms/mobile/www/ (Capacitor webDir).
 * Run once: node setup.js
 * Then: npx cap sync && npx cap open android/ios
 */
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = resolve(__dir, '../../');
const www   = join(__dir, 'www');
mkdirSync(www, { recursive: true });

const pwa = join(root, 'platforms', 'pwa');
const ext = join(root, 'extension');

['index.html','vault-pwa.js','sw.js','manifest.webmanifest'].forEach(f =>
  copyFileSync(join(pwa, f), join(www, f)));

copyFileSync(join(ext,'style.css'), join(www,'style.css'));
mkdirSync(join(www,'lib'), { recursive: true });
copyFileSync(join(ext,'lib','argon2id.js'), join(www,'lib','argon2id.js'));
mkdirSync(join(www,'icons'), { recursive: true });
const i128 = join(ext,'icons','icon-128.png');
['icon-128.png','icon-192.png','icon-512.png'].forEach(f =>
  copyFileSync(i128, join(www,'icons',f)));

console.log('✅ www/ ready.');
console.log('Next steps:');
console.log('  npm install');
console.log('  npx cap add android   # (or ios)');
console.log('  npx cap sync');
console.log('  npx cap open android  # opens Android Studio');
