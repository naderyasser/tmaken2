'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import nextDynamic from 'next/dynamic'
import { Star, X, Map as MapIcon, List } from 'lucide-react'
import { realEstateApi, type ListingSearchResult, type CityWithCount } from '@/lib/real-estate-api'
import { formatPrice } from '@/lib/aqar-format'
import { getGsap, prefersReducedMotion } from '@/lib/motion'
import type { MapBounds, FlyTo } from './price-pin-map'
import ListingImage from '@/components/store/listing-image'
import ListingContact from './listing-contact'
import FavoriteButton from '@/components/store/favorite-button'
import CompareButton from '@/components/store/compare-button'
import SaveSearchButton from '@/components/store/save-search-button'
import SearchFilters, { type FilterState } from './search-filters'

const PricePinMap = nextDynamic(() => import('./price-pin-map'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[var(--aqar-sand-2)]" />,
})

// Build a clean /search query string from the active filters (omit empties + default sort).
function buildQS(f: FilterState): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(f)) {
    if (v == null || v === '') continue
    if (k === 'sort' && v === 'newest') continue
    p.set(k, String(v))
  }
  return p.toString()
}

export default function MapSearch({ initial, initialCount, filters: initialFilters, categories }: {
  initial: ListingSearchResult[]
  initialCount: number
  filters: FilterState
  categories: { name: string; category_name_ar: string }[]
}) {
  const [items, setItems] = useState(initial)
  const [filters, setFilters] = useState<FilterState>(initialFilters)
  const [active, setActive] = useState<string | null>(null)
  const [selected, setSelected] = useState<ListingSearchResult | null>(null)
  const [searchOnMove, setSearchOnMove] = useState(true)
  const [mobileMap, setMobileMap] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fitKey, setFitKey] = useState(0)
  const [flyTo, setFlyTo] = useState<FlyTo | null>(null)
  const [nearMe, setNearMe] = useState<'idle' | 'locating' | 'denied'>('idle')
  const listRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const filtersRef = useRef(initialFilters)   // current filters for the (stable) onMove callback
  const forceMoveRef = useRef(false)           // run the next moveend search even if searchOnMove is off
  const debRef = useRef<ReturnType<typeof setTimeout>>()
  // One in-flight search at a time across BOTH paths (filters + map pan): starting a new
  // search aborts the previous one, so the latest query always wins and a slow earlier
  // response can never overwrite fresher results.
  const searchAbortRef = useRef<AbortController | null>(null)
  const nextSearchSignal = useCallback(() => {
    searchAbortRef.current?.abort()
    const ctrl = new AbortController()
    searchAbortRef.current = ctrl
    return ctrl.signal
  }, [])

  // Re-query with the given filters, sync the URL (shareable, no remount), update list + map.
  const applyFilters = useCallback(async (next: FilterState, refit: boolean) => {
    setFilters(next)
    filtersRef.current = next
    const qs = buildQS(next)
    window.history.replaceState(null, '', qs ? `/search?${qs}` : '/search')
    const signal = nextSearchSignal()
    setLoading(true)
    try {
      const r = await realEstateApi.searchListings({ ...next, limit: 50 } as any, signal)
      if (signal.aborted) return
      const results = r?.results || []
      setItems(results)
      if (refit) setFitKey((k) => k + 1)
    } catch (e) {
      if ((e as any)?.name === 'AbortError') return   // superseded by a newer search
      /* keep previous */
    } finally {
      if (!signal.aborted) setLoading(false)           // a newer search now owns `loading`
    }
  }, [nextSearchSignal])

  // Field edits: text inputs debounce; selects / city apply immediately. Inputs stay responsive.
  const onChange = useCallback((patch: Partial<FilterState>) => {
    const next = { ...filtersRef.current, ...patch }
    setFilters(next)
    filtersRef.current = next
    const isText = 'keyword' in patch || 'price_min' in patch || 'price_max' in patch || 'area_min' in patch || 'area_max' in patch
    clearTimeout(debRef.current)
    if (isText) debRef.current = setTimeout(() => applyFilters(next, true), 350)
    else applyFilters(next, true)
  }, [applyFilters])

  const onCityPick = useCallback((city: CityWithCount) => {
    // picking a city supersedes any inherited district/region; refit frames the city's listings
    applyFilters({ ...filtersRef.current, city: city.name, district: '', region: '' }, true)
  }, [applyFilters])

  const onClearCity = useCallback(() => {
    applyFilters({ ...filtersRef.current, city: '', district: '', region: '' }, true)
  }, [applyFilters])

  const clearFilters = useCallback(() => applyFilters({ sort: 'newest' }, true), [applyFilters])

  // Empty-in-bounds recovery: turn off map-bounds filtering and re-run the full (filters-only) search,
  // so listings outside the current viewport reappear. Keeps the active filters.
  const expandSearch = useCallback(() => {
    setSearchOnMove(false)
    applyFilters(filtersRef.current, true)
  }, [applyFilters])

  const onNearMe = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setNearMe('denied'); return }
    setNearMe('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNearMe('idle')
        forceMoveRef.current = true   // ensure the post-fly moveend loads nearby listings
        setSearchOnMove(true)
        setFlyTo({ lat: pos.coords.latitude, lng: pos.coords.longitude, zoom: 13, key: Date.now() })
      },
      () => {
        setNearMe('denied')
        // graceful fallback: if «الأقرب» sort was chosen, revert to «الأحدث»
        if (filtersRef.current.sort === 'nearest') applyFilters({ ...filtersRef.current, sort: 'newest' }, false)
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    )
  }, [applyFilters])

  // Sort: backend sorts (newest/price_*) re-query; «الأقرب» requests geolocation (URL still reflects it).
  // canGeo is gated behind mount so SSR and the first client render emit the SAME <select> options
  // (geolocation is client-only) — otherwise the extra «الأقرب» option causes a hydration mismatch (#418).
  const [canGeo, setCanGeo] = useState(false)
  useEffect(() => { setCanGeo(typeof navigator !== 'undefined' && !!navigator.geolocation) }, [])
  // «جديد» depends on Date.now(); only mark after mount so SSR and first client render agree (no #418).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isNew = (c?: string) => mounted && !!c && (Date.now() - new Date(c).getTime()) <= 7 * 86_400_000
  const onSort = useCallback((sort: string) => {
    if (sort === 'nearest') {
      const next = { ...filtersRef.current, sort: 'nearest' }
      setFilters(next); filtersRef.current = next
      window.history.replaceState(null, '', `/search?${buildQS(next)}`)
      onNearMe()
    } else {
      applyFilters({ ...filtersRef.current, sort }, true)
    }
  }, [applyFilters, onNearMe])

  // search-as-you-move: bounds + the CURRENT filters (keeps all filters stacking)
  const onMove = useCallback(async (b: MapBounds) => {
    if (!searchOnMove && !forceMoveRef.current) return
    forceMoveRef.current = false
    const signal = nextSearchSignal()
    setLoading(true)
    try {
      const r = await realEstateApi.searchInBounds({ ...filtersRef.current, ...b }, signal)
      if (signal.aborted) return
      setItems(r.results)
    } catch (e) {
      if ((e as any)?.name === 'AbortError') return   // superseded by a newer search
      /* keep previous */
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [searchOnMove, nextSearchSignal])

  // pin/list hover → scroll the active card into view
  useEffect(() => {
    if (!active || !listRef.current) return
    const el = listRef.current.querySelector(`[data-id="${active}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [active])

  // compact card slide-up on pin click
  useEffect(() => {
    if (!selected || !cardRef.current || prefersReducedMotion()) return
    let alive = true
    getGsap().then((g) => { if (alive) g.fromTo(cardRef.current, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'power3.out' }) })
    return () => { alive = false }
  }, [selected])

  const onPinClick = (id: string) => { setActive(id); setSelected(items.find((x) => x.name === id) || null) }

  const TheMap = (
    <PricePinMap items={items} active={active} onHover={setActive} onClick={onPinClick} onMove={onMove} searchOnMove={searchOnMove} fitKey={fitKey} flyTo={flyTo} />
  )

  return (
    <>
      <SearchFilters
        value={filters}
        categories={categories}
        nearMe={nearMe}
        onChange={onChange}
        onCityPick={onCityPick}
        onClearCity={onClearCity}
        onNearMe={onNearMe}
        onClearAll={clearFilters}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* results list (start side) */}
        <div ref={listRef} className="order-2 max-h-[calc(100vh-180px)] space-y-2 overflow-y-auto pe-1 lg:order-1">
          <div className="sticky top-0 z-10 -mx-1 mb-1 flex items-center justify-between gap-2 bg-[var(--aqar-sand)]/90 px-1 py-2 backdrop-blur">
            <p className="text-sm text-[var(--aqar-kohl)]/70">
              <span className="font-bold tabular-nums text-[var(--aqar-green-d)]">{items.length}</span> عقار
              {loading && <span className="ms-2 text-xs text-[var(--aqar-kohl)]/40">…تحديث</span>}
            </p>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <SaveSearchButton query={Object.fromEntries(Object.entries(filters).filter(([k, v]) => v && !(k === 'sort' && v === 'newest'))) as Record<string, string>} />
              <Link href="/saved-searches" className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl px-2 text-xs font-medium text-[var(--aqar-green-d)] hover:underline">المحفوظة</Link>
              <label className="flex items-center gap-1.5 text-xs text-[var(--aqar-kohl)]/60">
                <span className="hidden sm:inline">ترتيب</span>
                <select
                  value={filters.sort || 'newest'}
                  onChange={(e) => onSort(e.target.value)}
                  aria-label="ترتيب النتائج"
                  className="min-h-[36px] rounded-xl border border-[var(--aqar-sand-2)] bg-[var(--aqar-surface)] px-2 py-1 text-xs text-[var(--aqar-kohl)] outline-none focus:border-[var(--aqar-green)]"
                >
                  <option value="newest">الأحدث</option>
                  <option value="price_asc">الأقل سعراً</option>
                  <option value="price_desc">الأعلى سعراً</option>
                  {canGeo && <option value="nearest">الأقرب</option>}
                </select>
              </label>
            </div>
          </div>
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--aqar-sand-2)] p-8 text-center">
              {searchOnMove ? (
                <>
                  <p className="text-[var(--aqar-kohl)]/70">ما فيه عروض داخل حدود الخريطة الحالية.</p>
                  <p className="mt-1 text-sm text-[var(--aqar-kohl)]/50">قد تكون هناك عروض خارج النطاق الظاهر — وسّع البحث أو امسح الفلاتر.</p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <button onClick={expandSearch} className="aqar-btn">توسيع نطاق البحث</button>
                    <button onClick={clearFilters} className="aqar-btn aqar-btn-outline">مسح الفلاتر</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[var(--aqar-kohl)]/70">ما لقينا عروض بهذي الفلاتر.</p>
                  <p className="mt-1 text-sm text-[var(--aqar-kohl)]/50">جرّب توسيع البحث أو امسح الفلاتر وابدأ من جديد.</p>
                  <button onClick={clearFilters} className="aqar-btn mt-4">مسح الفلاتر</button>
                </>
              )}
            </div>
          ) : items.map((l) => (
            <div
              key={l.name} data-id={l.name}
              onMouseEnter={() => setActive(l.name)} onMouseLeave={() => setActive(null)}
              className={`flex items-stretch gap-2 rounded-2xl border-2 bg-[var(--aqar-surface)] p-2 transition-colors ${active === l.name ? 'border-[var(--aqar-green)]' : 'border-[var(--aqar-border)]'}`}
            >
              <Link href={`/listing/${l.name}`} className="flex min-w-0 flex-1 gap-3">
                <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-[var(--aqar-sand-2)]">
                  <ListingImage src={l.primary_image} alt={l.title} iconClassName="h-6 w-6" showLabel={false} />
                  <div className="absolute top-1 flex flex-col gap-0.5" style={{ insetInlineStart: '0.25rem' }}>
                    {l.is_featured ? <span className="rounded-full bg-[var(--aqar-gold)] px-1.5 py-0.5 text-[9px] font-bold text-white"><Star className="inline h-2.5 w-2.5" /></span> : null}
                    {isNew(l.creation) ? <span className="self-start rounded-full bg-[var(--aqar-green)] px-1.5 py-0.5 text-[9px] font-bold text-white">جديد</span> : null}
                  </div>
                  <span className="absolute bottom-0.5" style={{ insetInlineEnd: '0.125rem' }}><FavoriteButton listing={l} className="h-7 w-7" /></span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium text-[var(--aqar-kohl)]">{l.title}</p>
                  <p className="line-clamp-1 text-[11px] text-[var(--aqar-kohl)]/50">{l.district_name_ar || l.city_name_ar || ''}</p>
                  <p className="mt-1 text-sm font-bold tabular-nums text-[var(--aqar-green-d)]">{formatPrice(l.price, 'ar', l.listing_type)}</p>
                </div>
              </Link>
              <div className="flex flex-col items-center justify-center gap-1.5">
                <ListingContact listing={l.name} variant="wa-icon" />
                <CompareButton listing={l} />
              </div>
            </div>
          ))}
        </div>

        {/* map (end side, sticky on desktop; full-screen on mobile via the pill) */}
        <div className={`order-1 lg:order-2 ${mobileMap ? 'fixed inset-0 z-50' : 'relative h-[42vh] lg:sticky lg:top-20 lg:h-[calc(100vh-200px)] lg:max-h-[780px]'} overflow-hidden rounded-2xl border border-[var(--aqar-border)]`}>
          {TheMap}
          {/* search-as-you-move toggle */}
          <label className="absolute top-2 z-[400] flex items-center gap-1.5 rounded-full border border-[var(--aqar-border)] bg-[var(--aqar-surface)]/95 px-3 py-1.5 text-xs text-[var(--aqar-kohl)] shadow" style={{ insetInlineStart: '0.5rem' }}>
            <input type="checkbox" checked={searchOnMove} onChange={(e) => setSearchOnMove(e.target.checked)} />البحث عند تحريك الخريطة
          </label>
          {mobileMap && (
            <button onClick={() => setMobileMap(false)} className="absolute top-2 z-[400] flex h-9 w-9 items-center justify-center rounded-full bg-[var(--aqar-surface)] text-[var(--aqar-kohl)] shadow lg:hidden" style={{ insetInlineEnd: '0.5rem' }}><X className="h-4 w-4" /></button>
          )}
          {/* compact card slide-up on pin click */}
          {selected && (
            <div ref={cardRef} className="absolute inset-x-3 bottom-3 z-[400] flex gap-3 rounded-2xl border border-[var(--aqar-border)] bg-[var(--aqar-surface)] p-2.5 shadow-xl">
              <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-[var(--aqar-sand-2)]">
                <ListingImage src={selected.primary_image} alt={selected.title} iconClassName="h-6 w-6" showLabel={false} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-medium text-[var(--aqar-kohl)]">{selected.title}</p>
                <p className="line-clamp-1 text-[11px] text-[var(--aqar-kohl)]/50">{selected.district_name_ar || selected.city_name_ar || ''}</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-[var(--aqar-green-d)]">{formatPrice(selected.price, 'ar', selected.listing_type)}</p>
                <Link href={`/listing/${selected.name}`} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[var(--aqar-green)] hover:underline">عرض التفاصيل ←</Link>
                <ListingContact listing={selected.name} className="mt-1.5" />
                <div className="mt-1.5"><CompareButton listing={selected} /></div>
              </div>
              <button onClick={() => setSelected(null)} className="absolute top-1.5 text-[var(--aqar-kohl)]/40 hover:text-[var(--aqar-kohl)]" style={{ insetInlineEnd: '0.5rem' }}><X className="h-4 w-4" /></button>
            </div>
          )}
        </div>

        {/* mobile floating toggle pill */}
        <button onClick={() => setMobileMap((v) => !v)} className="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[var(--aqar-green)] px-5 py-2.5 text-sm font-semibold text-white shadow-lg lg:hidden">
          {mobileMap ? <><List className="h-4 w-4" />القائمة</> : <><MapIcon className="h-4 w-4" />الخريطة</>}
        </button>
      </div>
    </>
  )
}
