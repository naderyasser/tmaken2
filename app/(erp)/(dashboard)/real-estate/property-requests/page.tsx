'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import {
  realEstateApi, type AqarPropertyRequest, type AqarCategory, type GeoItem, type ListingSearchResult,
} from '@/lib/real-estate-api'
import { formatPrice } from '@/lib/aqar-format'
import { Search, Plus, Trash2, Bell, BellOff, ChevronDown, Loader2, X } from 'lucide-react'

const TYPE_LABEL: Record<string, string> = { Sale: 're.typeSale', Rent: 're.typeRent', 'Daily Rent': 're.typeDailyRent' }

export default function PropertyRequestsPage() {
  const { t, lang } = useI18n()
  const router = useRouter()
  const L = lang as 'ar' | 'en'

  const [requests, setRequests] = useState<AqarPropertyRequest[]>([])
  const [categories, setCategories] = useState<AqarCategory[]>([])
  const [regions, setRegions] = useState<GeoItem[]>([])
  const [cities, setCities] = useState<GeoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [matches, setMatches] = useState<Record<string, ListingSearchResult[]>>({})
  const [expanded, setExpanded] = useState<string | null>(null)

  const [form, setForm] = useState<AqarPropertyRequest & { region?: string }>({
    title: '', category: '', listing_type: '', region: '', city: '', district: '',
    price_min: undefined, price_max: undefined, area_min: undefined, area_max: undefined,
    bedrooms_min: undefined, notify_on_match: 1,
  })

  const load = async () => {
    setLoading(true)
    try { setRequests(await realEstateApi.listMyPropertyRequests()) } finally { setLoading(false) }
  }
  useEffect(() => {
    load()
    realEstateApi.listCategories().then((c) => setCategories(c.filter((x) => !x.is_group))).catch(() => {})
    realEstateApi.listRegions().then(setRegions).catch(() => {})
  }, [])
  useEffect(() => { if (form.region) realEstateApi.listCities(form.region).then(setCities).catch(() => {}) }, [form.region])

  const create = async () => {
    setBusy(true)
    try {
      const { region, ...payload } = form
      await realEstateApi.createPropertyRequest(payload)
      setShowForm(false)
      setForm({ title: '', category: '', listing_type: '', region: '', city: '', district: '', notify_on_match: 1 })
      await load()
    } finally { setBusy(false) }
  }
  const remove = async (name: string) => {
    setBusy(true)
    try { await realEstateApi.deletePropertyRequest(name); await load() } finally { setBusy(false) }
  }
  const loadMatches = async (name: string) => {
    if (expanded === name) { setExpanded(null); return }
    setExpanded(name)
    if (!matches[name]) {
      const m = await realEstateApi.getRequestMatches(name).catch(() => [])
      setMatches((p) => ({ ...p, [name]: m }))
    }
  }

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }))
  const catLabel = (c: AqarCategory) => (L === 'ar' ? c.category_name_ar : c.category_name_en)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('re.propertyRequests')}</h1>
        <button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{t('re.newRequest')}
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border-2 border-emerald-100 bg-white p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input className="inp" placeholder={t('re.requestLabel')} value={form.title || ''} onChange={(e) => set('title', e.target.value)} />
            <select className="inp" value={form.category || ''} onChange={(e) => set('category', e.target.value)}>
              <option value="">{t('re.category')}</option>{categories.map((c) => <option key={c.name} value={c.name}>{catLabel(c)}</option>)}
            </select>
            <select className="inp" value={form.listing_type || ''} onChange={(e) => set('listing_type', e.target.value)}>
              <option value="">{t('re.listingType')}</option>{Object.keys(TYPE_LABEL).map((ty) => <option key={ty} value={ty}>{t(TYPE_LABEL[ty])}</option>)}
            </select>
            <select className="inp" value={form.region || ''} onChange={(e) => { set('region', e.target.value); set('city', '') }}>
              <option value="">{t('re.region')}</option>{regions.map((r) => <option key={r.name} value={r.name}>{L === 'ar' ? r.region_name_ar : r.region_name_en}</option>)}
            </select>
            <select className="inp" value={form.city || ''} onChange={(e) => set('city', e.target.value)} disabled={!form.region}>
              <option value="">{t('re.city')}</option>{cities.map((c) => <option key={c.name} value={c.name}>{L === 'ar' ? c.city_name_ar : c.city_name_en}</option>)}
            </select>
            <input className="inp" type="number" dir="ltr" placeholder={t('re.minBedrooms')} value={form.bedrooms_min ?? ''} onChange={(e) => set('bedrooms_min', e.target.value ? Number(e.target.value) : undefined)} />
            <input className="inp" type="number" dir="ltr" placeholder={t('re.minPrice')} value={form.price_min ?? ''} onChange={(e) => set('price_min', e.target.value ? Number(e.target.value) : undefined)} />
            <input className="inp" type="number" dir="ltr" placeholder={t('re.maxPrice')} value={form.price_max ?? ''} onChange={(e) => set('price_max', e.target.value ? Number(e.target.value) : undefined)} />
            <input className="inp" type="number" dir="ltr" placeholder={t('re.minArea')} value={form.area_min ?? ''} onChange={(e) => set('area_min', e.target.value ? Number(e.target.value) : undefined)} />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={!!form.notify_on_match} onChange={(e) => set('notify_on_match', e.target.checked ? 1 : 0)} />
              {t('re.notifyOnMatch')}
            </label>
            <button onClick={create} disabled={busy} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{t('re.save')}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-100" />)}</div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center text-gray-400">
          <Search className="mx-auto mb-3 h-8 w-8 text-gray-300" />{t('re.noListings')}
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.name} className="rounded-2xl border-2 border-gray-100 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-semibold text-gray-900">
                    {r.title || r.name}
                    {r.notify_on_match ? <Bell className="h-3.5 w-3.5 text-emerald-600" /> : <BellOff className="h-3.5 w-3.5 text-gray-300" />}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                    {r.listing_type && <span>{t(TYPE_LABEL[r.listing_type])}</span>}
                    {r.city && <span>· {r.city}</span>}
                    {r.price_max ? <span>· ≤ {formatPrice(r.price_max, L)}</span> : null}
                    {r.bedrooms_min ? <span>· {r.bedrooms_min}+ {t('re.bedrooms')}</span> : null}
                  </p>
                </div>
                <button onClick={() => remove(r.name!)} disabled={busy} className="text-gray-300 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
              </div>
              <button onClick={() => loadMatches(r.name!)} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
                {t('re.matches')} <ChevronDown className={`h-4 w-4 transition-transform ${expanded === r.name ? 'rotate-180' : ''}`} />
              </button>
              {expanded === r.name && (
                <div className="mt-2 space-y-2 border-t border-gray-100 pt-2">
                  {(matches[r.name!] || []).length === 0 ? <p className="text-xs text-gray-400">—</p> : matches[r.name!].map((m) => (
                    <button key={m.name} onClick={() => router.push(`/real-estate/listings/${m.name}`)} className="flex w-full items-center justify-between rounded-xl bg-gray-50 p-2 text-start text-sm hover:bg-emerald-50">
                      <span className="font-medium text-gray-800">{m.title}</span>
                      <span className="text-emerald-700">{formatPrice(m.price, L, m.listing_type)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style jsx>{`:global(.inp){width:100%;border:1px solid #e5e7eb;border-radius:0.75rem;padding:0.5rem 0.75rem;font-size:0.875rem;outline:none}:global(.inp:focus){border-color:#34d399}`}</style>
    </div>
  )
}
