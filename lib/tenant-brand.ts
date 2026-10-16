import { readFileSync } from 'fs'
import { join } from 'path'
import { headers } from 'next/headers'

/**
 * Per-client identity of the HR product. One running frontend serves every
 * client: nginx tells it which Frappe site a request belongs to (the
 * `X-Frappe-Site-Name` it already sends to the API, falling back to the first
 * host label), and the client's name/logo/icons come from that site's
 * site_config.json → `tenant_brand` (written by ops/new-client.sh). Anything a
 * client leaves out keeps the product default below, so a site with no
 * `tenant_brand` (tamken3) looks exactly as before.
 */
export interface TenantBrand {
  site: string
  /** Product name in titles, the sidebar footer and «©» lines. */
  name: string
  /** Line next to the user menu in the topbar. */
  tagline: string
  /** Logo drawn on the dark-teal sidebar, sign-in and mobile header. */
  logoWhite: string
  favicon: string
  /** 180px home-screen icon (iOS). */
  appleIcon: string
  /** Folder holding icon-192/512 + maskable-192/512 for the «/m» PWA manifest. */
  pwaIconBase: string
  loginPhoto: string
  themeColor: string
}

const SITES_DIR = process.env.FRAPPE_SITES_DIR || '/home/frappeuser/frappe-dev/sites'
const SITE_RE = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)*$/

const DEFAULT_BRAND: Omit<TenantBrand, 'site'> = {
  name: 'Masar Time',
  tagline: 'مسار تايم - النظام الذكي',
  logoWhite: '/branding/masar/masar-logo-white.png',
  favicon: '/branding/masar/masar-favicon.png',
  appleIcon: '/m/apple-touch-icon.png',
  pwaIconBase: '/m',
  loginPhoto: '/branding/product/login-photo.webp',
  themeColor: '#1d4d56',
}

const KEYS = Object.keys(DEFAULT_BRAND) as (keyof typeof DEFAULT_BRAND)[]

export async function currentSite(): Promise<string> {
  const h = await headers()
  const site = (h.get('x-frappe-site-name') || (h.get('host') || '').split(':')[0].split('.')[0]).toLowerCase()
  return SITE_RE.test(site) ? site : ''
}

/** Uncached on purpose: a brand edit in site_config goes live without a rebuild. */
export async function getTenantBrand(): Promise<TenantBrand> {
  const site = await currentSite()
  const brand: TenantBrand = { site, ...DEFAULT_BRAND }
  if (!site) return brand
  try {
    const conf = JSON.parse(readFileSync(join(SITES_DIR, site, 'site_config.json'), 'utf-8'))
    const custom = conf.tenant_brand
    if (custom && typeof custom === 'object') {
      for (const k of KEYS) {
        if (typeof custom[k] === 'string' && custom[k].trim()) brand[k] = custom[k].trim()
      }
    }
  } catch {
    // unknown host / unreadable config → product defaults
  }
  return brand
}
