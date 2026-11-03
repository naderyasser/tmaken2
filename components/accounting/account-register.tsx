'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { accountingApi, type GLEntry, type Account } from '@/lib/accounting-api'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    AlertCircle,
    ChevronDown,
    ChevronRight,
    Download,
    Loader2,
    Plus,
    RefreshCw,
    Search,
} from 'lucide-react'
import { cn, localToday } from '@/lib/utils'
import { InlineTransactionRow } from './inline-transaction-row'

type Locale = 'ar' | 'en'

const L = {
    en: {
        register: 'Account Register',
        balance: 'Balance',
        currency: 'SAR',
        date: 'Date',
        num: 'Num',
        description: 'Description',
        transfer: 'Transfer',
        reconciled: 'R',
        increase: 'Increase',
        decrease: 'Decrease',
        runningBalance: 'Balance',
        splitTransaction: '-- Split Transaction --',
        accounts: 'accounts',
        noTransactions: 'No transactions found for this account.',
        loadError: 'Failed to load register',
        retry: 'Retry',
        refresh: 'Refresh',
        search: 'Search transactions...',
        fromDate: 'From',
        toDate: 'To',
        newEntry: 'New Entry',
        stockOnly: 'Stock accounts can only be updated via stock transactions',
        showing: 'Showing',
        transactions: 'transactions',
        opening: 'Opening Balance',
        filterApply: 'Apply',
        export: 'Export',
    },
    ar: {
        register: 'سجل الحساب',
        balance: 'الرصيد',
        currency: 'ر.س',
        date: 'التاريخ',
        num: 'الرقم',
        description: 'الوصف',
        transfer: 'الحساب المقابل',
        reconciled: 'م',
        increase: 'زيادة',
        decrease: 'نقص',
        runningBalance: 'الرصيد',
        splitTransaction: '-- قيد متعدد --',
        accounts: 'حسابات',
        noTransactions: 'لا توجد حركات لهذا الحساب.',
        loadError: 'حدث خطأ أثناء تحميل السجل',
        retry: 'إعادة المحاولة',
        refresh: 'تحديث',
        search: 'بحث في الحركات...',
        fromDate: 'من',
        toDate: 'إلى',
        newEntry: 'قيد جديد',
        stockOnly: 'حسابات المخزون يتم تحديثها فقط عبر حركات المخزون',
        showing: 'عرض',
        transactions: 'حركة',
        opening: 'الرصيد الافتتاحي',
        filterApply: 'تطبيق',
        export: 'تصدير',
    },
} as const

/** Determine if an account is normally debit-balance (Asset, Expense) */
function isDebitNature(rootType?: string): boolean {
    return rootType === 'Asset' || rootType === 'Expense'
}

/** Represents a row in the register */
export interface RegisterRow {
    id: string
    date: string
    num: string           // voucher_no
    voucherType: string
    description: string   // remarks or party
    transfer: string      // 'against' account or '-- Split --'
    transferCount?: number // for splits
    reconciled: 'n' | 'c' | 'y'
    increase: number
    decrease: number
    runningBalance: number
    isOpening?: boolean
    glEntries?: GLEntry[] // original GL entries for split expansion
}

