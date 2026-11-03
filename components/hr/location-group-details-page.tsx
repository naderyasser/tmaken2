'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronRight, ChevronDown, Loader2, MapPin, Printer, Users, AlertCircle,
} from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { fmtDate, fmtNumber } from '@/lib/hr-format'
import { LocalizedDateInput } from '@/components/ui/localized-date-input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { TransactionsTable } from '@/components/hr/location-group/transactions-table'
import { TransactionMapDialog } from '@/components/hr/location-group/transaction-map-dialog'
import { GroupEmployeesPanel } from '@/components/hr/location-group/group-employees-panel'
import {
  TABS, firstDayOfMonth, todayIso, statusOptionsFor,
  type GroupOverview, type TransactionRow, type TransactionTab,
} from '@/components/hr/location-group/types'

const API = 'base_meena.api.hr_location_groups'

/**
 * «تفاصيل مجموعة المواقع» (Apex M6, `hr/locations-group-details`) — the
 * group's member locations + employee count, then تبويبات الاجازات/الاذونات/
 * البصمات over a date range with اعتماد/رفض, plus a «موظفو المجموعة» panel.
 * Same Apex table/toolbar chrome as `generic-list-page.tsx` / `requests-tabs-page.tsx`.
 */
export function LocationGroupDetailsPage({ group }: { group: string }) {
  const router = useRouter()
  const { toast } = useToast()

  const [overview, setOverview] = useState<GroupOverview | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [overviewError, setOverviewError] = useState(false)

  const [tab, setTab] = useState<TransactionTab>('leaves')
  const [fromDate, setFromDate] = useState(firstDayOfMonth())
  const [toDate, setToDate] = useState(todayIso())
  const [status, setStatus] = useState('')

  const [counts, setCounts] = useState<Record<TransactionTab, number>>({ leaves: 0, permissions: 0, punches: 0 })
  const [rows, setRows] = useState<TransactionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [actionsOpen, setActionsOpen] = useState(false)
  const [mapRow, setMapRow] = useState<TransactionRow | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ kind: 'approve' | 'reject'; rows: TransactionRow[] } | null>(null)
  const [acting, setActing] = useState(false)

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true)
    setOverviewError(false)
    try {
      const r: any = await frappeClient.call<GroupOverview>(`${API}.get_group_overview`, { group })
      setOverview(r?.message ?? null)
    } catch (e: any) {
      setOverviewError(true)
      toast({ title: 'تعذّر تحميل بيانات المجموعة', description: e?.message, variant: 'destructive' })
    } finally {
      setOverviewLoading(false)
    }
  }, [group, toast])

  /** Unfiltered per-tab counts for the tab badges — cheap, one call per tab,
   *  independent of the active tab's own status filter. */
  const loadCounts = useCallback(async () => {
    const results = await Promise.all(TABS.map((t) =>
      frappeClient.call<TransactionRow[]>(`${API}.list_group_transactions`, {
        group, tab: t.id, from_date: fromDate, to_date: toDate,
      }).then((r: any) => (r?.message ?? []).length).catch(() => 0)
    ))
    setCounts({ leaves: results[0], permissions: results[1], punches: results[2] })
  }, [group, fromDate, toDate])

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      const r: any = await frappeClient.call<TransactionRow[]>(`${API}.list_group_transactions`, {
        group, tab, from_date: fromDate, to_date: toDate, status: status || undefined,
      })
      setRows(r?.message ?? [])
    } catch (e: any) {
      toast({ title: 'تعذّر تحميل الحركات', description: e?.message, variant: 'destructive' })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [group, tab, fromDate, toDate, status, toast])

  useEffect(() => { loadOverview() }, [loadOverview])
  useEffect(() => { loadCounts() }, [loadCounts])
  useEffect(() => { setSelected(new Set()); loadRows() }, [loadRows])

  const refreshAfterMutation = () => { loadRows(); loadCounts() }

  const toggleOne = (name: string) => setSelected((prev) => {
    const next = new Set(prev)
    next.has(name) ? next.delete(name) : next.add(name)
    return next
  })
  const toggleAll = () => setSelected((prev) => {
    const allChecked = rows.length > 0 && rows.every((r) => prev.has(r.name))
    if (allChecked) return new Set()
    return new Set(rows.map((r) => r.name))
  })

  const runAction = async () => {
    if (!confirmAction) return
    setActing(true)
    const method = confirmAction.kind === 'approve' ? 'approve_transaction' : 'reject_transaction'
    let ok = 0, failed = 0
    for (const row of confirmAction.rows) {
      try {
        await frappeClient.call(`${API}.${method}`, { doctype: row.doctype, name: row.name })
        ok++
      } catch { failed++ }
    }
    setActing(false)
    setConfirmAction(null)
    setSelected(new Set())
    toast({
      title: confirmAction.kind === 'approve' ? `تم اعتماد ${ok}` : `تم رفض ${ok}`,
      description: failed ? `تعذّرت العملية على ${failed}` : undefined,
      variant: failed ? 'destructive' : undefined,
    })
    refreshAfterMutation()
  }

  const doPrint = () => {
    requestAnimationFrame(() => window.print())
  }

  const tabLabel = TABS.find((t) => t.id === tab)!.label
  const groupLocations = overview?.locations ?? []

  return (
    <div dir="rtl" className="space-y-3 p-4 font-[family-name:var(--font-arabic)]">
      {/* ── Print-only view (see app/globals.css for the rules hiding the shell chrome) ── */}
      <div className="hidden print:block">
        <h1 className="text-lg font-bold mb-1">مجموعة المواقع — {overview?.location_name || group}</h1>
        <p className="text-xs text-slate-500 mb-1">
          {(overview?.locations || []).map((l) => l.location_name).join('، ') || '—'} · عدد الموظفين: {fmtNumber(overview?.employee_count || 0)}
        </p>
        <p className="text-xs text-slate-500 mb-4">{tabLabel} — {fmtDate(fromDate)} إلى {fmtDate(toDate)} — {fmtDate(new Date())}</p>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="border border-slate-300 px-2 py-1 text-right">الموظف</th>
              <th className="border border-slate-300 px-2 py-1 text-right">الفرع</th>
              <th className="border border-slate-300 px-2 py-1 text-right">النوع</th>
              <th className="border border-slate-300 px-2 py-1 text-right">التاريخ</th>
              <th className="border border-slate-300 px-2 py-1 text-right">الحالة</th>
              <th className="border border-slate-300 px-2 py-1 text-right">السبب</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.doctype}-${r.name}`}>
                <td className="border border-slate-300 px-2 py-1">{r.employee_name || r.employee}</td>
                <td className="border border-slate-300 px-2 py-1">{r.branch || '—'}</td>
                <td className="border border-slate-300 px-2 py-1">{r.type || '—'}</td>
                <td className="border border-slate-300 px-2 py-1">{fmtDate(r.date)}{r.date_to ? ` — ${fmtDate(r.date_to)}` : ''}</td>
                <td className="border border-slate-300 px-2 py-1">{r.status_label}</td>
                <td className="border border-slate-300 px-2 py-1">{r.reason || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="print:hidden space-y-3">
        {/* ── Header: breadcrumb, locations chips, employee count, طباعة ── */}
        <div className="bg-white rounded shadow-sm border border-slate-200/60 p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1 text-[13px] text-slate-500">
              <button type="button" onClick={() => router.push('/hr?module=location-groups')} className="flex items-center gap-1 text-[var(--apex-blue)] hover:underline">
                <ChevronRight className="h-4 w-4" />مجموعات المواقع
              </button>
              <span className="mx-1">/</span>
              <span className="text-slate-700 font-bold">{overview?.location_name || group}</span>
            </div>
            <button
              type="button"
              onClick={doPrint}
              className="rounded px-4 h-9 font-bold text-[13px] border border-[var(--apex-slate)] text-[var(--apex-slate)] hover:bg-slate-50 flex items-center gap-1.5"
              aria-label="الطباعة"
            >
              <Printer className="h-4 w-4" />الطباعة
            </button>
          </div>

          {overviewLoading ? (
            <div className="py-6 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[var(--apex-blue)]" /></div>
          ) : overviewError ? (
            <div className="mt-3 flex items-center gap-2 rounded bg-amber-50 border border-amber-200 px-3 py-2 text-[12.5px] text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0" /><span>تعذّر تحميل بيانات المجموعة.</span>
            </div>
          ) : (
            <div className="mt-3 flex items-center flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--apex-blue-light)]/10 text-[var(--apex-blue)] px-3 py-1 text-[12.5px] font-bold">
                <Users className="h-3.5 w-3.5" />عدد الموظفين: {fmtNumber(overview?.employee_count || 0)}
              </span>
              {groupLocations.length === 0 ? (
                <span className="text-[12.5px] text-slate-400">لا توجد مواقع في هذه المجموعة</span>
              ) : groupLocations.map((l) => (
                <span
                  key={l.name}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] border',
                    l.custom_status === 'Inactive' ? 'border-slate-200 text-slate-400 bg-slate-50' : 'border-[var(--apex-border)] text-slate-700 bg-white',
                  )}
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {l.location_name}
                  <span className="text-slate-400">(نطاق {fmtNumber(l.custom_radius_m || 0)} م)</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Filters ── */}
        <div className="bg-white rounded shadow-sm border border-slate-200/60 p-3 flex items-end flex-wrap gap-3">
          <div>
            <label className="block text-[12px] text-slate-600 mb-1">من تاريخ</label>
            <LocalizedDateInput value={fromDate} onChange={setFromDate} locale="ar" aria-label="من تاريخ" />
          </div>
          <div>
            <label className="block text-[12px] text-slate-600 mb-1">إلى تاريخ</label>
            <LocalizedDateInput value={toDate} onChange={setToDate} locale="ar" aria-label="إلى تاريخ" />
          </div>
          <div>
            <label className="block text-[12px] text-slate-600 mb-1">الحالة</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="تصفية حسب الحالة"
              className="h-9 rounded border border-[var(--apex-border)] bg-white px-2 text-[13px] text-slate-800 outline-none focus:border-[var(--apex-blue)] min-w-[160px]"
            >
              <option value="">كل الحالات</option>
              {statusOptionsFor(tab).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="border-t border-b border-slate-200 bg-white">
          <div className="flex items-center overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { setTab(t.id); setStatus('') }}
                aria-current={tab === t.id ? 'page' : undefined}
                className={cn(
                  'relative px-8 h-[60px] text-[16px] font-bold flex items-center gap-2 transition-colors shrink-0',
                  tab === t.id ? 'text-[var(--apex-blue)]' : 'text-slate-500 hover:text-slate-700',
                )}
              >
                <span>{t.label}</span>
                <span className={cn('min-w-[22px] h-[22px] rounded-full text-white text-[12px] flex items-center justify-center px-1',
                  tab === t.id ? 'bg-[var(--apex-blue)]' : 'bg-slate-400')}>{fmtNumber(counts[t.id])}</span>
                {tab === t.id && <span className="absolute bottom-0 right-0 left-0 h-[3px] bg-[var(--apex-blue)]" />}
              </button>
            ))}
          </div>
        </div>

        {/* ── Table + bulk toolbar ── */}
        <div className="bg-white rounded shadow-sm border border-slate-200/60 overflow-hidden">
          {tab !== 'punches' && (
            <div className="flex items-center gap-2 p-3 border-b border-slate-100">
              <div className="relative shrink-0">
                <button
                  type="button"
                  disabled={selected.size === 0}
                  onClick={() => setActionsOpen((v) => !v)}
                  className="rounded px-4 h-9 font-bold text-[13px] border border-[var(--apex-slate)] text-[var(--apex-slate)] disabled:opacity-50 min-w-[120px] flex items-center justify-between gap-2"
                >
                  الاجراءات
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {actionsOpen && selected.size > 0 && (
                  <div className="absolute z-20 mt-1 w-40 rounded border border-slate-200 bg-white shadow-lg py-1 text-[13px]">
                    <button
                      className="block w-full text-right px-3 py-1.5 hover:bg-slate-50 text-[var(--apex-green)]"
                      onClick={() => { setActionsOpen(false); setConfirmAction({ kind: 'approve', rows: rows.filter((r) => selected.has(r.name)) }) }}
                    >
                      اعتماد
                    </button>
                    <button
                      className="block w-full text-right px-3 py-1.5 hover:bg-slate-50 text-[var(--apex-red)]"
                      onClick={() => { setActionsOpen(false); setConfirmAction({ kind: 'reject', rows: rows.filter((r) => selected.has(r.name)) }) }}
                    >
                      رفض
                    </button>
                  </div>
                )}
              </div>
              {selected.size > 0 && <span className="text-[12.5px] text-slate-500">{fmtNumber(selected.size)} محدد</span>}
            </div>
          )}

          <TransactionsTable
            tab={tab}
            rows={rows}
            loading={loading}
            selected={selected}
            onToggleOne={toggleOne}
            onToggleAll={toggleAll}
            onApprove={(row) => setConfirmAction({ kind: 'approve', rows: [row] })}
            onReject={(row) => setConfirmAction({ kind: 'reject', rows: [row] })}
            onShowMap={setMapRow}
          />
        </div>

        <GroupEmployeesPanel group={group} onChanged={loadOverview} />
      </div>

      <TransactionMapDialog row={mapRow} onOpenChange={(o) => { if (!o) setMapRow(null) }} />

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(o) => { if (!o) setConfirmAction(null) }}
        title={confirmAction?.kind === 'approve' ? 'اعتماد الحركات المحددة' : 'رفض الحركات المحددة'}
        description={confirmAction ? `سيتم ${confirmAction.kind === 'approve' ? 'اعتماد' : 'رفض'} ${confirmAction.rows.length} حركة.` : ''}
        confirmLabel={confirmAction?.kind === 'approve' ? 'اعتماد' : 'رفض'}
        cancelLabel="إلغاء"
        variant={confirmAction?.kind === 'reject' ? 'destructive' : 'default'}
        confirmClassName={confirmAction?.kind === 'approve' ? 'bg-[var(--apex-green)] hover:bg-[var(--apex-green-dark)] text-white' : undefined}
        loading={acting}
        onConfirm={runAction}
      />
    </div>
  )
}
