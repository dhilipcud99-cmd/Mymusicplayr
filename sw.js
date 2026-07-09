const CACHE_NAME = 'rewind-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', e => {
  // Only cache same-origin resources to avoid complex CORS restrictions with YouTube/iTunes APIs
  if (e.request.url.startsWith(self.location.origin)) {
    e.respondWith(
      caches.match(e.request).then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
        return fetch(e.request).then(networkResponse => {
          // Cache new same-origin fetches
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(e.request, responseClone);
            });
          }
          return networkResponse;
        });
      })
    );
  }
});
