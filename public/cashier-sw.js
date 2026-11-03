// Cashier offline-first service worker (v2 — full shell PRECACHE).
//
// Purpose: the till must open COLD with zero network. Data is NOT handled here —
// sales/state/queue live in IndexedDB and sync via lib/cashier/sync.ts. This worker
// owns the app shell only:
//
// - install: precache every cashier route's HTML, then parse each HTML for its
//   /_next/static assets (JS chunks, CSS, fonts under /_next/static/media) and cache
//   those too, plus the PWA icons/manifest. A cold offline open then has everything.
// - /_next/static/*  → cache-first (content-hashed, immutable)
// - /cashier* navigations → network-first, falling back to the cached page (so deploys
//   land immediately when online; offline serves the precached shell)
// - /api/*           → NEVER intercepted (online-first data; the sync engine owns retries)
const CACHE_NAME = 'cashier-shell-v2';

// Every screen the cashier may open offline.
const SHELL_ROUTES = [
  '/cashier',
  '/cashier/checkout',
  '/cashier/history',
  '/cashier/close',
  '/cashier/returns',
  '/cashier/reports',
];

const STATIC_EXTRAS = [
  '/cashier-manifest.json',
  '/icons/cashier-192.svg',
  '/icons/cashier-512.svg',
];

// Pull every build asset referenced by an HTML document (script/link/preload tags all
// point into /_next/static — including next/font woff2 files under /_next/static/media).
function extractAssetUrls(html) {
  const urls = new Set();
  const re = /\/_next\/static\/[^"'\s)\\]+/g;
  let m;
  while ((m = re.exec(html))) urls.add(m[0].replace(/&amp;/g, '&'));
  return [...urls];
}

async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);
  // best-effort extras (icons/manifest)
  await Promise.all(
    STATIC_EXTRAS.map((u) =>
      fetch(u).then((r) => (r.ok ? cache.put(u, r) : null)).catch(() => null)
    )
  );
  // routes + their referenced assets
  for (const route of SHELL_ROUTES) {
    try {
      const res = await fetch(route, { credentials: 'include' });
      if (!res.ok) continue;
      const html = await res.clone().text();
      await cache.put(route, res);
      const assets = extractAssetUrls(html);
      await Promise.all(
        assets.map(async (u) => {
          if (await cache.match(u)) return;
          try {
            const ar = await fetch(u);
            if (ar.ok) await cache.put(u, ar);
          } catch { /* individual asset failures must not abort install */ }
        })
      );
    } catch { /* offline install — runtime caching will fill in later */ }
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// The diagnostics panel asks us for cache state (postMessage round-trip).
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'cashier-shell-status') return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const keys = await cache.keys();
      const routesCached = [];
      for (const route of SHELL_ROUTES) {
        if (await cache.match(route)) routesCached.push(route);
      }
      event.source?.postMessage({
        type: 'cashier-shell-status',
        cacheName: CACHE_NAME,
        totalEntries: keys.length,
        routesCached,
        shellComplete: routesCached.length === SHELL_ROUTES.length,
      });
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // data layer: never intercept

  // Immutable build assets: cache-first (hashed filenames make staleness impossible)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(request, clone));
            }
            return res;
          })
      )
    );
    return;
  }

  // Icons / manifest: cache-first
  if (STATIC_EXTRAS.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
    return;
  }

  // Cashier page navigations: network-first so deploys land immediately; the cached
  // copy (same path, else the checkout shell) serves when the network is gone.
  if (request.mode === 'navigate' && url.pathname.startsWith('/cashier')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(url.pathname, clone));
          }
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const hit = await cache.match(url.pathname);
          if (hit) return hit;
          const shell = await cache.match('/cashier/checkout');
          return (
            shell ||
            new Response('<meta charset="utf-8"><h1>غير متصل / Offline</h1>', {
              status: 503,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            })
          );
        })
    );
  }
});
