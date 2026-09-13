'use client'

import { useCallback, useEffect, useState } from 'react'
import { accountingApi, type SalesInvoice } from '@/lib/accounting-api'
import { fetchAllPages } from '@/components/accounting/report-print'
import { ListPager } from '@/components/accounting/list-pager'
import type { FrappeFilter } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, RefreshCw, FileText, Search, Download, CheckCircle, Clock, XCircle, ChevronDown, Printer, FileDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type Locale = 'ar' | 'en'

const fmt = (v?: number) =>
    (v ?? 0).toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Get the Frappe base URL from env or current host */
function getFrappeUrl(): string {
    if (typeof window !== 'undefined') {
        return (process.env.NEXT_PUBLIC_FRAPPE_URL ||
            `${window.location.protocol}//${window.location.host}`)
    }
    return process.env.NEXT_PUBLIC_FRAPPE_URL || 'http://localhost'
}

/** Build the Frappe print preview URL for a Sales Invoice */
function getPrintUrl(invoiceName: string, lang: string = 'en', printFormat: string = 'Sales Invoice Print'): string {
    const base = getFrappeUrl()
    const params = new URLSearchParams({
        doctype: 'Sales Invoice',
        name: invoiceName,
        format: printFormat,
        no_letterhead: '0',
        lang,
    })
    return `${base}/printview?${params.toString()}`
}

/** Build the Frappe PDF download URL for a Sales Invoice */
function getPdfUrl(invoiceName: string, lang: string = 'en', printFormat: string = 'Sales Invoice Print'): string {
    const base = getFrappeUrl()
    const params = new URLSearchParams({
        doctype: 'Sales Invoice',
        name: invoiceName,
        format: printFormat,
        no_letterhead: '0',
        lang,
    })
    return `${base}/api/method/frappe.utils.print_format.download_pdf?${params.toString()}`
}

/** Build the Frappe print view URL that auto-triggers browser print (Save as PDF) */
function getBrowserPdfUrl(invoiceName: string, lang: string = 'en', printFormat: string = 'Sales Invoice Print'): string {
    const base = getFrappeUrl()
    const params = new URLSearchParams({
        doctype: 'Sales Invoice',
        name: invoiceName,
        format: printFormat,
        no_letterhead: '0',
        lang,
        trigger_print: '1',
    })
    return `${base}/printview?${params.toString()}`
}

const L = {
    en: {
        title: 'Sales Invoices',
        subtitle: 'All sales invoices posted to the general ledger.',
        company: 'Company', allCompanies: 'All Companies',
        from: 'From Date', to: 'To Date', status: 'Status',
        allStatuses: 'All', overdue: 'Overdue', unpaid: 'Unpaid', paid: 'Paid', cancelled: 'Cancelled', returnLabel: 'Return',
        run: 'Load', refresh: 'Refresh', search: 'Search invoices...',
        invoice: 'Invoice', customer: 'Customer', date: 'Date',
        dueDate: 'Due Date', grandTotal: 'Grand Total', outstanding: 'Outstanding',
        statusCol: 'Status', noData: 'No sales invoices found.',
        loading: 'Loading...', error: 'Failed to load data', retry: 'Retry',
        exportCsv: 'Export CSV',
        draft: 'Draft', submitted: 'Submitted', cancelledStatus: 'Cancelled',
        overdueStatus: 'Overdue', paidStatus: 'Paid', unpaidStatus: 'Unpaid', returnStatus: 'Return',
        totalOutstanding: 'Total Outstanding',
        count: 'invoices',
        print: 'Print',
        downloadPdf: 'PDF',
        actions: 'Actions',
    },
    ar: {
        title: 'فواتير المبيعات',
        subtitle: 'جميع فواتير المبيعات المسجلة في دفتر الأستاذ.',
        company: 'الشركة', allCompanies: 'جميع الشركات',
        from: 'من تاريخ', to: 'إلى تاريخ', status: 'الحالة',
        allStatuses: 'الكل', overdue: 'متأخرة', unpaid: 'غير مدفوعة', paid: 'مدفوعة', cancelled: 'ملغاة', returnLabel: 'مرتجع',
        run: 'تحميل', refresh: 'تحديث', search: 'بحث في الفواتير...',
        invoice: 'الفاتورة', customer: 'العميل', date: 'التاريخ',
        dueDate: 'تاريخ الاستحقاق', grandTotal: 'الإجمالي', outstanding: 'المتبقي',
        statusCol: 'الحالة', noData: 'لا توجد فواتير مبيعات.',
        loading: 'جاري التحميل...', error: 'فشل تحميل البيانات', retry: 'إعادة المحاولة',
        exportCsv: 'تصدير CSV',
        draft: 'مسودة', submitted: 'معتمدة', cancelledStatus: 'ملغاة',
        overdueStatus: 'متأخرة', paidStatus: 'مدفوعة', unpaidStatus: 'غير مدفوعة', returnStatus: 'مرتجع',
        totalOutstanding: 'إجمالي المتبقي',
        count: 'فاتورة',
        print: 'طباعة',
        downloadPdf: 'PDF',
        actions: 'إجراءات',
    },
} as const

