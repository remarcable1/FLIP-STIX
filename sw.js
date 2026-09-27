const CACHE_NAME = 'flip-stix-v53';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // version.json must always come from the network so the app can
  // detect a new GitHub deployment.
  if (url.pathname.endsWith('/version.json')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // HTML/navigation requests must be network-first.
  // This prevents an old index.html from being served by the service worker.
  if (event.request.mode === 'navigate' ||
      url.pathname.endsWith('/index.html')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put('./index.html', copy);
          });
          return response;
        })
        .catch(() =>
          caches.match('./index.html').then(cached => cached || Response.error())
        )
    );
    return;
  }

  // Static assets: cache-first, with network fallback.
  event.respondWith(
    caches.match(event.request)
      .then(cached =>
        cached ||
        fetch(event.request).then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
      )
      .catch(() =>
        event.request.mode === 'navigate'
          ? caches.match('./index.html')
          : Response.error()
      )
  );
});
