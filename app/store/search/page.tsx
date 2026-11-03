import { store } from '@/lib/frappe-server'
import MapSearch from '@/components/store/map-search'
import type { ListingSearchResult } from '@/lib/real-estate-api'
import type { FilterState } from '@/components/store/search-filters'

export const revalidate = 30

export async function generateMetadata({ searchParams }: any) {
  const sp = await searchParams
  // Sanitize the user's keyword before it reaches the <title>: strip any HTML tags, collapse
  // whitespace, trim, and cap length. (React already escapes the DOM; this keeps the tab title clean.)
  const raw = sp?.keyword ? String(sp.keyword) : ''
  const clean = raw.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 60)
  const kw = clean ? ` — ${clean}` : ''
  return { title: `بحث العقارات${kw} | تمكين العقارية`, description: 'ابحث وفلتر العقارات الموثّقة في السعودية.' }
}

export default async function SearchPage({ searchParams }: any) {
  const sp = (await searchParams) || {}
  // Initial filters come from the URL (SSR + shareable links); the client island takes over.
  const filters: FilterState = {
    keyword: sp.keyword || '', category: sp.category || '', listing_type: sp.listing_type || '',
    city: sp.city || '', district: sp.district || '', region: sp.region || '',
    price_min: sp.price_min || '', price_max: sp.price_max || '',
    area_min: sp.area_min || '', area_max: sp.area_max || '', bedrooms_min: sp.bedrooms_min || '',
    bathrooms_min: sp.bathrooms_min || '', age_max: sp.age_max || '', facade: sp.facade || '',
    furnished: sp.furnished || '', floor_level: sp.floor_level || '', services: sp.services || '',
    sort: sp.sort || 'newest',
  }
  const [cats, res] = await Promise.all([
    store.categories(),
    store.search({ ...filters, limit: 24 }),
  ])
  const listings: ListingSearchResult[] = (res?.results as any) || []
  const categories = (cats || [])
    .filter((c: any) => !c.is_group)
    .map((c: any) => ({ name: c.name, category_name_ar: c.category_name_ar }))

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8">
      <h1 className="aqar-display mb-5 text-2xl text-[var(--aqar-kohl)]">نتائج البحث</h1>
      <MapSearch initial={listings} initialCount={listings.length} filters={filters} categories={categories} />
    </div>
  )
}
