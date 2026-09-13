'use client'

import { useCallback, useEffect, useState } from 'react'
import { accountingApi, type AgingRow } from '@/lib/accounting-api'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, RefreshCw, Building2, Download } from 'lucide-react'
import { exportToCsv } from '@/lib/export-csv'
import { cn } from '@/lib/utils'
import { ReportPrintButton } from '@/components/accounting/report-print'

type Locale = 'ar' | 'en'
const todayIso = () => new Date().toISOString().split('T')[0]
const fmt = (v?: number) => (v ?? 0).toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const L = {
    en: {
        title: 'Accounts Payable Aging', subtitle: 'Outstanding supplier balances grouped by how long they\'ve been overdue.',
        company: 'Company', asOf: 'As of Date', basis: 'Aging Based On',
        dueDate: 'Due Date', postingDate: 'Posting Date', run: 'Run Report', refresh: 'Refresh',
        supplier: 'Supplier', voucher: 'Voucher', due: 'Due Date', invoiced: 'Invoiced', paid: 'Paid',
        outstanding: 'Outstanding', current: 'Current (0-30)', r2: '31-60 Days', r3: '61-90 Days', r4: '90+ Days',
        total: 'Total', noData: 'No outstanding payables found.', error: 'Failed to load report.', allCompanies: 'Select company',
    },
    ar: {
        title: 'تقرير عمر الذمم الدائنة', subtitle: 'أرصدة الموردين المستحقة مقسّمة حسب مدة الاستحقاق.',
        company: 'الشركة', asOf: 'بتاريخ', basis: 'أساس التقادم',
        dueDate: 'تاريخ الاستحقاق', postingDate: 'تاريخ الترحيل', run: 'تشغيل التقرير', refresh: 'تحديث',
        supplier: 'المورد', voucher: 'المستند', due: 'تاريخ الاستحقاق', invoiced: 'المفوتر', paid: 'المدفوع',
        outstanding: 'المستحق', current: 'حالي (0-30)', r2: '31-60 يوم', r3: '61-90 يوم', r4: '90+ يوم',
        total: 'الإجمالي', noData: 'لا توجد ذمم دائنة مستحقة.', error: 'فشل تحميل التقرير.', allCompanies: 'اختر شركة',
    },
} as const

