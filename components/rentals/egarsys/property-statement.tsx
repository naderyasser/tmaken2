'use client'

// Ported from egarsys src/components/sections/property-statement.tsx (جرد العقارات /
// كشف حساب العقار). The inventory-first report: a table of ALL the company's
// properties with their financial standing; click a row to drill into the detailed
// كشف حساب, or switch to «جرد بالعقود» (by fixed internalId chain). Read-only.
//
// Mechanical changes vs the original:
//   • the four fetch('/api/...') calls → the mirror adapters in lib/rentals/summary-data
//     (getPropertyStatementSummary / getUnlinkedContractsCount /
//      getContractReferenceSummary / getPropertyStatement). The ledger + reference
//     dialogs fetch their own data via the same adapter module.
//   • zustand store (activeCompanyId/activeCompanyName) → useRentalsShell(); the site is
//     single-company, so the reload key is dropped (loads once on mount).
//   • @/components/* → the scoped ports; the printable path keeps printHtmlContent.
//   • The drill-down PropertyStatementView is the shared (data-only) port; its inline
//     contract-number → reference cross-link is not wired here (the reference statement
//     is reached via the «جرد بالعقود» rows / the dedicated dialog instead).

import { useEffect, useMemo, useState } from 'react'
import { Search, Loader2, AlertTriangle, Printer, Building2, ArrowRight, CheckCircle, ChevronDown, ChevronUp, ScrollText, Hash } from 'lucide-react'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { CompanyHeaderLogo } from './ui/company-header-logo'
import { formatSAR, formatDate, formatHijri } from './format'
import {
  buildStatementHtml,
  buildInventoryHtml,
  buildReferenceJardHtml,
  type StatementView,
  type InventoryRowView,
  type InventoryTotalsView,
  type ReferenceJardRowView,
} from './property-statement-html'
import { printHtmlContent } from './print-document'
import { PropertyStatementView } from './property-statement-view'
import { PropertyLedgerDialog } from './property-ledger-dialog'
import { ContractReferenceDialog } from './contract-reference-dialog'
import { useRentalsShell } from './store'
import {
  getPropertyStatementSummary,
  getUnlinkedContractsCount,
  getContractReferenceSummary,
  getPropertyStatement,
} from '@/lib/rentals/summary-data'

// جرد العقارات — the inventory-first page. Opens straight onto a table of ALL
// the company's properties with their financial standing (no searching needed);
// clicking a row drills into the detailed كشف حساب (the existing statement view).
// Presentation/aggregation only — figures come from the same derivation lib as the
// detailed statement.

type SortKey = 'internalId' | 'deedNumber' | 'title' | 'currentTenant' | 'contractsCount' | 'debtTotal' | 'collected'

