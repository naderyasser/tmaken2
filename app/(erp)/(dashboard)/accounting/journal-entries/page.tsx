'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { accountingApi, type JournalEntry } from '@/lib/accounting-api'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import {
  Plus, RefreshCw, Search, FileText,
  AlertCircle, ChevronLeft, BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ReportPrintButton, fetchAllPages, type PrintCell } from '@/components/accounting/report-print'
import { ListPager } from '@/components/accounting/list-pager'
import type { FrappeFilter } from '@/lib/api-client'

// ─── Status ───────────────────────────────────────────────────────────────────

type Locale = 'ar' | 'en'

const DOC_STATUS_CLASSES: Record<number, string> = {
  0: 'bg-slate-100 text-slate-600 border border-slate-200',
  1: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  2: 'bg-rose-100 text-rose-700 border border-rose-200',
}

const DOC_STATUS_LABELS: Record<Locale, Record<number, string>> = {
  ar: { 0: 'مسودة', 1: 'مرحّل', 2: 'ملغي' },
  en: { 0: 'Draft', 1: 'Posted', 2: 'Cancelled' },
}

const VOUCHER_LABELS: Record<Locale, Record<string, string>> = {
  ar: {
    'Journal Entry': 'قيد يومية',
    'Bank Entry': 'قيد بنكي',
    'Cash Entry': 'قيد نقدي',
    'Credit Note': 'إشعار دائن',
    'Debit Note': 'إشعار مدين',
    'Opening Entry': 'قيد افتتاحي',
    'Contra Entry': 'قيد مقاص',
    'Excise Entry': 'قيد ضريبة',
    'Write Off Entry': 'قيد شطب',
    'Depreciation Entry': 'قيد إهلاك',
    'Exchange Rate Revaluation': 'إعادة تقييم سعر الصرف',
  },
  en: {
    'Journal Entry': 'Journal Entry',
    'Bank Entry': 'Bank Entry',
    'Cash Entry': 'Cash Entry',
    'Credit Note': 'Credit Note',
    'Debit Note': 'Debit Note',
    'Opening Entry': 'Opening Entry',
    'Contra Entry': 'Contra Entry',
    'Excise Entry': 'Excise Entry',
    'Write Off Entry': 'Write Off Entry',
    'Depreciation Entry': 'Depreciation Entry',
    'Exchange Rate Revaluation': 'Exchange Rate Revaluation',
  },
}

const L = {
  ar: {
    title: 'القيود اليومية',
    loading: 'جاري التحميل...',
    entryCount: 'قيد',
    refresh: 'تحديث',
    newEntry: 'قيد يومية جديد',
    searchPlaceholder: 'ابحث بالرقم أو النوع أو الملاحظة...',
    errorTitle: 'خطأ',
    loadError: 'فشل تحميل القيود اليومية',
    retry: 'إعادة المحاولة',
    voucherType: 'نوع القيد',
    voucherNo: 'رقم القيد',
    postingDate: 'تاريخ الترحيل',
    debit: 'المدين',
    credit: 'الدائن',
    status: 'الحالة',
    noResults: 'لا توجد نتائج مطابقة',
    noEntries: 'لا توجد قيود يومية',
    submit: 'اعتماد',
    submitOk: 'تم اعتماد القيد',
    submitFail: 'تعذّر اعتماد القيد',
    createFirst: 'إنشاء أول قيد',
    showing: 'عرض',
    of: 'من',
    totalDebit: 'إجمالي المدين',
  },
  en: {
    title: 'Journal Entries',
    loading: 'Loading...',
    entryCount: 'entries',
    refresh: 'Refresh',
    newEntry: 'New Journal Entry',
    searchPlaceholder: 'Search by number, type, or remark...',
    errorTitle: 'Error',
    loadError: 'Failed to load journal entries',
    retry: 'Retry',
    voucherType: 'Voucher Type',
    voucherNo: 'Voucher Number',
    postingDate: 'Posting Date',
    debit: 'Debit',
    credit: 'Credit',
    status: 'Status',
    noResults: 'No matching results',
    noEntries: 'No journal entries found',
    submit: 'Submit',
    submitOk: 'Journal entry submitted',
    submitFail: 'Could not submit journal entry',
    createFirst: 'Create first entry',
    showing: 'Showing',
    of: 'of',
    totalDebit: 'Total Debit',
  },
} as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number | undefined, locale: Locale) =>
  n != null
    ? n.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—'