function transformGLToRegister(
    entries: GLEntry[],
    accountName: string,
    isDebit: boolean,
    openingBalance: number
): RegisterRow[] {
    // Sort chronologically (ASC) for running balance calculation
    const sorted = [...entries].sort((a, b) => {
        const d = a.posting_date.localeCompare(b.posting_date)
        if (d !== 0) return d
        return (a.creation ?? '').localeCompare(b.creation ?? '')
    })

    // Group by voucher_no — multiple GL entries with the same voucher are one transaction
    const voucherGroups = new Map<string, GLEntry[]>()
    for (const entry of sorted) {
        const key = `${entry.voucher_type}:${entry.voucher_no}`
        const group = voucherGroups.get(key) ?? []
        group.push(entry)
        voucherGroups.set(key, group)
    }

    const rows: RegisterRow[] = []
    let balance = openingBalance

    for (const [, group] of voucherGroups) {
        // The entry for THIS account in the group
        const myEntries = group.filter(e => e.account === accountName)
        if (myEntries.length === 0) continue

        const firstEntry = myEntries[0]
        const totalDebit = myEntries.reduce((s, e) => s + (e.debit ?? 0), 0)
        const totalCredit = myEntries.reduce((s, e) => s + (e.credit ?? 0), 0)

        // Increase/decrease depends on account nature
        const increase = isDebit ? totalDebit : totalCredit
        const decrease = isDebit ? totalCredit : totalDebit

        balance = balance + increase - decrease

        // Determine transfer account
        const against = firstEntry.against ?? ''
        const transferAccounts = against.split(',').map(a => a.trim()).filter(Boolean)
        const isSplit = transferAccounts.length > 1
        const transfer = isSplit
            ? `-- Split --`
            : transferAccounts[0] ?? ''

        // Description: prefer remarks, then party info
        const description = firstEntry.remarks
            || (firstEntry.party ? `${firstEntry.party_type}: ${firstEntry.party}` : '')
            || (firstEntry.voucher_type ?? '')

        rows.push({
            id: firstEntry.name,
            date: firstEntry.posting_date,
            num: firstEntry.voucher_no ?? '',
            voucherType: firstEntry.voucher_type ?? '',
            description,
            transfer,
            transferCount: isSplit ? transferAccounts.length : undefined,
            reconciled: 'n',
            increase,
            decrease,
            runningBalance: balance,
            glEntries: isSplit ? group : undefined,
        })
    }

    return rows
}

interface AccountRegisterProps {
    accountId: string
    accountName: string
    rootType?: string
    accountType?: string
    company?: string
}

