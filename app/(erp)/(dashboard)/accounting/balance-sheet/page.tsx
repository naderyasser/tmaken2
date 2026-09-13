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
import { AlertCircle, CheckCircle2, Filter, RefreshCw, Scale, Download } from 'lucide-react'
import { exportToCsv } from '@/lib/export-csv'
import { ReportPrintButton } from '@/components/accounting/report-print'
import { cn } from '@/lib/utils'

interface CompanyOption {
    name: string
    company_name: string
    default_currency: string
    abbr?: string
}

interface BalanceSheetFilters {
    company: string
    fiscalYear: string
    asOfDate: string
    fromDate?: string
}

type Locale = 'ar' | 'en'

const BALANCE_EPSILON = 0.01

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
                <Skeleton className="h-6 w-56" />
            </CardHeader>
            <CardContent className="space-y-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                        <Skeleton className="h-4 w-56" />
                        <Skeleton className="h-4 w-28" />
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}

export default function BalanceSheetPage() {
    const { lang, isRTL } = useI18n()
    const locale: Locale = lang === 'ar' ? 'ar' : 'en'
    const tr = (ar: string, en: string) => (locale === 'ar' ? ar : en)

    const [companies, setCompanies] = useState<CompanyOption[]>([])
    const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([])
    const [costCenters, setCostCenters] = useState<CostCenter[]>([])

    const [company, setCompany] = useState('')
    const [fiscalYear, setFiscalYear] = useState('')
    const [asOfDate, setAsOfDate] = useState('')
    const [costCenter, setCostCenter] = useState('')

    const [rows, setRows] = useState<TrialBalanceRow[]>([])
    const [accountMap, setAccountMap] = useState<Record<string, Account>>({})

    const [bootLoading, setBootLoading] = useState(true)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const loadReport = useCallback(async (filters: BalanceSheetFilters) => {
        try {
            setLoading(true)
            setError(null)

            const [accounts, trialBalance] = await Promise.all([
                accountingApi.getAccounts({ company: filters.company }),
                accountingApi.getTrialBalance({
                    company: filters.company,
                    fiscal_year: filters.fiscalYear,
                    from_date: filters.fromDate,
                    to_date: filters.asOfDate,
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
            setError(err?.message ?? tr('فشل تحميل الميزانية العمومية', 'Failed to load balance sheet'))
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
                const defaultAsOfDate = todayIso()

                setCompany(defaultCompany)
                setFiscalYear(defaultFiscalYear)
                setAsOfDate(defaultAsOfDate)

                if (defaultCompany && defaultFiscalYear) {
                    await loadReport({
                        company: defaultCompany,
                        fiscalYear: defaultFiscalYear,
                        fromDate: defaultFromDate || undefined,
                        asOfDate: defaultAsOfDate,
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

    const hasRequiredFilters = company.trim() !== '' && fiscalYear.trim() !== '' && asOfDate.trim() !== ''

    const runReport = async () => {
        if (!hasRequiredFilters) {
            setError(tr('يرجى اختيار الشركة والسنة المالية وتاريخ التقرير', 'Please select company, fiscal year and date'))
            return
        }

        const selectedFiscalYear = fiscalYears.find((fy) => fy.name === fiscalYear)

        await loadReport({
            company,
            fiscalYear,
            fromDate: selectedFiscalYear?.year_start_date,
            asOfDate,
        })
    }

    const analysis = useMemo(() => {
        const cleanedRows = rows.filter((row) => row.account)
        const parentAccounts = new Set(
            cleanedRows.map((row) => row.parent_account).filter((name): name is string => Boolean(name))
        )

        const isLeaf = (row: TrialBalanceRow): boolean => !parentAccounts.has(row.account)

        const assetRows: TrialBalanceRow[] = []
        const liabilityRows: TrialBalanceRow[] = []
        const equityRows: TrialBalanceRow[] = []

        let totalAssets = 0
        let totalLiabilities = 0
        let totalEquity = 0
        let totalIncome = 0
        let totalExpense = 0

        for (const row of cleanedRows) {
            const account = accountMap[row.account]
            if (!account?.root_type) continue

            const assetBalance = (row.closing_debit ?? 0) - (row.closing_credit ?? 0)
            const rhsBalance = (row.closing_credit ?? 0) - (row.closing_debit ?? 0)
            const incomeBalance = (row.closing_credit ?? 0) - (row.closing_debit ?? 0)
            const expenseBalance = (row.closing_debit ?? 0) - (row.closing_credit ?? 0)

            if (account.root_type === 'Asset') {
                assetRows.push(row)
                if (isLeaf(row)) {
                    totalAssets += assetBalance
                }
                continue
            }

            if (account.root_type === 'Liability') {
                liabilityRows.push(row)
                if (isLeaf(row)) {
                    totalLiabilities += rhsBalance
                }
                continue
            }

            if (account.root_type === 'Equity') {
                equityRows.push(row)
                if (isLeaf(row)) {
                    totalEquity += rhsBalance
                }
                continue
            }

            if (account.root_type === 'Income' && isLeaf(row)) {
                totalIncome += incomeBalance
                continue
            }

            if (account.root_type === 'Expense' && isLeaf(row)) {
                totalExpense += expenseBalance
            }
        }

        const currentPeriodEarnings = totalIncome - totalExpense
        const totalRightSide = totalLiabilities + totalEquity + currentPeriodEarnings
        const discrepancy = Math.abs(totalAssets - totalRightSide)
        const isBalanced = discrepancy < BALANCE_EPSILON

        return {
            parentAccounts,
            assetRows,
            liabilityRows,
            equityRows,
            totalAssets,
            totalLiabilities,
            totalEquity,
            currentPeriodEarnings,
            totalRightSide,
            discrepancy,
            isBalanced,
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
                            <Bilingual ar="الميزانية العمومية" en="Balance Sheet" />
                        </CardTitle>
                        <CardDescription className="text-gray-500">
                            <Bilingual ar="الأصول مقابل الخصوم وحقوق الملكية" en="Assets vs Liabilities and Equity" />
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
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
                                    onChange={(e) => setFiscalYear(e.target.value)}
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
                                    <Bilingual ar="كما في تاريخ" en="As of Date" />
                                </Label>
                                <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="h-10" />
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
                                        `balance-sheet-${asOfDate}.csv`,
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
                                const assetAmount = (r: TrialBalanceRow) => (r.closing_debit ?? 0) - (r.closing_credit ?? 0)
                                const rhsAmount = (r: TrialBalanceRow) => (r.closing_credit ?? 0) - (r.closing_debit ?? 0)
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
                                        title={tr('الميزانية العمومية', 'Balance Sheet')}
                                        subtitle={tr('الأصول، الالتزامات وحقوق الملكية', 'Assets, Liabilities and Equity')}
                                        meta={[
                                            `${tr('الشركة', 'Company')}: ${companies.find(c => c.name === company)?.company_name ?? company}`,
                                            `${tr('السنة المالية', 'Fiscal Year')}: ${fiscalYear}`,
                                            `${tr('بتاريخ', 'As of')}: ${asOfDate}`,
                                            costCenter ? `${tr('مركز التكلفة', 'Cost Center')}: ${costCenters.find(cc => cc.name === costCenter)?.cost_center_name ?? costCenter}` : '',
                                            analysis.isBalanced ? tr('الميزانية متوازنة ✓', 'Balanced ✓') : tr('الميزانية غير متوازنة ✗', 'Not balanced ✗'),
                                        ].filter(Boolean)}
                                        sections={[
                                            { heading: tr('الأصول', 'Assets'), columns: cols, rows: toRows(analysis.assetRows, assetAmount) },
                                            { heading: tr('الالتزامات', 'Liabilities'), columns: cols, rows: toRows(analysis.liabilityRows, rhsAmount) },
                                            { heading: tr('حقوق الملكية', 'Equity'), columns: cols, rows: toRows(analysis.equityRows, rhsAmount) },
                                        ]}
                                        summary={[
                                            { label: tr('إجمالي الأصول', 'Total Assets'), value: formatAmount(analysis.totalAssets, locale) },
                                            { label: tr('إجمالي الالتزامات', 'Total Liabilities'), value: formatAmount(analysis.totalLiabilities, locale) },
                                            { label: tr('إجمالي حقوق الملكية', 'Total Equity'), value: formatAmount(analysis.totalEquity, locale) },
                                            { label: tr('أرباح الفترة الحالية', 'Current Period Earnings'), value: formatAmount(analysis.currentPeriodEarnings, locale) },
                                            { label: tr('الالتزامات + حقوق الملكية', 'Liabilities + Equity'), value: formatAmount(analysis.totalRightSide, locale), strong: true },
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
                    </div>
                )}

                {!bootLoading && !loading && (
                    <>
                        <Card
                            className={cn(
                                'shadow-sm',
                                analysis.isBalanced ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'
                            )}
                        >
                            <CardContent className="flex flex-col gap-3 pt-6 md:flex-row md:items-center md:justify-between">
                                <div className="inline-flex items-center gap-2 font-semibold">
                                    {analysis.isBalanced ? (
                                        <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                                    ) : (
                                        <AlertCircle className="h-5 w-5 text-rose-700" />
                                    )}
                                    <Bilingual
                                        ar={analysis.isBalanced ? 'الميزانية متوازنة' : 'الميزانية غير متوازنة'}
                                        en={analysis.isBalanced ? 'Balanced' : 'Unbalanced'}
                                        className={analysis.isBalanced ? 'text-emerald-800' : 'text-rose-800'}
                                    />
                                </div>

                                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700">
                                    <span className="font-medium">
                                        <Bilingual ar="الأصول" en="Assets" />:
                                        <span className="ms-1 font-mono text-gray-900" dir="ltr">{formatAmount(analysis.totalAssets, locale)}</span>
                                    </span>
                                    <span className="font-medium">
                                        <Bilingual ar="الخصوم + حقوق الملكية" en="Liabilities + Equity" />:
                                        <span className="ms-1 font-mono text-gray-900" dir="ltr">{formatAmount(analysis.totalRightSide, locale)}</span>
                                    </span>
                                    {!analysis.isBalanced && (
                                        <span className="font-medium text-rose-700">
                                            <Bilingual ar="الفرق" en="Difference" />:
                                            <span className="ms-1 font-mono" dir="ltr">{formatAmount(analysis.discrepancy, locale)}</span>
                                        </span>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                            <Card className="border-gray-200 bg-white shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-lg text-gray-900">
                                        <span className="inline-flex items-center gap-2">
                                            <Scale className="h-5 w-5 text-blue-600" />
                                            <Bilingual ar="الأصول" en="Assets" />
                                        </span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {renderRows(
                                        analysis.assetRows,
                                        (row) => (row.closing_debit ?? 0) - (row.closing_credit ?? 0),
                                        'text-blue-700'
                                    )}

                                    <div className="mt-3 flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900">
                                        <Bilingual ar="إجمالي الأصول" en="Total Assets" />
                                        <span className="font-mono" dir="ltr">{formatAmount(analysis.totalAssets, locale)}</span>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="flex flex-col gap-6">
                                <Card className="border-gray-200 bg-white shadow-sm">
                                    <CardHeader>
                                        <CardTitle className="text-lg text-gray-900">
                                            <Bilingual ar="الخصوم" en="Liabilities" />
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {renderRows(
                                            analysis.liabilityRows,
                                            (row) => (row.closing_credit ?? 0) - (row.closing_debit ?? 0),
                                            'text-rose-700'
                                        )}

                                        <div className="mt-3 flex items-center justify-between rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-900">
                                            <Bilingual ar="إجمالي الخصوم" en="Total Liabilities" />
                                            <span className="font-mono" dir="ltr">{formatAmount(analysis.totalLiabilities, locale)}</span>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-gray-200 bg-white shadow-sm">
                                    <CardHeader>
                                        <CardTitle className="text-lg text-gray-900">
                                            <Bilingual ar="حقوق الملكية" en="Equity" />
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {renderRows(
                                            analysis.equityRows,
                                            (row) => (row.closing_credit ?? 0) - (row.closing_debit ?? 0),
                                            'text-purple-700'
                                        )}

                                        <div className="mt-3 space-y-2">
                                            <div className="flex items-center justify-between rounded-lg bg-purple-50 px-3 py-2 text-sm font-semibold text-purple-900">
                                                <Bilingual ar="إجمالي حقوق الملكية" en="Total Equity" />
                                                <span className="font-mono" dir="ltr">{formatAmount(analysis.totalEquity, locale)}</span>
                                            </div>
                                            <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                                                <Bilingual ar="أرباح / خسائر الفترة" en="Current Period Earnings" />
                                                <span className="font-mono" dir="ltr">{formatAmount(analysis.currentPeriodEarnings, locale)}</span>
                                            </div>
                                            <div className="flex items-center justify-between rounded-lg bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-900">
                                                <Bilingual ar="إجمالي الخصوم وحقوق الملكية" en="Total Liabilities + Equity" />
                                                <span className="font-mono" dir="ltr">{formatAmount(analysis.totalRightSide, locale)}</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
