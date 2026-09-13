'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import CityCombobox from './city-combobox'
import type { CityWithCount } from '@/lib/real-estate-api'

const FIELD =
  'rounded-xl border border-[var(--aqar-sand-2)] bg-[var(--aqar-surface)] px-3 py-2 text-sm text-[var(--aqar-kohl)] outline-none focus:border-[var(--aqar-green)]'

const TYPES: [string, string][] = [['Sale', 'للبيع'], ['Rent', 'للإيجار'], ['Daily Rent', 'إيجار يومي']]
const SORTS: [string, string][] = [['', 'الأنسب'], ['yield', 'الأعلى عائداً'], ['ppsqm', 'الأقل سعراً/م²']]

interface Props {
  city?: string
  category?: string
  listingType?: string
  priceMin?: string
  priceMax?: string
  minYield?: string
  sort?: string
  categories: { name: string; category_name_ar: string }[]
}

/** Investment-hub filter bar — city, category, purpose, price range, min gross yield, sort.
 *  Filters stack and sync to the URL (server re-renders), consistent with the rest of /store. */
export default function InvestmentFilters({ city, category, listingType, priceMin, priceMax, minYield, sort, categories }: Props) {
  const router = useRouter()
  const deb = useRef<ReturnType<typeof setTimeout>>()
  const [pMin, setPMin] = useState(priceMin || '')
  const [pMax, setPMax] = useState(priceMax || '')
  const [mY, setMY] = useState(minYield || '')

  const current: Record<string, string | undefined> = {
    city, category, listing_type: listingType, price_min: priceMin, price_max: priceMax, min_yield: minYield, sort,
  }
  const nav = (patch: Record<string, string | null>) => {
    const next = { ...current, ...patch }
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(next)) {
      if (!v) continue
      if (k === 'listing_type' && v === 'Sale') continue // Sale is the default; keep URLs clean
      p.set(k, String(v))
    }
    const qs = p.toString()
    router.push(qs ? `/investment?${qs}` : '/investment')
  }
  const navDebounced = (patch: Record<string, string | null>) => {
    clearTimeout(deb.current)
    deb.current = setTimeout(() => nav(patch), 500)
  }
  const onlyDigits = (s: string) => s.replace(/[^\d]/g, '')

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-8">
      <div className="col-span-2 lg:col-span-2">
        <CityCombobox value={city} onPick={(c: CityWithCount) => nav({ city: c.name })} onClear={() => nav({ city: null })} />
      </div>
      <select className={FIELD} value={category || ''} onChange={(e) => nav({ category: e.target.value || null })}>
        <option value="">كل الأقسام</option>
        {categories.map((c) => <option key={c.name} value={c.name}>{c.category_name_ar}</option>)}
      </select>
      <select className={FIELD} value={listingType || 'Sale'} onChange={(e) => nav({ listing_type: e.target.value })}>
        {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <input className={FIELD} dir="ltr" inputMode="numeric" placeholder="أقل سعر" value={pMin}
        onChange={(e) => { const v = onlyDigits(e.target.value); setPMin(v); navDebounced({ price_min: v || null }) }} />
      <input className={FIELD} dir="ltr" inputMode="numeric" placeholder="أعلى سعر" value={pMax}
        onChange={(e) => { const v = onlyDigits(e.target.value); setPMax(v); navDebounced({ price_max: v || null }) }} />
      <input className={FIELD} dir="ltr" inputMode="numeric" placeholder="أدنى عائد %" value={mY}
        onChange={(e) => { const v = onlyDigits(e.target.value); setMY(v); navDebounced({ min_yield: v || null }) }} />
      <select className={FIELD} value={sort || ''} onChange={(e) => nav({ sort: e.target.value || null })}>
        {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
}
