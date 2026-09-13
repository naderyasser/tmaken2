import { NextRequest, NextResponse } from 'next/server'

/**
 * Server-side demo session establishment for the /client-demo kiosk.
 *
 * The presence-only check in middleware is not enough: a stale `sid` (present
 * but expired) makes Frappe downgrade the session to Guest, and the embedded
 * HRMS app then renders its own login form. Here we authenticate in the
 * background against the site's one-click demo endpoint, capture the fresh
 * `sid` it returns in Set-Cookie, and inject it onto the response so the very
 * next request — including the /hrms iframe — is already authenticated.
 *
 * Scoped to demo-* hosts so it can never establish a session on a client site.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEMO_USER = 'demo@meena.sa'
const SID_MAX_AGE = 60 * 60 * 24 * 7 // matches Frappe's 7-day demo session

function isDemoHost(host: string) {
  return host === 'demo.base.meena.sa' || host.startsWith('demo-')
}

export async function GET(request: NextRequest) {
  const host = request.headers.get('host') || ''
  if (!isDemoHost(host)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const proto = request.headers.get('x-forwarded-proto') || 'https'
  const origin = `${proto}://${host}`

  let sid: string | null = null
  try {
    const login = await fetch(
      `${origin}/api/method/base_meena.demo.autologin.demo_login?redirect=%2Fhrms`,
      { redirect: 'manual', cache: 'no-store' },
    )
    const cookies = login.headers.getSetCookie?.() ?? []
    for (const cookie of cookies) {
      const match = /^sid=([^;]+)/.exec(cookie)
      if (match?.[1] && match[1] !== 'Guest') {
        sid = match[1]
        break
      }
    }
  } catch {
    /* network/edge failure → fall back to the retry-bounded path below */
  }

  // `cd_retry` bounds a failed refresh to a single attempt instead of looping.
  // Build the redirect from the PUBLIC host: behind nginx, request.url can be the
  // internal origin (localhost:3000), which would strand the browser off-site.
  const target = sid ? '/client-demo' : '/client-demo?cd_retry=1'
  const response = NextResponse.redirect(new URL(target, origin))
  if (sid) {
    response.cookies.set('sid', sid, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: SID_MAX_AGE,
    })
    response.cookies.set('user_id', DEMO_USER, {
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
      maxAge: SID_MAX_AGE,
    })
  }
  return response
}
