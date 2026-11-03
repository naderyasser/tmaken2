'use client'

// «المحاسبة» — the rentals-native accounting HUB. A tabbed shell that keeps the
// focused rental view AND embeds the platform's full accounting tools in-place
// (no redirect to the standalone /accounting module).
//
//   • FIRST tab «قيود الإيجار» = the focused rental view (unchanged): summary cards
//     for the 3 dedicated rental accounts' balances (ذمم عقود الإيجار / إيرادات
//     الإيجار / ض.ق.م الإيجار — auto-created by the aqar_bridge journal feed), a
//     total (gross) figure, the count of قيود, and the list of Journal Entries that
//     came from rental invoices (cheque_no LIKE 'EGARSYS::%'), with the SAME print
//     button (ReportPrintButton) and pager (ListPager) the accounting pages use.
//   • The remaining tabs embed each platform accounting tool via a same-origin
//     <iframe src="/accounting/<tool>?embed=1"> (session cookie shared → authed;
//     the accounting shell renders chrome-free when ?embed=1). Lazy-mounted: the
//     iframe for a tool only exists while its tab is active.
//
// The rental view reads the current tenant's real Frappe accounting through
// @/lib/accounting-api via the lib/rentals/rental-accounting-data helper. Read-only.
// Reads the shell store itself (no required props), like the other rentals sections.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Landmark, Wallet, Percent, Receipt, Hash, Home,
  RefreshCw, AlertCircle, FileText,
} from 'lucide-react'

import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Skeleton } from './ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table'
import { CompanyHeaderLogo } from './ui/company-header-logo'
import { useRentalsShell } from './store'
import { formatSAR, formatDate, toArabicNumerals } from './format'
import { cn } from '@/lib/utils'

import { ReportPrintButton, type PrintCell } from '@/components/accounting/report-print'
import { ListPager } from '@/components/accounting/list-pager'
import type { JournalEntryAccount } from '@/lib/accounting-api'
import {
  getRentalAccountBalances,
  getRentalJournalEntries,
  getRentalJournalTotals,
  getAllRentalJournalEntries,
  shortAccountName,
  type RentalAccountBalance,
  type RentalJournalEntry,
  type RentalJournalTotals,
} from '@/lib/rentals/rental-accounting-data'

// ---------------------------------------------------------------------------
// Constants / helpers
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50

/** The embedded platform-tool tabs. `id` = the /accounting/<id> route; the labels
 *  match the platform accounting shell verbatim. */
const TOOL_TABS = [
  { id: 'chart-of-accounts', label: 'شجرة الحسابات' },
  { id: 'general-ledger', label: 'دفتر الأستاذ' },
  { id: 'journal-entries', label: 'قيود اليومية' },
  { id: 'trial-balance', label: 'ميزان المراجعة' },
  { id: 'balance-sheet', label: 'الميزانية العمومية' },
  { id: 'pnl', label: 'قائمة الدخل' },
  { id: 'cash-flow', label: 'التدفق النقدي' },
  { id: 'ar-aging', label: 'أعمار الذمم المدينة' },
  { id: 'vat', label: 'ضريبة القيمة المضافة' },
] as const

/** id of the first (focused rental) tab. */
const RENTAL_TAB = 'rental'

/** Plain 2-decimal accounting number (LTR, monospaced) for the قيود table — mirrors
 *  the platform's journal-entries page. */
