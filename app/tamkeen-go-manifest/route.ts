import { NextRequest, NextResponse } from 'next/server'
import { existsSync } from 'fs'
import { join } from 'path'
import { getClientConfig, getCurrentDomain } from '@/lib/client-config'

/**
 * Per-tenant PWA manifest for Tamkeen Go (the /me self-service home).
 *
 * Cloned from app/sales-rep-manifest/route.ts, but scoped to '/me' and themed
 * teal (#0E6E62 — the HR ".theme-hr" identity). name/short_name/theme come from
 * the tenant's clients.json branding when present, so an installed home-screen
 * app shows the tenant's own name; every field has a sensible default so the
 * manifest is always valid even for a tenant with no branding.
 *
 * Icons: uses public/branding/<site>-{192,512}.png (generated from a tenant's
 * uploaded logo) when they exist, else the shipped teal Tamkeen Go SVG icons.
 */

const TEAL = '#0E6E62'

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest) {
  const host = getCurrentDomain(request.headers)
  const site = host.split('.')[0]
  const branding = getClientConfig(host)?.branding

  const appName = branding?.appName || 'تمكين — Tamkeen'

  // Prefer per-tenant branded icons; else the shipped teal Tamkeen Go icons.
  const brandingDir = join(process.cwd(), 'public', 'branding')
  const icons: Array<{ src: string; sizes: string; type: string; purpose: string }> = []
  for (const size of ['192', '512']) {
    if (existsSync(join(brandingDir, `${site}-${size}.png`))) {
      icons.push({ src: `/branding/${site}-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' })
    }
    if (existsSync(join(brandingDir, `${site}-maskable-${size}.png`))) {
      icons.push({ src: `/branding/${site}-maskable-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'maskable' })
    }
  }
  if (icons.length === 0) {
    icons.push(
      { src: '/icons/tamkeen-go-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/tamkeen-go-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/tamkeen-go-maskable-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
    )
  }

  const manifest = {
    name: appName,
    short_name: branding?.appName || 'تمكين',
    description: 'خدمة الموظف الذاتية — Tamkeen employee self-service',
    id: '/me',
    start_url: '/me',
    scope: '/me',
    display: 'standalone',
    orientation: 'portrait',
    dir: 'rtl',
    lang: 'ar',
    theme_color: branding?.primaryColor || TEAL,
    background_color: branding?.backgroundColor || '#FFFFFF',
    categories: ['business', 'productivity'],
    icons,
  }

  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
