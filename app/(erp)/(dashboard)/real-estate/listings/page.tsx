'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import {
  realEstateApi, type AqarListing, type AqarCategory, type GeoItem, type FrappeFilter,
} from '@/lib/real-estate-api'
import { formatPrice, timeAgo } from '@/lib/aqar-format'
import { Building2, Plus, Search, MapPin, BedDouble, Maximize, Filter } from 'lucide-react'

const STATUS_TONES: Record<string, string> = {
  Active: 'bg-emerald-100 text-emerald-800',
  Draft: 'bg-gray-100 text-gray-700',
  'Pending License': 'bg-amber-100 text-amber-800',
  Expired: 'bg-orange-100 text-orange-800',
  Rejected: 'bg-red-100 text-red-700',
  Sold: 'bg-blue-100 text-blue-700',
}

const STATUS_LABEL: Record<string, string> = {
  Active: 're.statusActive', Draft: 're.statusDraft', 'Pending License': 're.statusPending',
  Expired: 're.statusExpired', Rejected: 're.statusRejected', Sold: 're.statusSold',
}

const TYPE_LABEL: Record<string, string> = { Sale: 're.typeSale', Rent: 're.typeRent', 'Daily Rent': 're.typeDailyRent' }

export default function ListingsPage() {
  const { t, lang, isRTL } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const L = lang as 'ar' | 'en'

  const [listings, setListings] = useState<AqarListing[]>([])
  const [categories, setCategories] = useState<AqarCategory[]>([])
  const [regions, setRegions] = useState<GeoItem[]>([])
  const [cities, setCities] = useState<GeoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [fStatus, setFStatus] = useState(searchParams.get('status') || '')
  const [fCategory, setFCategory] = useState('')
  const [fType, setFType] = useState('')
  const [fRegion, setFRegion] = useState('')
  const [fCity, setFCity] = useState('')
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    realEstateApi.listCategories().then((c) => setCategories(c.filter((x) => !x.is_group))).catch(() => {})
    realEstateApi.listRegions().then(setRegions).catch(() => {})
  }, [])

  useEffect(() => {
    if (!fRegion) { setCities([]); setFCity(''); return }
    realEstateApi.listCities(fRegion).then(setCities).catch(() => {})
  }, [fRegion])

  const filters = useMemo<FrappeFilter[]>(() => {
    const f: FrappeFilter[] = []
    if (fStatus) f.push(['Aqar Listing', 'status', '=', fStatus])
    if (fCategory) f.push(['Aqar Listing', 'category', '=', fCategory])
    if (fType) f.push(['Aqar Listing', 'listing_type', '=', fType])
    if (fCity) f.push(['Aqar Listing', 'city', '=', fCity])
    if (keyword) f.push(['Aqar Listing', 'title', 'like', `%${keyword}%`])
    return f
  }, [fStatus, fCategory, fType, fCity, keyword])

  const load = async () => {
    setLoading(true); setError(null)
    try {
      setListings(await realEstateApi.getListings({ filters }))
    } catch (e: any) {
      setError(e?.message || t('re.error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const id = setTimeout(load, 250)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  const catName = (name?: string) => {
    const c = categories.find((x) => x.name === name)
    return c ? (L === 'ar' ? c.category_name_ar : c.category_name_en) : name
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('re.listings')}</h1>
        <button
          onClick={() => router.push('/real-estate/listings/new')}
          className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          <Plus className="h-4 w-4" />{t('re.newListing')}
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border-2 border-gray-100 bg-white p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-500">
          <Filter className="h-4 w-4" />{t('re.filters')}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute inset-y-0 my-auto h-4 w-4 text-gray-400 ms-3" />
            <input
              value={keyword} onChange={(e) => setKeyword(e.target.value)}
              placeholder={t('re.search')}
              className="w-full rounded-xl border border-gray-200 py-2 ps-9 pe-3 text-sm outline-none focus:border-emerald-400"
            />
          </div>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
            <option value="">{t('re.all')} — {t('re.statusActive')}…</option>
            {Object.keys(STATUS_LABEL).map((s) => <option key={s} value={s}>{t(STATUS_LABEL[s])}</option>)}
          </select>
          <select value={fType} onChange={(e) => setFType(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
            <option value="">{t('re.all')} — {t('re.listingType')}</option>
            {Object.keys(TYPE_LABEL).map((ty) => <option key={ty} value={ty}>{t(TYPE_LABEL[ty])}</option>)}
          </select>
          <select value={fCategory} onChange={(e) => setFCategory(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
            <option value="">{t('re.all')} — {t('re.category')}</option>
            {categories.map((c) => <option key={c.name} value={c.name}>{L === 'ar' ? c.category_name_ar : c.category_name_en}</option>)}
          </select>
          <select value={fRegion} onChange={(e) => setFRegion(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
            <option value="">{t('re.all')} — {t('re.region')}</option>
            {regions.map((r) => <option key={r.name} value={r.name}>{L === 'ar' ? r.region_name_ar : r.region_name_en}</option>)}
          </select>
          <select value={fCity} onChange={(e) => setFCity(e.target.value)} disabled={!fRegion} className="rounded-xl border border-gray-200 px-3 py-2 text-sm disabled:opacity-50">
            <option value="">{t('re.all')} — {t('re.city')}</option>
            {cities.map((c) => <option key={c.name} value={c.name}>{L === 'ar' ? c.city_name_ar : c.city_name_en}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error} · <button onClick={load} className="font-semibold underline">{t('re.retry')}</button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-44 animate-pulse rounded-2xl bg-gray-100" />)}
        </div>
      ) : listings.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center text-gray-500">
          <Building2 className="mx-auto mb-3 h-8 w-8 text-gray-300" />
          {t('re.noListings')}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <button
              key={l.name}
              onClick={() => router.push(`/real-estate/listings/${l.name}`)}
              className="group rounded-2xl border-2 border-gray-100 bg-white p-4 text-start transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="line-clamp-1 font-bold text-gray-900">{l.title}</h3>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONES[l.status || 'Draft']}`}>
                  {t(STATUS_LABEL[l.status || 'Draft'])}
                </span>
              </div>
              <p className="mb-3 text-lg font-bold text-emerald-700">{formatPrice(l.price, L, l.listing_type)}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{l.city || '—'}</span>
                {l.bedrooms != null && <span className="inline-flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" />{l.bedrooms}</span>}
                {l.area_sqm != null && <span className="inline-flex items-center gap-1"><Maximize className="h-3.5 w-3.5" />{l.area_sqm} م²</span>}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                <span>{catName(l.category)}</span>
                <span>{timeAgo(l.creation, L)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