function fmtAmount(n: number | undefined | null): string {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const DOC_STATUS: Record<number, { label: string; variant: 'neutral' | 'success' | 'danger' }> = {
  0: { label: 'مسودة', variant: 'neutral' },
  1: { label: 'مرحّل', variant: 'success' },
  2: { label: 'ملغي', variant: 'danger' },
}

function statusOf(docstatus: number | undefined) {
  return DOC_STATUS[docstatus ?? 0] ?? DOC_STATUS[0]
}

/** Legs → a compact " + "-joined list of short account names, for the print report. */
function legsToText(legs: JournalEntryAccount[]): string {
  if (!legs.length) return '—'
  return legs.map((l) => shortAccountName(l.account)).join(' + ')
}

// ---------------------------------------------------------------------------
// Summary card (glass style — matches invoices.tsx SummaryCard 1:1)
// ---------------------------------------------------------------------------

function SummaryCard({ icon, iconBg, title, value, valueColor }: {
  icon: ReactNode
  iconBg: string
  title: string
  value: string | number
  valueColor?: string
}) {
  return (
    <Card className="group relative overflow-hidden bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-100 dark:border-slate-800/80 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] transition-all duration-300 hover:-translate-y-1">
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
      <CardContent className="p-6 relative z-10">
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl shrink-0 shadow-inner transition-transform duration-300 group-hover:scale-105"
            style={{ background: `linear-gradient(135deg, ${iconBg}80, ${iconBg})` }}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{title}</p>
            <p className={`text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 tracking-tight ${valueColor || ''}`}>{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SummaryCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Tab 1 — the focused rental قيود + balances view (preserved as-is)
// ---------------------------------------------------------------------------

function RentalJournalTab() {
  const { companyName } = useRentalsShell()

  const [balances, setBalances] = useState<RentalAccountBalance[] | null>(null)
  const [totals, setTotals] = useState<RentalJournalTotals | null>(null)
  const [entries, setEntries] = useState<RentalJournalEntry[]>([])
  const [loading, setLoading] = useState(true)     // first load (cards + first page)
  const [pageLoading, setPageLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const total = totals?.count ?? 0

  // Summary (cards) — loaded once; independent of the paged list.
  const loadSummary = useCallback(async () => {
    const [bal, tot] = await Promise.all([
      getRentalAccountBalances(),
      getRentalJournalTotals(),
    ])
    setBalances(bal)
    setTotals(tot)
  }, [])

  // One page of قيود (with legs) — re-runs on page change.
  const loadPage = useCallback(async (p: number, initial = false) => {
    if (!initial) setPageLoading(true)
    try {
      const rows = await getRentalJournalEntries({
        limit_start: (p - 1) * PAGE_SIZE,
        limit_page_length: PAGE_SIZE,
      })
      setEntries(rows)
    } finally {
      if (!initial) setPageLoading(false)
    }
  }, [])

  // First load: cards + first page together.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        await Promise.all([loadSummary(), loadPage(1, true)])
      } catch (e) {
        if (!cancelled) setError((e as { message?: string })?.message || 'فشل تحميل بيانات المحاسبة')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [loadSummary, loadPage])

  // Page changes (after first load).
  useEffect(() => {
    if (loading) return
    loadPage(page).catch((e) =>
      setError((e as { message?: string })?.message || 'فشل تحميل القيود'))
  }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    setError(null)
    setLoading(true)
    setPage(1)
    Promise.all([loadSummary(), loadPage(1, true)])
      .catch((e) => setError((e as { message?: string })?.message || 'فشل التحديث'))
      .finally(() => setLoading(false))
  }, [loadSummary, loadPage])

  const byKey = useMemo(() => {
    const m = new Map<string, RentalAccountBalance>()
    for (const b of balances ?? []) m.set(b.key, b)
    return m
  }, [balances])

  // Page totals (visible rows) for the table footer.
  const pageDebit = entries.reduce((s, e) => s + (e.total_debit ?? 0), 0)
  const pageCredit = entries.reduce((s, e) => s + (e.total_credit ?? 0), 0)

  // ── Print composition (reuses the accounting pages' ReportPrintButton) ──
  const printColumns = [
    { label: 'التاريخ' },
    { label: 'رقم القيد' },
    { label: 'البيان' },
    { label: 'الحسابات' },
    { label: 'مدين', align: 'end' as const },
    { label: 'دائن', align: 'end' as const },
    { label: 'الحالة' },
  ]
  const printRow = (e: RentalJournalEntry): PrintCell[] => [
    formatDate(e.posting_date),
    e.name,
    e.user_remark || '—',
    legsToText(e.accounts),
    fmtAmount(e.total_debit),
    fmtAmount(e.total_credit),
    statusOf(e.docstatus).label,
  ]
  const printFooter = (list: RentalJournalEntry[]): PrintCell[] => [
    { text: 'الإجمالي', bold: true },
    '', '', '',
    fmtAmount(list.reduce((s, e) => s + (e.total_debit ?? 0), 0)),
    fmtAmount(list.reduce((s, e) => s + (e.total_credit ?? 0), 0)),
    '',
  ]
  const printMeta = [
    `عدد القيود: ${total}`,
    ...(companyName ? [companyName] : []),
    `تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}`,
  ]
  // Printing covers EVERY rental قيد, not just the visible page.
  const loadAllForPrint = async () => {
    const all = await getAllRentalJournalEntries()
    return {
      meta: [`عدد القيود: ${all.length}`, ...(companyName ? [companyName] : [])],
      sections: [{ columns: printColumns, rows: all.map(printRow), footer: printFooter(all) }],
    }
  }

  // ---- Loading ----
  if (loading) {
    return (
      <div className="space-y-6" dir="rtl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <SummaryCardSkeleton key={i} />)}
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const receivable = byKey.get('receivable')
  const income = byKey.get('rentIncome')
  const vat = byKey.get('vat')

  return (
    <div className="space-y-6" dir="rtl">
      {/* ---- Tab toolbar (refresh + print — rental-specific actions) ---- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
          القيود المحاسبية للإيجارات المرحّلة آلياً إلى دفاتر الشركة — وأرصدة حسابات الإيجار المخصّصة
        </p>
        <div className="flex items-center gap-2">
          <Button
            onClick={refresh}
            variant="outline"
            className="gap-2 font-semibold whitespace-nowrap"
            title="تحديث"
          >
            <RefreshCw className={`h-4 w-4 ${pageLoading ? 'animate-spin' : ''}`} />
            تحديث
          </Button>
          <ReportPrintButton
            title="القيود المحاسبية للإيجارات"
            meta={printMeta}
            orientation="landscape"
            disabled={entries.length === 0}
            sections={[{ columns: printColumns, rows: entries.map(printRow), footer: printFooter(entries) }]}
            loadSections={loadAllForPrint}
          />
        </div>
      </div>

      {/* ---- Summary cards: 3 account balances + total + count ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <SummaryCard
          icon={<Landmark className="h-6 w-6 text-blue-600" />}
          iconBg="#dbeafe"
          title={receivable?.label || 'ذمم عقود الإيجار'}
          value={formatSAR(receivable?.balance ?? 0)}
          valueColor="text-blue-700 dark:text-blue-400"
        />
        <SummaryCard
          icon={<Wallet className="h-6 w-6 text-emerald-600" />}
          iconBg="#d1fae5"
          title={income?.label || 'إيرادات الإيجار'}
          value={formatSAR(income?.balance ?? 0)}
          valueColor="text-emerald-700 dark:text-emerald-400"
        />
        <SummaryCard
          icon={<Percent className="h-6 w-6 text-amber-600" />}
          iconBg="#fef3c7"
          title={vat?.label || 'ضريبة القيمة المضافة على الإيجار'}
          value={formatSAR(vat?.balance ?? 0)}
          valueColor="text-amber-700 dark:text-amber-400"
        />
        <SummaryCard
          icon={<Receipt className="h-6 w-6 text-teal-600" />}
          iconBg="#ccfbf1"
          title="إجمالي قيمة القيود (شامل الضريبة)"
          value={formatSAR(totals?.totalDebit ?? 0)}
          valueColor="text-teal-700 dark:text-teal-400"
        />
        <SummaryCard
          icon={<Hash className="h-6 w-6 text-slate-600" />}
          iconBg="#e2e8f0"
          title="عدد القيود"
          value={toArabicNumerals(total)}
        />
      </div>

      {/* ---- Error ---- */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm">{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={refresh}>إعادة المحاولة</Button>
          </div>
        </div>
      )}

      {/* ---- قيود list (like the platform's journal-entries page) ---- */}
      <Card className="border-slate-100 dark:border-slate-800/80 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.04)] overflow-hidden rounded-xl bg-white dark:bg-slate-900/60">
        <CardContent className="p-0">
          {entries.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right whitespace-nowrap">التاريخ</TableHead>
                    <TableHead className="text-right whitespace-nowrap">رقم القيد</TableHead>
                    <TableHead className="text-right whitespace-nowrap">البيان</TableHead>
                    <TableHead className="text-right whitespace-nowrap">الحسابات</TableHead>
                    <TableHead className="text-right whitespace-nowrap">مدين</TableHead>
                    <TableHead className="text-right whitespace-nowrap">دائن</TableHead>
                    <TableHead className="text-right whitespace-nowrap">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => {
                    const st = statusOf(e.docstatus)
                    return (
                      <TableRow key={e.name}>
                        <TableCell className="text-xs tabular-nums whitespace-nowrap">{formatDate(e.posting_date)}</TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap" dir="ltr">{e.name}</TableCell>
                        <TableCell className="max-w-[260px]">
                          <span className="block truncate text-sm text-slate-700 dark:text-slate-300" title={e.user_remark || undefined}>
                            {e.user_remark || '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {e.accounts.length === 0 && <span className="text-xs text-slate-400">—</span>}
                            {e.accounts.map((leg, i) => {
                              const isDebit = (leg.debit_in_account_currency ?? 0) > 0
                              const amt = isDebit ? leg.debit_in_account_currency : leg.credit_in_account_currency
                              return (
                                <span
                                  key={i}
                                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap ${
                                    isDebit
                                      ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                  }`}
                                  title={`${isDebit ? 'مدين' : 'دائن'} ${fmtAmount(amt)}`}
                                >
                                  <span>{shortAccountName(leg.account)}</span>
                                  <span dir="ltr" className="font-mono opacity-70">{fmtAmount(amt)}</span>
                                </span>
                              )
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs tabular-nums text-right whitespace-nowrap" dir="ltr">{fmtAmount(e.total_debit)}</TableCell>
                        <TableCell className="font-mono text-xs tabular-nums text-right whitespace-nowrap" dir="ltr">{fmtAmount(e.total_credit)}</TableCell>
                        <TableCell>
                          <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              {/* Page totals */}
              <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-4 py-2 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-end gap-6">
                <span>
                  إجمالي المدين (الصفحة):{' '}
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-200" dir="ltr">{fmtAmount(pageDebit)}</span>
                </span>
                <span>
                  إجمالي الدائن (الصفحة):{' '}
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-200" dir="ltr">{fmtAmount(pageCredit)}</span>
                </span>
              </div>

              {/* Server-side pager (same component the accounting pages use) */}
              <ListPager page={page} pageSize={PAGE_SIZE} total={total} loading={pageLoading} onPage={setPage} />
            </div>
          ) : (
            <div className="py-20 text-center text-slate-400">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-slate-500 dark:text-slate-400">لا توجد قيود محاسبية للإيجارات بعد</p>
              <p className="text-xs mt-1">تُنشأ القيود تلقائياً عند ترحيل فواتير الإيجار إلى دفاتر الشركة</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main — the tabbed accounting hub
// ---------------------------------------------------------------------------

export default function AccountingSection() {
  const { setCurrentSection } = useRentalsShell()
  const [active, setActive] = useState<string>(RENTAL_TAB)

  const activeToolLabel = TOOL_TABS.find((t) => t.id === active)?.label ?? ''

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      {/* ---- Section header (always above the tabs) ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-50/50 to-transparent dark:from-emerald-950/20 p-5 md:p-6 rounded-2xl border border-emerald-100/50 dark:border-emerald-900/40">
        <div className="flex items-center gap-3">
          <CompanyHeaderLogo className="h-11" />
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">المحاسبة</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm mt-0.5 font-medium">
              قيود الإيجار المخصّصة وأدوات المحاسبة الكاملة في مكان واحد
            </p>
          </div>
        </div>

        <Button
          onClick={() => setCurrentSection('dashboard')}
          variant="outline"
          className="gap-2 font-semibold whitespace-nowrap border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 self-start sm:self-auto"
          title="العودة إلى الرئيسية"
        >
          <Home className="h-4 w-4" />
          الرئيسية
        </Button>
      </div>

      {/* ---- Tab bar (RTL, emerald-scoped; scrolls horizontally on overflow) ---- */}
      <div className="overflow-x-auto">
        <div className="flex items-center gap-1 border-b border-emerald-100 dark:border-emerald-900/40 min-w-max">
          {[{ id: RENTAL_TAB, label: 'قيود الإيجار' }, ...TOOL_TABS].map((tab) => {
            const isActive = active === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActive(tab.id)}
                className={cn(
                  'relative -mb-px px-4 py-2.5 text-sm font-semibold whitespace-nowrap rounded-t-lg border-b-2 transition-colors',
                  isActive
                    ? 'border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20',
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ---- Tab content ---- */}
      {active === RENTAL_TAB ? (
        <RentalJournalTab />
      ) : (
        // Lazy-mounted iframe: only the ACTIVE tool exists in the DOM. Same-origin,
        // so the tenant's session cookie authenticates it; ?embed=1 makes the
        // accounting shell render chrome-free. Keyed by tool so switching swaps it.
        <iframe
          key={active}
          src={`/accounting/${active}?embed=1`}
          title={activeToolLabel}
          className="w-full rounded-lg border bg-background"
          style={{ height: 'calc(100vh - 210px)' }}
        />
      )}
    </div>
  )
}
