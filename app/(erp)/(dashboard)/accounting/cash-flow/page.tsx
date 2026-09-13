'use client'

import { useCallback, useEffect, useState } from 'react'
import { accountingApi, type CashFlowRow, type CostCenter, type FiscalYear } from '@/lib/accounting-api'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, RefreshCw, TrendingUp, Download } from 'lucide-react'
import { exportToCsv } from '@/lib/export-csv'
import { cn } from '@/lib/utils'
import { ReportPrintButton } from '@/components/accounting/report-print'

type Locale = 'ar' | 'en'
const fmt = (v?: number) => (v ?? 0).toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const L = {
    en: {
        title: 'Cash Flow Statement', subtitle: 'How cash moved in and out of the business during the period.',
        company: 'Company', fiscalYear: 'Fiscal Year', from: 'From Date', to: 'To Date',
        costCenter: 'Cost Center', allCostCenters: 'All',
        periodicity: 'Periodicity', yearly: 'Yearly', halfYearly: 'Half-Yearly', quarterly: 'Quarterly', monthly: 'Monthly',
        run: 'Run Report', refresh: 'Refresh', account: 'Account', amount: 'Amount',
        noData: 'No cash flow data found.', error: 'Failed to load report.', allCompanies: 'Select company',
        selectFY: 'Select fiscal year',
    },
    ar: {
        title: 'قائمة التدفقات النقدية', subtitle: 'كيف تحرّكت النقدية خلال الفترة.',
        company: 'الشركة', fiscalYear: 'السنة المالية', from: 'من تاريخ', to: 'إلى تاريخ',
        costCenter: 'مركز التكلفة', allCostCenters: 'الكل',
        periodicity: 'الدورية', yearly: 'سنوي', halfYearly: 'نصف سنوي', quarterly: 'ربع سنوي', monthly: 'شهري',
        run: 'تشغيل التقرير', refresh: 'تحديث', account: 'الحساب', amount: 'المبلغ',
        noData: 'لا توجد بيانات تدفق نقدي.', error: 'فشل تحميل التقرير.', allCompanies: 'اختر شركة',
        selectFY: 'اختر السنة المالية',
    },
} as const

