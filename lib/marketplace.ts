/**
 * Marketplace-mode config. In production a request is "marketplace mode" when its host is a
 * registered marketplace domain (clients.json-style map below). For pre-domain review, the
 * :8080 nginx block sets `X-Marketplace: 1` which also forces marketplace mode — so wiring
 * the real domain later is a config-only change (add an entry here, drop the header).
 */

export interface MarketplaceDomain {
  site: string // Frappe site that backs this marketplace
  name: string // brand name shown in the storefront
}

// clients.json equivalent — add production marketplace domains here.
export const MARKETPLACE_DOMAINS: Record<string, MarketplaceDomain> = {
  'aqar.meena-alaqariya.com': { site: 'qarawi', name: 'تمكين عقار' },
}

export const DEFAULT_MARKETPLACE: MarketplaceDomain = { site: 'qarawi', name: 'تمكين عقار' }

export function isMarketplaceRequest(host: string | null, forced: string | null): boolean {
  if (forced === '1') return true
  if (!host) return false
  const h = host.split(':')[0]
  return h in MARKETPLACE_DOMAINS
}

export function marketplaceFor(host: string | null): MarketplaceDomain {
  const h = (host || '').split(':')[0]
  return MARKETPLACE_DOMAINS[h] || DEFAULT_MARKETPLACE
}
