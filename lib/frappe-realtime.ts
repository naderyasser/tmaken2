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
    socket = window.io(`${window.location.origin}/${window.location.hostname}`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 3,
    })
    return socket
  } catch {
    return null
  }
}