export default function APAgingPage() {
    const { lang, isRTL } = useI18n()
    const locale = (lang === 'ar' ? 'ar' : 'en') as Locale
    const t = L[locale]

    const [companies, setCompanies] = useState<Array<{ name: string; company_name: string }>>([])
    const [company, setCompany] = useState('')
    const [asOf, setAsOf] = useState(todayIso())
    const [basis, setBasis] = useState<'Due Date' | 'Posting Date'>('Due Date')
    const [rows, setRows] = useState<AgingRow[]>([])
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
            const data = await accountingApi.getAPAgingReport({ company, report_date: asOf, ageing_based_on: basis })
            setRows(data.filter(r => (r.outstanding ?? 0) !== 0))
        } catch (e: any) { setError(e?.message ?? t.error) }
        finally { setLoading(false) }
    }, [company, asOf, basis, t.error])

    const totals = rows.reduce((acc, r) => ({
        invoiced: acc.invoiced + (r.invoiced ?? 0), paid: acc.paid + (r.paid ?? 0),
        outstanding: acc.outstanding + (r.outstanding ?? 0), r1: acc.r1 + (r.range1 ?? 0),
        r2: acc.r2 + (r.range2 ?? 0), r3: acc.r3 + (r.range3 ?? 0), r4: acc.r4 + (r.range4 ?? 0),
    }), { invoiced: 0, paid: 0, outstanding: 0, r1: 0, r2: 0, r3: 0, r4: 0 })

    return (
        <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
                    <p className="text-sm text-gray-500">{t.subtitle}</p>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">{t.company}</label>
                    <select value={company} onChange={e => setCompany(e.target.value)} className="h-9 border border-gray-200 rounded-lg px-3 text-sm">
                        <option value="">{t.allCompanies}</option>
                        {companies.map(c => <option key={c.name} value={c.name}>{c.company_name}</option>)}
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">{t.asOf}</label>
                    <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="h-9 border border-gray-200 rounded-lg px-3 text-sm" />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">{t.basis}</label>
                    <select value={basis} onChange={e => setBasis(e.target.value as any)} className="h-9 border border-gray-200 rounded-lg px-3 text-sm">
                        <option value="Due Date">{t.dueDate}</option>
                        <option value="Posting Date">{t.postingDate}</option>
                    </select>
                </div>
                <Button onClick={runReport} disabled={!company || loading} className="bg-rose-600 hover:bg-rose-700">
                    <RefreshCw className={cn('w-4 h-4 me-2', loading && 'animate-spin')} />{ran ? t.refresh : t.run}
                </Button>
                {rows.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => exportToCsv(
                        `ap-aging-${asOf}.csv`,
                        ['Supplier', 'Voucher', 'Due Date', 'Invoiced', 'Paid', 'Outstanding', '0-30', '31-60', '61-90', '90+'],
                        rows.map(r => [r.party_name ?? r.party, r.voucher_no ?? '', r.due_date ?? '', r.invoiced, r.paid, r.outstanding, r.range1, r.range2, r.range3, r.range4])
                    )}>
                        <Download className="w-4 h-4 me-1" /> CSV
                    </Button>
                )}
                {rows.length > 0 && (
                    <ReportPrintButton
                        title={t.title}
                        subtitle={t.subtitle}
                        orientation="landscape"
                        meta={[
                            `${t.company}: ${companies.find(c => c.name === company)?.company_name ?? company}`,
                            `${t.asOf}: ${asOf}`,
                            `${t.basis}: ${basis === 'Due Date' ? t.dueDate : t.postingDate}`,
                        ]}
                        sections={[{
                            columns: [
                                { label: t.supplier },
                                { label: t.voucher },
                                { label: t.due },
                                { label: t.invoiced, align: 'end' },
                                { label: t.paid, align: 'end' },
                                { label: t.outstanding, align: 'end' },
                                { label: t.current, align: 'end' },
                                { label: t.r2, align: 'end' },
                                { label: t.r3, align: 'end' },
                                { label: t.r4, align: 'end' },
                            ],
                            rows: rows.map(r => [
                                r.party_name ?? r.party ?? '',
                                r.voucher_no ?? '—',
                                r.due_date ?? '—',
                                fmt(r.invoiced), fmt(r.paid), fmt(r.outstanding),
                                fmt(r.range1), fmt(r.range2), fmt(r.range3), fmt(r.range4),
                            ]),
                            footer: [
                                { text: t.total, bold: true }, '', '',
                                fmt(totals.invoiced), fmt(totals.paid), fmt(totals.outstanding),
                                fmt(totals.r1), fmt(totals.r2), fmt(totals.r3), fmt(totals.r4),
                            ],
                        }]}
                    />
                )}
            </div>

            {error && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" /><p className="text-sm">{error}</p>
                </div>
            )}

            {(ran || loading) && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>{[t.supplier, t.voucher, t.due, t.invoiced, t.paid, t.outstanding, t.current, t.r2, t.r3, t.r4].map(h => (
                                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                                ))}</tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}>{Array.from({ length: 10 }).map((_, j) => (
                                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                                    ))}</tr>
                                )) : rows.length === 0 ? (
                                    <tr><td colSpan={10} className="text-center py-12 text-gray-400">{t.noData}</td></tr>
                                ) : rows.map((r, i) => (
                                    <tr key={i} className={cn('hover:bg-gray-50', (r.range4 ?? 0) > 0 && 'bg-red-50/40')}>
                                        <td className="px-4 py-2.5 font-medium text-gray-900">{r.party_name ?? r.party}</td>
                                        <td className="px-4 py-2.5 text-gray-600 font-mono text-xs">{r.voucher_no ?? '—'}</td>
                                        <td className="px-4 py-2.5 text-gray-600">{r.due_date ?? '—'}</td>
                                        <td className="px-4 py-2.5 text-end tabular-nums">{fmt(r.invoiced)}</td>
                                        <td className="px-4 py-2.5 text-end tabular-nums text-green-700">{fmt(r.paid)}</td>
                                        <td className="px-4 py-2.5 text-end tabular-nums font-semibold">{fmt(r.outstanding)}</td>
                                        <td className="px-4 py-2.5 text-end tabular-nums text-blue-700">{fmt(r.range1)}</td>
                                        <td className="px-4 py-2.5 text-end tabular-nums text-amber-700">{fmt(r.range2)}</td>
                                        <td className="px-4 py-2.5 text-end tabular-nums text-orange-700">{fmt(r.range3)}</td>
                                        <td className="px-4 py-2.5 text-end tabular-nums text-red-700 font-semibold">{fmt(r.range4)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            {!loading && rows.length > 0 && (
                                <tfoot className="bg-gray-50 border-t-2 border-gray-300 font-bold">
                                    <tr>
                                        <td colSpan={3} className="px-4 py-3 text-gray-700">{t.total}</td>
                                        <td className="px-4 py-3 text-end tabular-nums">{fmt(totals.invoiced)}</td>
                                        <td className="px-4 py-3 text-end tabular-nums text-green-700">{fmt(totals.paid)}</td>
                                        <td className="px-4 py-3 text-end tabular-nums">{fmt(totals.outstanding)}</td>
                                        <td className="px-4 py-3 text-end tabular-nums text-blue-700">{fmt(totals.r1)}</td>
                                        <td className="px-4 py-3 text-end tabular-nums text-amber-700">{fmt(totals.r2)}</td>
                                        <td className="px-4 py-3 text-end tabular-nums text-orange-700">{fmt(totals.r3)}</td>
                                        <td className="px-4 py-3 text-end tabular-nums text-red-700">{fmt(totals.r4)}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
