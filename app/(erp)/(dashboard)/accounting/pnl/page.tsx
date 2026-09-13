'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    accountingApi,
    type Account,
    type CostCenter,
    type FiscalYear,
    type TrialBalanceRow,
} from '@/lib/accounting-api'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, Filter, RefreshCw, TrendingDown, TrendingUp, Download } from 'lucide-react'
import { exportToCsv } from '@/lib/export-csv'
import { ReportPrintButton } from '@/components/accounting/report-print'
import { cn } from '@/lib/utils'

interface CompanyOption {
    name: string
    company_name: string
    default_currency: string
    abbr?: string
}

interface PnlFilters {
    company: string
    fiscalYear: string
    fromDate?: string
    toDate?: string
}

type Locale = 'ar' | 'en'

const COGS_TYPE: Account['account_type'] = 'Cost of Goods Sold'
const EPSILON = 0.001

const todayIso = (): string => new Date().toISOString().split('T')[0]

const formatAmount = (value?: number, locale: Locale = 'en'): string =>
    (value ?? 0).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-SA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })

function Bilingual({ ar, en, className }: { ar: string; en: string; className?: string }) {
    const { lang } = useI18n()
    const locale: Locale = lang === 'ar' ? 'ar' : 'en'

    return (
        <span className={cn(className)}>{locale === 'ar' ? ar : en}</span>
    )
}

