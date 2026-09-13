'use client'

// Ported 1:1 from egarsys src/components/contract-reference-dialog.tsx. Mechanical
// changes: scoped ui/format/print imports; the
// fetch('/api/contracts/reference/[no]/statement') → the mirror adapter
// getContractReferenceStatement(). Read-only presentation.

import { useCallback, useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Badge } from './ui/badge'
import { Loader2, AlertTriangle, Printer, Hash, RefreshCw, ChevronDown } from 'lucide-react'
import { formatSAR, formatDate, formatHijri, installmentLabelAr } from './format'
import {
  buildContractReferenceHtml,
  LEDGER_TYPE_LABELS,
  type ContractReferenceView,
  type LedgerEntryView,
  type InstallmentView,
} from './property-statement-html'
import { InstallmentScheduleTable } from './installment-schedule-table'
import { printHtmlContent } from './print-document'
import { getContractReferenceStatement } from '@/lib/rentals/summary-data'

// كشف حساب العقد بالرقم الآلي — the FIXED reference number that survives
// renewals (Ejar number changes, this one doesn't) and tenant swaps.

function dual(iso: string): string {
  const g = formatDate(iso)
  const h = formatHijri(iso)
  return h && h !== '—' ? `${g} · ${h}` : g
}

function statusBadgeClass(status: string): string {
  if (status === 'moved_out') return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300'
  if (status === 'expired' || status === 'terminated') return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300'
  if (status === 'active') return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
  return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300'
}

function typeBadgeClass(t: LedgerEntryView['type']): string {
  switch (t) {
    case 'invoice': return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
    case 'payment': return 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/40 dark:text-teal-300'
    case 'credit_note': return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300'
    case 'expense': return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300'
    default: return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300'
  }
}

