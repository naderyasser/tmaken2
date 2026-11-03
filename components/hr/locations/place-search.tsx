'use client'

import { useRef, useState } from 'react'
import { Loader2, MapPin, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PlaceHit {
  lat: number
  lon: number
  label: string
  detail: string
}

/** Coordinates typed or pasted from a Google Maps link («@24.7,46.6», «?q=24.7,46.6», «24.7, 46.6»). */
export function coordsFromText(t: string): { lat: number; lon: number } | null {
  const m = t.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/)
    || t.match(/[?&](?:q|query|ll|center)=(-?\d{1,2}(?:\.\d+)?)(?:,|%2C)\s*(-?\d{1,3}(?:\.\d+)?)/i)
    || t.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,،\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/)
  if (!m) return null
  const lat = Number(m[1])
  const lon = Number(m[2])
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null
}

/**
 * «ابحث عن مكان» for the location dialog (owner 2026-10-27) — find a far site by name
 * (city, district, landmark…) like Google Maps instead of panning the map to it.
 * OpenStreetMap Nominatim, the same free geocoder the sales map picker already uses.
 */
export default function PlaceSearch({ onPick, className }: { onPick: (hit: PlaceHit) => void; className?: string }) {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [hits, setHits] = useState<PlaceHit[] | null>(null)
  const [err, setErr] = useState('')
  const seq = useRef(0)

  const pick = (h: PlaceHit) => {
    setHits(null)
    setQ(h.label)
    onPick(h)
  }

  const search = async () => {
    const text = q.trim()
    if (!text) return
    const c = coordsFromText(text)
    if (c) return pick({ ...c, label: `${c.lat}, ${c.lon}`, detail: '' })
    const id = ++seq.current
    setBusy(true)
    setErr('')
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=ar&q=${encodeURIComponent(text)}`
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(String(res.status))
      const rows: Array<{ lat: string; lon: string; name?: string; display_name: string }> = await res.json()
      if (id !== seq.current) return
      setHits(rows.map((r) => {
        const parts = r.display_name.split('،').join(',').split(',').map((s) => s.trim()).filter(Boolean)
        return { lat: Number(r.lat), lon: Number(r.lon), label: r.name || parts[0] || r.display_name, detail: parts.slice(1).join('، ') }
      }))
    } catch {
      if (id === seq.current) setErr('تعذّر البحث الآن — جرّب مرة أخرى أو الصق الإحداثيات')
    } finally {
      if (id === seq.current) setBusy(false)
    }
  }

  return (
    <div className={cn('relative', className)}>
      <div className="flex gap-1.5">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); if (!e.target.value) setHits(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search() } }}
          placeholder="اسم المدينة، الحي، المعلم… أو رابط خرائط Google"
          aria-label="ابحث عن مكان"
          className="h-9 min-w-0 flex-1 rounded border border-[var(--apex-border)] bg-white px-2 text-[13px] outline-none focus:border-[var(--apex-blue)]"
        />
        <button
          type="button"
          onClick={search}
          disabled={busy || !q.trim()}
          aria-label="بحث"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-[var(--apex-blue)] text-white disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </button>
      </div>
      {err && <p className="mt-1 text-[11.5px] text-red-600">{err}</p>}
      {hits && (
        <ul className="absolute inset-x-0 top-10 z-20 max-h-64 overflow-auto rounded border border-[var(--apex-border)] bg-white shadow-lg" role="listbox">
          {hits.length === 0 && <li className="px-3 py-2 text-slate-500">لا توجد نتائج — جرّب اسماً آخر</li>}
          {hits.map((h, i) => (
            <li key={i}>
              <button type="button" onClick={() => pick(h)} className="flex w-full items-start gap-2 px-3 py-2 text-right hover:bg-slate-50" role="option" aria-selected={false}>
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--apex-blue)]" />
                <span className="min-w-0">
                  <span className="block font-bold text-slate-800">{h.label}</span>
                  {h.detail && <span className="block truncate text-[11.5px] text-slate-500">{h.detail}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
