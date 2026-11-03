'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Loader2, AlertTriangle, Printer, ScrollText, ArrowUpDown, FileText } from 'lucide-react'
import { formatSAR, formatDate, formatHijri } from './format'
import { buildLedgerHtml, LEDGER_TYPE_LABELS, type LedgerView, type LedgerEntryView } from './property-statement-html'
import { printHtmlContent } from './print-doc'
import { getPropertyLedger } from '@/lib/rentals/property-statement-data'

// Ported from egarsys src/components/property-ledger-dialog.tsx — the bank-statement
// style سجل حركات العقار. Reads the mirror via lib/rentals/property-statement-data.

type Chip = 'all' | 'contract' | 'invoice' | 'payment' | 'expense'
const CHIPS: Array<{ key: Chip; label: string }> = [
  { key: 'all', label: 'الكل' },
  { key: 'contract', label: 'عقود' },
  { key: 'invoice', label: 'فواتير' },
  { key: 'payment', label: 'سدادات' },
  { key: 'expense', label: 'مصروفات' },
]

function typeBadgeClass(t: LedgerEntryView['type']): string {
  switch (t) {
    case 'invoice': return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
    case 'payment': return 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/40 dark:text-teal-300'
    case 'credit_note': return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300'
    case 'expense': return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300'
    default: return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300'
  }
}

function dualDate(iso: string): string {
  const g = formatDate(iso)
  const h = formatHijri(iso)
  return h && h !== '—' ? `${g} · ${h}` : g
}

