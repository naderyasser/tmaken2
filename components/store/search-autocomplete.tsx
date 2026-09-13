'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, MapPin, LayoutGrid, Home, Loader2 } from 'lucide-react'
import { realEstateApi, type AqarSuggest } from '@/lib/real-estate-api'
import { normalizeAr } from '@/lib/arabic'

type Kind = 'city' | 'district' | 'category'
interface Flat { kind: Kind; name: string; label: string; count: number; city?: string; sub?: string }

const ICON = { city: MapPin, district: Home, category: LayoutGrid } as const

/** Highlight the matched span (palm green). Best-effort 1:1 normalized index map. */
function Highlighted({ label, nq }: { label: string; nq: string }) {
  if (!nq) return <>{label}</>
  const i = normalizeAr(label).indexOf(nq)
  if (i < 0) return <>{label}</>
  return (
    <>
      {label.slice(0, i)}
      <span className="font-bold text-[var(--aqar-green)]">{label.slice(i, i + nq.length)}</span>
      {label.slice(i + nq.length)}
    </>
  )
}

export default function SearchAutocomplete({
  name = 'keyword', defaultValue = '', placeholder, inputClassName, autoFocus,
}: { name?: string; defaultValue?: string; placeholder?: string; inputClassName?: string; autoFocus?: boolean }) {
  const router = useRouter()
  const [q, setQ] = useState(defaultValue)
  const [data, setData] = useState<AqarSuggest | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(-1)
  const boxRef = useRef<HTMLDivElement>(null)
  const tRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setData(null); setOpen(false); setLoading(false); return }
    setLoading(true)
    clearTimeout(tRef.current)
    tRef.current = setTimeout(async () => {
      try { const r = await realEstateApi.suggest(term); setData(r); setActive(-1); setOpen(true) }
      catch { setData(null) } finally { setLoading(false) }
    }, 250)
    return () => clearTimeout(tRef.current)
  }, [q])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const flat = useMemo<Flat[]>(() => !data ? [] : [
    ...data.cities.map((c) => ({ kind: 'city' as const, name: c.name, label: c.label, count: c.count })),
    ...data.districts.map((d) => ({ kind: 'district' as const, name: d.name, label: d.label, count: d.count, city: d.city, sub: d.city_label })),
    ...data.categories.map((c) => ({ kind: 'category' as const, name: c.name, label: c.label, count: c.count })),
  ], [data])

  const nq = normalizeAr(q)
  const hasResults = flat.length > 0

  const go = (it: Flat) => {
    setOpen(false)
    if (it.kind === 'city') router.push(`/${encodeURIComponent(it.name)}`)
    else if (it.kind === 'district') router.push(`/search?city=${encodeURIComponent(it.city || '')}&district=${encodeURIComponent(it.name)}`)
    else router.push(`/search?category=${encodeURIComponent(it.name)}`)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (!open || !hasResults) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)) }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); go(flat[active]) }
    // Enter with no active item → let the surrounding <form action="/search"> submit (keyword + filters)
  }

  // group renderer with running flat index for keyboard highlight
  let idx = -1
  const Group = ({ title, kind, rows }: { title: string; kind: Kind; rows: Flat[] }) => {
    if (!rows.length) return null
    return (
      <div className="py-1">
        <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold text-[var(--aqar-muted)]">{title}</p>
        {rows.map((it) => {
          idx += 1
          const i = idx
          const Icon = ICON[kind]
          return (
            <button
              key={`${kind}-${it.name}`}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => go(it)}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-start text-sm transition-colors ${active === i ? 'bg-[var(--aqar-sand)]' : ''}`}
            >
              <Icon className="h-4 w-4 shrink-0 text-[var(--aqar-muted)]" />
              <span className="min-w-0 flex-1 truncate text-[var(--aqar-kohl)]">
                <Highlighted label={it.label} nq={nq} />
                {it.sub ? <span className="text-[var(--aqar-muted)]"> · {it.sub}</span> : null}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-[var(--aqar-muted)]">{it.count}</span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div ref={boxRef} className="relative flex-1">
      <Search className="pointer-events-none absolute inset-y-0 my-auto h-5 w-5 text-[var(--aqar-kohl)]/40 ms-3" />
      <input
        name={name}
        value={q}
        autoComplete="off"
        autoFocus={autoFocus}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKey}
        onFocus={() => { if (hasResults) setOpen(true) }}
        placeholder={placeholder}
        className={inputClassName}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {loading && <Loader2 className="absolute inset-y-0 my-auto h-4 w-4 animate-spin text-[var(--aqar-kohl)]/40 me-3 end-0" />}

      {open && (
        <div className="absolute z-50 mt-1 max-h-[70vh] w-full min-w-[260px] overflow-auto rounded-2xl border border-[var(--aqar-border)] bg-[var(--aqar-surface)] py-1 shadow-xl" dir="rtl">
          {hasResults ? (
            <>
              <Group title="مدن" kind="city" rows={flat.filter((f) => f.kind === 'city')} />
              <Group title="أحياء" kind="district" rows={flat.filter((f) => f.kind === 'district')} />
              <Group title="أقسام" kind="category" rows={flat.filter((f) => f.kind === 'category')} />
            </>
          ) : loading ? (
            <div className="space-y-1.5 p-2">
              {[0, 1, 2].map((i) => <div key={i} className="h-8 animate-pulse rounded-lg bg-[var(--aqar-sand-2)]" />)}
            </div>
          ) : (
            <p className="px-3 py-4 text-center text-sm text-[var(--aqar-muted)]">لا نتائج — اضغط Enter للبحث الكامل</p>
          )}
        </div>
      )}
    </div>
  )
}
