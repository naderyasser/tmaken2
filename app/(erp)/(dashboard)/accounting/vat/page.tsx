'use client'

import { useCallback, useEffect, useState } from 'react'
import { accountingApi, type VATSummary } from '@/lib/accounting-api'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, RefreshCw, Receipt, TrendingUp, TrendingDown, Scale, Download } from 'lucide-react'
import { exportToCsv } from '@/lib/export-csv'
import { cn } from '@/lib/utils'
import { ReportPrintButton } from '@/components/accounting/report-print'

type Locale = 'ar' | 'en'
const todayIso = () => new Date().toISOString().split('T')[0]
const firstOfYear = () => `${new Date().getFullYear()}-01-01`
const fmt = (v: number) => v.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const L = {
    en: {
        title: 'VAT Reconciliation', subtitle: 'Compare VAT collected from customers (output) vs. VAT paid to suppliers (input) to calculate what you owe ZATCA.',
        company: 'Company', from: 'From Date', to: 'To Date', run: 'Run Report', refresh: 'Refresh',
        outputTax: 'Output Tax (Collected from Customers)', inputTax: 'Input Tax (Paid to Suppliers)',
        netPayable: 'Net VAT Payable to ZATCA', date: 'Date', voucher: 'Voucher', party: 'Party', amount: 'Amount',
        noEntries: 'No VAT entries found for this period.',
        error: 'Failed to load VAT data.', allCompanies: 'Select company',
        outputSection: 'Output VAT Entries', inputSection: 'Input VAT Entries',
        netCredit: 'Net Credit (Refundable)',
    },
    ar: {
        title: 'مطابقة ضريبة القيمة المضافة', subtitle: 'مقارنة ضريبة المخرجات (من العملاء) مقابل ضريبة المدخلات (للموردين) لحساب المستحق لهيئة الزكاة والضريبة.',
        company: 'الشركة', from: 'من تاريخ', to: 'إلى تاريخ', run: 'تشغيل', refresh: 'تحديث',
        outputTax: 'ضريبة المخرجات (محصّلة من العملاء)', inputTax: 'ضريبة المدخلات (مدفوعة للموردين)',
        netPayable: 'صافي الضريبة المستحقة لهيئة الزكاة', date: 'التاريخ', voucher: 'المستند', party: 'الجهة', amount: 'المبلغ',
        noEntries: 'لا توجد قيود ضريبية في هذه الفترة.',
        error: 'فشل تحميل بيانات الضريبة.', allCompanies: 'اختر شركة',
        outputSection: 'قيود ضريبة المخرجات', inputSection: 'قيود ضريبة المدخلات',
        netCredit: 'رصيد دائن (قابل للاسترداد)',
    },
} as const

