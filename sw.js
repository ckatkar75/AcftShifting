// GndOps Service Worker — v1
// Caches the app shell and CDN libraries for offline use.

const CACHE_NAME = 'gndops-v1';

const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

const CDN_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&family=Exo+2:wght@300;400;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
];

// Install: cache everything
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache app shell (must succeed)
      return cache.addAll(APP_SHELL).then(() => {
        // Cache CDN assets best-effort (won't break install if offline)
        return Promise.allSettled(
          CDN_ASSETS.map(url =>
            fetch(url).then(res => cache.put(url, res)).catch(() => {})
          )
        );
      });
    })
  );
  self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for app shell & CDN, network-first otherwise
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Cache-first strategy
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Cache successful responses from our own origin and CDN
        if (
          response.ok &&
          (url.origin === self.location.origin ||
           url.hostname.includes('cdnjs.cloudflare.com') ||
           url.hostname.includes('fonts.googleapis.com') ||
           url.hostname.includes('fonts.gstatic.com'))
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback: serve index.html for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
