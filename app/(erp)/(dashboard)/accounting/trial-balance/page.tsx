'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    accountingApi,
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
import {
    Table,
    TableBody,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { AlertCircle, BookOpen, CheckCircle2, Filter, RefreshCw, Download } from 'lucide-react'
import { exportToCsv } from '@/lib/export-csv'
import { cn } from '@/lib/utils'
import { ReportPrintButton } from '@/components/accounting/report-print'

interface CompanyOption {
    name: string
    company_name: string
    default_currency: string
    abbr?: string
}

interface TrialBalanceFilters {
    company: string
    fiscalYear: string
    fromDate?: string
    toDate?: string
}

interface Totals {
    openingDebit: number
    openingCredit: number
    periodDebit: number
    periodCredit: number
    closingDebit: number
    closingCredit: number
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

function TableSkeleton() {
    return (
        <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="grid grid-cols-7 items-center gap-3">
                    <Skeleton className="h-4 w-56" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                </div>
            ))}
        </div>
    )
}

export default function TrialBalancePage() {
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

    const [bootLoading, setBootLoading] = useState(true)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const loadReport = useCallback(async (filters: TrialBalanceFilters) => {
        try {
            setLoading(true)
            setError(null)

            const reportRows = await accountingApi.getTrialBalance({
                company: filters.company,
                fiscal_year: filters.fiscalYear,
                from_date: filters.fromDate,
                to_date: filters.toDate,
                cost_center: costCenter || undefined,
            })

            setRows(reportRows.filter((row) => Boolean(row.account)))
        } catch (err: any) {
            setError(err?.message ?? tr('فشل تحميل ميزان المراجعة', 'Failed to load trial balance'))
            setRows([])
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

                // Fetch cost centers for default company
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

    const parentAccounts = useMemo(
        () => new Set(rows.map((row) => row.parent_account).filter((name): name is string => Boolean(name))),
        [rows]
    )

    const totals: Totals = useMemo(() => {
        const leafRows = rows.filter((row) => !parentAccounts.has(row.account))

        return leafRows.reduce<Totals>(
            (acc, row) => ({
                openingDebit: acc.openingDebit + (row.opening_debit ?? 0),
                openingCredit: acc.openingCredit + (row.opening_credit ?? 0),
                periodDebit: acc.periodDebit + (row.debit ?? 0),
                periodCredit: acc.periodCredit + (row.credit ?? 0),
                closingDebit: acc.closingDebit + (row.closing_debit ?? 0),
                closingCredit: acc.closingCredit + (row.closing_credit ?? 0),
            }),
            {
                openingDebit: 0,
                openingCredit: 0,
                periodDebit: 0,
                periodCredit: 0,
                closingDebit: 0,
                closingCredit: 0,
            }
        )
    }, [rows, parentAccounts])

    const isBalanced =
        Math.abs(totals.openingDebit - totals.openingCredit) < BALANCE_EPSILON &&
        Math.abs(totals.periodDebit - totals.periodCredit) < BALANCE_EPSILON &&
        Math.abs(totals.closingDebit - totals.closingCredit) < BALANCE_EPSILON

    return (
        <div dir={isRTL ? 'rtl' : 'ltr'} lang={locale} className="min-h-screen bg-gray-50 p-6">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
                <Card className="border-gray-200 bg-white shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-2xl font-bold text-gray-900">
                            <Bilingual ar="ميزان المراجعة" en="Trial Balance" />
                        </CardTitle>
                        <CardDescription className="text-gray-500">
                            <Bilingual ar="أرصدة افتتاحية، حركة الفترة، وأرصدة ختامية" en="Opening, Period Movement, and Closing Balances" />
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
                                    const fmt = (v?: number) => (v ?? 0).toFixed(2)
                                    exportToCsv(
                                        `trial-balance-${toDate}.csv`,
                                        ['Account', 'Opening Dr', 'Opening Cr', 'Period Dr', 'Period Cr', 'Closing Dr', 'Closing Cr'],
                                        rows.filter(r => r.account).map(r => [
                                            r.account_name ?? r.account, fmt(r.opening_debit), fmt(r.opening_credit),
                                            fmt(r.debit), fmt(r.credit), fmt(r.closing_debit), fmt(r.closing_credit),
                                        ])
                                    )
                                }}>
                                    <Download className="w-4 h-4 me-1" /> CSV
                                </Button>
                            )}
                            {rows.length > 0 && (
                                <ReportPrintButton
                                    title={tr('ميزان المراجعة', 'Trial Balance')}
                                    subtitle={tr('أرصدة افتتاحية، حركة الفترة، وأرصدة ختامية', 'Opening, Period Movement, and Closing Balances')}
                                    orientation="landscape"
                                    meta={[
                                        `${tr('الشركة', 'Company')}: ${companies.find(c => c.name === company)?.company_name ?? company}`,
                                        `${tr('السنة المالية', 'Fiscal Year')}: ${fiscalYear}`,
                                        `${tr('من', 'From')}: ${fromDate} — ${tr('إلى', 'To')}: ${toDate}`,
                                        costCenter ? `${tr('مركز التكلفة', 'Cost Center')}: ${costCenters.find(cc => cc.name === costCenter)?.cost_center_name ?? costCenter}` : '',
                                        isBalanced ? tr('الميزان متوازن ✓', 'Balanced ✓') : tr('الميزان غير متوازن ✗', 'Not balanced ✗'),
                                    ].filter(Boolean)}
                                    sections={[{
                                        columns: [
                                            { label: tr('الحساب', 'Account') },
                                            { label: tr('افتتاحي مدين', 'Opening Dr'), align: 'end' },
                                            { label: tr('افتتاحي دائن', 'Opening Cr'), align: 'end' },
                                            { label: tr('حركة مدين', 'Period Dr'), align: 'end' },
                                            { label: tr('حركة دائن', 'Period Cr'), align: 'end' },
                                            { label: tr('ختامي مدين', 'Closing Dr'), align: 'end' },
                                            { label: tr('ختامي دائن', 'Closing Cr'), align: 'end' },
                                        ],
                                        rows: rows.map(row => {
                                            const isGroup = parentAccounts.has(row.account)
                                            return [
                                                { text: row.account_name ?? row.account, indent: row.indent ?? 0, bold: isGroup },
                                                formatAmount(row.opening_debit, locale),
                                                formatAmount(row.opening_credit, locale),
                                                formatAmount(row.debit, locale),
                                                formatAmount(row.credit, locale),
                                                formatAmount(row.closing_debit, locale),
                                                formatAmount(row.closing_credit, locale),
                                            ]
                                        }),
                                        footer: [
                                            { text: tr('الإجمالي', 'Total'), bold: true },
                                            formatAmount(totals.openingDebit, locale),
                                            formatAmount(totals.openingCredit, locale),
                                            formatAmount(totals.periodDebit, locale),
                                            formatAmount(totals.periodCredit, locale),
                                            formatAmount(totals.closingDebit, locale),
                                            formatAmount(totals.closingCredit, locale),
                                        ],
                                    }]}
                                />
                            )}
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

                {!bootLoading && !loading && rows.length > 0 && (
                    <Card className={cn('shadow-sm', isBalanced ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50')}>
                        <CardContent className="flex flex-col gap-3 pt-6 md:flex-row md:items-center md:justify-between">
                            <div className="inline-flex items-center gap-2 font-semibold">
                                {isBalanced ? (
                                    <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                                ) : (
                                    <AlertCircle className="h-5 w-5 text-rose-700" />
                                )}
                                <Bilingual
                                    ar={isBalanced ? 'ميزان المراجعة متوازن' : 'ميزان المراجعة غير متوازن'}
                                    en={isBalanced ? 'Trial Balance is balanced' : 'Trial Balance is not balanced'}
                                    className={isBalanced ? 'text-emerald-800' : 'text-rose-800'}
                                />
                            </div>

                            <div className="text-sm text-gray-700">
                                <Bilingual ar="الإجمالي مبني على الحسابات الفرعية فقط" en="Totals are calculated from leaf accounts only" />
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card className="border-gray-200 bg-white shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg text-gray-900">
                            <span className="inline-flex items-center gap-2">
                                <BookOpen className="h-5 w-5 text-indigo-600" />
                                <Bilingual ar="جدول ميزان المراجعة" en="Trial Balance Table" />
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {(bootLoading || loading) && <TableSkeleton />}

                        {!bootLoading && !loading && rows.length === 0 && (
                            <div className="flex flex-col items-center gap-2 px-6 py-20 text-center text-gray-500">
                                <BookOpen className="h-10 w-10 text-gray-300" />
                                <p className="text-sm">{tr('لا توجد بيانات للعرض', 'No data to display')}</p>
                            </div>
                        )}

                        {!bootLoading && !loading && rows.length > 0 && (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50 hover:bg-gray-50">
                                        <TableHead className="w-[28%] text-right text-gray-600">
                                            <Bilingual ar="الحساب" en="Account" />
                                        </TableHead>
                                        <TableHead className="text-right text-gray-600">
                                            <Bilingual ar="افتتاحي مدين" en="Opening Dr" />
                                        </TableHead>
                                        <TableHead className="text-right text-gray-600">
                                            <Bilingual ar="افتتاحي دائن" en="Opening Cr" />
                                        </TableHead>
                                        <TableHead className="text-right text-gray-600">
                                            <Bilingual ar="حركة مدين" en="Period Dr" />
                                        </TableHead>
                                        <TableHead className="text-right text-gray-600">
                                            <Bilingual ar="حركة دائن" en="Period Cr" />
                                        </TableHead>
                                        <TableHead className="text-right text-gray-600">
                                            <Bilingual ar="ختامي مدين" en="Closing Dr" />
                                        </TableHead>
                                        <TableHead className="text-right text-gray-600">
                                            <Bilingual ar="ختامي دائن" en="Closing Cr" />
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {rows.map((row) => {
                                        const isGroup = parentAccounts.has(row.account)
                                        return (
                                            <TableRow key={row.account}>
                                                <TableCell className="text-right">
                                                    <div style={{ paddingInlineStart: `${(row.indent ?? 0) * 16}px` }}>
                                                        <p className={cn('max-w-[320px] truncate', isGroup ? 'font-semibold text-gray-900' : 'text-gray-700')}>
                                                            {row.account_name ?? row.account}
                                                        </p>
                                                        <p className="text-[11px] text-gray-400" dir="ltr">
                                                            {row.account}
                                                        </p>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-gray-700" dir="ltr">{formatAmount(row.opening_debit, locale)}</TableCell>
                                                <TableCell className="text-right font-mono text-gray-700" dir="ltr">{formatAmount(row.opening_credit, locale)}</TableCell>
                                                <TableCell className="text-right font-mono text-gray-700" dir="ltr">{formatAmount(row.debit, locale)}</TableCell>
                                                <TableCell className="text-right font-mono text-gray-700" dir="ltr">{formatAmount(row.credit, locale)}</TableCell>
                                                <TableCell className="text-right font-mono text-gray-900" dir="ltr">{formatAmount(row.closing_debit, locale)}</TableCell>
                                                <TableCell className="text-right font-mono text-gray-900" dir="ltr">{formatAmount(row.closing_credit, locale)}</TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>

                                <TableFooter>
                                    <TableRow className="bg-gray-100 hover:bg-gray-100">
                                        <TableCell className="text-right font-bold text-gray-900">
                                            <Bilingual ar="الإجمالي" en="Total" />
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-bold text-indigo-700" dir="ltr">{formatAmount(totals.openingDebit, locale)}</TableCell>
                                        <TableCell className="text-right font-mono font-bold text-indigo-700" dir="ltr">{formatAmount(totals.openingCredit, locale)}</TableCell>
                                        <TableCell className="text-right font-mono font-bold text-indigo-700" dir="ltr">{formatAmount(totals.periodDebit, locale)}</TableCell>
                                        <TableCell className="text-right font-mono font-bold text-indigo-700" dir="ltr">{formatAmount(totals.periodCredit, locale)}</TableCell>
                                        <TableCell className="text-right font-mono font-bold text-indigo-700" dir="ltr">{formatAmount(totals.closingDebit, locale)}</TableCell>
                                        <TableCell className="text-right font-mono font-bold text-indigo-700" dir="ltr">{formatAmount(totals.closingCredit, locale)}</TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
