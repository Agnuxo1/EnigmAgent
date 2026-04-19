/**
 * EnigmAgent E2E — minimal static HTTP server.
 *
 * Serves the repo root so tests can reach:
 *   http://localhost:<port>/tests/smoke-test.html
 */

import { createServer }        from 'node:http';
import { readFile }            from 'node:fs/promises';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath }       from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, '../../../');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.txt':  'text/plain',
  '.md':   'text/plain',
};

/**
 * Start a static server on the given port.
 * @param {number} port
 * @returns {Promise<import('node:http').Server>}
 */
export function startServer(port = 8088) {
  return new Promise((res, rej) => {
    const server = createServer(async (req, response) => {
      const url  = new URL(req.url, `http://localhost:${port}`);
      const file = join(REPO_ROOT, url.pathname.replace(/\/$/, '/index.html'));
      try {
        const data = await readFile(file);
        const mime = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
        response.writeHead(200, { 'Content-Type': mime });
        response.end(data);
      } catch {
        response.writeHead(404, { 'Content-Type': 'text/plain' });
        response.end('404 Not Found');
      }
    });

    server.on('error', rej);
    server.listen(port, '127.0.0.1', () => res(server));
  });
}
