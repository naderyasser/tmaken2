/**
 * Login-free access for the proposed-version site (tamkeen-v2).
 *
 * There is no login screen anywhere in this build. A visitor without a Frappe
 * session is sent to the backend's walkthrough endpoint, which opens a real
 * session for ONE fixed account (site_config `walkthrough_autologin_user`) and
 * bounces back — so every screen talks to the live backend with normal cookies,
 * CSRF and permissions. The middleware does this for page loads; the helpers
 * below do it client-side when a session dies mid-visit (expired / 403).
 */
export const WALKTHROUGH_LOGIN_PATH = '/api/method/base_meena.demo.walkthrough.walkthrough_login'
export const WALKTHROUGH_STATUS_PATH = '/api/method/base_meena.demo.walkthrough.walkthrough_status'

/** Where a visitor lands when nothing better is known. */
export const HOME_PATH = '/hr'

/** Marker appended to the bounce-back target so a broken backend can't loop forever. */
export const AUTO_PARAM = '_auto'

/** Build the endpoint URL that opens the session and redirects back to `target`. */
export function walkthroughLoginUrl(target: string): string {
  const safe = target.startsWith('/') && !target.startsWith('//') ? target : HOME_PATH
  const marked = safe.includes(`${AUTO_PARAM}=`)
    ? safe
    : `${safe}${safe.includes('?') ? '&' : '?'}${AUTO_PARAM}=1`
  return `${WALKTHROUGH_LOGIN_PATH}?redirect=${encodeURIComponent(marked)}`
}

const CLIENT_GUARD_KEY = 'walkthrough_login_at'
const CLIENT_GUARD_MS = 15_000

/**
 * Client-side session renewal: full navigation through the walkthrough endpoint
 * back to the current URL. Guarded so a backend that refuses to open a session
 * produces one bounce, not a reload storm.
 */
export function renewWalkthroughSession(): void {
  if (typeof window === 'undefined') return
  try {
    const last = Number(sessionStorage.getItem(CLIENT_GUARD_KEY) || 0)
    if (Date.now() - last < CLIENT_GUARD_MS) return
    sessionStorage.setItem(CLIENT_GUARD_KEY, String(Date.now()))
  } catch { /* storage unavailable — still try once */ }
  const here = window.location.pathname + window.location.search
  window.location.replace(walkthroughLoginUrl(here))
}

/**
 * Is login-free access switched on for this site (site_config
 * `walkthrough_autologin_user` + an enabled account)? Lets the UI say so
 * plainly instead of bouncing into a raw backend 403 when it is not.
 */
export async function walkthroughEnabled(): Promise<boolean> {
  try {
    const res = await fetch(WALKTHROUGH_STATUS_PATH, { credentials: 'include', headers: { Accept: 'application/json' } })
    if (!res.ok) return false
    const data = await res.json()
    return data?.message?.enabled === true
  } catch {
    return false
  }
}
