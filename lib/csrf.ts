// Shared CSRF handling for raw `fetch` calls to the Frappe backend.
//
// Frappe enforces CSRF on writes once the session has a csrf_token, and raises
// CSRFTokenError as **HTTP 400** (body exc_type "CSRFTokenError", message
// "طلب غير صالح / Invalid Request") — NOT 403/417. Any POST/PUT/DELETE that does
// not send the `X-Frappe-CSRF-Token` header therefore fails hard.
//
// Both centralized clients (lib/api-client.ts, lib/api.ts) handle this, but many
// components issue raw `fetch()` writes directly. `csrfFetch` is a safe drop-in
// replacement for those: it injects the token on writes and self-heals once on a
// CSRF error. GET/HEAD pass straight through untouched.

let csrfToken: string | null = null

function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null
  const c = document.cookie
    .split('; ')
    .find((r) => r.startsWith('csrf_token=') || r.startsWith('csrftoken='))
  return c ? decodeURIComponent(c.split('=')[1]) : null
}

/** Current best-known token: in-memory cache first, then the cookie. */
export function currentCsrf(): string | null {
  return csrfToken || readCsrfCookie()
}

/** Fetch a fresh token from the backend and cache it (also mirrors it to the cookie). */
export async function refreshCsrf(): Promise<string | null> {
  try {
    const res = await fetch('/api/method/base_meena.api.get_csrf_token', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    })
    if (res.ok) {
      const token = (await res.json())?.message || null
      if (token) {
        csrfToken = token
        if (typeof document !== 'undefined')
          document.cookie = `csrf_token=${encodeURIComponent(token)}; path=/; SameSite=Lax`
      }
      return token
    }
  } catch {
    /* ignore — the retried request will surface the real error */
  }
  return null
}

/**
 * True if `response` is a Frappe CSRF failure. Frappe returns HTTP 400 for
 * CSRFTokenError, so we can't key off status alone — a plain 400 ValidationError
 * must NOT be treated as CSRF (else we'd refetch + resubmit a bad write).
 */
export async function isCsrfError(response: Response): Promise<boolean> {
  if (![400, 403, 417].includes(response.status)) return false
  try {
    const data = await response.clone().json()
    const exc = String(data?.exc_type || data?.exception || '')
    if (exc) return exc.includes('CSRFTokenError')
  } catch {
    /* non-JSON body */
  }
  // Older Frappe: 417/403 with a plain "Invalid Request" body and no exc_type.
  return response.status === 417 || response.status === 403
}

/**
 * Drop-in replacement for `fetch` that attaches the CSRF token to writes and
 * retries once with a fresh token on a CSRF error. Safe for GET/HEAD (pass-through)
 * and for FormData bodies (only a header is added; the body is untouched).
 */
export async function csrfFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD') return fetch(input, init)

  const build = (): RequestInit => {
    const headers = new Headers(init.headers || {})
    const token = currentCsrf()
    if (token && !headers.has('X-Frappe-CSRF-Token')) headers.set('X-Frappe-CSRF-Token', token)
    // Default to sending cookies unless the caller opted out explicitly.
    return { credentials: 'include', ...init, headers }
  }

  let response = await fetch(input, build())
  if (await isCsrfError(response)) {
    csrfToken = null
    await refreshCsrf()
    response = await fetch(input, build())
  }
  return response
}
