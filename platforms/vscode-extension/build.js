#!/usr/bin/env node
/**
 * EnigmAgent VS Code Extension — build script.
 * Copies shared assets from extension/ into media/.
 * Run before `vsce package`.
 */
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir  = dirname(fileURLToPath(import.meta.url));
const extDir = resolve(__dir, '../../extension');
const media  = join(__dir, 'media');

if (!existsSync(media)) mkdirSync(media, { recursive: true });

const copies = [
  [join(extDir, 'style.css'),          join(media, 'style.css')],
  [join(extDir, 'lib', 'argon2id.js'), join(media, 'argon2id.js')],
  [join(extDir, 'icons', 'icon-128.png'), join(media, 'icon-128.png')],
];

for (const [src, dst] of copies) {
  copyFileSync(src, dst);
  console.log(`  ✓ ${src.replace(resolve(__dir,'../../'),'').replace(/\\/g,'/')} → ${dst.replace(__dir,'').replace(/\\/g,'/')}`);
}

// Copy vault-pwa.js adapted for VS Code (same logic, different VSCODE_ORIGIN constant)
import { readFileSync, writeFileSync } from 'node:fs';
const pwaSrc = join(resolve(__dir, '../pwa'), 'vault-pwa.js');
let code = readFileSync(pwaSrc, 'utf8');
// Patch: VS Code webview doesn't have localStorage — use vscode.acquireVsCodeApi state
code = code.replace(
  `const STORAGE_KEY   = 'enigmagent_vault';`,
  `const STORAGE_KEY   = 'enigmagent_vault';\nconst VSCODE_MODE = typeof acquireVsCodeApi !== 'undefined';`
);
writeFileSync(join(media, 'vault-vscode.js'), code, 'utf8');
console.log('  ✓ vault-pwa.js → media/vault-vscode.js');

console.log('\n✅ Media assets ready. Run: npx vsce package');
