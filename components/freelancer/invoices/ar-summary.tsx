'use client'

/**
 * AR aging summary — a row of cards above the invoices table: total outstanding
 * plus aging buckets (not-due / 0–30 / 31–60 / 60+ days overdue) computed over
 * the submitted invoices with an outstanding balance.
 *
 * Every card is an interactive, keyboard-focusable filter button:
 *  - the bucket cards filter the table to that bucket (and toggle off when the
 *    already-active bucket is clicked again),
 *  - the "Total outstanding" card clears the filter (show all).
 * The active card gets a strong selected state (deeper fill + ring + checkmark);
 * idle cards show a small colour dot that doubles as a severity legend.
 *
 * `invoiceAgingBucket` is the single source of truth shared with the table's
 * bucket filter so the cards and the toolbar filter always agree. On small
 * screens the row becomes a horizontally swipeable, snapping carousel.
 */

import { useMemo } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'
import type { InvoiceRow } from './invoice-detail-sheet'

export type AgingBucket = 'current' | '0-30' | '31-60' | '60+'
export type BucketSelection = AgingBucket | 'all'
/** A card represents a bucket OR the "total" (clear-filter) card. */
type CardKey = AgingBucket | 'total'

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}
function daysSince(d: string): number {
  return Math.max(0, Math.floor((Date.parse(todayISO()) - Date.parse(d)) / 86_400_000))
}

/** Aging bucket for an invoice, or null if it's not a submitted invoice with outstanding > 0. */
export function invoiceAgingBucket(inv: InvoiceRow): AgingBucket | null {
  if (inv.docstatus !== 1) return null
  const out = inv.outstanding_amount ?? 0
  if (out <= 0) return null
  if (!inv.due_date || inv.due_date >= todayISO()) return 'current'
  const days = daysSince(inv.due_date)
  if (days <= 30) return '0-30'
  if (days <= 60) return '31-60'
  return '60+'
}

interface CardDef {
  key: CardKey
  label: string
  /** classes when idle (dark text on a light tint → WCAG-AA contrast) */
  idle: string
  /** classes when selected (deeper tint + coloured ring; still dark-on-light) */
  active: string
  /** legend dot colour shown when idle */
  dot: string
}

interface Props {
  invoices: InvoiceRow[]
  isRTL: boolean
  lang: 'ar' | 'en'
  /** Current selection: 'all' (no bucket filter) or a specific bucket. */
  activeBucket: string
  /** Receives the new selection; the component toggles a re-clicked bucket to 'all'. */
  onSelect: (sel: BucketSelection) => void
}

export function ARSummary({ invoices, isRTL, lang, activeBucket, onSelect }: Props) {
  const msg = (en: string, ar: string) => (isRTL ? ar : en)
  const fmt = (n: number) => formatCurrency(n, { locale: lang, currency: 'SAR', decimals: 0 })

  const { acc, total, totalCount } = useMemo(() => {
    const a: Record<AgingBucket, { count: number; sum: number }> = {
      current: { count: 0, sum: 0 },
      '0-30': { count: 0, sum: 0 },
      '31-60': { count: 0, sum: 0 },
      '60+': { count: 0, sum: 0 },
    }
    let t = 0
    let tc = 0
    for (const inv of invoices) {
      const b = invoiceAgingBucket(inv)
      if (!b) continue
      const out = inv.outstanding_amount ?? 0
      a[b].count += 1
      a[b].sum += out
      t += out
      tc += 1
    }
    return { acc: a, total: t, totalCount: tc }
  }, [invoices])

  // Latin digits in the day-range labels to match the (Latin-numeral) amounts.
  const cards: CardDef[] = [
    {
      key: 'total', label: msg('Total outstanding', 'إجمالي المستحقات'),
      idle: 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10',
      active: 'border-primary bg-primary/15 text-primary ring-2 ring-primary',
      dot: 'bg-primary',
    },
    {
      key: 'current', label: msg('Not due', 'غير مستحقة'),
      idle: 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
      active: 'border-slate-500 bg-slate-100 text-slate-900 ring-2 ring-slate-500',
      dot: 'bg-slate-400',
    },
    {
      key: '0-30', label: msg('0–30 days', '0–30 يوم'),
      idle: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
      active: 'border-amber-500 bg-amber-100 text-amber-900 ring-2 ring-amber-500',
      dot: 'bg-amber-500',
    },
    {
      key: '31-60', label: msg('31–60 days', '31–60 يوم'),
      idle: 'border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100',
      active: 'border-orange-500 bg-orange-100 text-orange-900 ring-2 ring-orange-500',
      dot: 'bg-orange-500',
    },
    {
      key: '60+', label: msg('60+ days', '60+ يوم'),
      idle: 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100',
      active: 'border-red-500 bg-red-100 text-red-900 ring-2 ring-red-500',
      dot: 'bg-red-500',
    },
  ]

  const dataFor = (key: CardKey) =>
    key === 'total' ? { count: totalCount, sum: total } : acc[key as AgingBucket]

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="flex snap-x gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-5 lg:overflow-visible"
      role="group"
      aria-label={msg('Filter invoices by aging', 'تصفية الفواتير حسب العمر')}
    >
      {cards.map((c) => {
        const data = dataFor(c.key)
        // The total card is "active" when no bucket filter is applied.
        const isActive = c.key === 'total' ? activeBucket === 'all' : activeBucket === c.key
        const handle = () => {
          if (c.key === 'total') return onSelect('all')
          onSelect(isActive ? 'all' : (c.key as AgingBucket))
        }
        return (
          <button
            key={c.key}
            type="button"
            aria-pressed={isActive}
            aria-label={msg(
              `${c.label}: ${fmt(data.sum)}, ${data.count} invoices`,
              `${c.label}: ${fmt(data.sum)}، ${data.count} فاتورة`,
            )}
            onClick={handle}
            className={cn(
              'min-w-[150px] flex-shrink-0 snap-start rounded-xl border p-3 text-start transition lg:min-w-0',
              'cursor-pointer hover:shadow-md focus-visible:outline-none focus-visible:ring-2',
              'focus-visible:ring-primary focus-visible:ring-offset-1',
              isActive ? c.active : c.idle,
            )}
          >
            <div className="flex items-center justify-between gap-1">
              <p className="text-[11px] font-medium">{c.label}</p>
              {isActive
                ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                : <span className={cn('h-2 w-2 shrink-0 rounded-full', c.dot)} aria-hidden />}
            </div>
            <p className="mt-1 text-lg font-bold tabular-nums" dir="ltr">{fmt(data.sum)}</p>
            <p className="text-[11px] font-medium opacity-80">
              {msg(`${data.count} invoice${data.count === 1 ? '' : 's'}`, `${data.count} فاتورة`)}
            </p>
          </button>
        )
      })}
    </div>
  )
}
