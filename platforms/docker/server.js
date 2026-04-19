/**
 * EnigmAgent Docker — unified server.
 *
 * Serves:
 *   :8080  — PWA static files + /health
 *   :3737  — REST API (optional, enabled via ENIGMAGENT_REST=true)
 */

import { createServer }  from 'node:http';
import { readFile }      from 'node:fs/promises';
import { join, extname } from 'node:path';
import { resolve }       from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname }       from 'node:path';
import { VaultManager, FileStorage } from './shared/vault-core.js';

const __dir   = dirname(fileURLToPath(import.meta.url));
const PWA_DIR = join(__dir, 'pwa');

const VAULT_PATH  = process.env.ENIGMAGENT_VAULT || '/data/vault.json';
const START_REST  = process.env.ENIGMAGENT_REST === 'true';
const REST_PORT   = parseInt(process.env.ENIGMAGENT_REST_PORT || '3737', 10);
const STATIC_PORT = 8080;

const MIME = {
  '.html':         'text/html; charset=utf-8',
  '.js':           'application/javascript',
  '.css':          'text/css',
  '.json':         'application/json',
  '.webmanifest':  'application/manifest+json',
  '.png':          'image/png',
  '.ico':          'image/x-icon',
  '.svg':          'image/svg+xml',
};

// ── Static PWA server (port 8080) ─────────────────────────────────────────────
const staticServer = createServer(async (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  const url      = new URL(req.url, `http://localhost:${STATIC_PORT}`);
  let   pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = join(PWA_DIR, pathname);

  try {
    const data = await readFile(filePath);
    const mime = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch {
    // SPA fallback
    try {
      const data = await readFile(join(PWA_DIR, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    } catch {
      res.writeHead(404); res.end('Not Found');
    }
  }
});

staticServer.listen(STATIC_PORT, '0.0.0.0', () => {
  console.log(`[EnigmAgent] PWA serving on http://0.0.0.0:${STATIC_PORT}`);
});

// ── Optional REST API (port 3737) ─────────────────────────────────────────────
if (START_REST) {
  const vaultMgr = new VaultManager(new FileStorage(VAULT_PATH));

  const username = process.env.ENIGMAGENT_USER;
  const password = process.env.ENIGMAGENT_PASS;

  if (!username || !password) {
    console.error('[EnigmAgent] REST API requires ENIGMAGENT_USER and ENIGMAGENT_PASS env vars.');
    process.exit(1);
  }

  console.log('[EnigmAgent] Unlocking vault for REST API (Argon2id)…');
  vaultMgr.unlock(username, password).then(() => {
    console.log(`[EnigmAgent] Vault unlocked. REST API on http://0.0.0.0:${REST_PORT}`);

    const restServer = createServer(async (req, res) => {
      const cors = () => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      };
      cors();
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
      const json = (code, data) => {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      };

      const url = new URL(req.url, `http://localhost:${REST_PORT}`);

      if (req.method === 'GET' && url.pathname === '/status') {
        return json(200, { status: 'ok', unlocked: vaultMgr.isUnlocked });
      }
      if (req.method === 'GET' && url.pathname === '/list') {
        return json(200, { entries: vaultMgr.list() });
      }
      if (req.method === 'POST' && url.pathname === '/resolve') {
        let body = '';
        req.on('data', c => { body += c; });
        req.on('end', async () => {
          try {
            const { placeholder, origin } = JSON.parse(body);
            const value = await vaultMgr.resolve(placeholder, origin);
            json(200, { value });
          } catch (err) {
            json(403, { error: err.code || 'resolve_error', message: err.message });
          }
        });
        return;
      }
      json(404, { error: 'not_found' });
    });

    restServer.listen(REST_PORT, '0.0.0.0');
  }).catch(err => {
    console.error('[EnigmAgent] Failed to unlock vault:', err.message);
    process.exit(1);
  });
}
