import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getClientConfig, getCurrentDomain } from '@/lib/client-config'

/**
 * Host-resolved tenant branding for client components (the PWA meta tags and
 * the sales shells can't read clients.json themselves — they run in the
 * browser). Returns the same clients.json branding the login page uses,
 * plus the tenant flavor so callers can scope brand overrides to sales
 * tenants only (other tenants keep the legacy hardcoded PWA brand).
 *
 * Uncached by design — clients.json + site_config are runtime-mutated by the
 * operator branding endpoints; reads must go live without a rebuild.
 */

const SITES_DIR = '/home/frappeuser/frappe-dev/sites'

// Toggleable sales-rep (المناديب) app features and whether each is ENABLED by
// DEFAULT. wallet + payments are OFF by default everywhere (a rep app is
// sales+inventory only unless an operator turns them on per tenant); samples
// stays ON by default. Operators override per tenant via site_config
// `sales_rep_features` = { wallet: bool, payments: bool, samples: bool }.
// `rep_backoffice` gates whether plain reps (Sales User) may open the /sales-reps
// back office at all — ON by default so existing tenants are unchanged; a tenant
// that turns it off locks reps to the PWA (managers/admins are never affected).
// `commission` gates the whole sales-rep commission module (rules, accrual,
// statements, payouts). OFF by default platform-wide: the backend hooks are
// wired into Sales Invoice and Payment Entry for every tenant on the bench, and
// the same flag is what keeps them inert for tenants that never asked for it.
const REP_TOGGLEABLE = ['wallet', 'payments', 'samples', 'rep_backoffice', 'commission'] as const
const REP_DEFAULT_ENABLED: Record<string, boolean> = {
  wallet: false,
  payments: false,
  samples: true,
  rep_backoffice: true,
  commission: false,
}

function siteConfigForHost(host: string): { tenantType: string; hiddenFeatures: string[] } {
  // Site dirs are named by the first host label (nginx X-Frappe-Site-Name
  // convention: mandoob.base.meena.sa → site "mandoob").
  const site = host.split('.')[0]
  try {
    const p = join(SITES_DIR, site, 'site_config.json')
    if (!existsSync(p)) return { tenantType: '', hiddenFeatures: computeHidden({}) }
    const conf = JSON.parse(readFileSync(p, 'utf-8'))
    const feats =
      conf.sales_rep_features && typeof conf.sales_rep_features === 'object' ? conf.sales_rep_features : {}
    return {
      tenantType: typeof conf.tenant_type === 'string' ? conf.tenant_type : '',
      hiddenFeatures: computeHidden(feats),
    }
  } catch {
    return { tenantType: '', hiddenFeatures: computeHidden({}) }
  }
}

// A feature is HIDDEN when its effective enabled state is false. Effective =
// the explicit per-tenant boolean if set, else the default above.
function computeHidden(feats: Record<string, unknown>): string[] {
  return REP_TOGGLEABLE.filter((k) => {
    const enabled = typeof feats[k] === 'boolean' ? (feats[k] as boolean) : REP_DEFAULT_ENABLED[k]
    return !enabled
  })
}

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest) {
  const host = getCurrentDomain(request.headers)
  const config = getClientConfig(host)
  const { tenantType, hiddenFeatures } = siteConfigForHost(host)
  const site = host.split('.')[0]

  // Per-tenant PWA icons generated under public/branding/<site>-*.png are
  // served live from disk by nginx; report which exist so clients can fall
  // back to the legacy static icons otherwise.
  const brandingDir = join(process.cwd(), 'public', 'branding')
  const icon192 = existsSync(join(brandingDir, `${site}-192.png`)) ? `/branding/${site}-192.png` : null
  const icon512 = existsSync(join(brandingDir, `${site}-512.png`)) ? `/branding/${site}-512.png` : null

  return NextResponse.json(
    {
      appName: config?.branding?.appName || null,
      tagline: (config?.branding as { tagline?: string } | undefined)?.tagline || null,
      logo: config?.branding?.logo || null,
      primaryColor: config?.branding?.primaryColor || null,
      theme: config?.branding?.theme || null,
      invoice: config?.invoice || null,
      tenantType,
      hiddenFeatures,
      icon192,
      icon512,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
