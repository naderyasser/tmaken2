'use client'

import { useEffect, useState } from 'react'
import { LocateFixed, Loader2, SlidersHorizontal, ChevronDown, X } from 'lucide-react'
import CityCombobox from './city-combobox'
import { realEstateApi, type CityWithCount } from '@/lib/real-estate-api'

export interface FilterState {
  keyword?: string
  category?: string
  listing_type?: string
  city?: string
  district?: string
  region?: string
  price_min?: string
  price_max?: string
  area_min?: string
  area_max?: string
  bedrooms_min?: string
  bathrooms_min?: string
  age_max?: string
  facade?: string
  furnished?: string
  floor_level?: string
  services?: string // CSV of Aqar Property Service names (English), e.g. "Pool,Elevator"
  sort?: string
}

const TYPES: [string, string][] = [['', 'كل الأنواع'], ['Sale', 'للبيع'], ['Rent', 'للإيجار'], ['Daily Rent', 'إيجار يومي']]
const ROOMS: [string, string][] = [['', 'كل الغرف'], ['1', '+1'], ['2', '+2'], ['3', '+3'], ['4', '+4'], ['5', '+5']]
const BATHS: [string, string][] = [['', 'كل الدورات'], ['1', '+1'], ['2', '+2'], ['3', '+3'], ['4', '+4']]
const AGES: [string, string][] = [['', 'أي عمر'], ['3', 'أقل من 3 سنوات'], ['5', 'أقل من 5 سنوات'], ['10', 'أقل من 10 سنوات'], ['20', 'أقل من 20 سنة']]
const FURNISHED: [string, string][] = [['', 'الفرش (الكل)'], ['مفروش', 'مفروش'], ['مفروش جزئياً', 'مفروش جزئياً'], ['غير مفروش', 'غير مفروش']]
const FLOORS: [string, string][] = [['', 'الدور (الكل)'], ['أرضي', 'أرضي'], ['أول', 'أول'], ['ثاني', 'ثاني'], ['ثالث', 'ثالث'], ['رابع', 'رابع'], ['خامس فأعلى', 'خامس فأعلى'], ['ملحق سطح', 'ملحق سطح']]
// Full doctype facade option list (kept in lock-step with aqar_listing.json).
const FACADES = ['شمالية', 'جنوبية', 'شرقية', 'غربية', 'شمالية شرقية', 'شمالية غربية', 'جنوبية شرقية', 'جنوبية غربية', 'ثلاث شوارع', 'أربع شوارع', 'واجهتين', 'ثلاث واجهات', 'أربع واجهات']

const FIELD =
  'min-h-[44px] w-full rounded-xl border border-[var(--aqar-sand-2)] bg-[var(--aqar-surface)] px-3 py-2 text-sm text-[var(--aqar-kohl)] outline-none focus:border-[var(--aqar-green)]'

const num = (s?: string) => (s ? Number(s).toLocaleString('en-US') : '')
const csvList = (s?: string) => (s ? s.split(',').filter(Boolean) : [])

