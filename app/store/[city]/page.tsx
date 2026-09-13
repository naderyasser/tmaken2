import Link from 'next/link'
import { notFound } from 'next/navigation'
import { store } from '@/lib/frappe-server'
import StoreListingCard from '@/components/store/listing-card'
import type { ListingSearchResult } from '@/lib/real-estate-api'

export const revalidate = 120

async function resolveCity(cityParam: string) {
  const cities = await store.cities()
  return (cities || []).find((c: any) => c.name === cityParam)
}

export async function generateMetadata({ params }: any) {
  const { city } = await params
  const c = await resolveCity(decodeURIComponent(city))
  const name = c?.city_name_ar || city
  return {
    title: `عقارات ${name} | تمكين عقار`,
    description: `أحدث العقارات الموثّقة للبيع والإيجار في ${name} — شقق، فلل، أراضٍ والمزيد.`,
  }
}

export default async function CityPage({ params }: any) {
  const { city } = await params
  const cityName = decodeURIComponent(city)
  const [c, res, districts] = await Promise.all([
    resolveCity(cityName),
    store.search({ city: cityName, sort: 'newest', limit: 24 }),
    store.districts(cityName),
  ])
  if (!c) notFound()   // unknown city → real 404 (no soft-404 for SEO)
  const display = c?.city_name_ar || cityName
  const listings: ListingSearchResult[] = (res?.results as any) || []

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-3 text-sm text-[var(--aqar-kohl)]/50">
        <Link href="/" className="hover:underline">الرئيسية</Link> ‹ <span className="text-[var(--aqar-kohl)]">{display}</span>
      </nav>
      <h1 className="aqar-display text-3xl text-[var(--aqar-green-d)]">عقارات {display}</h1>

      {(districts || []).length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {(districts || []).slice(0, 24).map((d: any) => (
            <Link key={d.name} href={`/${encodeURIComponent(cityName)}/${encodeURIComponent(d.name)}`} className="aqar-chip">{d.district_name_ar}</Link>
          ))}
        </div>
      )}

      <div className="mt-6">
        {listings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--aqar-sand-2)] p-12 text-center text-[var(--aqar-kohl)]/50">لا توجد عروض في {display} حالياً</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {listings.map((l) => <StoreListingCard key={l.name} l={l} />)}
          </div>
        )}
      </div>
    </div>
  )
}