export function AccountRegister({ accountId, accountName, rootType, accountType, company }: AccountRegisterProps) {
    const { lang, isRTL } = useI18n()
    const { toast } = useToast()
    const locale: Locale = lang === 'ar' ? 'ar' : 'en'
    const t = L[locale]

    const isDebit = isDebitNature(rootType)

    // Stock accounts can only be updated via Stock Transactions, not JEs
    const STOCK_ACCOUNT_TYPES = new Set(['Stock', 'Stock Received But Not Billed', 'Stock Adjustment'])
    const isStockAccount = !!(accountType && STOCK_ACCOUNT_TYPES.has(accountType))

    // State
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [glEntries, setGlEntries] = useState<GLEntry[]>([])
    const [openingBalance, setOpeningBalance] = useState(0)
    const [currentBalance, setCurrentBalance] = useState(0)
    const [fromDate, setFromDate] = useState(() => `${new Date().getFullYear()}-01-01`)
    const [toDate, setToDate] = useState(() => localToday())
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedSplits, setExpandedSplits] = useState<Set<string>>(new Set())
    const [showInlineEntry, setShowInlineEntry] = useState(false)
    const [accounts, setAccounts] = useState<Account[]>([])
    const [allAccounts, setAllAccounts] = useState<Account[]>([])

    const tableEndRef = useRef<HTMLDivElement>(null)

    // Fetch register data
    const fetchRegister = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)

            // Fetch GL entries and opening balance in parallel
            const [entries, balance, accts, allAccts] = await Promise.all([
                accountingApi.getGLEntries({
                    account: accountId,
                    from_date: fromDate,
                    to_date: toDate,
                    is_cancelled: false,
                    limit_page_length: 2000,
                }),
                // Opening balance = balance as of day before from_date
                accountingApi.getAccountBalance(
                    accountId,
                    (() => { const d = new Date(fromDate + 'T00:00:00'); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0] })(),
                    company
                ),
                accountingApi.getAccounts({ company, is_group: false, disabled: false }),
                accountingApi.getAccounts({ company }),
            ])

            setGlEntries(entries)
            setOpeningBalance(Math.abs(balance))
            setAccounts(accts)
            setAllAccounts(allAccts)

            // Current balance = real-time
            const curBal = await accountingApi.getAccountBalance(accountId, toDate, company)
            setCurrentBalance(Math.abs(curBal))
        } catch (err: any) {
            setError(err?.message ?? t.loadError)
        } finally {
            setLoading(false)
        }
    }, [accountId, fromDate, toDate, company, t.loadError])

    useEffect(() => {
        void fetchRegister()
    }, [fetchRegister])

    // Build register rows
    const rows = useMemo(
        () => transformGLToRegister(glEntries, accountId, isDebit, openingBalance),
        [glEntries, accountId, isDebit, openingBalance]
    )

    // Search filter
    const filteredRows = useMemo(() => {
        if (!searchQuery.trim()) return rows
        const q = searchQuery.toLowerCase()
        return rows.filter(r =>
            r.description.toLowerCase().includes(q) ||
            r.num.toLowerCase().includes(q) ||
            r.transfer.toLowerCase().includes(q) ||
            r.voucherType.toLowerCase().includes(q)
        )
    }, [rows, searchQuery])

    const toggleSplit = useCallback((rowId: string) => {
        setExpandedSplits(prev => {
            const next = new Set(prev)
            if (next.has(rowId)) next.delete(rowId)
            else next.add(rowId)
            return next
        })
    }, [])

    const handleInlineSave = useCallback(async () => {
        setShowInlineEntry(false)
        await fetchRegister()
        toast({ title: locale === 'ar' ? 'تم إنشاء القيد بنجاح' : 'Transaction created successfully' })
    }, [fetchRegister, locale, toast])

    const fmtNum = useCallback((value: number): string => {
        if (value === 0) return ''
        return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-SA', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value)
    }, [locale])

    const fmtBal = useCallback((value: number): string => {
        return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-SA', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value)
    }, [locale])

    // Root type color
    const rootColor = (() => {
        switch (rootType) {
            case 'Asset': return 'text-blue-700 bg-blue-50 border-blue-200'
            case 'Liability': return 'text-rose-700 bg-rose-50 border-rose-200'
            case 'Equity': return 'text-purple-700 bg-purple-50 border-purple-200'
            case 'Income': return 'text-emerald-700 bg-emerald-50 border-emerald-200'
            case 'Expense': return 'text-amber-700 bg-amber-50 border-amber-200'
            default: return 'text-slate-700 bg-slate-50 border-slate-200'
        }
    })()

    // ─── Error state ────────────────────────────────────────────────

    if (error && !loading) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
                <AlertCircle className="h-10 w-10 text-red-400" />
                <p className="text-sm text-red-600">{error}</p>
                <Button variant="outline" size="sm" onClick={fetchRegister}>
                    <RefreshCw className="me-2 h-3.5 w-3.5" /> {t.retry}
                </Button>
            </div>
        )
    }

    // ─── Render ─────────────────────────────────────────────────────

    return (
        <div dir={isRTL ? 'rtl' : 'ltr'} className="flex h-full flex-col">
            {/* ─── Header: Account name + balance ─── */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
                <div className="flex items-center gap-3">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">{accountName}</h2>
                        <p className="text-xs text-slate-500 font-mono">{accountId}</p>
                    </div>
                    {rootType && (
                        <Badge className={cn('rounded-full text-[10px] font-semibold border', rootColor)}>
                            {rootType}
                        </Badge>
                    )}
                    {accountType && (
                        <Badge className="rounded-full text-[10px] font-medium border border-slate-200 bg-slate-50 text-slate-600">
                            {accountType}
                        </Badge>
                    )}
                </div>
                <div className={cn('flex items-center gap-4')}>
                    <div className="text-end">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{t.balance}</p>
                        <p className="text-xl font-bold tabular-nums text-slate-900">{fmtBal(currentBalance)}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchRegister} disabled={loading}>
                        <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                    </Button>
                </div>
            </div>

            {/* ─── Filters: Date range + search ─── */}
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-slate-50/50 px-4 py-2">
                <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 font-medium">{t.fromDate}</span>
                    <Input
                        type="date"
                        value={fromDate}
                        onChange={e => setFromDate(e.target.value)}
                        className="h-7 w-[130px] text-xs"
                    />
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 font-medium">{t.toDate}</span>
                    <Input
                        type="date"
                        value={toDate}
                        onChange={e => setToDate(e.target.value)}
                        className="h-7 w-[130px] text-xs"
                    />
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={fetchRegister}>
                    {t.filterApply}
                </Button>
                <div className="flex-1" />
                <div className="relative">
                    <Search className="absolute start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                        placeholder={t.search}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="h-7 w-[200px] ps-7 text-xs"
                    />
                </div>
                <Button
                    variant="default"
                    size="sm"
                    className="h-7 gap-1 bg-indigo-600 text-xs hover:bg-indigo-700"
                    onClick={() => { setShowInlineEntry(true); setTimeout(() => tableEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100) }}
                    disabled={isStockAccount}
                    title={isStockAccount ? t.stockOnly : undefined}
                >
                    <Plus className="h-3 w-3" /> {t.newEntry}
                </Button>
            </div>

            {/* ─── Register table ─── */}
            <div className="flex-1 overflow-auto">
                {loading ? (
                    <RegisterSkeleton />
                ) : (
                    <Table className="min-w-[960px]">
                        <TableHeader>
                            <TableRow className="bg-slate-50 hover:bg-slate-50">
                                <TableHead className="w-[90px] text-[11px] font-bold text-slate-600">{t.date}</TableHead>
                                <TableHead className="w-[110px] text-[11px] font-bold text-slate-600">{t.num}</TableHead>
                                <TableHead className="text-[11px] font-bold text-slate-600">{t.description}</TableHead>
                                <TableHead className="w-[180px] text-[11px] font-bold text-slate-600">{t.transfer}</TableHead>
                                <TableHead className="w-[32px] text-center text-[11px] font-bold text-slate-600">{t.reconciled}</TableHead>
                                <TableHead className="w-[110px] text-end text-[11px] font-bold text-emerald-700">{t.increase}</TableHead>
                                <TableHead className="w-[110px] text-end text-[11px] font-bold text-rose-700">{t.decrease}</TableHead>
                                <TableHead className="w-[120px] text-end text-[11px] font-bold text-slate-700">{t.runningBalance}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {/* Opening balance row */}
                            <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
                                <TableCell className="text-xs text-slate-400">{fromDate}</TableCell>
                                <TableCell />
                                <TableCell className="text-xs font-medium italic text-slate-500">{t.opening}</TableCell>
                                <TableCell />
                                <TableCell />
                                <TableCell />
                                <TableCell />
                                <TableCell className="text-end text-xs font-bold tabular-nums text-slate-700">{fmtBal(openingBalance)}</TableCell>
                            </TableRow>

                            {filteredRows.length === 0 && !showInlineEntry ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="py-12 text-center text-sm text-slate-400">
                                        {t.noTransactions}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredRows.map((row) => (
                                    <RegisterRowComponent
                                        key={row.id}
                                        row={row}
                                        locale={locale}
                                        fmtNum={fmtNum}
                                        fmtBal={fmtBal}
                                        isExpanded={expandedSplits.has(row.id)}
                                        onToggleSplit={() => toggleSplit(row.id)}
                                        t={t}
                                    />
                                ))
                            )}

                            {/* Inline new transaction row */}
                            {showInlineEntry && (
                                <InlineTransactionRow
                                    currentAccountId={accountId}
                                    currentAccountName={accountName}
                                    rootType={rootType}
                                    currentAccountType={accountType}
                                    company={company ?? ''}
                                    accounts={accounts}
                                    allAccounts={allAccounts}
                                    locale={locale}
                                    onSave={handleInlineSave}
                                    onCancel={() => setShowInlineEntry(false)}
                                />
                            )}
                        </TableBody>
                    </Table>
                )}
                <div ref={tableEndRef} />
            </div>

            {/* ─── Footer: Transaction count ─── */}
            {!loading && (
                <div className="flex items-center justify-between border-t border-gray-200 bg-slate-50/50 px-4 py-2">
                    <p className="text-[11px] text-slate-500">
                        {t.showing} <span className="font-semibold text-slate-700">{filteredRows.length}</span> {t.transactions}
                    </p>
                </div>
            )}
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════
// ██  Register Row Component
// ═══════════════════════════════════════════════════════════════════

