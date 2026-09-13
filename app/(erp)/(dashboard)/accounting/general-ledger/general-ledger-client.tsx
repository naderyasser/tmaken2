'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { accountingApi, type Account, type CostCenter, type GLEntry } from '@/lib/accounting-api'
import { useI18n } from '@/lib/i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { AlertCircle, BookOpen, Check, ChevronsUpDown, Filter, RefreshCw, X, Download } from 'lucide-react'
import { exportToCsv } from '@/lib/export-csv'
import { ReportPrintButton } from '@/components/accounting/report-print'

type Locale = 'ar' | 'en'

interface CompanyOption {
    name: string
    company_name: string
    default_currency: string
    abbr?: string
}

interface GeneralLedgerProps {
    initialAccount?: string
}

const L = {
    en: {
        title: 'General Ledger',
        subtitle: 'Detailed ledger entries with running balance',
        accountLabel: 'Account',
        companyLabel: 'Company',
        costCenterLabel: 'Cost Center',
        fromDate: 'From Date',
        toDate: 'To Date',
        selectCompany: 'Select company',
        allCostCenters: 'All',
        run: 'Run Report',
        retry: 'Retry',
        noData: 'No ledger entries found for current filters.',
        loadError: 'Failed to load report data.',
        companyRequired: 'Please select a company before running report.',
        postingDate: 'Posting Date',
        account: 'Account',
        voucherType: 'Voucher Type',
        voucherNo: 'Voucher No',
        debit: 'Debit',
        credit: 'Credit',
        balance: 'Balance',
        loadingCompanies: 'Loading companies...',
    },
    ar: {
        title: 'دفتر الأستاذ',
        subtitle: 'تفاصيل حركات الحساب مع الرصيد التراكمي',
        accountLabel: 'الحساب',
        companyLabel: 'الشركة',
        costCenterLabel: 'مركز التكلفة',
        fromDate: 'من تاريخ',
        toDate: 'إلى تاريخ',
        selectCompany: 'اختر الشركة',
        allCostCenters: 'الكل',
        run: 'عرض التقرير',
        retry: 'إعادة المحاولة',
        noData: 'لا توجد حركات دفتر أستاذ للمرشحات الحالية.',
        loadError: 'فشل تحميل بيانات التقرير.',
        companyRequired: 'يرجى اختيار الشركة قبل عرض التقرير.',
        postingDate: 'تاريخ القيد',
        account: 'الحساب',
        voucherType: 'نوع المستند',
        voucherNo: 'رقم المستند',
        debit: 'مدين',
        credit: 'دائن',
        balance: 'الرصيد',
        loadingCompanies: 'جاري تحميل الشركات...',
    },
} as const

const todayIso = () => new Date().toISOString().split('T')[0]
const yearStartIso = () => `${new Date().getFullYear()}-01-01`

