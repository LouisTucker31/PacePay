const CACHE = 'pacepay-v1';

const ASSETS = [
  './',
  './index.html',
  './settings.html',
  './css/variables.css',
  './css/base.css',
  './css/components.css',
  './css/home.css',
  './css/settings.css',
  './js/state.js',
  './js/ui.js',
  './js/app.js',
  './js/settings.js',
  './manifest.json',
  './icons/icon-180.png',
  './icons/favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first for app assets, network-first for Google Fonts
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(
      caches.open(CACHE).then(cache =>
        fetch(event.request)
          .then(res => { cache.put(event.request, res.clone()); return res; })
          .catch(() => caches.match(event.request))
      )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
