const CACHE_NAME = 'rewind-cache-v2';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=1.1',
  './script.js',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('Service Worker: Clearing Old Cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Only cache same-origin resources to avoid complex CORS restrictions with YouTube/iTunes APIs
  if (e.request.url.startsWith(self.location.origin)) {
    // Network-First with Cache Fallback strategy
    e.respondWith(
      fetch(e.request)
        .then(networkResponse => {
          // Cache new same-origin fetches if valid
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(e.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback
          return caches.match(e.request);
        })
    );
  }
});
