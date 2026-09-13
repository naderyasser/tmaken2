import type { MetadataRoute } from 'next'
import { store } from '@/lib/frappe-server'

const BASE = process.env.NEXT_PUBLIC_STORE_URL || 'https://aqar.meena-alaqariya.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // frappeServer throws on backend outage — a sitemap should degrade to the static
  // URLs rather than 500 for crawlers.
  let listings: any[] = []
  let cities: any[] = []
  try {
    const recent = await store.search({ sort: 'newest', limit: 200 })
    listings = (recent?.results as any[]) || []
    cities = (await store.cities()) || []
  } catch {
    /* backend down — serve static URLs only */
  }

  const staticUrls: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/search`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/post`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/request-property`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/interest`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/marketing`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/partnership`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/contact`, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${BASE}/about`, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${BASE}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ]
  const cityUrls: MetadataRoute.Sitemap = cities.slice(0, 200).map((c: any) => ({
    url: `${BASE}/${encodeURIComponent(c.name)}`, changeFrequency: 'weekly', priority: 0.6,
  }))
  const listingUrls: MetadataRoute.Sitemap = listings.map((l) => ({
    url: `${BASE}/listing/${l.name}`,
    lastModified: l.creation ? new Date(l.creation) : undefined,
    changeFrequency: 'weekly', priority: 0.7,
  }))
  return [...staticUrls, ...cityUrls, ...listingUrls]
}
