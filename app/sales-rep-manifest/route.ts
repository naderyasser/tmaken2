import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getClientConfig, getCurrentDomain } from '@/lib/client-config'

/**
 * Per-tenant PWA manifest for the sales-rep app.
 *
 * public/sales-rep-manifest.json is a static file shared by every tenant, so
 * the installed-app name was hardwired to the legacy brand. This route serves
 * the same manifest with name/short_name/description/theme_color resolved from
 * the tenant's clients.json branding — but ONLY for sales-flavor tenants
 * (site_config tenant_type = "sales"); every other host gets the legacy
 * values, so no existing tenant's installed PWA changes identity.
 *
 * Icons: uses public/branding/<site>-{192,512}.png (+ -maskable-) when they
 * exist (generated from the tenant's uploaded logo), else the legacy static
 * SVG icon set.
 */

const SITES_DIR = '/home/frappeuser/frappe-dev/sites'

function tenantTypeForHost(host: string): string {
  const site = host.split('.')[0]
  try {
    const p = join(SITES_DIR, site, 'site_config.json')
    if (!existsSync(p)) return ''
    const conf = JSON.parse(readFileSync(p, 'utf-8'))
    return typeof conf.tenant_type === 'string' ? conf.tenant_type : ''
  } catch {
    return ''
  }
}

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest) {
  const host = getCurrentDomain(request.headers)
  const site = host.split('.')[0]

  // Base = the legacy static manifest (single source for scope/display/etc.)
  let manifest: any
  try {
    manifest = JSON.parse(
      readFileSync(join(process.cwd(), 'public', 'sales-rep-manifest.json'), 'utf-8')
    )
  } catch {
    return NextResponse.json({ error: 'manifest unavailable' }, { status: 500 })
  }

  if (tenantTypeForHost(host) === 'sales') {
    const branding = getClientConfig(host)?.branding
    if (branding?.appName) {
      manifest.name = branding.appName
      manifest.short_name = branding.appName
      manifest.description = branding.appName
    }
    if (branding?.primaryColor) {
      manifest.theme_color = branding.primaryColor
    }
    if (branding?.backgroundColor) {
      manifest.background_color = branding.backgroundColor
    }

    const brandingDir = join(process.cwd(), 'public', 'branding')
    const icons: any[] = []
    for (const size of ['192', '512']) {
      if (existsSync(join(brandingDir, `${site}-${size}.png`))) {
        icons.push({ src: `/branding/${site}-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' })
      }
      if (existsSync(join(brandingDir, `${site}-maskable-${size}.png`))) {
        icons.push({ src: `/branding/${site}-maskable-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'maskable' })
      }
    }
    if (icons.length) {
      manifest.icons = icons
      // Shortcut icons follow the tenant icon too
      if (Array.isArray(manifest.shortcuts)) {
        for (const sc of manifest.shortcuts) {
          if (Array.isArray(sc.icons) && icons[0]) sc.icons = [icons[0]]
        }
      }
    }
  }

  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