export function GeneralLedgerClient({ initialAccount = '' }: GeneralLedgerProps) {
    const { lang, isRTL } = useI18n()
    const locale: Locale = lang === 'ar' ? 'ar' : 'en'
    const t = L[locale]

    const [companies, setCompanies] = useState<CompanyOption[]>([])
    const [company, setCompany] = useState('')
    const [costCenters, setCostCenters] = useState<CostCenter[]>([])
    const [costCenter, setCostCenter] = useState('')

    const [account, setAccount] = useState(initialAccount)
    const [accounts, setAccounts] = useState<Account[]>([])
    const [accountSearch, setAccountSearch] = useState('')
    const [accountDropdownOpen, setAccountDropdownOpen] = useState(false)
    const accountInputRef = useRef<HTMLInputElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const [fromDate, setFromDate] = useState(yearStartIso())
    const [toDate, setToDate] = useState(todayIso())

    const [entries, setEntries] = useState<GLEntry[]>([])
    const [bootLoading, setBootLoading] = useState(true)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        setAccount(initialAccount)
    }, [initialAccount])

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
                accountInputRef.current && !accountInputRef.current.contains(e.target as Node)) {
                setAccountDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const filteredAccounts = useMemo(() => {
        if (!accountSearch.trim()) return accounts.filter(a => !a.is_group)
        const q = accountSearch.toLowerCase()
        return accounts.filter(a =>
            !a.is_group && (
                a.name.toLowerCase().includes(q) ||
                a.account_name.toLowerCase().includes(q) ||
                (a.account_number && a.account_number.toLowerCase().includes(q))
            )
        )
    }, [accounts, accountSearch])

    const fetchLedger = useCallback(async (filters: {
        company: string
        account?: string
        fromDate: string
        toDate: string
    }) => {
        try {
            setLoading(true)
            setError(null)

            const result = await accountingApi.getGeneralLedgerReport({
                company: filters.company,
                from_date: filters.fromDate,
                to_date: filters.toDate,
                account: filters.account || undefined,
                cost_center: costCenter || undefined,
            })

            setEntries(result)
        } catch (err: any) {
            setError(err?.message ?? t.loadError)
            setEntries([])
        } finally {
            setLoading(false)
        }
    }, [costCenter, t.loadError])

    const loadLedger = useCallback(async () => {
        const selectedCompany = company.trim()

        if (!selectedCompany) {
            setEntries([])
            setError(t.companyRequired)
            return
        }

        await fetchLedger({
            company: selectedCompany,
            account: account.trim() || undefined,
            fromDate,
            toDate,
        })
    }, [company, account, fromDate, toDate, t.companyRequired, fetchLedger])

    useEffect(() => {
        let mounted = true

        const bootstrap = async () => {
            try {
                setBootLoading(true)
                setError(null)

                const list = await accountingApi.getCompanies()
                if (!mounted) return

                setCompanies(list)
                const defaultCompany = list[0]?.name ?? ''
                setCompany(defaultCompany)

                if (defaultCompany) {
                    accountingApi.getCostCenters(defaultCompany).then(cc => {
                        if (mounted) setCostCenters(cc)
                    }).catch(() => { })
                    accountingApi.getAccounts({ company: defaultCompany }).then(accs => {
                        if (mounted) setAccounts(accs)
                    }).catch(() => { })
                }

                if (defaultCompany) {
                    await fetchLedger({
                        company: defaultCompany,
                        account: initialAccount || undefined,
                        fromDate: yearStartIso(),
                        toDate: todayIso(),
                    })
                }
            } catch (err: any) {
                if (!mounted) return
                setError(err?.message ?? t.loadError)
            } finally {
                if (mounted) {
                    setBootLoading(false)
                }
            }
        }

        void bootstrap()

        return () => {
            mounted = false
        }
    }, [fetchLedger, t.loadError, initialAccount])

    const rows = useMemo(() => {
        const cleaned = entries
            .filter((entry) => Boolean(entry.posting_date) && Boolean(entry.account))
            .sort((a, b) => {
                const left = `${a.posting_date ?? ''} ${a.name}`
                const right = `${b.posting_date ?? ''} ${b.name}`
                return left.localeCompare(right)
            })

        let runningBalance = 0

        return cleaned.map((entry) => {
            const debit = entry.debit ?? entry.debit_in_account_currency ?? 0
            const credit = entry.credit ?? entry.credit_in_account_currency ?? 0
            runningBalance += debit - credit

            return {
                ...entry,
                debit,
                credit,
                runningBalance,
            }
        })
    }, [entries])

    const fmt = (value?: number) =>
        (value ?? 0).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })

    return (
        <div dir={isRTL ? 'rtl' : 'ltr'} lang={locale} className="min-h-screen bg-gray-50 p-6">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
                <Card className="border-gray-200 bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl text-gray-900">
                            <BookOpen className="h-5 w-5 text-indigo-600" />
                            {t.title}
                        </CardTitle>
                        <p className="text-sm text-gray-500">{t.subtitle}</p>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                            <div className="space-y-1 md:col-span-2">
                                <label className="text-xs text-gray-500">{t.companyLabel}</label>
                                <select
                                    value={company}
                                    onChange={(e) => {
                                        const v = e.target.value
                                        setCompany(v)
                                        setCostCenter('')
                                        setAccount('')
                                        setAccountSearch('')
                                        if (v) {
                                            accountingApi.getCostCenters(v).then(setCostCenters).catch(() => setCostCenters([]))
                                            accountingApi.getAccounts({ company: v }).then(setAccounts).catch(() => setAccounts([]))
                                        } else {
                                            setCostCenters([])
                                            setAccounts([])
                                        }
                                    }}
                                    className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                >
                                    <option value="">{bootLoading ? t.loadingCompanies : t.selectCompany}</option>
                                    {companies.map((item) => (
                                        <option key={item.name} value={item.name}>
                                            {item.company_name} ({item.name})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="relative space-y-1 md:col-span-2">
                                <label className="text-xs text-gray-500">{t.accountLabel}</label>
                                <div className="relative">
                                    <input
                                        ref={accountInputRef}
                                        value={accountDropdownOpen ? accountSearch : (account || '')}
                                        onChange={(e) => {
                                            setAccountSearch(e.target.value)
                                            if (!accountDropdownOpen) setAccountDropdownOpen(true)
                                        }}
                                        onFocus={() => {
                                            setAccountSearch('')
                                            setAccountDropdownOpen(true)
                                        }}
                                        placeholder={account ? accounts.find(a => a.name === account)?.account_name || account : (locale === 'ar' ? 'ابحث عن حساب...' : 'Search account...')}
                                        className="h-10 w-full rounded-md border border-gray-300 bg-white pe-16 ps-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    />
                                    <div className="absolute inset-y-0 end-0 flex items-center gap-0.5 pe-1">
                                        {account && (
                                            <button
                                                type="button"
                                                onClick={() => { setAccount(''); setAccountSearch(''); }}
                                                className="rounded p-1 text-gray-400 hover:text-gray-600"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                                            className="rounded p-1 text-gray-400 hover:text-gray-600"
                                        >
                                            <ChevronsUpDown className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                                {accountDropdownOpen && (
                                    <div
                                        ref={dropdownRef}
                                        className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
                                    >
                                        {filteredAccounts.length === 0 ? (
                                            <div className="px-3 py-4 text-center text-sm text-gray-500">
                                                {locale === 'ar' ? 'لا توجد نتائج' : 'No results'}
                                            </div>
                                        ) : (
                                            filteredAccounts.slice(0, 50).map((acc) => (
                                                <button
                                                    key={acc.name}
                                                    type="button"
                                                    onClick={() => {
                                                        setAccount(acc.name)
                                                        setAccountSearch('')
                                                        setAccountDropdownOpen(false)
                                                    }}
                                                    className={`flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-gray-100 ${account === acc.name ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
                                                        }`}
                                                >
                                                    {account === acc.name && <Check className="h-3.5 w-3.5 shrink-0 text-indigo-600" />}
                                                    <span className={account === acc.name ? '' : 'ps-5'}>
                                                        {acc.account_number ? `${acc.account_number} - ` : ''}
                                                        {acc.account_name}
                                                    </span>
                                                    <span className="ms-auto text-xs text-gray-400">{acc.root_type}</span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1 md:col-span-2">
                                <label className="text-xs text-gray-500">{t.costCenterLabel}</label>
                                <select
                                    value={costCenter}
                                    onChange={(e) => setCostCenter(e.target.value)}
                                    className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                >
                                    <option value="">{t.allCostCenters}</option>
                                    {costCenters.filter(cc => !cc.is_group).map((cc) => (
                                        <option key={cc.name} value={cc.name}>
                                            {cc.cost_center_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-gray-500">{t.fromDate}</label>
                                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-10" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-gray-500">{t.toDate}</label>
                                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-10" />
                            </div>
                            <div className="flex items-end gap-2 md:col-span-2">
                                <Button onClick={() => void loadLedger()} disabled={loading} className="bg-indigo-600 text-white hover:bg-indigo-700">
                                    {loading ? <RefreshCw className="me-2 h-4 w-4 animate-spin" /> : <Filter className="me-2 h-4 w-4" />}
                                    {t.run}
                                </Button>
                                <Button variant="outline" onClick={() => void loadLedger()} disabled={loading} className="border-gray-200">
                                    <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                                </Button>
                                {rows.length > 0 && (
                                    <Button variant="outline" size="sm" onClick={() => {
                                        const fmtVal = (v?: number) => (v ?? 0).toFixed(2)
                                        exportToCsv(
                                            `general-ledger-${fromDate}-${toDate}.csv`,
                                            ['Date', 'Account', 'Voucher Type', 'Voucher No', 'Debit', 'Credit', 'Balance'],
                                            rows.map(r => [r.posting_date, r.account, r.voucher_type ?? '', r.voucher_no ?? '', fmtVal(r.debit), fmtVal(r.credit), fmtVal((r as any).runningBalance)])
                                        )
                                    }}>
                                        <Download className="w-4 h-4 me-1" /> CSV
                                    </Button>
                                )}
                                {rows.length > 0 && (
                                    <ReportPrintButton
                                        title={t.title}
                                        subtitle={t.subtitle}
                                        orientation="landscape"
                                        meta={[
                                            `${t.companyLabel}: ${companies.find(c => c.name === company)?.company_name ?? company}`,
                                            account ? `${t.accountLabel}: ${accounts.find(a => a.name === account)?.account_name ?? account}` : '',
                                            costCenter ? `${t.costCenterLabel}: ${costCenters.find(cc => cc.name === costCenter)?.cost_center_name ?? costCenter}` : '',
                                            `${t.fromDate}: ${fromDate} — ${t.toDate}: ${toDate}`,
                                        ].filter(Boolean)}
                                        sections={[{
                                            columns: [
                                                { label: t.postingDate },
                                                { label: t.account },
                                                { label: t.voucherType },
                                                { label: t.voucherNo },
                                                { label: t.debit, align: 'end' },
                                                { label: t.credit, align: 'end' },
                                                { label: t.balance, align: 'end' },
                                            ],
                                            rows: rows.map(entry => [
                                                entry.posting_date ?? '',
                                                entry.account ?? '',
                                                entry.voucher_type ?? '-',
                                                entry.voucher_no ?? entry.name,
                                                fmt(entry.debit),
                                                fmt(entry.credit),
                                                fmt(entry.runningBalance),
                                            ]),
                                            footer: [
                                                { text: locale === 'ar' ? 'الإجمالي' : 'Total', bold: true },
                                                '', '', '',
                                                fmt(rows.reduce((s, r) => s + (r.debit ?? 0), 0)),
                                                fmt(rows.reduce((s, r) => s + (r.credit ?? 0), 0)),
                                                fmt(rows[rows.length - 1]?.runningBalance),
                                            ],
                                        }]}
                                    />
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {error && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                            <p>{error}</p>
                            <button type="button" onClick={() => void loadLedger()} className="mt-1 underline">
                                {t.retry}
                            </button>
                        </div>
                    </div>
                )}

                <Card className="border-gray-200 bg-white shadow-sm">
                    <CardContent className="p-0">
                        {(bootLoading || loading) && (
                            <div className="space-y-2 p-4">
                                {Array.from({ length: 8 }).map((_, idx) => (
                                    <Skeleton key={idx} className="h-8 w-full" />
                                ))}
                            </div>
                        )}

                        {!bootLoading && !loading && rows.length === 0 && (
                            <div className="px-6 py-16 text-center text-sm text-gray-500">{t.noData}</div>
                        )}

                        {!bootLoading && !loading && rows.length > 0 && (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-gray-50 text-gray-600 hover:bg-gray-50">
                                            <TableHead className="text-start">{t.postingDate}</TableHead>
                                            <TableHead className="text-start">{t.account}</TableHead>
                                            <TableHead className="text-start">{t.voucherType}</TableHead>
                                            <TableHead className="text-start">{t.voucherNo}</TableHead>
                                            <TableHead className="text-end">{t.debit}</TableHead>
                                            <TableHead className="text-end">{t.credit}</TableHead>
                                            <TableHead className="text-end">{t.balance}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rows.map((entry) => (
                                            <TableRow key={entry.name} className="border-t border-gray-100">
                                                <TableCell>{entry.posting_date}</TableCell>
                                                <TableCell>{entry.account}</TableCell>
                                                <TableCell>{entry.voucher_type ?? '-'}</TableCell>
                                                <TableCell>{entry.voucher_no ?? entry.name}</TableCell>
                                                <TableCell className="text-end font-mono" dir="ltr">{fmt(entry.debit)}</TableCell>
                                                <TableCell className="text-end font-mono" dir="ltr">{fmt(entry.credit)}</TableCell>
                                                <TableCell className="text-end font-mono" dir="ltr">{fmt(entry.runningBalance)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
