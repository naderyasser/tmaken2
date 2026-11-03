/**
 * Server-side Frappe fetch for the storefront (SSR / ISR). Calls the guest-allowed
 * whitelisted methods directly against the backend, resolving the tenant site via the
 * Host header (Frappe resolves sites by host). Configurable via env for production:
 *   FRAPPE_INTERNAL_URL (default http://127.0.0.1:8000) · FRAPPE_SITE (default qarawi)
 */

const BASE = process.env.FRAPPE_INTERNAL_URL || 'http://127.0.0.1:8000'
const SITE = process.env.FRAPPE_SITE || 'qarawi'

const PUBLIC = 'base_meena.real_estate.aqar_public_api'

/** Backend outage/5xx — thrown so route error boundaries (error.tsx) render a retryable
 *  error state instead of the page masquerading as "no results" or a 404. */
export class FrappeServerError extends Error {
  constructor(method: string, detail: string) {
    super(`frappe backend failed for ${method}: ${detail}`)
    this.name = 'FrappeServerError'
  }
}

export async function frappeServer<T = any>(
  method: string,
  params: Record<string, any> = {},
  revalidate = 60,
): Promise<T | null> {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '') as any,
  ).toString()
  const url = `${BASE}/api/method/${method}${qs ? `?${qs}` : ''}`
  let res: Response
  try {
    res = await fetch(url, {
      headers: { Host: SITE, 'X-Frappe-Site-Name': SITE },
      next: { revalidate },
    })
  } catch (e: any) {
    console.warn(`[FrappeServer] unreachable for ${method}:`, e?.message)
    return null
  }
  if (res.status >= 500) {
    console.warn(`[FrappeServer] HTTP ${res.status} for ${method}`)
    return null
  }
  // 4xx = semantic miss (not found / not Active / bad params) — callers map it to
  // notFound()/empty states themselves.
  if (!res.ok) return null
  try {
    const json = await res.json()
    return (json?.message ?? null) as T
  } catch {
    console.warn(`[FrappeServer] invalid JSON response for ${method}`)
    return null
  }
}

// Convenience wrappers over the public API
export const store = {
  search: (params: Record<string, any>) => frappeServer(`${PUBLIC}.search_listings`, params, 60),
  listing: (name: string) => frappeServer(`${PUBLIC}.get_listing`, { name }, 120),
  similar: (listing: string) => frappeServer(`${PUBLIC}.get_similar_listings`, { listing }, 120),
  comments: (listing: string) => frappeServer(`${PUBLIC}.get_comments`, { listing }, 30),
  categories: () => frappeServer(`${PUBLIC}.list_categories`, {}, 60),
  regions: () => frappeServer(`${PUBLIC}.list_regions`, {}, 3600),
  regionCounts: () => frappeServer(`${PUBLIC}.get_region_counts`, {}, 120),
  cities: (region?: string) => frappeServer(`${PUBLIC}.list_cities`, { region }, 3600),
  districts: (city: string) => frappeServer(`${PUBLIC}.list_districts`, { city }, 3600),
  advertiser: (advertiser: string) => frappeServer(`${PUBLIC}.get_advertiser`, { advertiser }, 120),
  officeReviews: (office: string) => frappeServer(`${PUBLIC}.get_office_reviews`, { office }, 60),
  offices: () => frappeServer(`${PUBLIC}.list_offices`, {}, 120),
  investment: (params: Record<string, any> = {}) => frappeServer(`${PUBLIC}.get_investment_overview`, params, 120),
  contactChannels: () => frappeServer<Record<string, string>>(`${PUBLIC}.get_contact_channels`, {}, 300),
}
