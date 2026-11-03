/**
 * Sign-in redirect helper.
 *
 * Every page requires a real Frappe session by default — see middleware.ts.
 * `redirectToLogin()` handles a session that dies mid-visit (401/403 on an
 * already-loaded page) and anyone who navigates to /login directly.
 *
 * DEV/DEMO ONLY: `walkthroughLoginUrl()` / `WALKTHROUGH_LOGIN_PATH` /
 * `AUTO_PARAM` back the `NEXT_PUBLIC_WALKTHROUGH_AUTOLOGIN=1` flag in
 * middleware.ts, which bounces a session-less request through the backend's
 * walkthrough endpoint (opens a session for site_config
 * `walkthrough_autologin_user`) instead of /login. Unused when the flag is
 * unset or not `'1'`.
 */

/** Where a visitor lands when nothing better is known. */
export const HOME_PATH = '/hr'

/** Backend endpoint that opens a real session for site_config `walkthrough_autologin_user`. */
export const WALKTHROUGH_LOGIN_PATH = '/api/method/base_meena.demo.walkthrough.walkthrough_login'

/** Marker appended to the bounce-back target so a disabled/misconfigured backend can't loop forever. */
export const AUTO_PARAM = '_auto'

/** Build the endpoint URL that opens the walkthrough session and redirects back to `target`. */
export function walkthroughLoginUrl(target: string): string {
  const safe = target.startsWith('/') && !target.startsWith('//') ? target : HOME_PATH
  const marked = safe.includes(`${AUTO_PARAM}=`)
    ? safe
    : `${safe}${safe.includes('?') ? '&' : '?'}${AUTO_PARAM}=1`
  return `${WALKTHROUGH_LOGIN_PATH}?redirect=${encodeURIComponent(marked)}`
}

const CLIENT_GUARD_KEY = 'login_redirect_at'
const CLIENT_GUARD_MS = 15_000

/**
 * Client-side redirect to the real login screen, carrying the current URL as
 * `?redirect=` so the visitor lands back where they were after signing in.
 * Guarded so a component that keeps re-rendering can't reload-storm.
 */
export function redirectToLogin(): void {
  if (typeof window === 'undefined') return
  try {
    const last = Number(sessionStorage.getItem(CLIENT_GUARD_KEY) || 0)
    if (Date.now() - last < CLIENT_GUARD_MS) return
    sessionStorage.setItem(CLIENT_GUARD_KEY, String(Date.now()))
  } catch { /* storage unavailable — still try once */ }
  if (window.location.pathname.startsWith('/login')) return
  const here = window.location.pathname + window.location.search
  window.location.replace(`/login?redirect=${encodeURIComponent(here)}`)
}
