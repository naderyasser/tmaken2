'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Scale, X, Search, Award } from 'lucide-react'
import { useCompare, type ListingSnapshot } from '@/lib/listing-collections'
import { formatPrice, formatNumber } from '@/lib/aqar-format'
import ListingImage from '@/components/store/listing-image'
import VerifiedBadge from '@/components/store/verified-badge'

const ppsqm = (l: ListingSnapshot) => (l.price && l.area_sqm ? Math.round(l.price / l.area_sqm) : null)

// Rows with a `best` config get the winner highlighted (lowest price/ppsqm, largest area, most rooms).
interface Row {
  label: string
  cell: (l: ListingSnapshot) => ReactNode
  best?: { dir: 'min' | 'max'; value: (l: ListingSnapshot) => number | null; srLabel: string }
}

const ROWS: Row[] = [
  {
    label: 'السعر',
    cell: (l) => <span className="font-bold text-[var(--aqar-green-d)]">{formatPrice(l.price, 'ar', l.listing_type)}</span>,
    best: { dir: 'min', value: (l) => l.price ?? null, srLabel: 'الأفضل سعراً' },
  },
  {
    label: 'المساحة',
    cell: (l) => (l.area_sqm != null ? `${formatNumber(l.area_sqm, 'ar')} م²` : '—'),
    best: { dir: 'max', value: (l) => l.area_sqm ?? null, srLabel: 'الأكبر مساحة' },
  },
  {
    label: 'عدد الغرف',
    cell: (l) => (l.bedrooms != null ? formatNumber(l.bedrooms, 'ar') : '—'),
    best: { dir: 'max', value: (l) => l.bedrooms ?? null, srLabel: 'الأكثر غرفاً' },
  },
  { label: 'الموقع', cell: (l) => [l.district_name_ar, l.city_name_ar].filter(Boolean).join('، ') || '—' },
  {
    label: 'السعر/م²',
    cell: (l) => { const p = ppsqm(l); return p ? `${formatNumber(p, 'ar')} ر.س` : '—' },
    best: { dir: 'min', value: ppsqm, srLabel: 'الأفضل سعراً للمتر' },
  },
  { label: 'حالة الترخيص', cell: (l) => (l.rega_ad_license_number ? <VerifiedBadge /> : <span className="text-[var(--aqar-kohl)]/40">غير محدد</span>) },
]

/** Set of listing names that hold the best value for a row — empty when <2 values or all equal. */
function bestNames(items: ListingSnapshot[], row: Row): Set<string> {
  if (!row.best) return new Set()
  const vals = items.map((l) => ({ name: l.name, v: row.best!.value(l) })).filter((x) => x.v != null) as { name: string; v: number }[]
  if (vals.length < 2) return new Set()
  const uniq = new Set(vals.map((x) => x.v))
  if (uniq.size < 2) return new Set() // all equal → nothing to highlight
  const target = row.best.dir === 'min' ? Math.min(...vals.map((x) => x.v)) : Math.max(...vals.map((x) => x.v))
  return new Set(vals.filter((x) => x.v === target).map((x) => x.name))
}

export default function ComparePage() {
  const { items, remove } = useCompare()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="aqar-display mb-1 flex items-center gap-2 text-2xl text-[var(--aqar-kohl)]"><Scale className="h-6 w-6 text-[var(--aqar-green)]" />مقارنة العقارات</h1>
      <p className="mb-6 text-sm text-[var(--aqar-kohl)]/55">قارن حتى 3 عقارات جنباً إلى جنب — الأفضل في كل صف مميّز.</p>

      {!mounted ? (
        <div className="h-72 animate-pulse rounded-2xl bg-[var(--aqar-sand-2)]" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--aqar-sand-2)] p-12 text-center">
          <Scale className="mx-auto mb-3 h-10 w-10 text-[var(--aqar-kohl)]/20" />
          <p className="text-[var(--aqar-kohl)]/70">لم تختر أي عقار للمقارنة بعد</p>
          <p className="mt-1 text-sm text-[var(--aqar-kohl)]/45">اضغط «قارن» على أي إعلان لإضافته هنا.</p>
          <Link href="/search" className="aqar-btn mt-5 inline-flex items-center gap-2"><Search className="h-4 w-4" />تصفّح العقارات</Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--aqar-border)] bg-[var(--aqar-surface)]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-24 p-3 text-start text-xs font-medium text-[var(--aqar-kohl)]/45" />
                {items.map((l) => (
                  <th key={l.name} className="min-w-[160px] border-s border-[var(--aqar-sand-2)] p-3 align-top">
                    <div className="relative">
                      <Link href={`/listing/${l.name}`} className="block">
                        <span className="block h-24 w-full overflow-hidden rounded-xl bg-[var(--aqar-sand-2)]"><ListingImage src={l.primary_image} alt={l.title || ''} iconClassName="h-8 w-8" showLabel={false} /></span>
                        <span className="mt-1.5 line-clamp-2 block text-start text-xs font-medium text-[var(--aqar-kohl)]">{l.title}</span>
                      </Link>
                      <button onClick={() => remove(l.name)} aria-label={`إزالة ${l.title || ''} من المقارنة`} className="absolute top-1 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--aqar-surface)]/90 text-[var(--aqar-kohl)]/60 shadow hover:text-[var(--aqar-clay)]" style={{ insetInlineEnd: '0.25rem' }}><X className="h-4 w-4" /></button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const winners = bestNames(items, row)
                return (
                  <tr key={row.label} className="border-t border-[var(--aqar-sand-2)]">
                    <th scope="row" className="p-3 text-start text-xs font-medium text-[var(--aqar-kohl)]/55">{row.label}</th>
                    {items.map((l) => {
                      const isBest = winners.has(l.name)
                      return (
                        <td key={l.name} className={`border-s border-[var(--aqar-sand-2)] p-3 text-[var(--aqar-kohl)] ${isBest ? 'bg-[var(--aqar-green)]/10' : ''}`}>
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            {row.cell(l)}
                            {isBest && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--aqar-green)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                                <Award className="h-3 w-3" aria-hidden />
                                <span aria-hidden>الأفضل</span>
                                <span className="sr-only">{row.best?.srLabel}</span>
                              </span>
                            )}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
