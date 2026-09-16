import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isMarketplaceRequest } from '@/lib/marketplace'
import { AUTO_PARAM, HOME_PATH, walkthroughLoginUrl } from '@/lib/public-access'

// Routes that never need a session (API proxies, public share pages).
const publicPaths = ['/update-password', '/onboarding', '/proposal', '/letter-verify', '/api/', '/sales-brand', '/sales-rep-manifest', '/tamkeen-go-manifest']

/**
 * Login-free build (tamkeen-v2, "النسخة المطروحة"): there is no login screen.
 * A page request without a Frappe session is bounced through the backend's
 * walkthrough endpoint, which opens a real session for the fixed account and
 * redirects straight back — so the visitor lands on the page they asked for,
 * already signed in. See lib/public-access.ts.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl

  // ── Marketplace mode (public storefront on registered domains) — unchanged ──
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

  // Static files, Next internals, API proxies and public share pages pass through.
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('.') ||
    publicPaths.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next()
  }

  // The old entry points collapse onto the HR dashboard.
  if (pathname === '/login' || pathname === '/') {
    return NextResponse.redirect(new URL(HOME_PATH, request.url))
  }

  // `sid` is the real session credential. A stale sid still passes here; the
  // backend answers 403, and the client renews (lib/public-access.ts).
  const sid = request.cookies.get('sid')?.value
  const hasSession = !!sid && sid !== 'Guest'
  if (hasSession) return NextResponse.next()

  // Just came back from the walkthrough endpoint and STILL no session → the
  // site is not opted in (the endpoint bounces back with this marker instead
  // of a raw 403). Render the page; the client explains that login-free access
  // is off. No backend probe here: fetch() inside the edge middleware proved
  // unreliable and silently disabled the bounce.
  if (searchParams.has(AUTO_PARAM)) return NextResponse.next()

  return NextResponse.redirect(new URL(walkthroughLoginUrl(pathname + search), request.url))
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
