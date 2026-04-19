/**
 * EnigmAgent PWA — Service Worker
 *
 * Caches all app shell assets for offline use.
 * The vault data is stored in localStorage (never leaves the device).
 * The service worker never intercepts vault reads/writes — only caches static assets.
 */

const CACHE_NAME = 'enigmagent-pwa-v0.2.0';

const PRECACHE_URLS = [
  './',
  './index.html',
  './vault-pwa.js',
  './manifest.webmanifest',
  './lib/argon2id.js',
  './style.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ── Install: precache app shell ───────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache what's available; skip assets that are missing (icons may not exist yet).
      return Promise.allSettled(
        PRECACHE_URLS.map((url) => cache.add(url).catch(() => { /* optional asset */ }))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: remove old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first strategy for app shell, network-first for everything else
self.addEventListener('fetch', (event) => {
  // Only handle same-origin GET requests.
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // Offline fallback: return index.html for navigation requests
        if (event.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
