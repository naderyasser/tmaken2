'use client'

import { useCallback, useEffect, useState } from 'react'
import { accountingApi, type PaymentEntry } from '@/lib/accounting-api'
import { fetchAllPages } from '@/components/accounting/report-print'
import { ListPager } from '@/components/accounting/list-pager'
import type { FrappeFilter } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, RefreshCw, CreditCard, Search, Download, ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type Locale = 'ar' | 'en'

const fmt = (v?: number) =>
    (v ?? 0).toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const L = {
    en: {
        title: 'Payment Entries',
        subtitle: 'All payment transactions — receipts, payments and internal transfers.',
        company: 'Company', allCompanies: 'All Companies',
        from: 'From Date', to: 'To Date', type: 'Type',
        allTypes: 'All', receive: 'Receive', pay: 'Pay', transfer: 'Internal Transfer',
        search: 'Search payments...',
        entry: 'Entry', partyType: 'Party Type', party: 'Party',
        date: 'Date', amount: 'Amount', mode: 'Mode', reference: 'Reference',
        statusCol: 'Status', noData: 'No payment entries found.',
        loading: 'Loading...', error: 'Failed to load data', retry: 'Retry',
        exportCsv: 'Export CSV', refresh: 'Refresh',
        draft: 'Draft', submitted: 'Submitted', cancelled: 'Cancelled',
        totalReceived: 'Total Received', totalPaid: 'Total Paid',
        count: 'entries',
        customer: 'Customer', supplier: 'Supplier', employee: 'Employee',
    },
    ar: {
        title: 'قيود الدفع',
        subtitle: 'جميع عمليات الدفع — التحصيلات والمدفوعات والتحويلات الداخلية.',
        company: 'الشركة', allCompanies: 'جميع الشركات',
        from: 'من تاريخ', to: 'إلى تاريخ', type: 'النوع',
        allTypes: 'الكل', receive: 'استلام', pay: 'دفع', transfer: 'تحويل داخلي',
        search: 'بحث في القيود...',
        entry: 'القيد', partyType: 'نوع الطرف', party: 'الطرف',
        date: 'التاريخ', amount: 'المبلغ', mode: 'طريقة الدفع', reference: 'المرجع',
        statusCol: 'الحالة', noData: 'لا توجد قيود دفع.',
        loading: 'جاري التحميل...', error: 'فشل تحميل البيانات', retry: 'إعادة المحاولة',
        exportCsv: 'تصدير CSV', refresh: 'تحديث',
        draft: 'مسودة', submitted: 'معتمد', cancelled: 'ملغي',
        totalReceived: 'إجمالي التحصيلات', totalPaid: 'إجمالي المدفوعات',
        count: 'قيد',
        customer: 'عميل', supplier: 'مورد', employee: 'موظف',
    },
} as const

function getStatusBadge(pe: PaymentEntry, t: typeof L['en']) {
    if (pe.docstatus === 2) return { label: t.cancelled, cls: 'bg-red-100 text-red-700' }
    if (pe.docstatus === 0) return { label: t.draft, cls: 'bg-amber-100 text-amber-700' }
    return { label: t.submitted, cls: 'bg-emerald-100 text-emerald-700' }
}

function typeIcon(type?: string) {
    if (type === 'Receive') return <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
    if (type === 'Pay') return <ArrowUpRight className="w-4 h-4 text-red-600" />
    return <ArrowLeftRight className="w-4 h-4 text-blue-600" />
}

const partyTypeAr: Record<string, string> = {
    Customer: 'عميل', Supplier: 'مورد', Employee: 'موظف',
    Shareholder: 'مساهم', Student: 'طالب', Member: 'عضو',
}