export function ContractReferenceDialog({
  referenceNo,
  open,
  onOpenChange,
  onOpenProperty,
}: {
  referenceNo: number | null
  open: boolean
  onOpenChange: (v: boolean) => void
  /** Optional cross-link: opens the linked property's statement (جرد context). */
  onOpenProperty?: (propertyId: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ContractReferenceView | null>(null)

  const load = useCallback(async () => {
    if (!referenceNo) return
    setLoading(true)
    setError(null)
    try {
      const json = await getContractReferenceStatement(referenceNo)
      if (!json) throw new Error('تعذّر تحميل كشف حساب العقد')
      setData(json)
    } catch (e: any) {
      setError(e?.message || 'تعذّر تحميل كشف حساب العقد')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [referenceNo])

  useEffect(() => {
    if (open && referenceNo) load()
    if (!open) setData(null)
  }, [open, referenceNo, load])

  const doPrint = () => {
    if (!data) return
    printHtmlContent(buildContractReferenceHtml(data, dual(new Date().toISOString())))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pl-7">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Hash className="h-5 w-5 text-emerald-600" />
              كشف حساب العقد — الرقم الآلي {referenceNo ?? ''}
            </DialogTitle>
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
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> جارٍ تحميل كشف الحساب…
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            <AlertTriangle className="h-5 w-5 shrink-0" /> {error}
          </div>
        )}

        {data && !loading && (
          <div className="space-y-5 text-sm">
            {/* header: current contract + linked property */}
            <div className="rounded-xl border border-emerald-200/70 border-r-4 border-r-emerald-500 bg-emerald-50/50 p-3 dark:border-emerald-900/50 dark:border-r-emerald-600 dark:bg-emerald-950/20">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  العقد الحالي: <span className="font-mono" dir="ltr">{data.current.contractNumber}</span>
                </span>
                <span className="text-slate-700 dark:text-slate-300">{data.current.tenantName || '—'}</span>
                <Badge className={statusBadgeClass(data.current.status)}>{data.current.statusLabelAr}</Badge>
                {data.property && (
                  onOpenProperty ? (
                    <button
                      type="button"
                      onClick={() => onOpenProperty(data.property!.id)}
                      className="text-xs text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
                      title="فتح كشف حساب العقار"
                    >
                      العقار: {data.property.title} <span className="font-mono" dir="ltr">#{data.property.internalId}</span>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500">العقار: {data.property.title} <span className="font-mono" dir="ltr">#{data.property.internalId}</span></span>
                  )
                )}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                الرقم الآلي ثابت لا يتغيّر — يبقى مع العقد عبر التجديد وتغيّر المستأجرين، بينما يتغيّر رقم منصة إيجار
              </div>
            </div>

            {/* debt banner (live) */}
            <div
              className={`rounded-xl border-2 p-3 text-center ${
                data.debtTotal > 0
                  ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                  : 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
              }`}
            >
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">إجمالي المديونيات على هذا الرقم (يُحتسب لحظيًا)</div>
              <div className={`mt-0.5 text-xl font-extrabold ${data.debtTotal > 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                {formatSAR(data.debtTotal)}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                مستحقات فات موعد سدادها ولم تُفوَّتر بعد — ليست قيمة العقد الكاملة
              </div>
            </div>

            {/* summary strip */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Cell label="إجمالي المفوتر (سارية)" value={data.summary.totalInvoiced} />
              <Cell
                label="المحصّل"
                value={data.summary.totalCollected}
                tone="emerald"
                sub={`${formatSAR(data.summary.totalCollectedBase)} أساس + ${formatSAR(data.summary.totalCollectedVat)} ضريبة`}
              />
              <Cell label="الضريبة" value={data.summary.totalVat} />
              <Cell label="إشعارات دائنة · منفصلة" value={data.summary.creditNotesTotal} tone="orange" />
            </div>

            {/* succession under this number */}
            <section>
              <h4 className="mb-2 font-bold text-slate-800 dark:text-slate-200">تسلسل المستأجرين على هذا الرقم</h4>
              <ol className="relative space-y-3 border-r-2 border-slate-200 pr-5 dark:border-slate-800">
                {data.succession.map((t) => {
                  const owes = t.outstanding > 0.005
                  const departedOwing = t.isDeparted && owes
                  return (
                    <li key={t.contractId} className="relative">
                      <span
                        className={`absolute -right-[27px] top-1.5 h-3.5 w-3.5 rounded-full ring-4 ${
                          departedOwing || t.status === 'moved_out'
                            ? 'bg-red-500 ring-red-200 dark:ring-red-900'
                            : t.status === 'active'
                              ? 'bg-emerald-500 ring-emerald-200 dark:ring-emerald-900'
                              : 'bg-slate-400 ring-slate-200 dark:ring-slate-700'
                        }`}
                        aria-hidden
                      />
                      <div
                        className={`rounded-lg border p-3 ${
                          departedOwing
                            ? 'border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20'
                            : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{t.tenantName || '—'}</span>
                          <Badge className={statusBadgeClass(t.status)}>{t.statusLabelAr}</Badge>
                          {t.isRenewal && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                              <RefreshCw className="h-3 w-3" /> تجديد
                            </span>
                          )}
                          {departedOwing && (
                            <span className="rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700 dark:bg-red-950/50 dark:text-red-400">
                              غادر مدينًا بـ {formatSAR(t.outstanding)}
                            </span>
                          )}
                          <span className="mr-auto font-mono text-[11px] text-slate-500" dir="ltr">
                            {t.ejarContractNumber || t.contractNumber}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                          <span>من: {dual(t.startDate)}</span>
                          <span>إلى: {dual(t.endDate)}</span>
                          <span>المفوتر: {formatSAR(t.invoiced)}</span>
                          <span>المحصّل: {formatSAR(t.collected)}</span>
                          {!departedOwing && (
                            <span className={owes ? 'font-semibold text-red-700 dark:text-red-400' : ''}>
                              الرصيد: {formatSAR(t.outstanding)}
                            </span>
                          )}
                        </div>
                        <GenerationSchedule schedule={t.schedule} nextDueNo={t.nextDueNo} />
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>

            {/* overdue-uninvoiced (red) */}
            {data.overdueUninvoiced.length > 0 && (
              <section>
                <h4 className="mb-2 font-bold text-red-700 dark:text-red-400">المستحقات المتأخرة (غير مُصدَّر لها فواتير)</h4>
                <div className="overflow-x-auto rounded-lg border border-red-200 dark:border-red-900">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-red-100/70 text-red-900 dark:bg-red-950/40 dark:text-red-200">
                      <tr>
                        <th className="p-2 font-semibold">المستأجر</th>
                        <th className="p-2 font-semibold">رقم العقد</th>
                        <th className="p-2 font-semibold">القسط</th>
                        <th className="p-2 font-semibold">تاريخ الاستحقاق</th>
                        <th className="p-2 font-semibold">المبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.overdueUninvoiced.map((o, i) => (
                        <tr key={`${o.contractId}-${o.installmentNo}-${i}`} className="border-t border-red-100 text-red-800 dark:border-red-900/60 dark:text-red-300">
                          <td className="p-2 font-medium">{o.tenantName || '—'}</td>
                          <td className="p-2 font-mono" dir="ltr">{o.contractNumber}</td>
                          <td className="p-2">{installmentLabelAr(o.installmentNo)}</td>
                          <td className="p-2">{o.dueDateAD} · {o.dueDateAH} هـ</td>
                          <td className="p-2 font-bold">{formatSAR(o.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* chronological ledger */}
            <section>
              <h4 className="mb-2 font-bold text-slate-800 dark:text-slate-200">سجل الحركات الزمني — من بداية التأجير حتى العقد الحالي</h4>
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
                    {data.entries.length === 0 && (
                      <tr><td colSpan={5} className="p-4 text-center text-slate-400">لا توجد حركات</td></tr>
                    )}
                    {data.entries.map((e, i) => (
                      <tr key={i} className={`border-t border-slate-100 dark:border-slate-800 ${e.cancelled ? 'text-slate-400 line-through' : ''}`}>
                        <td className="p-2 whitespace-nowrap">{dual(e.date)}</td>
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
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Cell({ label, value, tone, sub }: { label: string; value: number; tone?: 'emerald' | 'orange'; sub?: string }) {
  const cls =
    tone === 'emerald' ? 'text-emerald-700 dark:text-emerald-400'
    : tone === 'orange' ? 'text-orange-700 dark:text-orange-400'
    : 'text-slate-800 dark:text-slate-200'
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="text-[10px] text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-0.5 text-sm font-bold ${cls}`}>{formatSAR(value)}</div>
      {sub && <div className="mt-0.5 text-[9px] leading-tight text-slate-400 dark:text-slate-500">{sub}</div>}
    </div>
  )
}

// Collapsible per-generation installment schedule.
function GenerationSchedule({
  schedule,
  nextDueNo,
}: {
  schedule: InstallmentView[]
  nextDueNo: number | null
}) {
  const [open, setOpen] = useState(false)
  if (!schedule || !schedule.length) return null
  const nextDue = schedule.find((s) => s.state === 'next')
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-400"
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        الأقساط ({schedule.length})
        {nextDue && (
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
            القسط القادم: القسط {nextDue.installmentNo}
          </span>
        )}
      </button>
      {open && (
        <div className="mt-2">
          <InstallmentScheduleTable schedule={schedule} nextDueNo={nextDueNo} />
        </div>
      )}
    </div>
  )
}
