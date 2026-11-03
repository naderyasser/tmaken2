const CACHE_NAME = 'meena-sales-rep-v3';

// Only cache static images for offline — NOT pages or JS bundles
const PRECACHE_URLS = [
  '/logo.jpeg',
];

// Install event — precache only static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching static assets only');
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Some precache URLs failed:', err);
      });
    })
  );
  // Activate immediately — don't wait for old SW tabs to close
  self.skipWaiting();
});

// Activate event — purge ALL old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Purging old cache:', name);
            return caches.delete(name);
          })
      )
    )
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

// Fetch event — Network-first for everything, cache only as offline fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests
  if (url.origin !== location.origin) return;

  // ALWAYS go to network for API calls — never intercept
  if (url.pathname.startsWith('/api/')) return;

  // Everything else: network-first, fallback to cache for offline support
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // For navigation, serve cached /sales-rep as app shell fallback
          if (request.mode === 'navigate') {
            return caches.match('/sales-rep');
          }
          return undefined;
        });
      })
  );
});
