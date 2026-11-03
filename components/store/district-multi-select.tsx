'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Search } from 'lucide-react'
import { realEstateApi, type GeoItem } from '@/lib/real-estate-api'
import { normalizeAr } from '@/lib/arabic'

/**
 * Searchable multi-select over a city's districts (الأحياء المفضلة — أكثر من حي).
 * Value = Aqar District names; labels come from district_name_ar.
 */
export default function DistrictMultiSelect({
  city,
  value,
  onChange,
  max = 10,
}: {
  city: string
  value: string[]
  onChange: (v: string[]) => void
  max?: number
}) {
  const [districts, setDistricts] = useState<GeoItem[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!city) { setDistricts([]); return }
    setLoading(true)
    realEstateApi.listDistricts(city)
      .then(setDistricts)
      .catch(() => setDistricts([]))
      .finally(() => setLoading(false))
  }, [city])

  const labelOf = useMemo(() => {
    const m = new Map<string, string>()
    districts.forEach((d: any) => m.set(d.name, d.district_name_ar || d.name))
    return (name: string) => m.get(name) || name
  }, [districts])

  const filtered = useMemo(() => {
    const nq = normalizeAr(q, true)
    const pool = districts.filter((d: any) => !value.includes(d.name))
    if (!nq) return pool.slice(0, 60)
    return pool.filter((d: any) => normalizeAr(d.district_name_ar || '', true).includes(nq)).slice(0, 60)
  }, [districts, q, value])

  const add = (name: string) => {
    if (value.length >= max || value.includes(name)) return
    onChange([...value, name])
  }
  const remove = (name: string) => onChange(value.filter((v) => v !== name))

  if (!city) {
    return <p className="rounded-xl border border-dashed border-[var(--aqar-sand-2)] p-3 text-sm text-[var(--aqar-kohl)]/50">اختر المدينة أولاً لعرض الأحياء</p>
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((name) => (
            <span key={name} className="inline-flex items-center gap-1 rounded-full bg-[var(--aqar-green)]/10 py-1 pe-1 ps-3 text-sm font-medium text-[var(--aqar-green-d)]">
              {labelOf(name)}
              <button type="button" onClick={() => remove(name)} aria-label={`إزالة ${labelOf(name)}`} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-[var(--aqar-green)]/15">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--aqar-kohl)]/35" style={{ insetInlineStart: '0.75rem' }} />
        <input
          className="inp"
          style={{ paddingInlineStart: '2.4rem' }}
          placeholder={value.length >= max ? `الحد الأقصى ${max} أحياء` : 'ابحث عن حي…'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={value.length >= max}
        />
      </div>
      <div className="flex max-h-44 flex-wrap content-start gap-1.5 overflow-y-auto rounded-xl border border-[var(--aqar-sand-2)] p-2">
        {loading ? (
          <span className="p-2 text-sm text-[var(--aqar-kohl)]/50">جارٍ تحميل الأحياء…</span>
        ) : filtered.length === 0 ? (
          <span className="p-2 text-sm text-[var(--aqar-kohl)]/50">{q ? 'لا يوجد حي مطابق' : 'لا توجد أحياء أخرى'}</span>
        ) : (
          filtered.map((d: any) => (
            <button
              key={d.name}
              type="button"
              onClick={() => add(d.name)}
              disabled={value.length >= max}
              className="rounded-full border border-[var(--aqar-sand-2)] px-3 py-1 text-sm text-[var(--aqar-kohl)]/75 hover:border-[var(--aqar-green)] hover:text-[var(--aqar-green-d)] disabled:opacity-40"
            >
              {d.district_name_ar}
            </button>
          ))
        )}
      </div>
      <p className="text-xs text-[var(--aqar-kohl)]/50">بالإمكان اختيار أكثر من حي (حتى {max})</p>
    </div>
  )
}