export default function VATPage() {
    const { lang, isRTL } = useI18n()
    const locale = (lang === 'ar' ? 'ar' : 'en') as Locale
    const t = L[locale]

    const [companies, setCompanies] = useState<Array<{ name: string; company_name: string }>>([])
    const [company, setCompany] = useState('')
    const [fromDate, setFromDate] = useState(firstOfYear())
    const [toDate, setToDate] = useState(todayIso())
    const [summary, setSummary] = useState<VATSummary | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [ran, setRan] = useState(false)

    useEffect(() => {
        accountingApi.getCompanies().then(list => { setCompanies(list); if (list.length === 1) setCompany(list[0].name) }).catch(() => {})
    }, [])

    const runReport = useCallback(async () => {
        if (!company) return
        setLoading(true); setError(null); setRan(true)
        try {
            const data = await accountingApi.getVATSummary({ company, from_date: fromDate, to_date: toDate })
            setSummary(data)
        } catch (e: any) { setError(e?.message ?? t.error) }
        finally { setLoading(false) }
    }, [company, fromDate, toDate, t.error])

    const netPayable = summary ? summary.net_payable : 0
    const isCredit = netPayable < 0

    return (
        <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
                    <p className="text-sm text-gray-500">{t.subtitle}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">{t.company}</label>
                    <select value={company} onChange={e => setCompany(e.target.value)} className="h-9 border border-gray-200 rounded-lg px-3 text-sm">
                        <option value="">{t.allCompanies}</option>
                        {companies.map(c => <option key={c.name} value={c.name}>{c.company_name}</option>)}
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">{t.from}</label>
                    <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-9 border border-gray-200 rounded-lg px-3 text-sm" />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">{t.to}</label>
                    <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-9 border border-gray-200 rounded-lg px-3 text-sm" />
                </div>
                <Button onClick={runReport} disabled={!company || loading} className="bg-violet-600 hover:bg-violet-700">
                    <RefreshCw className={cn('w-4 h-4 me-2', loading && 'animate-spin')} />{ran ? t.refresh : t.run}
                </Button>
                {summary && (
                    <Button variant="outline" size="sm" onClick={() => {
                        const allEntries = [
                            ...summary.output_entries.map(e => ['Output', e.date, e.voucher, e.party, e.amount]),
                            ...summary.input_entries.map(e => ['Input', e.date, e.voucher, e.party, e.amount]),
                        ]
                        exportToCsv(`vat-${fromDate}-${toDate}.csv`, ['Type', 'Date', 'Voucher', 'Party', 'Amount'], allEntries)
                    }}>
                        <Download className="w-4 h-4 me-1" /> CSV
                    </Button>
                )}
                {summary && (() => {
                    const cols = [
                        { label: t.date },
                        { label: t.voucher },
                        { label: t.party },
                        { label: t.amount, align: 'end' as const },
                    ]
                    const toRows = (entries: VATSummary['output_entries']) =>
                        entries.map(e => [e.date ?? '', e.voucher ?? '', e.party || '—', fmt(e.amount)])
                    return (
                        <ReportPrintButton
                            title={t.title}
                            subtitle={t.subtitle}
                            meta={[
                                `${t.company}: ${companies.find(c => c.name === company)?.company_name ?? company}`,
                                `${t.from}: ${fromDate} — ${t.to}: ${toDate}`,
                            ]}
                            sections={[
                                {
                                    heading: t.outputSection, columns: cols, rows: toRows(summary.output_entries),
                                    footer: [{ text: t.outputTax, bold: true }, '', '', fmt(summary.output_tax)],
                                },
                                {
                                    heading: t.inputSection, columns: cols, rows: toRows(summary.input_entries),
                                    footer: [{ text: t.inputTax, bold: true }, '', '', fmt(summary.input_tax)],
                                },
                            ]}
                            summary={[
                                { label: t.outputTax, value: fmt(summary.output_tax) },
                                { label: t.inputTax, value: fmt(summary.input_tax) },
                                { label: isCredit ? t.netCredit : t.netPayable, value: fmt(Math.abs(netPayable)), strong: true },
                            ]}
                        />
                    )
                })()}
            </div>

            {error && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" /><p className="text-sm">{error}</p>
                </div>
            )}

            {/* Summary Cards */}
            {ran && !loading && summary && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white border border-gray-200 rounded-xl p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
                                <TrendingUp className="w-4 h-4 text-red-600" />
                            </div>
                            <p className="text-sm font-medium text-gray-600">{t.outputTax}</p>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 tabular-nums">{fmt(summary.output_tax)}</p>
                        <p className="text-xs text-gray-400 mt-1">{summary.output_entries.length} {locale === 'ar' ? 'قيد' : 'entries'}</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                                <TrendingDown className="w-4 h-4 text-green-600" />
                            </div>
                            <p className="text-sm font-medium text-gray-600">{t.inputTax}</p>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 tabular-nums">{fmt(summary.input_tax)}</p>
                        <p className="text-xs text-gray-400 mt-1">{summary.input_entries.length} {locale === 'ar' ? 'قيد' : 'entries'}</p>
                    </div>
                    <div className={cn('border rounded-xl p-5', isCredit ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200')}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', isCredit ? 'bg-green-100' : 'bg-orange-100')}>
                                <Scale className={cn('w-4 h-4', isCredit ? 'text-green-600' : 'text-orange-600')} />
                            </div>
                            <p className="text-sm font-medium text-gray-700">{isCredit ? t.netCredit : t.netPayable}</p>
                        </div>
                        <p className={cn('text-2xl font-bold tabular-nums', isCredit ? 'text-green-700' : 'text-orange-700')}>
                            {fmt(Math.abs(netPayable))}
                        </p>
                    </div>
                </div>
            )}

            {/* Entry Tables */}
            {ran && !loading && summary && (
                <div className="space-y-6">
                    {[
                        { title: t.outputSection, entries: summary.output_entries, color: 'text-red-700' },
                        { title: t.inputSection, entries: summary.input_entries, color: 'text-green-700' },
                    ].map(section => (
                        <div key={section.title} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                                <h3 className="font-semibold text-gray-800 text-sm">{section.title}</h3>
                            </div>
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50/50">
                                    <tr>
                                        {[t.date, t.voucher, t.party, t.amount].map(h => (
                                            <th key={h} className="px-4 py-2.5 text-start text-xs font-semibold text-gray-500">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {section.entries.length === 0 ? (
                                        <tr><td colSpan={4} className="text-center py-8 text-gray-400 text-xs">{t.noEntries}</td></tr>
                                    ) : section.entries.map((e, i) => (
                                        <tr key={i} className="hover:bg-gray-50">
                                            <td className="px-4 py-2 text-gray-600">{e.date}</td>
                                            <td className="px-4 py-2 font-mono text-xs text-gray-600">{e.voucher}</td>
                                            <td className="px-4 py-2 text-gray-800">{e.party || '—'}</td>
                                            <td className={cn('px-4 py-2 text-end tabular-nums font-medium', section.color)}>{fmt(e.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            )}

            {ran && loading && (
                <div className="bg-white border border-gray-200 rounded-xl p-8 space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
                </div>
            )}
        </div>
    )
}