export default function CashFlowPage() {
    const { lang, isRTL } = useI18n()
    const locale = (lang === 'ar' ? 'ar' : 'en') as Locale
    const t = L[locale]

    const [companies, setCompanies] = useState<Array<{ name: string; company_name: string }>>([])
    const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([])
    const [costCenters, setCostCenters] = useState<CostCenter[]>([])
    const [company, setCompany] = useState('')
    const [fiscalYear, setFiscalYear] = useState('')
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')
    const [costCenter, setCostCenter] = useState('')
    const [periodicity, setPeriodicity] = useState<'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly'>('Yearly')
    const [rows, setRows] = useState<CashFlowRow[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [ran, setRan] = useState(false)

    useEffect(() => {
        Promise.all([accountingApi.getCompanies(), accountingApi.getFiscalYears()]).then(([cos, fys]) => {
            setCompanies(cos)
            setFiscalYears(fys)
            if (cos.length === 1) {
                setCompany(cos[0].name)
                accountingApi.getCostCenters(cos[0].name).then(setCostCenters).catch(() => {})
            }
            if (fys.length > 0) {
                setFiscalYear(fys[0].name)
                setFromDate(fys[0].year_start_date)
                setToDate(fys[0].year_end_date)
            }
        }).catch(() => {})
    }, [])

    const runReport = useCallback(async () => {
        if (!company || !fiscalYear) return
        setLoading(true); setError(null); setRan(true)
        try {
            const data = await accountingApi.getCashFlowReport({ company, fiscal_year: fiscalYear, period_start_date: fromDate || undefined, period_end_date: toDate || undefined, periodicity, cost_center: costCenter || undefined })
            setRows(data)
        } catch (e: any) { setError(e?.message ?? t.error) }
        finally { setLoading(false) }
    }, [company, fiscalYear, fromDate, toDate, periodicity, costCenter, t.error])

    return (
        <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-600 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
                    <p className="text-sm text-gray-500">{t.subtitle}</p>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">{t.company}</label>
                    <select value={company} onChange={e => {
                        const v = e.target.value
                        setCompany(v)
                        setCostCenter('')
                        if (v) accountingApi.getCostCenters(v).then(setCostCenters).catch(() => setCostCenters([]))
                        else setCostCenters([])
                    }} className="h-9 border border-gray-200 rounded-lg px-3 text-sm">
                        <option value="">{t.allCompanies}</option>
                        {companies.map(c => <option key={c.name} value={c.name}>{c.company_name}</option>)}
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">{t.fiscalYear}</label>
                    <select value={fiscalYear} onChange={e => {
                        setFiscalYear(e.target.value)
                        const fy = fiscalYears.find(f => f.name === e.target.value)
                        if (fy) { setFromDate(fy.year_start_date); setToDate(fy.year_end_date) }
                    }} className="h-9 border border-gray-200 rounded-lg px-3 text-sm">
                        <option value="">{t.selectFY}</option>
                        {fiscalYears.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
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
                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">{t.periodicity}</label>
                    <select value={periodicity} onChange={e => setPeriodicity(e.target.value as any)} className="h-9 border border-gray-200 rounded-lg px-3 text-sm">
                        <option value="Yearly">{t.yearly}</option>
                        <option value="Half-Yearly">{t.halfYearly}</option>
                        <option value="Quarterly">{t.quarterly}</option>
                        <option value="Monthly">{t.monthly}</option>
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">{t.costCenter}</label>
                    <select value={costCenter} onChange={e => setCostCenter(e.target.value)} className="h-9 border border-gray-200 rounded-lg px-3 text-sm">
                        <option value="">{t.allCostCenters}</option>
                        {costCenters.filter(cc => !cc.is_group).map(cc => (
                            <option key={cc.name} value={cc.name}>{cc.cost_center_name}</option>
                        ))}
                    </select>
                </div>
                <Button onClick={runReport} disabled={!company || !fiscalYear || loading} className="bg-cyan-600 hover:bg-cyan-700">
                    <RefreshCw className={cn('w-4 h-4 me-2', loading && 'animate-spin')} />{ran ? t.refresh : t.run}
                </Button>
                {rows.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => exportToCsv(
                        `cash-flow-${fiscalYear}.csv`,
                        ['Account', 'Amount'],
                        rows.map(r => [r.account_name ?? r.account ?? '', r.amount])
                    )}>
                        <Download className="w-4 h-4 me-1" /> CSV
                    </Button>
                )}
                {rows.length > 0 && (
                    <ReportPrintButton
                        title={t.title}
                        subtitle={t.subtitle}
                        meta={[
                            `${t.company}: ${companies.find(c => c.name === company)?.company_name ?? company}`,
                            `${t.fiscalYear}: ${fiscalYear}`,
                            `${t.from}: ${fromDate} — ${t.to}: ${toDate}`,
                            costCenter ? `${t.costCenter}: ${costCenters.find(cc => cc.name === costCenter)?.cost_center_name ?? costCenter}` : '',
                        ].filter(Boolean)}
                        sections={[{
                            columns: [
                                { label: t.account },
                                { label: t.amount, align: 'end' },
                            ],
                            rows: rows.map(r => [
                                { text: r.account_name ?? r.account ?? '', indent: r.indent ?? 0, bold: r.is_group || false },
                                { text: r.amount != null ? fmt(r.amount) : '', align: 'end' as const, bold: r.is_group || false },
                            ]),
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
                                <tr>
                                    <th className="px-4 py-3 text-start text-xs font-semibold text-gray-600">{t.account}</th>
                                    <th className="px-4 py-3 text-end text-xs font-semibold text-gray-600">{t.amount}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={i}><td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td><td className="px-4 py-3"><Skeleton className="h-4 w-24 ms-auto" /></td></tr>
                                )) : rows.length === 0 ? (
                                    <tr><td colSpan={2} className="text-center py-12 text-gray-400">{t.noData}</td></tr>
                                ) : rows.map((r, i) => {
                                    const isHeader = r.is_group || false
                                    const amount = r.amount ?? 0
                                    const indent = r.indent ?? 0
                                    return (
                                        <tr key={i} className={cn('hover:bg-gray-50', isHeader && 'bg-gray-50/80')}>
                                            <td className={cn('px-4 py-2.5 text-gray-800', isHeader ? 'font-bold text-[14px]' : 'text-[13px]')}
                                                style={{ paddingInlineStart: `${16 + indent * 24}px` }}>
                                                {r.account_name ?? r.account ?? ''}
                                            </td>
                                            <td className={cn('px-4 py-2.5 text-end tabular-nums', amount < 0 ? 'text-red-700' : 'text-gray-800', isHeader && 'font-bold')}>
                                                {r.amount != null ? fmt(amount) : ''}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
