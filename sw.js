const CACHE_NAME = 'equity-merchants-v1';
const APP_SHELL = [
  './',
  './index.html',
  './admin.html',
  './form.html',
  './detail.html',
  './listings.html',
  './styles.css',
  './brand.css',
  './config.js',
  './script.js',
  './listings.js',
  './form.js',
  './detail.js',
  './admin.js',
  './manifest.json',
  './Equity Merchants.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('http') && !event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }))
  );
});