export default function SearchFilters({
  value,
  categories,
  nearMe,
  onChange,
  onCityPick,
  onClearCity,
  onNearMe,
  onClearAll,
}: {
  value: FilterState
  categories: { name: string; category_name_ar: string }[]
  nearMe: 'idle' | 'locating' | 'denied'
  onChange: (patch: Partial<FilterState>) => void
  onCityPick: (city: CityWithCount) => void
  onClearCity: () => void
  onNearMe: () => void
  onClearAll: () => void
}) {
  // Any advanced filter active → open the panel by default.
  const [showMore, setShowMore] = useState(
    !!(value.category || value.bathrooms_min || value.age_max || value.facade || value.furnished || value.floor_level || value.services),
  )
  const [services, setServices] = useState<{ name: string; service_name_ar: string }[]>([])
  useEffect(() => {
    realEstateApi.listPropertyServices().then(setServices).catch(() => setServices([]))
  }, [])

  const catLabel = (name?: string) => categories.find((c) => c.name === name)?.category_name_ar || name
  const svcLabel = (name: string) => services.find((s) => s.name === name)?.service_name_ar || name

  const selectedServices = csvList(value.services)
  const toggleService = (name: string) => {
    const cur = selectedServices
    const next = cur.includes(name) ? cur.filter((s) => s !== name) : [...cur, name]
    onChange({ services: next.join(',') })
  }

  // Removable chips for the active filters.
  const chips: { key: string; label: string; clear: Partial<FilterState> }[] = []
  if (value.keyword) chips.push({ key: 'keyword', label: `«${value.keyword}»`, clear: { keyword: '' } })
  if (value.listing_type) chips.push({ key: 'listing_type', label: TYPES.find((t) => t[0] === value.listing_type)?.[1] || '', clear: { listing_type: '' } })
  if (value.bedrooms_min) chips.push({ key: 'rooms', label: `${value.bedrooms_min}+ غرف`, clear: { bedrooms_min: '' } })
  if (value.bathrooms_min) chips.push({ key: 'baths', label: `${value.bathrooms_min}+ دورات مياه`, clear: { bathrooms_min: '' } })
  if (value.price_min || value.price_max) {
    const l = value.price_min && value.price_max ? `${num(value.price_min)}–${num(value.price_max)}` : value.price_min ? `من ${num(value.price_min)}` : `حتى ${num(value.price_max)}`
    chips.push({ key: 'price', label: `السعر: ${l} ر.س`, clear: { price_min: '', price_max: '' } })
  }
  if (value.area_min || value.area_max) {
    const l = value.area_min && value.area_max ? `${num(value.area_min)}–${num(value.area_max)}` : value.area_min ? `من ${num(value.area_min)}` : `حتى ${num(value.area_max)}`
    chips.push({ key: 'area', label: `المساحة: ${l} م²`, clear: { area_min: '', area_max: '' } })
  }
  if (value.category) chips.push({ key: 'category', label: catLabel(value.category) || '', clear: { category: '' } })
  if (value.age_max) chips.push({ key: 'age', label: AGES.find((a) => a[0] === value.age_max)?.[1] || '', clear: { age_max: '' } })
  if (value.furnished) chips.push({ key: 'furnished', label: value.furnished, clear: { furnished: '' } })
  if (value.floor_level) chips.push({ key: 'floor', label: `الدور: ${value.floor_level}`, clear: { floor_level: '' } })
  if (value.facade) chips.push({ key: 'facade', label: `الواجهة: ${value.facade}`, clear: { facade: '' } })
  for (const svc of selectedServices) chips.push({ key: `svc-${svc}`, label: svcLabel(svc), clear: {} as any })

  return (
    <div className="mb-5 rounded-2xl border border-[var(--aqar-sand-2)] bg-[var(--aqar-surface)]/70 p-3 sm:p-4">
      {/* essentials: search + city + near-me */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-12">
        <input
          className={`${FIELD} lg:col-span-6`}
          placeholder="ابحث باسم الحي أو المدينة أو نوع العقار…"
          value={value.keyword || ''}
          onChange={(e) => onChange({ keyword: e.target.value })}
          aria-label="بحث"
        />
        <div className="lg:col-span-4">
          <CityCombobox value={value.city} onPick={onCityPick} onClear={onClearCity} />
        </div>
        <button
          type="button"
          onClick={onNearMe}
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[var(--aqar-green)] bg-transparent px-3 text-sm font-medium text-[var(--aqar-green)] hover:bg-[var(--aqar-sand)] lg:col-span-2"
        >
          {nearMe === 'locating' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          القريب مني
        </button>
      </div>

      {/* quick filters — always visible: نوع العرض + الغرف + السعر + المساحة */}
      <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <select className={FIELD} value={value.listing_type || ''} onChange={(e) => onChange({ listing_type: e.target.value })} aria-label="نوع العرض">
          {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className={FIELD} value={value.bedrooms_min || ''} onChange={(e) => onChange({ bedrooms_min: e.target.value })} aria-label="عدد الغرف">
          {ROOMS.map(([v, l]) => <option key={v} value={v}>{l === 'كل الغرف' ? l : `${l} غرف`}</option>)}
        </select>
        <input className={FIELD} dir="ltr" inputMode="numeric" placeholder="أقل سعر" value={value.price_min || ''} onChange={(e) => onChange({ price_min: e.target.value.replace(/[^\d]/g, '') })} aria-label="أقل سعر" />
        <input className={FIELD} dir="ltr" inputMode="numeric" placeholder="أعلى سعر" value={value.price_max || ''} onChange={(e) => onChange({ price_max: e.target.value.replace(/[^\d]/g, '') })} aria-label="أعلى سعر" />
        <input className={FIELD} dir="ltr" inputMode="numeric" placeholder="أقل مساحة (م²)" value={value.area_min || ''} onChange={(e) => onChange({ area_min: e.target.value.replace(/[^\d]/g, '') })} aria-label="أقل مساحة" />
        <input className={FIELD} dir="ltr" inputMode="numeric" placeholder="أعلى مساحة (م²)" value={value.area_max || ''} onChange={(e) => onChange({ area_max: e.target.value.replace(/[^\d]/g, '') })} aria-label="أعلى مساحة" />
      </div>

      {/* advanced toggle */}
      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        aria-expanded={showMore}
        className="mt-2.5 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-2 text-sm font-medium text-[var(--aqar-green-d)]"
      >
        <SlidersHorizontal className="h-4 w-4" />
        {showMore ? 'فلاتر أقل' : 'فلاتر أكثر'}
        <ChevronDown className={`h-4 w-4 transition-transform ${showMore ? 'rotate-180' : ''}`} />
      </button>

      {showMore && (
        <div className="mt-2 space-y-3">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            <select className={FIELD} value={value.category || ''} onChange={(e) => onChange({ category: e.target.value })} aria-label="القسم">
              <option value="">كل الأقسام</option>
              {categories.map((c) => <option key={c.name} value={c.name}>{c.category_name_ar}</option>)}
            </select>
            <select className={FIELD} value={value.bathrooms_min || ''} onChange={(e) => onChange({ bathrooms_min: e.target.value })} aria-label="دورات المياه">
              {BATHS.map(([v, l]) => <option key={v} value={v}>{l === 'كل الدورات' ? l : `${l} دورات مياه`}</option>)}
            </select>
            <select className={FIELD} value={value.furnished || ''} onChange={(e) => onChange({ furnished: e.target.value })} aria-label="الفرش">
              {FURNISHED.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select className={FIELD} value={value.age_max || ''} onChange={(e) => onChange({ age_max: e.target.value })} aria-label="عمر العقار">
              {AGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select className={FIELD} value={value.floor_level || ''} onChange={(e) => onChange({ floor_level: e.target.value })} aria-label="الدور">
              {FLOORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select className={FIELD} value={value.facade || ''} onChange={(e) => onChange({ facade: e.target.value })} aria-label="الواجهة">
              <option value="">الواجهة (الكل)</option>
              {FACADES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          {/* amenities */}
          {services.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-[var(--aqar-kohl)]/60">المرافق والخدمات</p>
              <div className="flex flex-wrap gap-2">
                {services.map((s) => {
                  const on = selectedServices.includes(s.name)
                  return (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => toggleService(s.name)}
                      aria-pressed={on}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${on ? 'border-[var(--aqar-green)] bg-[var(--aqar-green)]/10 text-[var(--aqar-green-d)]' : 'border-[var(--aqar-sand-2)] text-[var(--aqar-kohl)]/70 hover:border-[var(--aqar-green)]/40'}`}
                    >
                      {s.service_name_ar}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* active-filter chips */}
      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => (chip.key.startsWith('svc-') ? toggleService(chip.key.slice(4)) : onChange(chip.clear))}
              aria-label={`إزالة الفلتر: ${chip.label}`}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--aqar-green)]/10 px-3 py-1 text-xs font-medium text-[var(--aqar-green-d)] hover:bg-[var(--aqar-green)]/15"
            >
              {chip.label}
              <X className="h-3 w-3" />
            </button>
          ))}
          <button type="button" onClick={onClearAll} className="text-xs font-medium text-[var(--aqar-clay)] hover:underline">مسح الكل</button>
        </div>
      )}

      {nearMe === 'denied' && (
        <p className="mt-2 text-xs text-[var(--aqar-clay)]">تعذّر تحديد موقعك — فعّل صلاحية الموقع في المتصفّح وحاول مجدداً.</p>
      )}
    </div>
  )
}
