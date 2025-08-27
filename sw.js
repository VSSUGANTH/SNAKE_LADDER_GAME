const CACHE_NAME = 'friends-snake-v1';
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/assets/background.wav',
  '/assets/icon-192.png',
  '/assets/icon-512.png'
];

self.addEventListener('install', evt => {
  evt.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(key => { if(key!==CACHE_NAME) return caches.delete(key); })))
  );
  self.clients.claim();
});

self.addEventListener('fetch', evt => {
  evt.respondWith(
    caches.match(evt.request).then(resp => resp || fetch(evt.request).then(fetchResp => {
      return caches.open(CACHE_NAME).then(cache => {
        cache.put(evt.request, fetchResp.clone());
        return fetchResp;
      });
    })).catch(()=>caches.match('/index.html'))
  );
});