function RegisterRowComponent({
    row,
    locale,
    fmtNum,
    fmtBal,
    isExpanded,
    onToggleSplit,
    t,
}: {
    row: RegisterRow
    locale: Locale
    fmtNum: (v: number) => string
    fmtBal: (v: number) => string
    isExpanded: boolean
    onToggleSplit: () => void
    t: (typeof L)['en'] | (typeof L)['ar']
}) {
    const isSplit = row.transfer === '-- Split --'
    const reconChar = row.reconciled === 'y' ? 'y' : row.reconciled === 'c' ? 'c' : 'n'
    const reconColor = row.reconciled === 'y' ? 'text-emerald-600 bg-emerald-50' : row.reconciled === 'c' ? 'text-blue-600 bg-blue-50' : 'text-slate-400'

    return (
        <>
            <TableRow className="group hover:bg-indigo-50/30 transition-colors">
                <TableCell className="text-xs tabular-nums text-slate-600">{row.date}</TableCell>
                <TableCell className="text-xs font-mono text-indigo-600">{row.num}</TableCell>
                <TableCell className="text-xs text-slate-700 max-w-[300px] truncate">{row.description}</TableCell>
                <TableCell className="text-xs">
                    {isSplit ? (
                        <button
                            type="button"
                            onClick={onToggleSplit}
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            <span className="italic">{t.splitTransaction}</span>
                            <Badge className="ms-1 rounded-full bg-indigo-100 px-1.5 text-[9px] text-indigo-600">
                                {row.transferCount} {t.accounts}
                            </Badge>
                        </button>
                    ) : (
                        <span className="text-slate-600 font-mono text-[11px]">{row.transfer}</span>
                    )}
                </TableCell>
                <TableCell className="text-center">
                    <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold', reconColor)}>
                        {reconChar}
                    </span>
                </TableCell>
                <TableCell className="text-end text-xs tabular-nums font-medium text-emerald-700">{fmtNum(row.increase)}</TableCell>
                <TableCell className="text-end text-xs tabular-nums font-medium text-rose-700">{fmtNum(row.decrease)}</TableCell>
                <TableCell className="text-end text-xs tabular-nums font-bold text-slate-800">{fmtBal(row.runningBalance)}</TableCell>
            </TableRow>

            {/* Split expansion rows */}
            {isSplit && isExpanded && row.glEntries && (
                row.glEntries.map((gl) => (
                    <TableRow key={gl.name} className="bg-indigo-50/20">
                        <TableCell />
                        <TableCell />
                        <TableCell className="text-[11px] text-slate-500 ps-6">{gl.remarks ?? ''}</TableCell>
                        <TableCell className="text-[11px] font-mono text-slate-500">{gl.account}</TableCell>
                        <TableCell />
                        <TableCell className="text-end text-[11px] tabular-nums text-emerald-600">
                            {gl.debit ? fmtNum(gl.debit) : ''}
                        </TableCell>
                        <TableCell className="text-end text-[11px] tabular-nums text-rose-600">
                            {gl.credit ? fmtNum(gl.credit) : ''}
                        </TableCell>
                        <TableCell />
                    </TableRow>
                ))
            )}
        </>
    )
}

// ═══════════════════════════════════════════════════════════════════
// ██  Loading Skeleton
// ═══════════════════════════════════════════════════════════════════

function RegisterSkeleton() {
    return (
        <div className="space-y-1 p-4">
            {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-1.5">
                    <Skeleton className="h-4 w-[70px]" />
                    <Skeleton className="h-4 w-[80px]" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-[130px]" />
                    <Skeleton className="h-4 w-[20px]" />
                    <Skeleton className="h-4 w-[80px]" />
                    <Skeleton className="h-4 w-[80px]" />
                    <Skeleton className="h-4 w-[90px]" />
                </div>
            ))}
        </div>
    )
}
