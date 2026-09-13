'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { MapPin, ChevronDown, X, Loader2 } from 'lucide-react'
import { realEstateApi, type CityWithCount } from '@/lib/real-estate-api'
import { normalizeAr } from '@/lib/arabic'

/**
 * Searchable city picker — typeahead over ONLY cities that have ≥1 active listing
 * (so every option returns results), with the active-listing count shown. Loads the
 * (small) list once on mount; filters client-side; emits the picked city (with centroid).
 */
export default function CityCombobox({
  value,
  onPick,
  onClear,
}: {
  value?: string | null
  onPick: (city: CityWithCount) => void
  onClear: () => void
}) {
  const [cities, setCities] = useState<CityWithCount[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    realEstateApi
      .listCitiesWithListings()
      .then((r) => { if (alive) setCities(r) })
      .catch(() => { if (alive) setCities([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const selected = useMemo(() => cities.find((c) => c.name === value) || null, [cities, value])

  const filtered = useMemo(() => {
    const nq = normalizeAr(q, true)
    if (!nq) return cities.slice(0, 80)
    return cities
      .filter((c) =>
        normalizeAr(c.city_name_ar || '', true).includes(nq) ||
        normalizeAr(c.city_name_en || '').includes(nq.toLowerCase()),
      )
      .slice(0, 80)
  }, [cities, q])

  const pick = (c: CityWithCount) => { onPick(c); setQ(''); setOpen(false); setActive(-1) }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (!open || !filtered.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(filtered[active]) }
  }

  return (
    <div ref={boxRef} className="relative">
      <MapPin className="pointer-events-none absolute inset-y-0 my-auto h-4 w-4 text-[var(--aqar-kohl)]/40 ms-3" />
      <input
        value={open ? q : selected ? `${selected.city_name_ar} (${selected.count})` : ''}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => { setQ(''); setOpen(true) }}
        onKeyDown={onKey}
        placeholder="المدينة"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        className="w-full rounded-xl border border-[var(--aqar-sand-2)] bg-[var(--aqar-surface)] py-2 ps-9 pe-8 text-sm text-[var(--aqar-kohl)] outline-none focus:border-[var(--aqar-green)]"
      />
      {selected && !open ? (
        <button
          type="button"
          onClick={() => { onClear(); setQ('') }}
          className="absolute inset-y-0 my-auto flex h-5 w-5 items-center justify-center rounded-full text-[var(--aqar-kohl)]/40 hover:text-[var(--aqar-kohl)] end-0 me-2.5"
          aria-label="مسح المدينة"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : (
        <ChevronDown className="pointer-events-none absolute inset-y-0 my-auto h-4 w-4 text-[var(--aqar-kohl)]/40 end-0 me-3" />
      )}

      {open && (
        <div className="absolute z-50 mt-1 max-h-[60vh] w-full min-w-[220px] overflow-auto rounded-2xl border border-[var(--aqar-border)] bg-[var(--aqar-surface)] py-1 shadow-xl" dir="rtl">
          {loading ? (
            <div className="space-y-1.5 p-2">
              {[0, 1, 2].map((i) => <div key={i} className="h-8 animate-pulse rounded-lg bg-[var(--aqar-sand-2)]" />)}
            </div>
          ) : filtered.length ? (
            filtered.map((c, i) => (
              <button
                key={c.name}
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(c)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-start text-sm transition-colors ${active === i || c.name === value ? 'bg-[var(--aqar-sand)]' : ''}`}
              >
                <MapPin className="h-4 w-4 shrink-0 text-[var(--aqar-muted)]" />
                <span className="min-w-0 flex-1 truncate text-[var(--aqar-kohl)]">{c.city_name_ar}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-[var(--aqar-muted)]">{c.count}</span>
              </button>
            ))
          ) : (
            <p className="px-3 py-4 text-center text-sm text-[var(--aqar-muted)]">لا مدن مطابقة</p>
          )}
        </div>
      )}
    </div>
  )
}
