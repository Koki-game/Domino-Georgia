/* DOMINO GEORGIA – stable offline shell, GitHub Pages /Domino-Georgia/ */
const CACHE_NAME = 'domino-georgia-stable-v90';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './privacy.html',
  './delete-account.html',
  './offline.html'
];

// A single unavailable asset must not break service-worker installation.
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(APP_SHELL.map(async path => {
      const response = await fetch(new Request(path, {cache: 'reload'}));
      if (response.ok && response.type !== 'opaque') {
        await cache.put(path, response);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith('domino-georgia-') && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

// Only our own static application files are cached. Firebase authentication,
// dynamic API traffic and third-party libraries always use normal network rules.
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const pathPrefix = new URL(self.registration.scope).pathname;
  if (!url.pathname.startsWith(pathPrefix)) return;

  const isNavigation = request.mode === 'navigate';
  const staticPaths = new Set([
    'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png',
    'privacy.html', 'delete-account.html', 'offline.html'
  ]);
  const relativePath = decodeURIComponent(url.pathname.slice(pathPrefix.length));
  if (!isNavigation && !staticPaths.has(relativePath)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response && response.ok && response.type !== 'opaque') {
        // Update static resources and the app entry point for later launches.
        event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
      }
      return response;
    } catch (error) {
      const cached = await cache.match(request, {ignoreSearch: true});
      if (cached) return cached;
      if (isNavigation) {
        const entry = await cache.match('./index.html');
        if (entry) return entry;
        const offline = await cache.match('./offline.html');
        if (offline) return offline;
      }
      return Response.error();
    }
  })());
});