function SectionSkeleton() {
    return (
        <Card className="border-gray-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
                <Skeleton className="h-6 w-52" />
            </CardHeader>
            <CardContent className="space-y-3">
                {Array.from({ length: 5 }).map((_, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                        <Skeleton className="h-4 w-56" />
                        <Skeleton className="h-4 w-28" />
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}

export default function ProfitLossPage() {
    const { lang, isRTL } = useI18n()
    const locale: Locale = lang === 'ar' ? 'ar' : 'en'
    const tr = (ar: string, en: string) => (locale === 'ar' ? ar : en)

    const [companies, setCompanies] = useState<CompanyOption[]>([])
    const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([])
    const [costCenters, setCostCenters] = useState<CostCenter[]>([])

    const [company, setCompany] = useState('')
    const [fiscalYear, setFiscalYear] = useState('')
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')
    const [costCenter, setCostCenter] = useState('')

    const [rows, setRows] = useState<TrialBalanceRow[]>([])
    const [accountMap, setAccountMap] = useState<Record<string, Account>>({})

    const [bootLoading, setBootLoading] = useState(true)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const loadReport = useCallback(async (filters: PnlFilters) => {
        try {
            setLoading(true)
            setError(null)

            const [accounts, trialBalance] = await Promise.all([
                accountingApi.getAccounts({ company: filters.company }),
                accountingApi.getTrialBalance({
                    company: filters.company,
                    fiscal_year: filters.fiscalYear,
                    from_date: filters.fromDate,
                    to_date: filters.toDate,
                    cost_center: costCenter || undefined,
                }),
            ])

            const nextAccountMap: Record<string, Account> = {}
            for (const account of accounts) {
                nextAccountMap[account.name] = account
            }

            setAccountMap(nextAccountMap)
            setRows(trialBalance.filter((row) => Boolean(row.account)))
        } catch (err: any) {
            setError(err?.message ?? tr('فشل تحميل قائمة الدخل', 'Failed to load P&L'))
            setRows([])
            setAccountMap({})
        } finally {
            setLoading(false)
        }
    }, [costCenter, locale])

    useEffect(() => {
        let isMounted = true

        const bootstrap = async () => {
            try {
                setBootLoading(true)
                setError(null)

                const [companyList, fiscalYearList] = await Promise.all([
                    accountingApi.getCompanies(),
                    accountingApi.getFiscalYears(),
                ])

                if (!isMounted) return

                setCompanies(companyList)
                setFiscalYears(fiscalYearList)

                const defaultCompany = companyList[0]?.name ?? ''

                if (defaultCompany) {
                    accountingApi.getCostCenters(defaultCompany).then(cc => {
                        if (isMounted) setCostCenters(cc)
                    }).catch(() => { })
                }
                const defaultFiscalYear = fiscalYearList[0]?.name ?? ''
                const defaultFromDate = fiscalYearList[0]?.year_start_date ?? ''
                const defaultToDate = todayIso()

                setCompany(defaultCompany)
                setFiscalYear(defaultFiscalYear)
                setFromDate(defaultFromDate)
                setToDate(defaultToDate)

                if (defaultCompany && defaultFiscalYear) {
                    await loadReport({
                        company: defaultCompany,
                        fiscalYear: defaultFiscalYear,
                        fromDate: defaultFromDate || undefined,
                        toDate: defaultToDate || undefined,
                    })
                }
            } catch (err: any) {
                if (!isMounted) return
                setError(err?.message ?? tr('فشل تحميل البيانات التمهيدية', 'Failed to initialize report'))
            } finally {
                if (isMounted) {
                    setBootLoading(false)
                }
            }
        }

        void bootstrap()
        return () => {
            isMounted = false
        }
    }, [loadReport, locale])

    const hasRequiredFilters = company.trim() !== '' && fiscalYear.trim() !== ''

    const runReport = async () => {
        if (!hasRequiredFilters) {
            setError(tr('يرجى اختيار الشركة والسنة المالية', 'Please select company and fiscal year'))
            return
        }

        await loadReport({
            company,
            fiscalYear,
            fromDate: fromDate || undefined,
            toDate: toDate || undefined,
        })
    }

    const analysis = useMemo(() => {
        const cleanedRows = rows.filter((row) => row.account)
        const parentAccounts = new Set(
            cleanedRows.map((row) => row.parent_account).filter((name): name is string => Boolean(name))
        )

        const isLeaf = (row: TrialBalanceRow): boolean => !parentAccounts.has(row.account)

        const incomeRows: TrialBalanceRow[] = []
        const cogsRows: TrialBalanceRow[] = []
        const opexRows: TrialBalanceRow[] = []

        let totalIncome = 0
        let totalCogs = 0
        let totalOpex = 0

        for (const row of cleanedRows) {
            const account = accountMap[row.account]
            if (!account?.root_type) continue

            const incomeBalance = (row.closing_credit ?? 0) - (row.closing_debit ?? 0)
            const expenseBalance = (row.closing_debit ?? 0) - (row.closing_credit ?? 0)

            if (account.root_type === 'Income') {
                incomeRows.push(row)
                if (isLeaf(row)) {
                    totalIncome += incomeBalance
                }
                continue
            }

            if (account.root_type === 'Expense') {
                if (account.account_type === COGS_TYPE) {
                    cogsRows.push(row)
                    if (isLeaf(row)) {
                        totalCogs += expenseBalance
                    }
                } else {
                    opexRows.push(row)
                    if (isLeaf(row)) {
                        totalOpex += expenseBalance
                    }
                }
            }
        }

        const netIncome = totalIncome - totalCogs - totalOpex

        return {
            parentAccounts,
            incomeRows,
            cogsRows,
            opexRows,
            totalIncome,
            totalCogs,
            totalOpex,
            netIncome,
        }
    }, [rows, accountMap])

    const renderRows = (
        data: TrialBalanceRow[],
        amountResolver: (row: TrialBalanceRow) => number,
        colorClass: string
    ) => {
        if (data.length === 0) {
            return (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                    {tr('لا توجد بيانات', 'No records')}
                </div>
            )
        }

        return (
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {data.map((row) => {
                    const isGroup = analysis.parentAccounts.has(row.account)
                    return (
                        <div key={row.account} className="flex items-center justify-between gap-4 px-4 py-2.5 hover:bg-gray-50">
                            <div className="min-w-0" style={{ paddingInlineStart: `${(row.indent ?? 0) * 16}px` }}>
                                <p className={cn('truncate text-sm', isGroup ? 'font-semibold text-gray-900' : 'text-gray-700')}>
                                    {row.account_name ?? row.account}
                                </p>
                                <p className="truncate text-[11px] text-gray-400" dir="ltr">
                                    {row.account}
                                </p>
                            </div>
                            <p className={cn('shrink-0 text-sm font-mono', isGroup ? `font-bold ${colorClass}` : 'text-gray-700')} dir="ltr">
                                {formatAmount(amountResolver(row), locale)}
                            </p>
                        </div>
                    )
                })}
            </div>
        )
    }

    return (
        <div dir={isRTL ? 'rtl' : 'ltr'} lang={locale} className="min-h-screen bg-gray-50 p-6">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
                <Card className="border-gray-200 bg-white shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-2xl font-bold text-gray-900">
                            <Bilingual ar="قائمة الدخل" en="Profit & Loss" />
                        </CardTitle>
                        <CardDescription className="text-gray-500">
                            <Bilingual ar="الإيرادات، تكلفة المبيعات، المصروفات وصافي الربح" en="Income, COGS, Expenses and Net Income" />
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
                            <div className="space-y-1.5 lg:col-span-2">
                                <Label className="text-xs text-gray-500">
                                    <Bilingual ar="الشركة" en="Company" />
                                </Label>
                                <select
                                    value={company}
                                    onChange={(e) => {
                                        const v = e.target.value
                                        setCompany(v)
                                        setCostCenter('')
                                        if (v) accountingApi.getCostCenters(v).then(setCostCenters).catch(() => setCostCenters([]))
                                        else setCostCenters([])
                                    }}
                                    className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                >
                                    <option value="">{tr('اختر الشركة', 'Select company')}</option>
                                    {companies.map((item) => (
                                        <option key={item.name} value={item.name}>
                                            {item.company_name} ({item.name})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs text-gray-500">
                                    <Bilingual ar="السنة المالية" en="Fiscal Year" />
                                </Label>
                                <select
                                    value={fiscalYear}
                                    onChange={(e) => {
                                        const nextFiscalYear = e.target.value
                                        setFiscalYear(nextFiscalYear)
                                        const picked = fiscalYears.find((fy) => fy.name === nextFiscalYear)
                                        if (picked?.year_start_date) {
                                            setFromDate(picked.year_start_date)
                                        }
                                    }}
                                    className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                >
                                    <option value="">{tr('اختر السنة', 'Select fiscal year')}</option>
                                    {fiscalYears.map((fy) => (
                                        <option key={fy.name} value={fy.name}>
                                            {fy.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs text-gray-500">
                                    <Bilingual ar="من تاريخ" en="From" />
                                </Label>
                                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-10" />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs text-gray-500">
                                    <Bilingual ar="إلى تاريخ" en="To" />
                                </Label>
                                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-10" />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs text-gray-500">
                                    <Bilingual ar="مركز التكلفة" en="Cost Center" />
                                </Label>
                                <select
                                    value={costCenter}
                                    onChange={(e) => setCostCenter(e.target.value)}
                                    className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                >
                                    <option value="">{tr('الكل', 'All')}</option>
                                    {costCenters.filter(cc => !cc.is_group).map((cc) => (
                                        <option key={cc.name} value={cc.name}>
                                            {cc.cost_center_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <Button
                                onClick={runReport}
                                disabled={loading || !hasRequiredFilters}
                                className="bg-indigo-600 text-white hover:bg-indigo-700"
                            >
                                {loading ? <RefreshCw className="me-2 h-4 w-4 animate-spin" /> : <Filter className="me-2 h-4 w-4" />}
                                {tr('عرض التقرير', 'Run Report')}
                            </Button>
                            {rows.length > 0 && (
                                <Button variant="outline" size="sm" onClick={() => {
                                    const fmtVal = (v?: number) => (v ?? 0).toFixed(2)
                                    exportToCsv(
                                        `profit-and-loss-${toDate}.csv`,
                                        ['Account', 'Amount'],
                                        rows.filter(r => r.account).map(r => [
                                            r.account_name ?? r.account,
                                            fmtVal(r.closing_debit || r.closing_credit || r.debit || r.credit),
                                        ])
                                    )
                                }}>
                                    <Download className="w-4 h-4 me-1" /> CSV
                                </Button>
                            )}
                            {rows.length > 0 && (() => {
                                const incomeAmount = (r: TrialBalanceRow) => (r.closing_credit ?? 0) - (r.closing_debit ?? 0)
                                const expenseAmount = (r: TrialBalanceRow) => (r.closing_debit ?? 0) - (r.closing_credit ?? 0)
                                const cols = [
                                    { label: tr('الحساب', 'Account') },
                                    { label: tr('المبلغ', 'Amount'), align: 'end' as const },
                                ]
                                const toRows = (data: TrialBalanceRow[], amount: (r: TrialBalanceRow) => number) =>
                                    data.map(r => {
                                        const isGroup = analysis.parentAccounts.has(r.account)
                                        return [
                                            { text: r.account_name ?? r.account, indent: r.indent ?? 0, bold: isGroup },
                                            { text: formatAmount(amount(r), locale), align: 'end' as const, bold: isGroup },
                                        ]
                                    })
                                return (
                                    <ReportPrintButton
                                        title={tr('قائمة الدخل', 'Profit & Loss')}
                                        subtitle={tr('الإيرادات، تكلفة المبيعات، المصروفات وصافي الربح', 'Income, COGS, Expenses and Net Income')}
                                        meta={[
                                            `${tr('الشركة', 'Company')}: ${companies.find(c => c.name === company)?.company_name ?? company}`,
                                            `${tr('السنة المالية', 'Fiscal Year')}: ${fiscalYear}`,
                                            `${tr('من', 'From')}: ${fromDate} — ${tr('إلى', 'To')}: ${toDate}`,
                                            costCenter ? `${tr('مركز التكلفة', 'Cost Center')}: ${costCenters.find(cc => cc.name === costCenter)?.cost_center_name ?? costCenter}` : '',
                                        ].filter(Boolean)}
                                        sections={[
                                            { heading: tr('الإيرادات', 'Income'), columns: cols, rows: toRows(analysis.incomeRows, incomeAmount) },
                                            { heading: tr('تكلفة المبيعات', 'Cost of Goods Sold'), columns: cols, rows: toRows(analysis.cogsRows, expenseAmount) },
                                            { heading: tr('المصروفات التشغيلية', 'Operating Expenses'), columns: cols, rows: toRows(analysis.opexRows, expenseAmount) },
                                        ]}
                                        summary={[
                                            { label: tr('إجمالي الإيرادات', 'Total Income'), value: formatAmount(analysis.totalIncome, locale) },
                                            { label: tr('تكلفة المبيعات', 'Total COGS'), value: formatAmount(analysis.totalCogs, locale) },
                                            { label: tr('المصروفات التشغيلية', 'Total Operating Expenses'), value: formatAmount(analysis.totalOpex, locale) },
                                            { label: tr('صافي الربح', 'Net Income'), value: formatAmount(analysis.netIncome, locale), strong: true },
                                        ]}
                                    />
                                )
                            })()}
                        </div>
                    </CardContent>
                </Card>

                {error && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                            <p>{error}</p>
                            <button
                                type="button"
                                onClick={() => void runReport()}
                                className="mt-1 underline"
                            >
                                {tr('إعادة المحاولة', 'Retry')}
                            </button>
                        </div>
                    </div>
                )}

                {(bootLoading || loading) && (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <SectionSkeleton />
                        <SectionSkeleton />
                        <SectionSkeleton />
                    </div>
                )}

                {!bootLoading && !loading && (
                    <>
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                            <Card className="border-emerald-200 bg-emerald-50/40 shadow-sm">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base text-emerald-900">
                                        <Bilingual ar="إجمالي الإيرادات" en="Total Income" />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold text-emerald-700" dir="ltr">
                                        {formatAmount(analysis.totalIncome, locale)}
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="border-amber-200 bg-amber-50/40 shadow-sm">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base text-amber-900">
                                        <Bilingual ar="تكلفة المبيعات" en="COGS" />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold text-amber-700" dir="ltr">
                                        {formatAmount(analysis.totalCogs, locale)}
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="border-rose-200 bg-rose-50/40 shadow-sm">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base text-rose-900">
                                        <Bilingual ar="إجمالي المصروفات التشغيلية" en="Total Operating Expenses" />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold text-rose-700" dir="ltr">
                                        {formatAmount(analysis.totalOpex, locale)}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                            <Card className="border-gray-200 bg-white shadow-sm lg:col-span-3">
                                <CardHeader>
                                    <CardTitle className="text-lg text-gray-900">
                                        <span className="inline-flex items-center gap-2">
                                            <TrendingUp className="h-5 w-5 text-emerald-600" />
                                            <Bilingual ar="الإيرادات" en="Income" />
                                        </span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>{renderRows(analysis.incomeRows, (row) => (row.closing_credit ?? 0) - (row.closing_debit ?? 0), 'text-emerald-700')}</CardContent>
                            </Card>

                            <Card className="border-gray-200 bg-white shadow-sm lg:col-span-3">
                                <CardHeader>
                                    <CardTitle className="text-lg text-gray-900">
                                        <span className="inline-flex items-center gap-2">
                                            <TrendingDown className="h-5 w-5 text-amber-600" />
                                            <Bilingual ar="تكلفة المبيعات" en="Cost of Goods Sold" />
                                        </span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>{renderRows(analysis.cogsRows, (row) => (row.closing_debit ?? 0) - (row.closing_credit ?? 0), 'text-amber-700')}</CardContent>
                            </Card>

                            <Card className="border-gray-200 bg-white shadow-sm lg:col-span-3">
                                <CardHeader>
                                    <CardTitle className="text-lg text-gray-900">
                                        <span className="inline-flex items-center gap-2">
                                            <TrendingDown className="h-5 w-5 text-rose-600" />
                                            <Bilingual ar="المصروفات التشغيلية" en="Operating Expenses" />
                                        </span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>{renderRows(analysis.opexRows, (row) => (row.closing_debit ?? 0) - (row.closing_credit ?? 0), 'text-rose-700')}</CardContent>
                            </Card>
                        </div>

                        <Card
                            className={cn(
                                'shadow-sm',
                                Math.abs(analysis.netIncome) < EPSILON
                                    ? 'border-gray-300 bg-gray-50'
                                    : analysis.netIncome > 0
                                        ? 'border-emerald-300 bg-emerald-50'
                                        : 'border-rose-300 bg-rose-50'
                            )}
                        >
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xl font-bold text-gray-900">
                                    <Bilingual ar="صافي الربح / الخسارة" en="Net Income" />
                                </CardTitle>
                                <CardDescription className="text-gray-500">
                                    <Bilingual ar="الإيرادات - تكلفة المبيعات - المصروفات التشغيلية" en="Income - COGS - Operating Expenses" />
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p
                                    dir="ltr"
                                    className={cn(
                                        'text-3xl font-bold',
                                        Math.abs(analysis.netIncome) < EPSILON
                                            ? 'text-gray-700'
                                            : analysis.netIncome > 0
                                                ? 'text-emerald-700'
                                                : 'text-rose-700'
                                    )}
                                >
                                    {formatAmount(analysis.netIncome, locale)}
                                </p>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </div>
    )
}
