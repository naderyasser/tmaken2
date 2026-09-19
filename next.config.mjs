/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build output dir. Defaults to `.next`; override via NEXT_DIST_DIR to build
  // out-of-place (so the live server keeps serving the current `.next` untouched
  // until an atomic swap). `next start` uses the default `.next`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  // Next 16: eslint config moved to eslint.config.js / no longer in next.config
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
  async headers() {
    // CSP in REPORT-ONLY (review violations before enforcing). Allowlist keeps Leaflet/OSM tiles,
    // object-storage images, self-hosted fonts, and the same-origin Frappe API working.
    const cspReportOnly = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "img-src 'self' data: blob: https:",            // OSM tiles + listing images (object storage)
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next hydration + no-FOUC inline theme script
      "style-src 'self' 'unsafe-inline'",              // Tailwind + Leaflet inline styles
      "font-src 'self' data:",                          // next/font self-hosted
      "connect-src 'self' https:",                      // same-origin Frappe API
      "worker-src 'self' blob:",
    ].join('; ')
    return [
      {
        // Security headers for ALL routes (pages served by :3000). HSTS is intentionally NOT set
        // here — it belongs on the :443 nginx vhost (deferred; egarsys cert trap).
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(self)' },
          { key: 'Content-Security-Policy-Report-Only', value: cspReportOnly },
        ],
      },
      {
        // CORS for guest/public API reads only. NEVER pair Allow-Credentials with the
        // '*' origin (invalid + unsafe): the app is same-origin on every tenant vhost,
        // so credentialed (session-cookie) calls need no CORS at all — browsers simply
        // refuse to expose credentialed responses under a wildcard, and we keep it that
        // way. Cross-origin callers can read public endpoints without cookies.
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-Requested-With, Content-Type, Authorization' },
        ],
      },
      {
        // Cashier SW: must revalidate so updates roll out immediately
        source: '/cashier-sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        // Allow service worker to control the /sales-rep scope
        source: '/sales-rep-sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/sales-rep' },
        ],
      },
      {
        source: '/sales-rep-manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'no-cache' },
        ],
      },
    ]
  },
  // In dev, proxy Frappe API paths to the real backend so client-side
  // fetch(window.location.origin + '/api/resource/...') reaches Frappe.
  // In production the frontend and backend share the same domain, so
  // these rewrites are never hit.
  async redirects() {
    return [
      { source: '/accounting/profit-loss', destination: '/accounting/pnl', permanent: true },
    ]
  },
  async rewrites() {
    const frappeUrl = process.env.NEXT_PUBLIC_FRAPPE_URL
    if (!frappeUrl) return []          // production — same domain, no rewrites needed
    return [
      { source: '/api/method/:path*', destination: `${frappeUrl}/api/method/:path*` },
      { source: '/api/resource/:path*', destination: `${frappeUrl}/api/resource/:path*` },
      // Proxy assets & files for dev
      { source: '/assets/:path*', destination: `${frappeUrl}/assets/:path*` },
      { source: '/files/:path*', destination: `${frappeUrl}/files/:path*` },
    ]
  },
  // Vercel-specific optimizations
  // Note: optimizeCss causes Turbopack to spawn a PostCSS worker that
  // fails to bind its port ("Address already in use") — disabled in dev.
  experimental: process.env.NODE_ENV === 'production' ? { optimizeCss: true } : {},
}

export default nextConfig