export default function PaymentEntriesPage() {
    const { lang, isRTL } = useI18n()
    const locale: Locale = lang === 'ar' ? 'ar' : 'en'
    const t = L[locale]

    const [companies, setCompanies] = useState<Array<{ name: string; company_name: string }>>([])
    const [company, setCompany] = useState<string>('')
    const [fromDate, setFromDate] = useState(() => `${new Date().getFullYear()}-01-01`)
    const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0])
    const [typeFilter, setTypeFilter] = useState<string>('all')
    const [query, setQuery] = useState('')

    const PAGE_SIZE = 100
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)

    const [rows, setRows] = useState<PaymentEntry[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(false)

    useEffect(() => {
        accountingApi.getCompanies().then(list => {
            setCompanies(list.map(c => ({ name: c.name, company_name: c.company_name })))
            if (list.length === 1) setCompany(list[0].name)
        }).catch(() => {})
    }, [])

    useEffect(() => {
        const id = setTimeout(() => { setSearch(query.trim()); setPage(1) }, 400)
        return () => clearTimeout(id)
    }, [query])
    useEffect(() => { setPage(1) }, [company, fromDate, toDate, typeFilter])

    // Search moved SERVER-side so pagination pages over the real result set.
    const buildOpts = useCallback((): Parameters<typeof accountingApi.getPaymentEntries>[0] => {
        const opts: Parameters<typeof accountingApi.getPaymentEntries>[0] = {
            from_date: fromDate,
            to_date: toDate,
        }
        if (company) opts.company = company
        if (typeFilter !== 'all') opts.payment_type = typeFilter as PaymentEntry['payment_type']
        if (search) {
            opts.or_filters = [
                ['Payment Entry', 'name', 'like', `%${search}%`],
                ['Payment Entry', 'party_name', 'like', `%${search}%`],
                ['Payment Entry', 'party', 'like', `%${search}%`],
                ['Payment Entry', 'reference_no', 'like', `%${search}%`],
            ] as FrappeFilter[]
        }
        return opts
    }, [company, fromDate, toDate, typeFilter, search])

    const load = useCallback(async () => {
        setLoading(true)
        setError(false)
        try {
            const opts = buildOpts()
            const [data, count] = await Promise.all([
                accountingApi.getPaymentEntries({ ...opts, limit_start: (page - 1) * PAGE_SIZE, limit_page_length: PAGE_SIZE }),
                accountingApi.countPaymentEntries(opts),
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

    const totalReceived = filtered.filter(pe => pe.payment_type === 'Receive').reduce((s, pe) => s + (pe.paid_amount ?? 0), 0)
    const totalPaid = filtered.filter(pe => pe.payment_type === 'Pay').reduce((s, pe) => s + (pe.paid_amount ?? 0), 0)

    // CSV covers ALL matching entries, not just the page.
    const exportCsv = async () => {
        const all = await fetchAllPages<PaymentEntry>((start, len) =>
            accountingApi.getPaymentEntries({ ...buildOpts(), limit_start: start, limit_page_length: len }))
        const headers = ['Entry', 'Type', 'Party Type', 'Party', 'Date', 'Amount', 'Mode', 'Reference', 'Status']
        const csvRows = all.map(pe => {
            const st = getStatusBadge(pe, L['en'])
            return [pe.name, pe.payment_type ?? '', pe.party_type ?? '', pe.party_name ?? pe.party ?? '', pe.posting_date, fmt(pe.paid_amount), pe.mode_of_payment ?? '', pe.reference_no ?? '', st.label]
        })
        const csv = [headers, ...csvRows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `payment-entries-${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="p-6 md:p-8 max-w-[1400px] mx-auto" dir={isRTL ? 'rtl' : 'ltr'}>
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-2.5 mb-1">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
                        <CreditCard className="w-5 h-5 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
                </div>
                <p className="text-sm text-gray-500 ms-[2.875rem]">{t.subtitle}</p>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-gray-500 uppercase">{t.company}</label>
                        <select value={company} onChange={e => setCompany(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white min-w-[160px]">
                            <option value="">{t.allCompanies}</option>
                            {companies.map(c => <option key={c.name} value={c.name}>{c.company_name}</option>)}
                        </select>
                    </div>
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
                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-gray-500 uppercase">{t.type}</label>
                        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white min-w-[140px]">
                            <option value="all">{t.allTypes}</option>
                            <option value="Receive">{t.receive}</option>
                            <option value="Pay">{t.pay}</option>
                            <option value="Internal Transfer">{t.transfer}</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                        <label className="text-[11px] font-semibold text-gray-500 uppercase">&nbsp;</label>
                        <div className="relative">
                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t.search}
                                className="border border-gray-200 rounded-lg ps-9 pe-3 py-2 text-sm w-full" />
                        </div>
                    </div>
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
            <div className="flex flex-wrap items-center gap-4 mb-4">
                <span className="text-sm text-gray-500">{total} {t.count}</span>
                {totalReceived > 0 && (
                    <span className="text-sm font-semibold text-emerald-600">
                        {t.totalReceived}{locale === 'ar' ? ' (المعروض)' : ' (shown)'}: {fmt(totalReceived)} SAR
                    </span>
                )}
                {totalPaid > 0 && (
                    <span className="text-sm font-semibold text-red-600">
                        {t.totalPaid}{locale === 'ar' ? ' (المعروض)' : ' (shown)'}: {fmt(totalPaid)} SAR
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
                                {[t.entry, t.type, t.party, t.date, t.amount, t.mode, t.reference, t.statusCol].map(h => (
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
                                    <CreditCard className="w-10 h-10 mx-auto opacity-30 mb-2" />
                                    <p>{t.noData}</p>
                                </td></tr>
                            ) : filtered.map(pe => {
                                const st = getStatusBadge(pe, t)
                                const partyLabel = locale === 'ar' ? (partyTypeAr[pe.party_type ?? ''] ?? pe.party_type ?? '') : (pe.party_type ?? '')
                                return (
                                    <tr key={pe.name} className="border-b border-gray-50 hover:bg-gray-50/70 transition-colors">
                                        <td className="px-4 py-3 font-semibold text-gray-800">{pe.name}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="flex items-center gap-1.5">
                                                {typeIcon(pe.payment_type)}
                                                <span className="text-gray-700 text-[13px]">
                                                    {locale === 'ar'
                                                        ? pe.payment_type === 'Receive' ? t.receive
                                                            : pe.payment_type === 'Pay' ? t.pay : t.transfer
                                                        : pe.payment_type}
                                                </span>
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            <p className="font-medium">{pe.party_name ?? pe.party ?? '-'}</p>
                                            <p className="text-[11px] text-gray-400">{partyLabel}</p>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{pe.posting_date}</td>
                                        <td className={cn('px-4 py-3 font-medium tabular-nums whitespace-nowrap',
                                            pe.payment_type === 'Receive' ? 'text-emerald-600' : pe.payment_type === 'Pay' ? 'text-red-600' : 'text-blue-600')}>
                                            {fmt(pe.paid_amount)}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{pe.mode_of_payment ?? '-'}</td>
                                        <td className="px-4 py-3 text-gray-500 text-[12px]">{pe.reference_no ?? '-'}</td>
                                        <td className="px-4 py-3">
                                            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold', st.cls)}>
                                                {st.label}
                                            </span>
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
