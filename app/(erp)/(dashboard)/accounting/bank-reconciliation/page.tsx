'use client'

import { useCallback, useEffect, useState } from 'react'
import { accountingApi, type BankStatement } from '@/lib/accounting-api'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, RefreshCw, Landmark, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type Locale = 'ar' | 'en'
const fmt = (v?: number) => (v ?? 0).toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const L = {
    en: {
        title: 'Bank Reconciliation', subtitle: 'Compare book balances with bank statement balances to identify discrepancies.',
        company: 'Company', run: 'Load Accounts', refresh: 'Refresh',
        account: 'Account', bookBalance: 'Balance (Books)', bankBalance: 'Bank Statement Balance', difference: 'Difference',
        status: 'Status', reconciled: 'Reconciled', unreconciled: 'Difference Found',
        noData: 'No bank accounts found.', error: 'Failed to load bank accounts.', allCompanies: 'Select company',
        enterBank: 'Enter bank balance...', save: 'Update', hint: 'Enter the closing balance from your bank statement for each account.',
    },
    ar: {
        title: 'مطابقة الحسابات البنكية', subtitle: 'مقارنة الأرصدة الدفترية مع كشف الحساب البنكي للكشف عن الفروق.',
        company: 'الشركة', run: 'تحميل الحسابات', refresh: 'تحديث',
        account: 'الحساب', bookBalance: 'الرصيد الدفتري', bankBalance: 'رصيد كشف الحساب', difference: 'الفرق',
        status: 'الحالة', reconciled: 'مطابق', unreconciled: 'يوجد فرق',
        noData: 'لا توجد حسابات بنكية.', error: 'فشل تحميل الحسابات البنكية.', allCompanies: 'اختر شركة',
        enterBank: 'أدخل رصيد البنك...', save: 'تحديث', hint: 'أدخل الرصيد الختامي من كشف حسابك البنكي لكل حساب.',
    },
} as const

export default function BankReconciliationPage() {
    const { lang, isRTL } = useI18n()
    const locale = (lang === 'ar' ? 'ar' : 'en') as Locale
    const t = L[locale]

    const [companies, setCompanies] = useState<Array<{ name: string; company_name: string }>>([])
    const [company, setCompany] = useState('')
    const [rows, setRows] = useState<BankStatement[]>([])
    const [bankInputs, setBankInputs] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [ran, setRan] = useState(false)

    useEffect(() => {
        accountingApi.getCompanies().then(list => {
            setCompanies(list)
            if (list.length === 1) setCompany(list[0].name)
        }).catch(() => {})
    }, [])

    const loadAccounts = useCallback(async () => {
        if (!company) return
        setLoading(true); setError(null); setRan(true)
        try {
            const data = await accountingApi.getBankAccountSummaries(company)
            setRows(data)
            // Preserve existing inputs, init new ones to ''
            setBankInputs(prev => {
                const next: Record<string, string> = {}
                data.forEach(r => { next[r.account] = prev[r.account] ?? '' })
                return next
            })
        } catch (e: any) { setError(e?.message ?? t.error) }
        finally { setLoading(false) }
    }, [company, t.error])

    const rowsWithCalc = rows.map(r => {
        const bankBalance = bankInputs[r.account] !== '' ? parseFloat(bankInputs[r.account] ?? '') : undefined
        const diff = bankBalance !== undefined && !isNaN(bankBalance) ? (r.balance_as_per_books ?? 0) - bankBalance : undefined
        return { ...r, balance_as_per_bank: bankBalance, difference: diff }
    })

    return (
        <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center">
                    <Landmark className="w-5 h-5 text-white" />
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
                <Button onClick={loadAccounts} disabled={!company || loading} className="bg-sky-600 hover:bg-sky-700">
                    <RefreshCw className={cn('w-4 h-4 me-2', loading && 'animate-spin')} />{ran ? t.refresh : t.run}
                </Button>
            </div>

            {error && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" /><p className="text-sm">{error}</p>
                </div>
            )}

            {ran && !loading && rows.length > 0 && (
                <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2">{t.hint}</p>
            )}

            {(ran || loading) && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    {[t.account, t.bookBalance, t.bankBalance, t.difference, t.status].map(h => (
                                        <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? Array.from({ length: 4 }).map((_, i) => (
                                    <tr key={i}>{Array.from({ length: 5 }).map((_, j) => (
                                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                                    ))}</tr>
                                )) : rows.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center py-12 text-gray-400">{t.noData}</td></tr>
                                ) : rowsWithCalc.map(r => {
                                    const isReconciled = r.difference !== undefined && Math.abs(r.difference) < 0.01
                                    const hasInput = r.balance_as_per_bank !== undefined && !isNaN(r.balance_as_per_bank)
                                    return (
                                        <tr key={r.account} className="hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-gray-900">{r.account_name}</p>
                                                <p className="text-xs text-gray-400 font-mono">{r.account}</p>
                                            </td>
                                            <td className="px-4 py-3 text-end tabular-nums font-semibold text-gray-800">{fmt(r.balance_as_per_books)}</td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={bankInputs[r.account] ?? ''}
                                                    onChange={e => setBankInputs(prev => ({ ...prev, [r.account]: e.target.value }))}
                                                    placeholder={t.enterBank}
                                                    className="h-8 w-36 border border-gray-200 rounded-lg px-2 text-sm text-end tabular-nums focus:outline-none focus:ring-2 focus:ring-sky-300"
                                                />
                                            </td>
                                            <td className={cn('px-4 py-3 text-end tabular-nums font-semibold', !hasInput ? 'text-gray-300' : isReconciled ? 'text-green-700' : 'text-red-700')}>
                                                {hasInput ? fmt(r.difference) : '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                {!hasInput ? (
                                                    <span className="text-gray-300 text-xs">—</span>
                                                ) : isReconciled ? (
                                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                                                        <CheckCircle2 className="w-3 h-3" />{t.reconciled}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                                                        <XCircle className="w-3 h-3" />{t.unreconciled}
                                                    </span>
                                                )}
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
