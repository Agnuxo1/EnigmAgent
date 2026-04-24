#!/usr/bin/env node
/**
 * EnigmAgent — Firefox / Edge / Opera extension builder.
 *
 * Usage:
 *   node build.js [firefox|edge|opera]
 *
 * Output: dist/<target>/  (unpacked extension)
 *         dist/enigmagent-<target>.zip  (or .xpi for firefox)
 *
 * All source files are shared with the Chrome extension (../../extension/).
 * The manifest and (for Firefox) background.js are patched per-target.
 */

import { copyFileSync, mkdirSync, cpSync, rmSync, existsSync, readFileSync } from 'node:fs';
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
console.log(`✓ Copied shared extension source from ${EXT_SRC}`);

// ── Patch manifest and scripts per target ────────────────────────────────────
if (target === 'firefox') {
  // Firefox: replace manifest with Firefox-specific version (background.scripts,
  // gecko settings, windows permission instead of tabs).
  copyFileSync(join(__dir, 'manifest.json'), join(outDir, 'manifest.json'));
  console.log('✓ Applied Firefox manifest (background.scripts, windows permission)');

  // Firefox: replace background.js with the Firefox-adapted version that uses
  // browser.tabs.query({url}) for own-extension pages (no tabs permission needed).
  const ffBg = join(__dir, 'background.js');
  if (existsSync(ffBg)) {
    copyFileSync(ffBg, join(outDir, 'background.js'));
    console.log('✓ Applied Firefox-adapted background.js');
  } else {
    console.log('! No firefox-specific background.js found — using shared Chrome version.');
  }
} else if (target === 'edge' || target === 'opera') {
  // Edge and Opera are Chromium-based — the Chrome MV3 manifest works as-is.
  copyFileSync(join(EXT_SRC, 'manifest.json'), join(outDir, 'manifest.json'));
  console.log(`✓ Using Chrome manifest for ${target} (Chromium-based, no changes needed)`);
}

// ── Package as zip / xpi ──────────────────────────────────────────────────────
// Firefox uses .xpi extension but the format is just a ZIP archive.
// For Windows compatibility we always create a .zip first, then rename to .xpi.
const ext = target === 'firefox' ? 'xpi' : 'zip';
const finalFile = join(DIST_ROOT, `enigmagent-${target}.${ext}`);
const zipFile   = target === 'firefox'
  ? join(DIST_ROOT, `enigmagent-${target}.zip`)
  : finalFile;

// Try native zip (Unix/Git-Bash/WSL), fall back to PowerShell Compress-Archive
let zipped = false;
try {
  execSync(`zip -r "${zipFile}" .`, { cwd: outDir, stdio: 'inherit' });
  zipped = true;
  console.log(`✓ Created ${zipFile} (zip)`);
} catch {
  // zip not available — try PowerShell (only supports .zip extension)
  try {
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path '${outDir}\\*' -DestinationPath '${zipFile}' -Force"`,
      { stdio: 'inherit' }
    );
    zipped = true;
    console.log(`✓ Created ${zipFile} (PowerShell)`);
  } catch {
    console.log(`! Could not create ZIP automatically.`);
    console.log(`  Unpacked extension is at: ${outDir}`);
    console.log(`  Compress it manually (zip all files inside ${outDir}) as: ${finalFile}`);
  }
}

// Rename .zip → .xpi for Firefox (XPI is identical format)
if (zipped && target === 'firefox' && zipFile !== finalFile) {
  try {
    const { renameSync } = await import('node:fs');
    if (existsSync(finalFile)) rmSync(finalFile);
    renameSync(zipFile, finalFile);
    console.log(`✓ Renamed to ${finalFile} (XPI = ZIP)`);
  } catch (err) {
    console.log(`! Could not rename to .xpi: ${err.message}`);
    console.log(`  The .zip file at ${zipFile} is identical in format — rename it to .xpi before submission.`);
  }
}

console.log(`\nBuild complete → ${outDir}`);
if (zipped) console.log(`Archive  → ${finalFile}`);