function parseDate(v: string): Date | null {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

export function PropertyLedgerDialog({
  propertyId,
  open,
  onOpenChange,
  onOpenStatement,
}: {
  propertyId: string | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onOpenStatement?: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<LedgerView | null>(null)
  const [chip, setChip] = useState<Chip>('all')
  const [newestFirst, setNewestFirst] = useState(true)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = useCallback(async () => {
    if (!propertyId) return
    setLoading(true)
    setError(null)
    try {
      const fromD = parseDate(from)
      const toRaw = parseDate(to)
      // inclusive end-of-day for the "to" bound (mirrors the egarsys route).
      const toD = toRaw ? new Date(toRaw.getTime() + 24 * 60 * 60 * 1000 - 1) : null
      const res = await getPropertyLedger(propertyId, { from: fromD, to: toD })
      if (!res) throw new Error('لم يتم العثور على العقار')
      setData(res)
    } catch (e) {
      setError((e as Error)?.message || 'تعذّر تحميل سجل الحركات')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [propertyId, from, to])

  useEffect(() => {
    if (open && propertyId) load()
    if (!open) {
      setData(null)
      setChip('all')
      setFrom('')
      setTo('')
      setNewestFirst(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, propertyId])

  const entries = useMemo(() => {
    if (!data) return []
    let list = data.entries
    if (chip === 'invoice') list = list.filter((e) => e.type === 'invoice' || e.type === 'credit_note')
    else if (chip !== 'all') list = list.filter((e) => e.type === chip)
    return newestFirst ? list : [...list].reverse()
  }, [data, chip, newestFirst])

  const doPrint = () => {
    if (!data) return
    printHtmlContent(buildLedgerHtml(data, dualDate(new Date().toISOString())))
  }

  const p = data?.property

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pl-7">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ScrollText className="h-5 w-5 text-emerald-600" />
              سجل حركات العقار
            </DialogTitle>
            <div className="flex items-center gap-2">
              {onOpenStatement && data && !loading && (
                <button
                  type="button"
                  onClick={onOpenStatement}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                >
                  <FileText className="h-4 w-4" /> الكشف التفصيلي
                </button>
              )}
              {data && !loading && (
                <button
                  type="button"
                  onClick={doPrint}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Printer className="h-4 w-4" /> طباعة
                </button>
              )}
            </div>
          </div>
          <DialogDescription className="sr-only">سجل الحركات المالية الزمني للعقار</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> جارٍ تحميل سجل الحركات…
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            <AlertTriangle className="h-5 w-5 shrink-0" /> {error}
          </div>
        )}

        {data && p && !loading && (
          <div className="space-y-4 text-sm">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="font-bold text-slate-900 dark:text-slate-100">{p.title}</div>
              <div className="mt-0.5 font-mono text-xs text-slate-500">
                الرقم الآلي: {p.internalId || '—'}{p.deedNumber ? ` • رقم الصك: ${p.deedNumber}` : ''}{p.city ? ` • ${p.city}` : ''}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <SummaryCell label="الإيرادات المفوترة" value={data.summary.totalInvoiced} tone="emerald" />
              <SummaryCell label="المحصّل" value={data.summary.totalCollected} tone="teal" />
              <SummaryCell label="المصروفات" value={data.summary.totalExpenses} tone="red" />
              <SummaryCell label="الضريبة" value={data.summary.totalVat} />
              <SummaryCell label="الصافي" value={data.summary.net} tone={data.summary.net >= 0 ? 'emerald' : 'red'} note="المفوتر − المصروفات" />
            </div>
            {data.summary.creditNotesTotal > 0 && (
              <div className="text-xs text-orange-700 dark:text-orange-400">
                إشعارات دائنة: {formatSAR(data.summary.creditNotesTotal)} — تُعرض منفصلة ولا تُخصم من الإيرادات
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {CHIPS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setChip(c.key)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    chip === c.key
                      ? 'border-emerald-500 bg-emerald-600 text-white'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  {c.label}
                </button>
              ))}
              <span className="mr-auto" />
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-36 text-xs" title="من تاريخ" />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-36 text-xs" title="إلى تاريخ" />
              <button
                type="button"
                onClick={load}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                تطبيق
              </button>
              <button
                type="button"
                onClick={() => setNewestFirst((v) => !v)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                title="عكس الترتيب"
              >
                <ArrowUpDown className="h-3.5 w-3.5" /> {newestFirst ? 'الأحدث أولًا' : 'الأقدم أولًا'}
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800/60">
                  <tr>
                    <th className="p-2 font-semibold">التاريخ</th>
                    <th className="p-2 font-semibold">نوع الحركة</th>
                    <th className="p-2 font-semibold">البيان</th>
                    <th className="p-2 font-semibold">المبلغ</th>
                    <th className="p-2 font-semibold">المرجع</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 && (
                    <tr><td colSpan={5} className="p-4 text-center text-slate-400">لا توجد حركات مطابقة</td></tr>
                  )}
                  {entries.map((e, i) => (
                    <tr key={i} className={`border-t border-slate-100 dark:border-slate-800 ${e.cancelled ? 'text-slate-400 line-through' : ''}`}>
                      <td className="p-2 whitespace-nowrap">{dualDate(e.date)}</td>
                      <td className="p-2">
                        <Badge className={typeBadgeClass(e.type)}>
                          {LEDGER_TYPE_LABELS[e.type]}{e.cancelled ? ' — ملغاة' : ''}
                        </Badge>
                      </td>
                      <td className="p-2">{e.label}</td>
                      <td className={`p-2 font-bold whitespace-nowrap ${e.cancelled ? '' : e.amount > 0 ? 'text-emerald-700 dark:text-emerald-400' : e.amount < 0 ? 'text-red-700 dark:text-red-400' : 'text-slate-400'}`} dir="ltr">
                        {e.type === 'contract' ? '—' : `${e.amount > 0 ? '+' : e.amount < 0 ? '−' : ''}${formatSAR(Math.abs(e.amount))}`}
                      </td>
                      <td className="p-2 font-mono" dir="ltr">{e.refs.invoiceNumber || e.refs.voucherNumber || e.refs.contractNumber || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SummaryCell({ label, value, tone, note }: { label: string; value: number; tone?: 'emerald' | 'teal' | 'red'; note?: string }) {
  const cls =
    tone === 'emerald' ? 'text-emerald-700 dark:text-emerald-400'
    : tone === 'teal' ? 'text-teal-700 dark:text-teal-400'
    : tone === 'red' ? 'text-red-700 dark:text-red-400'
    : 'text-slate-800 dark:text-slate-200'
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="text-[10px] text-slate-500 dark:text-slate-400">{label}{note ? ` · ${note}` : ''}</div>
      <div className={`mt-0.5 text-sm font-bold ${cls}`}>{formatSAR(value)}</div>
    </div>
  )
}
