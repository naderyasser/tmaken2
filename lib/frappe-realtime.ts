'use client'

/**
 * Frappe socket.io realtime — the ONE place in the app that opens a
 * connection to the site's realtime server, so any screen that needs
 * "new X arrived" (right now: notifications-panel.tsx) reuses this instead
 * of wiring its own socket.
 *
 * Deliberately does NOT depend on the `socket.io-client` npm package (not a
 * dependency of this project, and this batch adds no new deps/build steps):
 * every Frappe site's own socketio server already serves its bundled client
 * at `/socket.io/socket.io.js` (this is what frappe's desk `frappe.realtime`
 * — apps/frappe/frappe/public/js/frappe/socketio_client.js — loads too), so
 * we lazy-load that script tag and use the `io` global it defines.
 *
 * Namespace + auth mirror that same desk client: connect same-origin to
 * `/${location.hostname}` with the session cookie (`withCredentials`).
 * apps/frappe/realtime/middlewares/authenticate.js requires the namespace to
 * equal the browser's Origin hostname and the Origin's host to match the
 * request Host header — i.e. this only works when the frontend is served
 * from the same origin as the Frappe backend (true in production; NOT true
 * in dev, where NEXT_PUBLIC_FRAPPE_URL points at a different host through
 * the /api/frappe proxy). In dev we skip connecting entirely and callers
 * just keep polling.
 */

declare global {
  interface Window {
    io?: (uri: string, opts?: Record<string, unknown>) => any
  }
}

let scriptPromise: Promise<void> | null = null

/** Frappe site name: NEXT_PUBLIC_FRAPPE_SITE, else the first hostname label
 *  (tenant subdomains are named after their site: tamken3.base.meena.sa → tamken3). */
function siteName(): string {
  return process.env.NEXT_PUBLIC_FRAPPE_SITE || window.location.hostname.split('.')[0]
}
let socket: any = null

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.io) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = '/socket.io/socket.io.js'
    el.async = true
    el.onload = () => resolve()
    el.onerror = () => reject(new Error('failed to load /socket.io/socket.io.js'))
    document.head.appendChild(el)
  })
  return scriptPromise
}

/**
 * Resolves to a shared, already-connecting socket for this site, or `null`
 * when realtime isn't usable (SSR, dev cross-origin setup, or the script
 * failed to load) — callers should treat `null` as "stay on polling", never
 * throw.
 */
export async function getFrappeSocket(): Promise<any | null> {
  if (typeof window === 'undefined') return null
  if (process.env.NEXT_PUBLIC_FRAPPE_URL) return null // dev: cross-origin, realtime auth can't succeed
  if (socket) return socket
  try {
    await loadScript()
    if (!window.io) return null
    // Namespace = the Frappe SITE name (python publishes to "/<site>"), which
    // differs from the hostname here (tamken3 vs tamken3.base.meena.sa) — the
    // hostname namespace failed auth with "Invalid namespace" (2026-09-29).
    socket = window.io(`${window.location.origin}/${siteName()}`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
    })
    return socket
  } catch {
    return null
  }
}

/**
 * Subscribe to a realtime event. Returns an unsubscribe function; `onStatus`
 * reports connected/disconnected so callers can show a live indicator and
 * lean on polling while disconnected.
 */
export function subscribeRealtime<T = unknown>(
  event: string,
  handler: (payload: T) => void,
  onStatus?: (connected: boolean) => void,
): () => void {
  let sock: any = null
  let cancelled = false
  const up = () => onStatus?.(true)
  const down = () => onStatus?.(false)
  getFrappeSocket().then((s) => {
    if (cancelled || !s) { if (!s) down(); return }
    sock = s
    s.on(event, handler)
    s.on('connect', up)
    s.on('disconnect', down)
    s.on('connect_error', down)
    if (s.connected) up()
  })
  return () => {
    cancelled = true
    if (sock) {
      sock.off(event, handler); sock.off('connect', up); sock.off('disconnect', down); sock.off('connect_error', down)
    }
  }
}
