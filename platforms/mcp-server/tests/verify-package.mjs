/** Validate the distributable without publishing or calling lifecycle scripts. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const npmCli = process.env.npm_execpath;
const command = npmCli ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
const args = [...(npmCli ? [npmCli] : []), 'pack', '--dry-run', '--json', '--ignore-scripts'];
const packed = JSON.parse(execFileSync(command, args, { encoding: 'utf8',
  shell: !npmCli && process.platform === 'win32' }));
assert.equal(packed.length, 1);
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(packed[0].version, '2.0.0');
const paths = new Set(packed[0].files.map(file => file.path));
for (const path of manifest.files) assert(paths.has(path), `Missing package file: ${path}`);
assert(![...paths].some(path => /^(versions|audit|tests)\//.test(path)), 'Development material leaked into package');
assert.equal(manifest.exports['.'], './client.js');
console.log(JSON.stringify({ version: packed[0].version, runtimeFilesVerified: manifest.files.length,
  packedFiles: paths.size, archiveExcluded: true, published: false }));
