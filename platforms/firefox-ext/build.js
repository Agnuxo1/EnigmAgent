#!/usr/bin/env node
/**
 * EnigmAgent — Firefox / Edge / Opera extension builder.
 *
 * Usage:
 *   node build.js [firefox|edge|opera]
 *
 * Output: dist/<target>/  (unpacked extension)
 *         dist/enigmagent-<target>.zip
 *
 * All source files are shared with the Chrome extension (../../extension/).
 * Only the manifest is patched per-target.
 */

import { copyFileSync, mkdirSync, cpSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = resolve(__dir, '../../');
const EXT_SRC    = join(REPO_ROOT, 'extension');
const DIST_ROOT  = join(__dir, 'dist');

const target = process.argv[2] || 'firefox';
const VALID = ['firefox', 'edge', 'opera'];
if (!VALID.includes(target)) {
  console.error(`Unknown target "${target}". Use: ${VALID.join(' | ')}`);
  process.exit(1);
}

const outDir = join(DIST_ROOT, target);

// ── Clean & recreate output directory ────────────────────────────────────────
if (existsSync(outDir)) rmSync(outDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

// ── Copy all extension source files ──────────────────────────────────────────
cpSync(EXT_SRC, outDir, { recursive: true });

// ── Patch manifest per target ─────────────────────────────────────────────────
if (target === 'firefox') {
  // Firefox: use background.scripts (not service_worker) + gecko settings
  const manifest = JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(new TextEncoder().encode(
        require('node:fs').readFileSync(join(__dir, 'manifest.json'), 'utf8')
      ))
    )
  );
  // Actually just copy the Firefox-specific manifest directly
  copyFileSync(join(__dir, 'manifest.json'), join(outDir, 'manifest.json'));
  console.log('✓ Patched manifest.json for Firefox');
} else if (target === 'edge' || target === 'opera') {
  // Edge and Opera are Chromium-based — use the original Chrome manifest as-is.
  // Edge Add-ons and Opera Addons accept Chrome MV3 packages unchanged.
  copyFileSync(join(EXT_SRC, 'manifest.json'), join(outDir, 'manifest.json'));
  console.log(`✓ Using Chrome manifest for ${target} (Chromium-based, no changes needed)`);
}

// ── Package as zip ─────────────────────────────────────────────────────────────
const zipFile = join(DIST_ROOT, `enigmagent-${target}.zip`);
try {
  execSync(`cd "${outDir}" && zip -r "${zipFile}" .`, { stdio: 'inherit' });
  console.log(`✓ Created ${zipFile}`);
} catch {
  console.log(`ℹ  zip not available. The unpacked extension is at: ${outDir}`);
  console.log('   Compress it manually for store submission.');
}

console.log(`\n✅ Build complete → ${outDir}`);
