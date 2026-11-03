import Link from 'next/link'
import { notFound } from 'next/navigation'
import { store } from '@/lib/frappe-server'
import StoreListingCard from '@/components/store/listing-card'
import type { ListingSearchResult } from '@/lib/real-estate-api'

export const revalidate = 120

export async function generateMetadata({ params }: any) {
  const { city, district } = await params
  const [cities, dists] = await Promise.all([store.cities(), store.districts(decodeURIComponent(city))])
  const c = (cities || []).find((x: any) => x.name === decodeURIComponent(city))
  const d = (dists || []).find((x: any) => x.name === decodeURIComponent(district))
  const dn = d?.district_name_ar || district
  const cn = c?.city_name_ar || city
  return {
    title: `عقارات ${dn}، ${cn} | تمكين عقار`,
    description: `عقارات موثّقة للبيع والإيجار في ${dn} بمدينة ${cn}.`,
  }
}

export default async function DistrictPage({ params }: any) {
  const { city, district } = await params
  const cityName = decodeURIComponent(city)
  const districtName = decodeURIComponent(district)
  const [cities, dists, res] = await Promise.all([
    store.cities(),
    store.districts(cityName),
    store.search({ city: cityName, district: districtName, sort: 'newest', limit: 24 }),
  ])
  const c = (cities || []).find((x: any) => x.name === cityName)
  const d = (dists || []).find((x: any) => x.name === districtName)
  if (!c || !d) notFound()   // unknown city/district → real 404
  const cn = c?.city_name_ar || cityName
  const dn = d?.district_name_ar || districtName
  const listings: ListingSearchResult[] = (res?.results as any) || []

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-3 text-sm text-[var(--aqar-kohl)]/50">
        <Link href="/" className="hover:underline">الرئيسية</Link> ‹{' '}
        <Link href={`/${encodeURIComponent(cityName)}`} className="hover:underline">{cn}</Link> ‹{' '}
        <span className="text-[var(--aqar-kohl)]">{dn}</span>
      </nav>
      <h1 className="aqar-display text-3xl text-[var(--aqar-green-d)]">عقارات {dn}</h1>
      <p className="mt-1 text-[var(--aqar-kohl)]/60">{cn}</p>

      <div className="mt-6">
        {listings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--aqar-sand-2)] p-12 text-center text-[var(--aqar-kohl)]/50">لا توجد عروض في {dn} حالياً</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {listings.map((l) => <StoreListingCard key={l.name} l={l} />)}
          </div>
        )}
      </div>
    </div>
  )
}
