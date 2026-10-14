/* Masar Time mobile check-in («/m») service worker.
 *
 * Registered with scope "/m". Scope matching is a plain string prefix, so this
 * worker also sees requests for "/me", "/messages"… — every handler below
 * ignores anything that is not exactly "/m" or under "/m/".
 *
 * - Pages: network-first, falling back to the last good copy, then to the
 *   cached home shell (so the installed app opens offline and says so).
 * - Hashed Next assets + app icons: cache-first (immutable).
 * - /api: never touched — punches must always reach the server live.
 */
const VERSION = 'm-v1'
const SHELL = '/m'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(['/m/icon-192.png', '/m/manifest.webmanifest'])).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('m-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const inApp = (url) => url.pathname === '/m' || url.pathname.startsWith('/m/')

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (req.mode === 'navigate') {
    if (!inApp(url)) return
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone()
            caches.open(VERSION).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match(SHELL))),
    )
    return
  }

  if (url.pathname.startsWith('/_next/static/') || (inApp(url) && /\.(png|webmanifest)$/.test(url.pathname))) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(VERSION).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
  }
})