const fmtDate = (d: string | undefined, locale: Locale) =>
  d
    ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
    : '—'

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="divide-y divide-gray-100">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="h-5 w-24 rounded" />
          <Skeleton className="h-5 w-36 rounded" />
          <Skeleton className="h-5 w-24 rounded" />
          <Skeleton className="h-5 w-20 rounded ms-auto" />
          <Skeleton className="h-5 w-20 rounded" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JournalEntriesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { lang, isRTL } = useI18n()
  const locale: Locale = lang === 'ar' ? 'ar' : 'en'
  const t = L[locale]

  const PAGE_SIZE = 100

  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  // `search` is the DEBOUNCED, applied query — the server filters by it (or_filters),
  // so search spans ALL entries, not just the loaded page.
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const [submittingName, setSubmittingName] = useState<string | null>(null)

  useEffect(() => {
    const id = setTimeout(() => { setSearch(query.trim()); setPage(1) }, 400)
    return () => clearTimeout(id)
  }, [query])

  const searchFilters = (q: string): FrappeFilter[] => ([
    ['Journal Entry', 'name', 'like', `%${q}%`],
    ['Journal Entry', 'title', 'like', `%${q}%`],
    ['Journal Entry', 'user_remark', 'like', `%${q}%`],
    ['Journal Entry', 'cheque_no', 'like', `%${q}%`],
  ])

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const or_filters = search ? searchFilters(search) : undefined
      const [data, count] = await Promise.all([
        accountingApi.getJournalEntries({
          limit_start: (page - 1) * PAGE_SIZE,
          limit_page_length: PAGE_SIZE,
          or_filters,
        }),
        accountingApi.countJournalEntries({ or_filters }),
      ])
      setEntries(data)
      setTotal(count)
    } catch (err: any) {
      const msg = err?.message ?? t.loadError
      setError(msg)
      toast({ title: t.errorTitle, description: msg, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast, locale, page, search])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  // اعتماد a draft قيد inline (client 2026-07-21): the API client always had
  // submitJournalEntry — the list page simply never exposed it. Drafts only;
  // posted/cancelled rows are untouchable here.
  const handleSubmitEntry = async (name: string) => {
    if (submittingName) return
    setSubmittingName(name)
    try {
      await accountingApi.submitJournalEntry(name)
      toast({ title: t.submitOk })
      fetchEntries()
    } catch {
      toast({ title: t.submitFail, variant: 'destructive' })
    } finally {
      setSubmittingName(null)
    }
  }

  // Search runs server-side now — rows arrive already filtered.
  const filtered = entries

  const totalDebitSum = filtered.reduce((s, e) => s + (e.total_debit ?? 0), 0)
  const totalCreditSum = filtered.reduce((s, e) => s + (e.total_credit ?? 0), 0)

  // Print composition shared by the visible-page fallback and the fetch-all path.
  const printColumns = [
    { label: t.voucherType },
    { label: t.voucherNo },
    { label: t.postingDate },
    { label: t.debit, align: 'end' as const },
    { label: t.credit, align: 'end' as const },
    { label: t.status },
  ]
  const printRow = (e: JournalEntry): PrintCell[] => [
    VOUCHER_LABELS[locale][e.voucher_type ?? ''] ?? e.voucher_type ?? '—',
    e.user_remark ? `${e.name} — ${e.user_remark}` : e.name,
    fmtDate(e.posting_date, locale),
    fmt(e.total_debit, locale),
    fmt(e.total_credit, locale),
    DOC_STATUS_LABELS[locale][e.docstatus ?? 0] ?? DOC_STATUS_LABELS[locale][0],
  ]
  const printFooter = (list: JournalEntry[]): PrintCell[] => [
    { text: locale === 'ar' ? 'الإجمالي' : 'Total', bold: true },
    '', '',
    fmt(list.reduce((s, e) => s + (e.total_debit ?? 0), 0), locale),
    fmt(list.reduce((s, e) => s + (e.total_credit ?? 0), 0), locale),
    '',
  ]
  // Printing fetches EVERY matching entry (current search included), not just the page.
  const loadAllForPrint = async () => {
    const or_filters = search ? searchFilters(search) : undefined
    const all = await fetchAllPages<JournalEntry>((start, len) =>
      accountingApi.getJournalEntries({ limit_start: start, limit_page_length: len, or_filters }))
    return {
      meta: [`${all.length} ${t.entryCount}`],
      sections: [{ columns: printColumns, rows: all.map(printRow), footer: printFooter(all) }],
    }
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gray-50">

      {/* ── Header ── */}
      <div className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-indigo-600" />
              {t.title}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {loading ? t.loading : `${total} ${t.entryCount}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <ReportPrintButton
              title={t.title}
              meta={[`${filtered.length} ${t.entryCount}`]}
              disabled={loading || filtered.length === 0}
              className="border-gray-200 text-gray-600 hover:bg-gray-50"
              sections={[{ columns: printColumns, rows: filtered.map(printRow), footer: printFooter(filtered) }]}
              loadSections={loadAllForPrint}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={fetchEntries}
              disabled={loading}
              className="border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              <RefreshCw className={cn('h-4 w-4 me-2', loading && 'animate-spin')} />
              {t.refresh}
            </Button>
            <Button
              size="sm"
              onClick={() => router.push('/accounting/journal-entries/new')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="h-4 w-4 me-2" />
              {t.newEntry}
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4 relative max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            placeholder={t.searchPlaceholder}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="ps-9 border-gray-200 bg-white"
          />
        </div>
      </div>

      <div className="p-6">
        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 mb-4">
            <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">{error}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={fetchEntries}>
                {t.retry}
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {/* Column headers */}
          <div className="hidden md:grid grid-cols-[1.2fr_1.4fr_1fr_1fr_1fr_auto_auto] gap-4 items-center bg-gray-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-100">
            <span>{t.voucherType}</span>
            <span>{t.voucherNo}</span>
            <span>{t.postingDate}</span>
            <span className="text-end">{t.debit}</span>
            <span className="text-end">{t.credit}</span>
            <span>{t.status}</span>
            <span></span>
          </div>

          {loading && <TableSkeleton />}

          {!loading && filtered.length === 0 && (
            <div className="py-20 text-center text-gray-400">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-gray-500">
                {query ? t.noResults : t.noEntries}
              </p>
              {!query && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => router.push('/accounting/journal-entries/new')}
                >
                  <Plus className="h-4 w-4 me-2" />
                  {t.createFirst}
                </Button>
              )}
            </div>
          )}

          {!loading && filtered.map(entry => {
            const statusCode = entry.docstatus ?? 0
            const status = {
              label: DOC_STATUS_LABELS[locale][statusCode] ?? DOC_STATUS_LABELS[locale][0],
              className: DOC_STATUS_CLASSES[statusCode] ?? DOC_STATUS_CLASSES[0],
            }
            const vLabel = VOUCHER_LABELS[locale][entry.voucher_type ?? ''] ?? entry.voucher_type ?? '—'

            return (
              <div
                key={entry.name}
                className="group grid grid-cols-1 md:grid-cols-[1.2fr_1.4fr_1fr_1fr_1fr_auto_auto] gap-2 md:gap-4 items-start md:items-center px-4 py-3 border-b border-gray-50 hover:bg-indigo-50/40 transition-colors"
              >
                <span className="text-sm font-medium text-gray-800">{vLabel}</span>

                <div>
                  <p className="text-sm font-mono text-gray-700">{entry.name}</p>
                  {entry.user_remark && (
                    <p className="text-xs text-gray-400 truncate max-w-[200px]">{entry.user_remark}</p>
                  )}
                </div>

                <span className="hidden md:block text-sm text-gray-600">{fmtDate(entry.posting_date, locale)}</span>
                <span className="hidden md:block text-sm font-mono text-end text-gray-700">{fmt(entry.total_debit, locale)}</span>
                <span className="hidden md:block text-sm font-mono text-end text-gray-700">{fmt(entry.total_credit, locale)}</span>

                <Badge className={cn('text-xs w-fit font-medium', status.className)}>
                  {status.label}
                </Badge>

                {statusCode === 0 ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={submittingName === entry.name}
                    onClick={() => handleSubmitEntry(entry.name)}
                    className="h-7 px-2 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                  >
                    {submittingName === entry.name ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      t.submit
                    )}
                  </Button>
                ) : (
                  <ChevronLeft className="hidden md:block h-4 w-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                )}
              </div>
            )
          })}

          {/* Footer: page totals + server-side pager */}
          {!loading && filtered.length > 0 && (
            <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-500 flex items-center justify-end">
              <span>
                {t.totalDebit}{locale === 'ar' ? ' (الصفحة)' : ' (page)'}:{' '}
                <span className="font-mono font-semibold text-gray-700">{fmt(totalDebitSum, locale)}</span>
              </span>
            </div>
          )}
          {!loading && (
            <ListPager page={page} pageSize={PAGE_SIZE} total={total} loading={loading} onPage={setPage} />
          )}
        </div>
      </div>

      <Toaster />
    </div>
  )
}
