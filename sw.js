// ================================================================
//  sw.js  —  Service Worker (PWA offline support)
// ================================================================
const CACHE = 'gm-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/config.js',
  '/js/helpers.js',
  '/js/database.js',
  '/js/auth.js',
  '/js/app.js',
  '/manifest.json'
];

// Install: cache app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: serve from cache, fallback to network
self.addEventListener('fetch', e => {
  // Only handle GET requests
  if(e.request.method !== 'GET') return;
  // Skip Firebase/CDN requests — let them go to network
  const url = e.request.url;
  if(url.includes('firebaseapp') || url.includes('googleapis') ||
     url.includes('gstatic') || url.includes('cloudflare') ||
     url.includes('fonts.google')) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