export default function PropertyStatementSection() {
  const { companyName: activeCompanyName, setCurrentSection } = useRentalsShell()

  // --- inventory (جرد) ---
  const [rows, setRows] = useState<InventoryRowView[] | null>(null)
  const [totals, setTotals] = useState<InventoryTotalsView | null>(null)
  const [invLoading, setInvLoading] = useState(true)
  const [invError, setInvError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('debtTotal')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  // View chips: one-tap focus (الكل default; debt-first sort keeps red rows on top)
  const [viewChip, setViewChip] = useState<'all' | 'debt' | 'rented' | 'vacant'>('all')

  // --- جرد mode: by property (default) or by contract reference number ---
  const [jardMode, setJardMode] = useState<'properties' | 'contracts'>('properties')
  const [refRows, setRefRows] = useState<ReferenceJardRowView[] | null>(null)
  const [refTotals, setRefTotals] = useState<{ references: number; generations: number; debtTotal: number; collected: number } | null>(null)
  const [refUnnumbered, setRefUnnumbered] = useState(0)
  const [refChip, setRefChip] = useState<'all' | 'debt' | 'multi'>('all')
  const [refSortKey, setRefSortKey] = useState<'referenceNo' | 'currentTenant' | 'generations' | 'debtTotal' | 'collected'>('debtTotal')
  const [refSortDir, setRefSortDir] = useState<'asc' | 'desc'>('desc')
  const [refDialogNo, setRefDialogNo] = useState<number | null>(null)
  const [refDialogOpen, setRefDialogOpen] = useState(false)

  // --- unlinked-contracts guidance ---
  const [unlinkedCount, setUnlinkedCount] = useState(0)

  // --- ledger (سجل الحركات) ---
  const [ledgerOpen, setLedgerOpen] = useState(false)
  const [ledgerPropertyId, setLedgerPropertyId] = useState<string | null>(null)

  // --- drill-down (detailed statement) ---
  const [selected, setSelected] = useState<InventoryRowView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<StatementView | null>(null)

  const loadInventory = async () => {
    setInvLoading(true)
    setInvError(null)
    try {
      const [sum, unlinked, ref] = await Promise.all([
        getPropertyStatementSummary(),
        getUnlinkedContractsCount().catch(() => 0),
        getContractReferenceSummary().catch(() => null),
      ])
      setRows(sum.properties || [])
      setTotals(sum.totals || null)
      setUnlinkedCount(unlinked ?? 0)
      if (ref) {
        setRefRows(ref.references || [])
        setRefTotals(ref.totals || null)
        setRefUnnumbered(ref.unnumbered ?? 0)
      } else {
        setRefRows(null)
        setRefTotals(null)
      }
    } catch (e: any) {
      setInvError(e?.message || 'تعذّر تحميل الجرد')
      setRows(null)
      setTotals(null)
    } finally {
      setInvLoading(false)
    }
  }

  useEffect(() => {
    setSelected(null)
    setData(null)
    setFilter('')
    loadInventory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openStatement = async (p: InventoryRowView) => {
    setSelected(p)
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const json = await getPropertyStatement(p.id)
      if (!json) throw new Error('تعذّر تحميل كشف الحساب')
      setData(json)
    } catch (e: any) {
      setError(e?.message || 'تعذّر تحميل كشف الحساب')
    } finally {
      setLoading(false)
    }
  }

  const backToInventory = () => {
    setSelected(null)
    setData(null)
    setError(null)
  }

  // Hide columns that are empty for EVERY property (e.g. رقم الصك before any
  // deed numbers are entered) — a full column of dashes is dead weight.
  const hasDeed = useMemo(() => (rows ?? []).some((r) => r.deedNumber), [rows])

  const sorted = useMemo(() => {
    if (!rows) return []
    const q = filter.trim().toLowerCase()
    let filtered = q
      ? rows.filter((r) =>
          [String(r.internalId), r.deedNumber || '', r.title, r.currentTenant || '', r.city || '']
            .join(' ')
            .toLowerCase()
            .includes(q),
        )
      : rows
    if (viewChip === 'debt') filtered = filtered.filter((r) => r.debtTotal > 0)
    else if (viewChip === 'rented') filtered = filtered.filter((r) => !!r.currentTenant)
    else if (viewChip === 'vacant') filtered = filtered.filter((r) => !r.currentTenant)
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv), 'ar') * dir
    })
  }, [rows, filter, sortKey, sortDir, viewChip])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'title' || key === 'currentTenant' || key === 'deedNumber' ? 'asc' : 'desc')
    }
  }

  const printInventory = () => {
    if (!rows || !totals) return
    const nowIso = new Date().toISOString()
    const h = formatHijri(nowIso)
    const dateLabel = `${formatDate(nowIso)}${h && h !== '—' ? ' · ' + h : ''}`
    printHtmlContent(buildInventoryHtml({ rows: sorted.length ? sorted : rows, totals, companyName: activeCompanyName, dateLabel }))
  }

  // ---- جرد بالعقود: filter/sort + print ----
  const refSorted = useMemo(() => {
    if (!refRows) return []
    const q = filter.trim().toLowerCase()
    let filtered = q
      ? refRows.filter((r) =>
          [String(r.referenceNo), r.currentTenant || '', r.currentContractNumber, r.property?.title || '']
            .join(' ')
            .toLowerCase()
            .includes(q),
        )
      : refRows
    if (refChip === 'debt') filtered = filtered.filter((r) => r.debtTotal > 0)
    else if (refChip === 'multi') filtered = filtered.filter((r) => r.generations > 1)
    const dir = refSortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = a[refSortKey] ?? ''
      const bv = b[refSortKey] ?? ''
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv), 'ar') * dir
    })
  }, [refRows, filter, refChip, refSortKey, refSortDir])

  const toggleRefSort = (key: typeof refSortKey) => {
    if (refSortKey === key) setRefSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setRefSortKey(key)
      setRefSortDir(key === 'currentTenant' ? 'asc' : 'desc')
    }
  }

  const printReferences = () => {
    if (!refRows || !refTotals) return
    const nowIso = new Date().toISOString()
    const h = formatHijri(nowIso)
    const dateLabel = `${formatDate(nowIso)}${h && h !== '—' ? ' · ' + h : ''}`
    printHtmlContent(buildReferenceJardHtml({ rows: refSorted.length ? refSorted : refRows, totals: refTotals, companyName: activeCompanyName, dateLabel }))
  }

  const openReferenceDialog = (no: number) => {
    setRefDialogNo(no)
    setRefDialogOpen(true)
  }

  const Th = ({ k, children, numeric }: { k: SortKey; children: React.ReactNode; numeric?: boolean }) => (
    <th
      onClick={() => toggleSort(k)}
      className={`cursor-pointer select-none p-2 font-semibold hover:bg-slate-200/60 dark:hover:bg-slate-700/40 ${numeric ? '' : ''}`}
      title="ترتيب"
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortKey === k && (sortDir === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)}
      </span>
    </th>
  )

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      {/* ---- Page header ---- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <CompanyHeaderLogo className="h-11" />
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">جرد العقارات</h1>
          </div>
          <p className="text-slate-500 text-sm mt-1 font-medium">
            جرد شامل لعقارات الشركة: المديونيات، المحصّل، والمستأجرين — اضغط على أي عقار لكشف حسابه التفصيلي
          </p>
        </div>
        {!selected && jardMode === 'properties' && rows !== null && rows.length > 0 && (
          <Button onClick={printInventory} variant="outline" className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400">
            <Printer className="h-4 w-4" /> طباعة الجرد
          </Button>
        )}
        {!selected && jardMode === 'contracts' && refRows !== null && refRows.length > 0 && (
          <Button onClick={printReferences} variant="outline" className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400">
            <Printer className="h-4 w-4" /> طباعة جرد العقود
          </Button>
        )}
      </div>

      {/* ---- Guidance: contracts not linked to any property ---- */}
      {!selected && unlinkedCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            يوجد <b>{unlinkedCount}</b> {unlinkedCount === 1 ? 'عقد غير مرتبط' : 'عقود غير مرتبطة'} بأي عقار — لن {unlinkedCount === 1 ? 'يظهر' : 'تظهر'} في أي كشف حساب حتى يتم ربطها
          </span>
          <Button
            size="sm"
            onClick={() => setCurrentSection('contract-linking')}
            className="gap-1.5 bg-amber-600 text-white hover:bg-amber-700"
          >
            ربط العقود
          </Button>
        </div>
      )}

      {/* ================= DRILL-DOWN: detailed statement ================= */}
      {selected ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button onClick={backToInventory} variant="outline" className="gap-2">
              <ArrowRight className="h-4 w-4" /> عودة للجرد
            </Button>
            {data && !loading && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setLedgerPropertyId(selected.id)
                    setLedgerOpen(true)
                  }}
                  className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400"
                >
                  <ScrollText className="h-4 w-4" /> سجل الحركات
                </Button>
                <Button onClick={() => printHtmlContent(buildStatementHtml(data))} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
                  <Printer className="h-4 w-4" /> طباعة كشف الحساب
                </Button>
              </div>
            )}
          </div>

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
            <Card>
              <CardContent className="p-5">
                <PropertyStatementView data={data} />
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <>
          {/* ================= THE INVENTORY (جرد) ================= */}
          {/* mode toggle: by property | by contract reference number */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit dark:border-slate-800 dark:bg-slate-900/40">
            {([
              { key: 'properties', label: 'جرد بالعقارات', icon: Building2 },
              { key: 'contracts', label: 'جرد بالعقود', icon: Hash },
            ] as const).map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setJardMode(m.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                  jardMode === m.key
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-600 hover:bg-white dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <m.icon className="h-4 w-4" /> {m.label}
              </button>
            ))}
          </div>

          {invLoading && (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" /> جارٍ تحميل جرد العقارات…
            </div>
          )}

          {invError && !invLoading && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              <AlertTriangle className="h-5 w-5 shrink-0" /> {invError}
            </div>
          )}

          {/* zero-properties explainer */}
          {jardMode === 'properties' && !invLoading && !invError && rows !== null && rows.length === 0 && (
            <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/60 p-8 text-center dark:border-amber-800 dark:bg-amber-950/20">
              <Building2 className="h-10 w-10 text-amber-500" />
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-200">لا توجد عقارات مسجلة لهذه الشركة</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  كشف الحساب يعتمد على ربط العقود بالعقارات — أضف عقارًا ثم اربط عقوده ليظهر كشفه هنا
                </p>
              </div>
              <Button onClick={() => setCurrentSection('properties')} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
                <Building2 className="h-4 w-4" /> إضافة عقار
              </Button>
            </div>
          )}

          {jardMode === 'properties' && !invLoading && !invError && rows !== null && rows.length > 0 && totals && (
            <div className="space-y-3">
              {/* company-wide debt banner */}
              <div
                className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 p-3 ${
                  totals.debtTotal > 0
                    ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                    : 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                }`}
              >
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  إجمالي مديونيات الشركة عبر {totals.properties} عقارًا ({totals.activeContracts ?? totals.contracts} عقدًا نشطًا):
                </span>
                <span className={`text-xl font-extrabold ${totals.debtTotal > 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  {formatSAR(totals.debtTotal)}
                </span>
                <span className="w-full text-[11px] text-slate-500 dark:text-slate-400">
                  المديونيات = مستحقات فات موعد سدادها ولم تُفوَّتر بعد، وليست قيمة العقود الكاملة
                </span>
              </div>

              {/* view chips + filter */}
              <div className="flex flex-wrap items-center gap-2">
                {([
                  { key: 'all', label: 'الكل' },
                  { key: 'debt', label: 'عليها مديونيات' },
                  { key: 'rented', label: 'مؤجرة' },
                  { key: 'vacant', label: 'شاغرة' },
                ] as const).map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setViewChip(c.key)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      viewChip === c.key
                        ? 'border-emerald-500 bg-emerald-600 text-white'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
                <div className="relative mr-auto w-full max-w-xs sm:w-auto">
                  <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="تصفية: رقم آلي، صك، اسم عقار، مستأجر…"
                    className="pr-10 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </div>

              {/* the table */}
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800/60">
                    <tr>
                      <Th k="internalId">الرقم الآلي</Th>
                      {hasDeed && <Th k="deedNumber">رقم الصك</Th>}
                      <Th k="title">اسم العقار</Th>
                      <Th k="currentTenant">المستأجر الحالي</Th>
                      <Th k="contractsCount">عدد العقود</Th>
                      <Th k="debtTotal">المديونيات</Th>
                      <Th k="collected">المحصّل</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length === 0 && (
                      <tr><td colSpan={hasDeed ? 7 : 6} className="p-4 text-center text-slate-400">لا توجد نتائج مطابقة للتصفية</td></tr>
                    )}
                    {sorted.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => openStatement(r)}
                        className={`group cursor-pointer border-t border-slate-100 transition-colors hover:bg-emerald-50 active:bg-emerald-100 dark:border-slate-800 dark:hover:bg-emerald-950/30 ${
                          r.debtTotal > 0 ? 'bg-red-50/40 dark:bg-red-950/10' : ''
                        }`}
                        title="فتح كشف الحساب التفصيلي"
                      >
                        <td className="p-2" dir="ltr">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setLedgerPropertyId(r.id)
                              setLedgerOpen(true)
                            }}
                            className="font-mono font-bold text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
                            title="فتح سجل حركات العقار"
                          >
                            {r.internalId || '—'}
                          </button>
                        </td>
                        {hasDeed && <td className="p-2 font-mono" dir="ltr">{r.deedNumber || '—'}</td>}
                        <td className="p-2 font-medium underline-offset-2 group-hover:text-emerald-700 group-hover:underline dark:group-hover:text-emerald-400">{r.title}</td>
                        <td className="p-2">{r.currentTenant || <span className="text-slate-400">شاغر</span>}</td>
                        <td className="p-2" dir="ltr">{r.contractsCount}</td>
                        <td className="p-2 font-bold">
                          {r.debtTotal > 0 ? (
                            <span className="text-red-700 dark:text-red-400">{formatSAR(r.debtTotal)}</span>
                          ) : (
                            <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400" title="لا مديونيات">
                              <CheckCircle className="h-4 w-4" />
                            </span>
                          )}
                        </td>
                        <td className="p-2">{r.collected > 0 ? formatSAR(r.collected) : <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-50 font-extrabold dark:border-slate-700 dark:bg-slate-900/60">
                      <td className="p-2" colSpan={hasDeed ? 4 : 3}>الإجمالي</td>
                      <td className="p-2" dir="ltr">{totals.contracts}</td>
                      <td className={`p-2 ${totals.debtTotal > 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{formatSAR(totals.debtTotal)}</td>
                      <td className="p-2">{formatSAR(totals.collected)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ================= جرد بالعقود (by reference number) ================= */}
          {jardMode === 'contracts' && !invLoading && !invError && refRows !== null && refTotals && (
            <div className="space-y-3">
              {/* company-debt banner (by contract chains — works even before property linkage) */}
              <div
                className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 p-3 ${
                  refTotals.debtTotal > 0
                    ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                    : 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                }`}
              >
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  إجمالي مديونيات الشركة عبر {refTotals.references} رقمًا داخليًا ({refTotals.generations} عقدًا):
                </span>
                <span className={`text-xl font-extrabold ${refTotals.debtTotal > 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  {formatSAR(refTotals.debtTotal)}
                </span>
                <span className="w-full text-[11px] text-slate-500 dark:text-slate-400">
                  المديونيات = مستحقات فات موعد سدادها ولم تُفوَّتر بعد، وليست قيمة العقود الكاملة
                </span>
              </div>

              {refUnnumbered > 0 && (
                <div className="text-xs text-amber-700 dark:text-amber-400">
                  {refUnnumbered} عقدًا بدون رقم داخلي — لا يمكن إدراجها في هذا الجرد حتى يُحدَّد رقمها
                </div>
              )}

              {/* chips + filter */}
              <div className="flex flex-wrap items-center gap-2">
                {([
                  { key: 'all', label: 'الكل' },
                  { key: 'debt', label: 'عليها مديونيات' },
                  { key: 'multi', label: 'متعددة الأجيال' },
                ] as const).map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setRefChip(c.key)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      refChip === c.key
                        ? 'border-emerald-500 bg-emerald-600 text-white'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
                <div className="relative mr-auto w-full max-w-xs sm:w-auto">
                  <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="تصفية: رقم داخلي، مستأجر، رقم منصة…"
                    className="pr-10 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </div>

              {/* the table */}
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800/60">
                    <tr>
                      {([
                        { k: 'referenceNo', label: 'الرقم الداخلي' },
                        { k: 'currentTenant', label: 'المستأجر الحالي' },
                      ] as const).map((h) => (
                        <th key={h.k} onClick={() => toggleRefSort(h.k)} className="cursor-pointer select-none p-2 font-semibold hover:bg-slate-200/60 dark:hover:bg-slate-700/40">
                          <span className="inline-flex items-center gap-1">
                            {h.label}
                            {refSortKey === h.k && (refSortDir === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)}
                          </span>
                        </th>
                      ))}
                      <th className="p-2 font-semibold">رقم المنصة الحالي</th>
                      <th className="p-2 font-semibold">العقار</th>
                      {([
                        { k: 'generations', label: 'الأجيال' },
                        { k: 'debtTotal', label: 'المديونيات' },
                        { k: 'collected', label: 'المحصّل' },
                      ] as const).map((h) => (
                        <th key={h.k} onClick={() => toggleRefSort(h.k)} className="cursor-pointer select-none p-2 font-semibold hover:bg-slate-200/60 dark:hover:bg-slate-700/40">
                          <span className="inline-flex items-center gap-1">
                            {h.label}
                            {refSortKey === h.k && (refSortDir === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {refSorted.length === 0 && (
                      <tr><td colSpan={7} className="p-4 text-center text-slate-400">لا توجد نتائج مطابقة</td></tr>
                    )}
                    {refSorted.map((r) => (
                      <tr
                        key={r.referenceNo}
                        onClick={() => openReferenceDialog(r.referenceNo)}
                        className={`group cursor-pointer border-t border-slate-100 transition-colors hover:bg-emerald-50 active:bg-emerald-100 dark:border-slate-800 dark:hover:bg-emerald-950/30 ${
                          r.debtTotal > 0 ? 'bg-red-50/40 dark:bg-red-950/10' : ''
                        }`}
                        title="فتح كشف حساب العقد"
                      >
                        <td className="p-2 font-mono font-bold text-emerald-700 underline-offset-2 group-hover:underline dark:text-emerald-400" dir="ltr">{r.referenceNo}</td>
                        <td className="p-2 font-medium">{r.currentTenant || <span className="text-slate-400">—</span>}</td>
                        <td className="p-2 font-mono" dir="ltr">{r.currentContractNumber}</td>
                        <td className="p-2">
                          {r.property ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                const row = rows?.find((p) => p.id === r.property!.id)
                                if (row) {
                                  setJardMode('properties')
                                  openStatement(row)
                                }
                              }}
                              className="text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
                              title="فتح كشف حساب العقار"
                            >
                              {r.property.title}
                            </button>
                          ) : (
                            <span className="text-slate-400">غير مرتبط</span>
                          )}
                        </td>
                        <td className="p-2" dir="ltr">{r.generations}</td>
                        <td className="p-2 font-bold">
                          {r.debtTotal > 0 ? (
                            <span className="text-red-700 dark:text-red-400">{formatSAR(r.debtTotal)}</span>
                          ) : (
                            <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400" title="لا مديونيات">
                              <CheckCircle className="h-4 w-4" />
                            </span>
                          )}
                        </td>
                        <td className="p-2">{r.collected > 0 ? formatSAR(r.collected) : <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-50 font-extrabold dark:border-slate-700 dark:bg-slate-900/60">
                      <td className="p-2" colSpan={4}>الإجمالي</td>
                      <td className="p-2" dir="ltr">{refTotals.generations}</td>
                      <td className={`p-2 ${refTotals.debtTotal > 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{formatSAR(refTotals.debtTotal)}</td>
                      <td className="p-2">{formatSAR(refTotals.collected)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* كشف حساب العقد بالرقم الداخلي — from the جرد بالعقود rows */}
      <ContractReferenceDialog
        referenceNo={refDialogNo}
        open={refDialogOpen}
        onOpenChange={setRefDialogOpen}
        onOpenProperty={(propertyId) => {
          setRefDialogOpen(false)
          const row = rows?.find((p) => p.id === propertyId)
          if (row) {
            setJardMode('properties')
            openStatement(row)
          }
        }}
      />

      {/* سجل حركات العقار — opened from the internalId anywhere on this page */}
      <PropertyLedgerDialog
        propertyId={ledgerPropertyId}
        open={ledgerOpen}
        onOpenChange={setLedgerOpen}
        onOpenStatement={() => {
          setLedgerOpen(false)
          const row = rows?.find((r) => r.id === ledgerPropertyId)
          if (row && (!selected || selected.id !== row.id)) openStatement(row)
        }}
      />
    </div>
  )
}
