import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isMarketplaceRequest } from '@/lib/marketplace'
import { AUTO_PARAM, HOME_PATH, walkthroughLoginUrl } from '@/lib/public-access'

// Routes that never need a session (API proxies, public share pages, and the
// one real sign-in screen at /login — components/hr-shell/real-login-form.tsx).
const publicPaths = ['/login', '/company-select', '/support-api/', '/update-password', '/onboarding', '/proposal', '/letter-verify', '/api/', '/sales-brand', '/sales-rep-manifest', '/tamkeen-go-manifest']

/**
 * Every page requires a real Frappe session by default — a session-less page
 * request redirects to /login, carrying the original path as `?redirect=` so
 * the visitor lands back where they were after signing in.
 *
 * DEV/DEMO ONLY: when `NEXT_PUBLIC_WALKTHROUGH_AUTOLOGIN=1` is set, a
 * session-less page request instead bounces through the backend's
 * walkthrough endpoint (opens a real session for site_config
 * `walkthrough_autologin_user`) so a dev/demo environment doesn't need a
 * login on every visit — see lib/public-access.ts. To revert: unset the flag
 * (or remove it from `.env.production`) and rebuild.
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

  // Shared entry (masar.base.meena.sa): the product's public landing + self-service
  // subscribe pages. Only there — on a client's own domain they don't exist.
  const onEntry = request.headers.get('x-masar-entry') === '1'
  if (pathname === '/welcome' || pathname === '/subscribe' || pathname.startsWith('/subscribe/')) {
    return onEntry ? NextResponse.next() : NextResponse.redirect(new URL('/', request.url))
  }
  if (pathname === '/' && onEntry) {
    const s = request.cookies.get('sid')?.value
    if (!s || s === 'Guest') return NextResponse.rewrite(new URL('/welcome', request.url))
  }

  // Static files, Next internals, API proxies and public share pages pass through.
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('.') ||
    publicPaths.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next()
  }

  // «/m» — the employees' mobile check-in app signs in on its own screen
  // (employee number + app password), never the HR /login or the walkthrough.
  if (pathname === '/m' || pathname.startsWith('/m/')) {
    if (pathname === '/m/login') return NextResponse.next()
    const mSid = request.cookies.get('sid')?.value
    if (mSid && mSid !== 'Guest') return NextResponse.next()
    return NextResponse.redirect(new URL(`/m/login?redirect=${encodeURIComponent(pathname + search)}`, request.url))
  }

  // The bare root collapses onto the HR dashboard. `/login` is handled above
  // (publicPaths) so it renders instead of being swept in here.
  if (pathname === '/') {
    return NextResponse.redirect(new URL(HOME_PATH, request.url))
  }

  // `sid` is the real session credential. A stale sid still passes here; the
  // backend answers 401/403, and the client redirects to /login (lib/public-access.ts).
  const sid = request.cookies.get('sid')?.value
  const hasSession = !!sid && sid !== 'Guest'
  if (hasSession) return NextResponse.next()

  // Next.js auto-prefetches every visible <Link>, including the "الرئيسية"
  // link on the login page itself — that prefetch request comes through this
  // same middleware. With the walkthrough flag on, redirecting it below would
  // silently open a real Administrator session via a background request
  // while the visitor is still looking at the (still-rendered) login form,
  // having clicked nothing (exhaustive audit, 2026-09-20). Prefetches carry
  // this header; let them pass through unauthenticated instead — the actual
  // navigation, when it happens, is a real (non-prefetch) request and still
  // gets bounced normally.
  if (request.headers.get('Next-Router-Prefetch') || request.headers.get('purpose') === 'prefetch') {
    return NextResponse.next()
  }

  const target = `/login?redirect=${encodeURIComponent(pathname + search)}`

  if (process.env.NEXT_PUBLIC_WALKTHROUGH_AUTOLOGIN === '1') {
    // Just came back from the walkthrough endpoint and STILL no session → it's
    // not configured (or the account is disabled). Fall back to the real login
    // screen instead of looping. No backend probe here: fetch() inside edge
    // middleware has proved unreliable elsewhere in this app.
    if (searchParams.has(AUTO_PARAM)) {
      return NextResponse.redirect(new URL(target, request.url))
    }
    return NextResponse.redirect(new URL(walkthroughLoginUrl(pathname + search), request.url))
  }

  return NextResponse.redirect(new URL(target, request.url))
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
