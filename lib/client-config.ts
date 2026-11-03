import { readFileSync } from 'fs'
import { join } from 'path'

export interface BrandingConfig {
  appName: string
  primaryColor: string
  logo: string
  favicon: string
  // Optional named theme (scoped CSS class in app/globals.css, e.g. "lazaa").
  // When set on a sales tenant, the sales PWA + admin apply `.theme-<theme>` so the
  // whole vertical re-skins from design tokens. Absent → the tenant keeps the default
  // (blue) palette, so existing tenants are unaffected.
  theme?: string
  // Optional PWA manifest background_color (splash screen). Absent → the legacy
  // static manifest value is kept, so existing tenants are unaffected.
  backgroundColor?: string
}

/**
 * Per-tenant printed-invoice settings. When `format` is "parts", the inventory
 * module prints the client's «فاتورة قطع غيار / Parts Invoice» sheet instead of
 * the default branded goods-receipt document. The three constants below are the
 * fields that never change per receipt; the per-document numbers (invoice /
 * sales order / customer order / case) are entered on the receipt form.
 * Absent → the tenant keeps the default invoice, so other tenants are unaffected.
 */
export interface InvoiceConfig {
  format?: 'parts'
  soldToParty?: string
  shipToParty?: string
  vatPercent?: number
}

export interface ClientConfig {
  branding: BrandingConfig
  invoice?: InvoiceConfig
}

export interface ClientMappings {
  clients: Record<string, ClientConfig>
}

// NOTE: intentionally NOT cached. clients.json is written by the operator-gated
// tenant_manager.set_branding/upload_branding_logo endpoints, and the login page reads
// it server-side per request — reading the small file each time lets branding changes
// go live with zero rebuild/restart. (Previously a module-level cache required a
// process restart to pick up edits.)
export function loadClientConfig(): ClientMappings {
  try {
    const configPath = join(process.cwd(), 'config', 'clients.json')
    const configContent = readFileSync(configPath, 'utf-8')
    return JSON.parse(configContent) as ClientMappings
  } catch (error) {
    console.error('Failed to load client config:', error)
    // Return default configuration
    return {
      clients: {
        default: {
          branding: {
            appName: process.env.NEXT_PUBLIC_APP_NAME || 'تمكين',
            primaryColor: '#3B82F6',
            logo: '/logo.jpeg',
            favicon: '/favicon.ico'
          }
        }
      }
    }
  }
}

export function getClientConfig(domain: string): ClientConfig | null {
  const mappings = loadClientConfig()

  // Check for exact domain match
  if (mappings.clients[domain]) {
    return mappings.clients[domain]
  }

  // Check for wildcard subdomain matching (e.g., *.client-a.com)
  for (const [key, config] of Object.entries(mappings.clients)) {
    if (key.startsWith('*.')) {
      const baseDomain = key.slice(2)
      if (domain === baseDomain || domain.endsWith('.' + baseDomain)) {
        return config
      }
    }
  }

  // Return default configuration
  return mappings.clients.default || null
}

/**
 * Get the Frappe backend URL for the current domain.
 * Since the frontend and backend are on the same domain,
 * we just use the current domain with the appropriate protocol.
 */
export function getFrappeBackendUrl(domain: string): string {
  // In production, use HTTPS. In development, use HTTP.
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  return `${protocol}://${domain}`
}

/**
 * Get the current domain from the request headers.
 * This is used to determine which client configuration to load.
 */
export function getCurrentDomain(headers: Headers): string {
  const host = headers.get('host') || ''
  // Remove port if present
  return host.split(':')[0]
}
