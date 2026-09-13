import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_STORE_URL || 'http://69.164.249.142:8080'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/real-estate', '/app', '/api'] },
    sitemap: `${BASE}/sitemap.xml`,
  }
}
