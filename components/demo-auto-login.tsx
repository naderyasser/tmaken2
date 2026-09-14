'use client'

import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'

/**
 * Passwordless demo login.
 *
 * When the configured backend is a demo tenant (demo.base.meena.sa or
 * demo-*.base.meena.sa), sign the visitor in automatically via Frappe's
 * `base_meena.demo.autologin.demo_login` endpoint — the same one the middleware
 * uses on real demo subdomains. This makes local/dev runs against a demo backend
 * behave like the hosted demo: real data, no login wall.
 *
 * Inert on every non-demo backend, so it never touches a production tenant.
 */
const DONE_KEY = 'demo_autologin_done'

function demoBackendHost(): string | null {
  const url = process.env.NEXT_PUBLIC_FRAPPE_URL
  if (!url) return null
  try {
    const host = new URL(url).hostname
    return /^demo(-[^.]+)?\.base\.meena\.sa$/i.test(host) ? host : null
  } catch {
    return null
  }
}

export function DemoAutoLogin() {
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!demoBackendHost()) return
    if (isLoading || isAuthenticated) return
    // One attempt per browser session — avoids a reload loop when the demo
    // endpoint is unreachable.
    if (sessionStorage.getItem(DONE_KEY)) return
    sessionStorage.setItem(DONE_KEY, '1')

    fetch('/api/frappe?path=' + encodeURIComponent('/api/method/base_meena.demo.autologin.demo_login'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': 'fetch' },
      body: '{}',
    })
      // Reload regardless: the endpoint answers 302 (no Location forwarded), which
      // some browsers surface as a rejected fetch even though Set-Cookie was applied.
      // The sessionStorage guard above makes this a single attempt per tab session.
      .finally(() => { window.location.reload() })
  }, [isAuthenticated, isLoading])

  return null
}
