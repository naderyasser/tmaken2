import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isMarketplaceRequest } from '@/lib/marketplace'
import { isHrDemoPath } from '@/lib/hr-demo'
import { PUBLIC_APP_NO_AUTH } from '@/lib/public-access'

// Pages that don't require authentication
const publicPaths = ['/login', '/update-password', '/onboarding', '/proposal', '/letter-verify', '/api/frappe', '/api/upload_file', '/api/method', '/api/resource', '/sales-brand', '/sales-rep-manifest']

// Pages that require auth but skip the company check
const skipCompanyCheck = ['/setup-wizard', '/api/frappe', '/api/upload_file', '/api/method', '/api/resource']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Dedicated client demo kiosk (/client-demo) ──
  // Open on demo-* hosts only. Session establishment is handled server-side by
  // the route itself (validate → refresh via /client-demo/session), so this
  // branch must NOT fall through to the presence-only session check below: a
  // stale-but-present demo cookie would otherwise skip the auto-login and the
  // embedded HRMS app would render its own login form.
  if (pathname.startsWith('/client-demo')) {
    const host = request.headers.get('host') || ''
    const isDemoHost = host === 'demo.base.meena.sa' || host.startsWith('demo-')
    if (!isDemoHost) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.next()
  }

  // ── Marketplace mode (public storefront) ──
  // Forced by the :8080 review block (X-Marketplace: 1) or a registered domain (clients.json).
  // Guests allowed; everything except /store, /api, /_next is rewritten under /store so the
  // storefront serves at the site root without colliding with the ERP routes.
  const marketplace = isMarketplaceRequest(
    request.headers.get('host'),
    request.headers.get('x-marketplace'),
  )
  if (marketplace) {
    if (
      pathname.startsWith('/store') ||
      pathname.startsWith('/api') ||
      pathname.startsWith('/_next') ||
      pathname.includes('.')
    ) {
      return NextResponse.next()
    }
    const url = request.nextUrl.clone()
    url.pathname = `/store${pathname === '/' ? '' : pathname}`
    return NextResponse.rewrite(url)
  }

  // Public frontend walkthrough mode. This intentionally removes only the
  // Next.js login redirect; the Frappe backend still protects its resources.
  if (PUBLIC_APP_NO_AUTH) {
    return NextResponse.next()
  }

  // Exact public route: the bare HR dashboard (`/hr`) — the guest-accessible
  // "Tamkeen proposed version" mock — plus every HR-shell surface the sidebar
  // links to, so the proposed UI can be walked through without a login wall.
  // (See lib/hr-demo.ts; the backend still authorizes every data call.)
  if (isHrDemoPath(pathname)) {
    return NextResponse.next()
  }

  // Allow public paths
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Allow static files and assets
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Check Frappe session cookies — validate values, not just existence.
  // `sid` is the actual session credential (persistent). `user_id` is a display
  // cookie that Frappe sets session-scoped, so browsers DROP it on restart —
  // requiring it forced a full re-login after every browser restart even though the
  // sid was still valid. Accept a non-Guest sid when user_id is merely absent; the
  // backend remains the judge of sid validity (stale sid → API 403 → client login).
  const sid = request.cookies.get('sid')
  const userId = request.cookies.get('user_id')

  const isValidSession =
    !!(sid && sid.value && sid.value !== 'Guest') &&
    (!userId || (!!userId.value && userId.value !== 'Guest'))

  if (!isValidSession) {
    // ── Demo subdomains: auto-login via Frappe's one-click endpoint ──
    // Any visitor to a demo-*.base.meena.sa subdomain who is not yet logged in
    // is sent through the auto-login endpoint instead of the login page. The
    // endpoint sets the Frappe session cookie and redirects back, so the next
    // pass through middleware sees a valid session and lets them through.
    // A `_demo_auth=1` marker in the redirect-target query prevents infinite
    // redirects when the auto-login endpoint itself fails to set the cookie
    // (e.g. demo user missing on the Frappe site). In that case we fall
    // through to the normal login page instead of looping forever.
    const host = request.headers.get('host') || ''
    const isDemo = host === 'demo.base.meena.sa' || host.startsWith('demo-')
    if (isDemo) {
      if (request.nextUrl.searchParams.has('_demo_auth')) {
        // Already attempted auto-login — show login to avoid infinite redirect
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('redirect', pathname + request.nextUrl.search)
        return NextResponse.redirect(loginUrl)
      }
      const autoLoginUrl = new URL('/api/method/base_meena.demo.autologin.demo_login', request.url)
      const target = pathname + request.nextUrl.search
      const sep = request.nextUrl.search ? '&' : '?'
      autoLoginUrl.searchParams.set('redirect', (target === '/' ? '' : target) + sep + '_demo_auth=1')
      return NextResponse.redirect(autoLoginUrl)
    }

    const loginUrl = new URL('/login', request.url)
    // Preserve the query string too (pathname alone drops it) so a shared deep link
    // like /rentals-native?section=…&type=…&key=… survives the login bounce and the
    // recipient lands on the exact record, not just the module root.
    loginUrl.searchParams.set('redirect', pathname + request.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  // ── Company existence check ──
  // Skip for paths that don't need it (setup-wizard itself)
  if (!skipCompanyCheck.some(p => pathname.startsWith(p))) {
    try {
      const domain = request.headers.get('host') || ''
      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
      // Use env var when available (required in dev where host ≠ backend)
      const FRAPPE_URL = process.env.NEXT_PUBLIC_FRAPPE_URL || `${protocol}://${domain}`
      const apiUrl = `${FRAPPE_URL}/api/resource/Company?fields=["name"]&limit_page_length=1`
      const res = await fetch(apiUrl, {
        headers: {
          Cookie: request.headers.get('cookie') || '',
        },
      })
      if (res.ok) {
        const json = await res.json()
        const hasCompany = Array.isArray(json.data) && json.data.length > 0
        if (!hasCompany) {
          return NextResponse.redirect(new URL('/setup-wizard', request.url))
        }
      }
      // If fetch fails (network, 403, etc.) — let the user through;
      // the page-level AuthContext will handle errors gracefully.
    } catch {
      // Network error — don't block navigation
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$).*)',
  ],
}
