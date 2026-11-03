// Tamkeen Go (G2) — Web Push service worker.
//
// Deliberately MINIMAL and scoped: it is registered with { scope: '/me' } so it
// only ever controls the self-service home, and it does NO fetch-caching. That
// keeps it from clobbering the cashier ('/cashier') and sales-rep ('/sales-rep')
// offline service workers, which own their own scopes and shells. This worker's
// only jobs are: take control fast (skipWaiting + clients.claim), render OS push
// notifications, and route a notification tap back into the /me PWA.

self.addEventListener('install', (event) => {
  // Activate this version immediately rather than waiting for old tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Incoming push: RFC 8291 payload was decrypted by the browser; event.data is
// the plaintext JSON our backend sent ({title, body, url, tag}).
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'Tamkeen', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Tamkeen';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/tamkeen-go-192.svg',
    badge: '/icons/tamkeen-go-192.svg',
    tag: payload.tag || undefined,
    // Coalesce repeats of the same tag but still re-alert the user.
    renotify: payload.tag ? true : undefined,
    data: { url: payload.url || '/me' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Tap on a notification: focus an already-open /me tab if there is one, else
// open a new window at the notification's deep-link (defaulting to /me).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/me';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        // Prefer any existing app tab under /me.
        if (client.url.indexOf('/me') !== -1 && 'focus' in client) {
          client.focus();
          if ('navigate' in client && targetUrl) {
            try { client.navigate(targetUrl); } catch (e) { /* cross-origin/nav guard */ }
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