function getStatusInfo(inv: SalesInvoice, t: typeof L['en'] | typeof L['ar']) {
    if (inv.docstatus === 2) return { label: t.cancelledStatus, cls: 'bg-red-100 text-red-700' }
    if (inv.docstatus === 0) return { label: t.draft, cls: 'bg-amber-100 text-amber-700' }
    if (inv.is_return) return { label: t.returnStatus, cls: 'bg-purple-100 text-purple-700' }
    if ((inv.outstanding_amount ?? 0) <= 0) return { label: t.paidStatus, cls: 'bg-emerald-100 text-emerald-700' }
    if (inv.due_date && inv.due_date < new Date().toISOString().split('T')[0])
        return { label: t.overdueStatus, cls: 'bg-red-100 text-red-700' }
    return { label: t.unpaidStatus, cls: 'bg-blue-100 text-blue-700' }
}

export default function SalesInvoicesPage() {
    const { lang, isRTL } = useI18n()
    const locale: Locale = lang === 'ar' ? 'ar' : 'en'
    const t = L[locale]

    const [companies, setCompanies] = useState<Array<{ name: string; company_name: string }>>([])
    const [company, setCompany] = useState<string>('')
    const [fromDate, setFromDate] = useState(() => `${new Date().getFullYear()}-01-01`)
    const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0])
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [query, setQuery] = useState('')

    const PAGE_SIZE = 100
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)

    const [rows, setRows] = useState<SalesInvoice[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(false)

    useEffect(() => {
        accountingApi.getCompanies().then(list => {
            setCompanies(list.map(c => ({ name: c.name, company_name: c.company_name })))
            if (list.length === 1) setCompany(list[0].name)
        }).catch(() => { })
    }, [])

    useEffect(() => {
        const id = setTimeout(() => { setSearch(query.trim()); setPage(1) }, 400)
        return () => clearTimeout(id)
    }, [query])
    useEffect(() => { setPage(1) }, [company, fromDate, toDate, statusFilter])

    // Status + search moved SERVER-side (filters/or_filters) so pagination pages over
    // the real result set — the old client-side filter only saw the fetched chunk.
    const statusExtraFilters = (): FrappeFilter[] => {
        switch (statusFilter) {
            case 'paid': return [['Sales Invoice', 'docstatus', '=', 1], ['Sales Invoice', 'is_return', '=', 0], ['Sales Invoice', 'outstanding_amount', '<=', 0]]
            case 'unpaid': return [['Sales Invoice', 'docstatus', '=', 1], ['Sales Invoice', 'is_return', '=', 0], ['Sales Invoice', 'outstanding_amount', '>', 0]]
            case 'cancelled': return [['Sales Invoice', 'docstatus', '=', 2]]
            case 'return': return [['Sales Invoice', 'is_return', '=', 1]]
            default: return []
        }
    }
    const buildOpts = useCallback((): Parameters<typeof accountingApi.getSalesInvoices>[0] => {
        const opts: Parameters<typeof accountingApi.getSalesInvoices>[0] = {
            from_date: fromDate,
            to_date: toDate,
            filters: statusExtraFilters(),
        }
        if (company) opts.company = company
        if (statusFilter === 'overdue') opts.overdue = true
        if (search) {
            opts.or_filters = [
                ['Sales Invoice', 'name', 'like', `%${search}%`],
                ['Sales Invoice', 'customer_name', 'like', `%${search}%`],
                ['Sales Invoice', 'customer', 'like', `%${search}%`],
            ]
        }
        return opts
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [company, fromDate, toDate, statusFilter, search])

    const load = useCallback(async () => {
        setLoading(true)
        setError(false)
        try {
            const opts = buildOpts()
            const [data, count] = await Promise.all([
                accountingApi.getSalesInvoices({ ...opts, limit_start: (page - 1) * PAGE_SIZE, limit_page_length: PAGE_SIZE }),
                accountingApi.countSalesInvoices(opts),
            ])
            setRows(data)
            setTotal(count)
        } catch {
            setError(true)
        } finally {
            setLoading(false)
        }
    }, [buildOpts, page])

    useEffect(() => { load() }, [load])

    const filtered = rows

    const totalOutstanding = filtered.reduce((s, inv) => s + (inv.outstanding_amount ?? 0), 0)

    // CSV covers ALL matching invoices (current filters + search), not just the page.
    const exportCsv = async () => {
        const all = await fetchAllPages<SalesInvoice>((start, len) =>
            accountingApi.getSalesInvoices({ ...buildOpts(), limit_start: start, limit_page_length: len }))
        const headers = ['Invoice', 'Customer', 'Date', 'Due Date', 'Grand Total', 'Outstanding', 'Status']
        const csvRows = all.map(inv => {
            const st = getStatusInfo(inv, L['en'])
            return [inv.name, inv.customer_name ?? inv.customer, inv.posting_date, inv.due_date ?? '', fmt(inv.grand_total), fmt(inv.outstanding_amount), st.label]
        })
        const csv = [headers, ...csvRows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `sales-invoices-${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    const handlePrint = (invoiceName: string) => {
        window.open(getPrintUrl(invoiceName, lang), '_blank')
    }

    const handleDownloadPdf = (invoiceName: string) => {
        // Use browser's built-in print-to-PDF instead of server-side wkhtmltopdf
        // which may not be installed on the remote Frappe server
        window.open(getBrowserPdfUrl(invoiceName, lang), '_blank')
    }

    return (
        <div className="p-6 md:p-8 max-w-[1400px] mx-auto" dir={isRTL ? 'rtl' : 'ltr'}>
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-2.5 mb-1">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow-sm">
                        <FileText className="w-5 h-5 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
                </div>
                <p className="text-sm text-gray-500 ms-[2.875rem]">{t.subtitle}</p>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6">
                <div className="flex flex-wrap items-end gap-3">
                    {/* Company */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-gray-500 uppercase">{t.company}</label>
                        <select value={company} onChange={e => setCompany(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white min-w-[160px]">
                            <option value="">{t.allCompanies}</option>
                            {companies.map(c => <option key={c.name} value={c.name}>{c.company_name}</option>)}
                        </select>
                    </div>
                    {/* Dates */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-gray-500 uppercase">{t.from}</label>
                        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-gray-500 uppercase">{t.to}</label>
                        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    {/* Status */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-gray-500 uppercase">{t.status}</label>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white min-w-[120px]">
                            <option value="all">{t.allStatuses}</option>
                            <option value="unpaid">{t.unpaid}</option>
                            <option value="overdue">{t.overdue}</option>
                            <option value="paid">{t.paid}</option>
                            <option value="cancelled">{t.cancelled}</option>
                            <option value="return">{t.returnLabel}</option>
                        </select>
                    </div>
                    {/* Search */}
                    <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                        <label className="text-[11px] font-semibold text-gray-500 uppercase">&nbsp;</label>
                        <div className="relative">
                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t.search}
                                className="border border-gray-200 rounded-lg ps-9 pe-3 py-2 text-sm w-full" />
                        </div>
                    </div>
                    {/* Actions */}
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
                            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                        </Button>
                        <Button size="sm" variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
                            <Download className="w-4 h-4 me-1" /> {t.exportCsv}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Summary */}
            <div className="flex items-center gap-4 mb-4">
                <span className="text-sm text-gray-500">{total} {t.count}</span>
                {totalOutstanding > 0 && (
                    <span className="text-sm font-semibold text-red-600">
                        {t.totalOutstanding}{locale === 'ar' ? ' (المعروض)' : ' (shown)'}: {fmt(totalOutstanding)} SAR
                    </span>
                )}
            </div>

            {/* Error */}
            {error && !loading && (
                <div className="mb-6 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <p className="text-sm text-red-700 flex-1">{t.error}</p>
                    <button onClick={load} className="text-sm font-semibold text-red-600 hover:underline">{t.retry}</button>
                </div>
            )}

            {/* Table */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50">
                                {[t.invoice, t.customer, t.date, t.dueDate, t.grandTotal, t.outstanding, t.statusCol, t.actions].map(h => (
                                    <th key={h} className="text-start px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? [...Array(8)].map((_, i) => (
                                <tr key={i} className="border-b border-gray-50">
                                    {[...Array(8)].map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}
                                </tr>
                            )) : filtered.length === 0 ? (
                                <tr><td colSpan={8} className="text-center py-16 text-gray-400">
                                    <FileText className="w-10 h-10 mx-auto opacity-30 mb-2" />
                                    <p>{t.noData}</p>
                                </td></tr>
                            ) : filtered.map(inv => {
                                const st = getStatusInfo(inv, t)
                                const isSubmitted = inv.docstatus === 1
                                return (
                                    <tr key={inv.name} className="border-b border-gray-50 hover:bg-gray-50/70 transition-colors">
                                        <td className="px-4 py-3 font-semibold text-gray-800">{inv.name}</td>
                                        <td className="px-4 py-3 text-gray-600">{inv.customer_name ?? inv.customer}</td>
                                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{inv.posting_date}</td>
                                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{inv.due_date ?? '-'}</td>
                                        <td className="px-4 py-3 font-medium text-gray-900 tabular-nums whitespace-nowrap">{fmt(inv.grand_total)}</td>
                                        <td className={cn('px-4 py-3 font-medium tabular-nums whitespace-nowrap', (inv.outstanding_amount ?? 0) > 0 ? 'text-red-600' : 'text-emerald-600')}>
                                            {fmt(inv.outstanding_amount)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold', st.cls)}>
                                                {st.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 px-2 text-gray-500 hover:text-emerald-600"
                                                    onClick={() => handlePrint(inv.name)}
                                                    title={t.print}
                                                >
                                                    <Printer className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 px-2 text-gray-500 hover:text-blue-600"
                                                    onClick={() => handleDownloadPdf(inv.name)}
                                                    title={t.downloadPdf}
                                                    disabled={!isSubmitted}
                                                >
                                                    <FileDown className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
                <ListPager page={page} pageSize={PAGE_SIZE} total={total} loading={loading} onPage={setPage} />
            </div>
            <div className="h-8" />
        </div>
    )
}
