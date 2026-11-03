import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_STORE_URL ?? ''

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/real-estate', '/app', '/api'] },
    ...(BASE ? { sitemap: `${BASE}/sitemap.xml` } : {}),
  }
}
