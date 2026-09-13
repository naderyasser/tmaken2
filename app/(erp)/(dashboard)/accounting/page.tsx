'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/lib/i18n'
import {
    accountingApi,
    type AccountingDashboard,
    type JournalEntry,
} from '@/lib/accounting-api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import {
    LayoutDashboard,
    BookOpen,
    Landmark,
    TrendingUp,
    TrendingDown,
    Wallet,
    DollarSign,
    PlusCircle,
    FileText,
    RefreshCw,
    AlertCircle,
    CheckCircle,
    Clock,
    XCircle,
    ChevronDown,
    LogOut,
    Home,
    Building2,
    ArrowLeft,
    Loader2,
    Scale,
    LineChart,
    Table,
    BookMarked,
    Banknote,
    Receipt,
    Lock,
    CreditCard,
    BarChart3,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════
// ██  INLINE BILINGUAL LABELS  (same pattern as purchases)
// ═══════════════════════════════════════════════════════

const L = {
    en: {
        // Module
        title: 'Accounting',
        subtitle: 'General ledger, invoices, payments & reports',
        // Header
        selectCompany: 'Select Company',
        allCompanies: 'All Companies',
        // KPI
        totalReceivables: 'Total Receivables',
        totalPayables: 'Total Payables',
        bankCashBalance: 'Bank & Cash Balance',
        revenueYTD: 'Revenue YTD',
        expenseYTD: 'Expense YTD',
        netProfitYTD: 'Net Profit YTD',
        overdueReceivables: 'Overdue Receivables',
        overduePayables: 'Overdue Payables',
        pendingReceivables: 'Pending Sales Invoices',
        pendingPayables: 'Pending Purchase Invoices',
        activeAccounts: 'Active accounts',
        invoicesCount: 'invoices',
        // Quick Actions
        quickActions: 'Quick Actions',
        createJournalEntry: 'New Journal Entry',
        salesInvoice: 'Sales Invoice',
        purchaseInvoice: 'Purchase Invoice',
        bankReconciliation: 'Bank Reconciliation',
        paymentEntry: 'Payment Entry',
        profitLoss: 'Profit & Loss',
        balanceSheet: 'Balance Sheet',
        trialBalance: 'Trial Balance',
        generalLedger: 'General Ledger',
        chartOfAccounts: 'Chart of Accounts',
        cashFlow: 'Cash Flow',
        arAging: 'AR Aging',
        apAging: 'AP Aging',
        vat: 'VAT',
        periodClosing: 'Period Closing',
        // Bank & Cash
        bankCashTitle: 'Bank & Cash Account Balances',
        // Journal Entries table
        recentJournalEntries: 'Latest Journal Entries',
        noEntries: 'No journal entries found.',
        voucherType: 'Type',
        postingDate: 'Date',
        totalDebit: 'Total Debit',
        totalCredit: 'Total Credit',
        remarks: 'Remarks',
        status: 'Status',
        viewAll: 'View all',
        viewAllEntries: '→ View all entries',
        showingLast: 'Showing last',
        entries: 'entries',
        // Statuses
        draft: 'Draft',
        submitted: 'Submitted',
        cancelled: 'Cancelled',
        // Common
        loading: 'Loading...',
        error: 'Failed to load data',
        retry: 'Retry',
        refresh: 'Refresh',
        currency: 'SAR',
        unauthorized: 'Accounting access required',
        unauthorizedDesc: 'You need Accounts Manager or Accounts User role to access this module.',
        goHome: 'Go to Home',
        logout: 'Logout',
    },
    ar: {
        title: 'المحاسبة',
        subtitle: 'دفتر الأستاذ العام، الفواتير، المدفوعات والتقارير',
        selectCompany: 'اختر الشركة',
        allCompanies: 'جميع الشركات',
        totalReceivables: 'إجمالي المديونيات',
        totalPayables: 'إجمالي المستحقات',
        bankCashBalance: 'رصيد البنوك والخزينة',
        revenueYTD: 'إيرادات السنة',
        expenseYTD: 'مصروفات السنة',
        netProfitYTD: 'صافي الربح',
        overdueReceivables: 'مستحقات متأخرة (عملاء)',
        overduePayables: 'مستحقات متأخرة (موردين)',
        pendingReceivables: 'فواتير مبيعات معلقة',
        pendingPayables: 'فواتير مشتريات معلقة',
        activeAccounts: 'حسابات نشطة',
        invoicesCount: 'فاتورة',
        quickActions: 'إجراءات سريعة',
        createJournalEntry: 'قيد يومية جديد',
        salesInvoice: 'فاتورة مبيعات',
        purchaseInvoice: 'فاتورة مشتريات',
        bankReconciliation: 'مطابقة بنكية',
        paymentEntry: 'قيد دفع',
        profitLoss: 'قائمة الدخل',
        balanceSheet: 'الميزانية العمومية',
        trialBalance: 'ميزان المراجعة',
        generalLedger: 'دفتر الأستاذ',
        chartOfAccounts: 'شجرة الحسابات',
        cashFlow: 'التدفق النقدي',
        arAging: 'أعمار ديون العملاء',
        apAging: 'أعمار ديون الموردين',
        vat: 'ضريبة القيمة المضافة',
        periodClosing: 'إقفال الفترات',
        bankCashTitle: 'أرصدة الحسابات البنكية والنقدية',
        recentJournalEntries: 'أحدث قيود اليومية',
        noEntries: 'لا توجد قيود يومية.',
        voucherType: 'نوع القيد',
        postingDate: 'التاريخ',
        totalDebit: 'إجمالي المدين',
        totalCredit: 'إجمالي الدائن',
        remarks: 'البيان',
        status: 'الحالة',
        viewAll: 'عرض الكل',
        viewAllEntries: 'عرض جميع القيود ←',
        showingLast: 'عرض آخر',
        entries: 'قيد',
        draft: 'مسودة',
        submitted: 'معتمد',
        cancelled: 'ملغي',
        loading: 'جاري التحميل...',
        error: 'فشل تحميل البيانات',
        retry: 'إعادة المحاولة',
        refresh: 'تحديث',
        currency: 'ر.س',
        unauthorized: 'مطلوب صلاحية المحاسبة',
        unauthorizedDesc: 'تحتاج دور مدير المحاسبة أو مستخدم محاسبة للوصول.',
        goHome: 'الرجوع للرئيسية',
        logout: 'تسجيل الخروج',
    },
} as const

type Lang = 'en' | 'ar'

// ═══════════════════════════════════════════════════════
// ██  HELPERS
// ═══════════════════════════════════════════════════════

function formatCurrency(value: number | undefined | null, lang: Lang): string {
    if (value == null) return '-'
    const prefix = value < 0 ? '-' : ''
    const formatted = new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-SA', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(Math.abs(value))
    return `${prefix}${formatted} ${lang === 'ar' ? 'ر.س' : 'SAR'}`
}

function formatDate(d: string | undefined | null): string {
    if (!d) return '-'
    return d.substring(0, 10)
}

/** Docstatus → human-readable status string */
function entryStatus(entry: JournalEntry): 'submitted' | 'draft' | 'cancelled' {
    if (entry.docstatus === 1) return 'submitted'
    if (entry.docstatus === 2) return 'cancelled'
    return 'draft'
}

function statusBadgeClass(s: 'submitted' | 'draft' | 'cancelled'): string {
    switch (s) {
        case 'submitted': return 'bg-emerald-100 text-emerald-700'
        case 'cancelled': return 'bg-red-100 text-red-700'
        default: return 'bg-amber-100 text-amber-700'
    }
}

function statusIcon(s: 'submitted' | 'draft' | 'cancelled') {
    switch (s) {
        case 'submitted': return <CheckCircle className="w-3 h-3" />
        case 'cancelled': return <XCircle className="w-3 h-3" />
        default: return <Clock className="w-3 h-3" />
    }
}

// Translate vocal voucher_type to short Arabic label
const voucherTypeAr: Record<string, string> = {
    'Journal Entry': 'قيد يومية',
    'Bank Entry': 'قيد بنكي',
    'Cash Entry': 'قيد نقدي',
    'Credit Note': 'إشعار دائن',
    'Debit Note': 'إشعار مدين',
    'Opening Entry': 'قيد افتتاحي',
    'Contra Entry': 'قيد مقابل',
    'Depreciation Entry': 'قيد إهلاك',
    'Write Off Entry': 'قيد شطب',
    'Exchange Rate Revaluation': 'إعادة تقييم العملة',
}

// ═══════════════════════════════════════════════════════
// ██  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════

// ── KPI Card ────────────────────────────────────────────

interface KPICardProps {
    icon: React.ElementType
    iconBg: string      // Tailwind classes for icon container bg + text
    label: string
    value: string
    subLabel?: string
    subValue?: string
    subValueClass?: string
    loading: boolean
    href?: string
}

function KPICard({ icon: Icon, iconBg, label, value, subLabel, subValue, subValueClass, loading, href }: KPICardProps) {
    const router = useRouter()
    const content = (
        <div className={`bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4 hover:shadow-md hover:border-gray-200 transition-all group ${href ? 'cursor-pointer' : ''}`}
            onClick={href ? () => router.push(href) : undefined}
        >
            {/* Icon */}
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform shadow-sm ${iconBg}`}>
                <Icon className="w-6 h-6" />
            </div>

            {/* Text — right-aligned content (RTL: naturally left in LTR mode) */}
            <div className="flex-1 min-w-0">
                <p className="text-[13px] text-gray-500 font-medium truncate mb-0.5">{label}</p>
                {loading ? (
                    <div className="space-y-1.5 mt-1">
                        <Skeleton className="h-7 w-32" />
                        <Skeleton className="h-4 w-20" />
                    </div>
                ) : (
                    <>
                        <p className="text-2xl font-bold text-gray-900 tracking-tight truncate">{value}</p>
                        {subLabel && subValue && (
                            <p className={`text-[11px] mt-1 font-medium flex items-center gap-1 ${subValueClass ?? 'text-gray-400'}`}>
                                {subValue} {subLabel}
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    )
    return content
}

// ── Quick Action Tile ────────────────────────────────────

interface QuickActionProps {
    icon: React.ElementType
    iconBg: string
    label: string
    onClick: () => void
}

function QuickActionTile({ icon: Icon, iconBg, label, onClick }: QuickActionProps) {
    return (
        <button
            onClick={onClick}
            className="bg-white border border-gray-100 rounded-2xl p-4 hover:border-blue-300 hover:shadow-md transition-all flex flex-col items-center gap-2.5 group cursor-pointer w-full"
        >
            <div className={`p-3 rounded-xl group-hover:scale-105 transition-all ${iconBg}`}>
                <Icon className="w-5 h-5" />
            </div>
            <p className="text-[12px] font-semibold text-gray-700 text-center leading-tight">{label}</p>
        </button>
    )
}

// ── Journal Entry Row Skeleton ───────────────────────────

function JERowSkeleton() {
    return (
        <tr className="border-b border-gray-50">
            {[...Array(6)].map((_, i) => (
                <td key={i} className="px-4 py-3">
                    <Skeleton className="h-4 w-full" />
                </td>
            ))}
        </tr>
    )
}

// ── Company Selector ─────────────────────────────────────

type LType = typeof L['en'] | typeof L['ar']

interface CompanySelectorProps {
    companies: Array<{ name: string; company_name: string }>
    selected: string | null
    onSelect: (company: string | null) => void
    t: LType
}

function CompanySelector({ companies, selected, onSelect, t }: CompanySelectorProps) {
    const [open, setOpen] = useState(false)
    const selectedLabel = selected
        ? (companies.find(c => c.name === selected)?.company_name ?? selected)
        : t.allCompanies

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-sm font-medium text-gray-700 hover:border-gray-300 transition-colors shadow-sm"
            >
                <Building2 className="w-4 h-4 text-gray-400" />
                <span className="max-w-[160px] truncate">{selectedLabel}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    {/* Dropdown */}
                    <div className="absolute start-0 top-full mt-1.5 z-50 bg-white border border-gray-200 rounded-xl shadow-xl min-w-[200px] overflow-hidden">
                        <button
                            onClick={() => { onSelect(null); setOpen(false) }}
                            className={`w-full text-start px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${!selected ? 'text-blue-600 font-semibold' : 'text-gray-700'}`}
                        >
                            {t.allCompanies}
                        </button>
                        {companies.map(c => (
                            <button
                                key={c.name}
                                onClick={() => { onSelect(c.name); setOpen(false) }}
                                className={`w-full text-start px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${selected === c.name ? 'text-blue-600 font-semibold' : 'text-gray-700'}`}
                            >
                                {c.company_name}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

// ═══════════════════════════════════════════════════════
// ██  MAIN PAGE
// ═══════════════════════════════════════════════════════

export default function AccountingPage() {
    const router = useRouter()
    const { isAuthenticated, isLoading: authLoading, logout } = useAuth()
    const { lang, isRTL } = useI18n()

    const locale: Lang = lang === 'ar' ? 'ar' : 'en'
    const t = L[locale]

    // ── State ──────────────────────────────────────────
    const [companies, setCompanies] = useState<Array<{ name: string; company_name: string }>>([])
    const [selectedCompany, setSelectedCompany] = useState<string | null>(null)
    const [dashboard, setDashboard] = useState<AccountingDashboard | null>(null)
    const [dashLoading, setDashLoading] = useState(true)
    const [dashError, setDashError] = useState(false)
    const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
    const [jeLoading, setJeLoading] = useState(true)

    // ── Monthly revenue (sum bank balances as proxy until P&L ready) ──
    const totalBankBalance = (dashboard?.bank_balances ?? []).reduce((s, b) => s + b.balance, 0)
        + (dashboard?.cash_balances ?? []).reduce((s, b) => s + b.balance, 0)

    // ── Overdue amounts (SAR) ──
    const overdueSalesAmt = dashboard?.overdue_sales_amount ?? 0
    const overduePurchaseAmt = dashboard?.overdue_purchase_amount ?? 0

    // ── Load companies once ────────────────────────────
    useEffect(() => {
        accountingApi.getCompanies()
            .then(list => setCompanies(list.map(c => ({ name: c.name, company_name: c.company_name }))))
            .catch(() => { /* non-critical */ })
    }, [])

    // ── Load dashboard & journal entries ───────────────
    const loadData = useCallback(async (company: string | null) => {
        setDashLoading(true)
        setDashError(false)
        setJeLoading(true)

        try {
            const [dash, entries] = await Promise.allSettled([
                accountingApi.getDashboard(company ?? undefined),
                accountingApi.getJournalEntries({
                    company: company ?? undefined,
                    limit_page_length: 10,
                }),
            ])

            if (dash.status === 'fulfilled') {
                setDashboard(dash.value)
                setDashError(false)
            } else {
                setDashError(true)
            }
            setDashLoading(false)

            if (entries.status === 'fulfilled') {
                setJournalEntries(entries.value)
            }
            setJeLoading(false)

        } catch {
            setDashError(true)
            setDashLoading(false)
            setJeLoading(false)
        }
    }, [])

    useEffect(() => { loadData(selectedCompany) }, [loadData, selectedCompany])

    // ── Auth guard ─────────────────────────────────────
    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        )
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
                <div className="text-center space-y-4 max-w-sm px-6">
                    <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto">
                        <BookOpen className="w-8 h-8 text-blue-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">{t.unauthorized}</h2>
                    <p className="text-sm text-gray-500">{t.unauthorizedDesc}</p>
                    <div className="flex flex-col gap-2 pt-2">
                        <button
                            onClick={() => router.push('/')}
                            className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors"
                        >
                            <Home className="w-4 h-4" />
                            {t.goHome}
                        </button>
                        <button
                            onClick={() => { logout(); router.push('/login') }}
                            className="flex items-center justify-center gap-2 w-full border border-gray-200 text-gray-700 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            {t.logout}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // ── Quick actions definition ───────────────────────
    const quickActions: Array<{ icon: React.ElementType; iconBg: string; label: string; href: string }> = [
        { icon: PlusCircle, iconBg: 'bg-blue-50 text-blue-600', label: t.createJournalEntry, href: '/accounting/journal-entries/new' },
        { icon: BookMarked, iconBg: 'bg-orange-50 text-orange-600', label: t.chartOfAccounts, href: '/accounting/chart-of-accounts' },
        { icon: FileText, iconBg: 'bg-slate-50 text-slate-600', label: t.generalLedger, href: '/accounting/general-ledger' },
        { icon: Table, iconBg: 'bg-cyan-50 text-cyan-600', label: t.trialBalance, href: '/accounting/trial-balance' },
        { icon: Scale, iconBg: 'bg-teal-50 text-teal-600', label: t.balanceSheet, href: '/accounting/balance-sheet' },
        { icon: LineChart, iconBg: 'bg-indigo-50 text-indigo-600', label: t.profitLoss, href: '/accounting/pnl' },
        { icon: Banknote, iconBg: 'bg-green-50 text-green-600', label: t.cashFlow, href: '/accounting/cash-flow' },
        { icon: TrendingUp, iconBg: 'bg-emerald-50 text-emerald-600', label: t.arAging, href: '/accounting/ar-aging' },
        { icon: TrendingDown, iconBg: 'bg-rose-50 text-rose-600', label: t.apAging, href: '/accounting/ap-aging' },
        { icon: Receipt, iconBg: 'bg-amber-50 text-amber-600', label: t.vat, href: '/accounting/vat' },
        { icon: Landmark, iconBg: 'bg-sky-50 text-sky-600', label: t.bankReconciliation, href: '/accounting/bank-reconciliation' },
        { icon: Lock, iconBg: 'bg-gray-50 text-gray-600', label: t.periodClosing, href: '/accounting/period-closing' },
    ]

    // ── KPI definitions ────────────────────────────────
    const kpiCards: KPICardProps[] = [
        {
            icon: TrendingUp,
            iconBg: 'bg-emerald-100 text-emerald-600',
            label: t.totalReceivables,
            value: formatCurrency(dashboard?.total_receivables, locale),
            subLabel: t.overdueReceivables,
            subValue: dashboard ? formatCurrency(overdueSalesAmt, locale) : '—',
            subValueClass: dashboard && overdueSalesAmt > 0
                ? 'text-red-500'
                : 'text-gray-400',
            loading: dashLoading,
            href: '/accounting/ar-aging',
        },
        {
            icon: TrendingDown,
            iconBg: 'bg-red-100 text-red-600',
            label: t.totalPayables,
            value: formatCurrency(dashboard?.total_payables, locale),
            subLabel: t.overduePayables,
            subValue: dashboard ? formatCurrency(overduePurchaseAmt, locale) : '—',
            subValueClass: dashboard && overduePurchaseAmt > 0
                ? 'text-red-500'
                : 'text-gray-400',
            loading: dashLoading,
            href: '/accounting/ap-aging',
        },
        {
            icon: Wallet,
            iconBg: 'bg-blue-100 text-blue-600',
            label: t.bankCashBalance,
            value: formatCurrency(totalBankBalance, locale),
            subLabel: t.activeAccounts,
            subValue: String(
                (dashboard?.bank_balances?.length ?? 0) +
                (dashboard?.cash_balances?.length ?? 0)
            ),
            subValueClass: 'text-gray-400',
            loading: dashLoading,
            href: '/accounting/bank-reconciliation',
        },
        {
            icon: DollarSign,
            iconBg: 'bg-violet-100 text-violet-600',
            label: t.revenueYTD,
            value: formatCurrency(dashboard?.revenue_ytd ?? 0, locale),
            subLabel: t.expenseYTD,
            subValue: dashboard ? formatCurrency(dashboard.expense_ytd, locale) : '—',
            subValueClass: 'text-gray-400',
            loading: dashLoading,
            href: '/accounting/pnl',
        },
        {
            icon: BarChart3,
            iconBg: (dashboard?.net_profit_ytd ?? 0) >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600',
            label: t.netProfitYTD,
            value: formatCurrency(dashboard?.net_profit_ytd ?? 0, locale),
            subLabel: t.pendingReceivables,
            subValue: dashboard ? String(dashboard.pending_sales_invoices) : '—',
            subValueClass: 'text-amber-500',
            loading: dashLoading,
            href: '/accounting/pnl',
        },
    ]

    // ─────────────────────────────────────────────────────
    // ██  RENDER
    // ─────────────────────────────────────────────────────

    return (
        <div className="p-6 md:p-8 max-w-[1400px] mx-auto" dir={isRTL ? 'rtl' : 'ltr'}>

            {/* ── Page Header ───────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                {/* Left/Start: Title */}
                <div>
                    <div className="flex items-center gap-2.5 mb-1">
                        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
                            <BookOpen className="w-5 h-5 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {t.title}
                        </h1>
                    </div>
                    <p className="text-sm text-gray-500 ms-[2.875rem]">
                        {t.subtitle}
                    </p>
                </div>

                {/* Right/End: Company Selector + Refresh */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Refresh */}
                    <button
                        onClick={() => loadData(selectedCompany)}
                        disabled={dashLoading}
                        className="p-2 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-colors shadow-sm disabled:opacity-50"
                        title={t.refresh}
                    >
                        <RefreshCw className={`w-4 h-4 ${dashLoading ? 'animate-spin' : ''}`} />
                    </button>

                    {/* Company Selector */}
                    <CompanySelector
                        companies={companies}
                        selected={selectedCompany}
                        onSelect={setSelectedCompany}
                        t={t}
                    />
                </div>
            </div>

            {/* ── Error Banner ──────────────────────────── */}
            {dashError && !dashLoading && (
                <div className="mb-6 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-700 flex-1">{t.error}</p>
                    <button
                        onClick={() => loadData(selectedCompany)}
                        className="text-sm font-semibold text-red-600 hover:underline flex-shrink-0"
                    >
                        {t.retry}
                    </button>
                </div>
            )}

            {/* ── KPI Cards ─────────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 md:gap-5 mb-8">
                {kpiCards.map((card, i) => (
                    <KPICard key={i} {...card} />
                ))}
            </div>

            {/* ── Charts Row ────────────────────────────── */}
            {!dashLoading && dashboard && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
                    {/* Revenue vs Expense bar chart */}
                    <div className="bg-white rounded-xl border border-gray-100 p-5">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-blue-600" />
                            {locale === 'ar' ? 'الإيرادات مقابل المصروفات' : 'Revenue vs Expense (YTD)'}
                        </h3>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={[
                                { name: locale === 'ar' ? 'إيرادات' : 'Revenue', value: dashboard.revenue_ytd, fill: '#10b981' },
                                { name: locale === 'ar' ? 'مصروفات' : 'Expense', value: dashboard.expense_ytd, fill: '#ef4444' },
                                { name: locale === 'ar' ? 'صافي الربح' : 'Net Profit', value: dashboard.net_profit_ytd, fill: '#6366f1' },
                            ]} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                                <Tooltip formatter={(v: number) => `${v.toLocaleString('en-SA', { minimumFractionDigits: 0 })} SAR`} />
                                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28}>
                                    {['#10b981', '#ef4444', '#6366f1'].map((color, i) => (
                                        <Cell key={i} fill={color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Receivables / Payables pie chart */}
                    <div className="bg-white rounded-xl border border-gray-100 p-5">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-blue-600" />
                            {locale === 'ar' ? 'المديونيات والمستحقات' : 'Receivables & Payables'}
                        </h3>
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: locale === 'ar' ? 'مديونيات' : 'Receivables', value: dashboard.total_receivables },
                                        { name: locale === 'ar' ? 'مستحقات' : 'Payables', value: dashboard.total_payables },
                                        { name: locale === 'ar' ? 'متأخرة (عملاء)' : 'Overdue (AR)', value: overdueSalesAmt },
                                        { name: locale === 'ar' ? 'متأخرة (موردين)' : 'Overdue (AP)', value: overduePurchaseAmt },
                                    ].filter(d => d.value > 0)}
                                    cx="50%" cy="50%" innerRadius={50} outerRadius={85}
                                    paddingAngle={3} dataKey="value"
                                >
                                    {['#10b981', '#ef4444', '#f59e0b', '#f97316'].map((color, i) => (
                                        <Cell key={i} fill={color} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(v: number) => `${v.toLocaleString('en-SA', { minimumFractionDigits: 0 })} SAR`} />
                                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* ── Secondary Metrics Row ─────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                {[
                    {
                        label: t.pendingReceivables,
                        value: dashLoading ? null : (dashboard?.pending_sales_invoices ?? 0),
                        color: 'text-emerald-600',
                        bg: 'bg-emerald-50',
                        href: '/accounting/sales-invoices',
                    },
                    {
                        label: t.pendingPayables,
                        value: dashLoading ? null : (dashboard?.pending_purchase_invoices ?? 0),
                        color: 'text-violet-600',
                        bg: 'bg-violet-50',
                        href: '/accounting/purchase-invoices',
                    },
                    {
                        label: t.overdueReceivables,
                        value: dashLoading ? null : (dashboard?.overdue_sales_invoices ?? 0),
                        color: 'text-red-600',
                        bg: 'bg-red-50',
                        href: '/accounting/ar-aging',
                    },
                    {
                        label: t.overduePayables,
                        value: dashLoading ? null : (dashboard?.overdue_purchase_invoices ?? 0),
                        color: 'text-orange-600',
                        bg: 'bg-orange-50',
                        href: '/accounting/ap-aging',
                    },
                ].map((item, i) => (
                    <div
                        key={i}
                        onClick={() => router.push(item.href)}
                        className={`rounded-xl border border-gray-100 px-4 py-3 flex flex-col gap-1 cursor-pointer hover:shadow-md hover:border-gray-200 transition-all ${item.bg}`}
                    >
                        <p className="text-[11px] font-medium text-gray-500 leading-tight">{item.label}</p>
                        {dashLoading ? (
                            <Skeleton className="h-7 w-12 mt-0.5" />
                        ) : (
                            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                        )}
                    </div>
                ))}
            </div>

            {/* ── Quick Actions ─────────────────────────── */}
            <div className="mb-8">
                <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <LayoutDashboard className="w-4 h-4 text-blue-600" />
                    {t.quickActions}
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                    {quickActions.map((action) => (
                        <QuickActionTile
                            key={action.href}
                            icon={action.icon}
                            iconBg={action.iconBg}
                            label={action.label}
                            onClick={() => router.push(action.href)}
                        />
                    ))}
                </div>
            </div>

            {/* ── Bank / Cash Balance Cards ─────────────── */}
            {(dashLoading || ((dashboard?.bank_balances?.length ?? 0) + (dashboard?.cash_balances?.length ?? 0)) > 0) && (
                <div className="mb-8">
                    <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Landmark className="w-4 h-4 text-blue-600" />
                        {t.bankCashTitle}
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {dashLoading
                            ? [...Array(3)].map((_, i) => (
                                <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-7 w-1/2" />
                                </div>
                            ))
                            : [...(dashboard?.bank_balances ?? []), ...(dashboard?.cash_balances ?? [])].map((acct) => (
                                <div
                                    key={acct.account}
                                    className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[12px] text-gray-500 truncate mb-1">{acct.account_name}</p>
                                            <p className="text-lg font-bold text-gray-900">
                                                {formatCurrency(acct.balance, locale)}
                                            </p>
                                        </div>
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${acct.balance >= 0
                                            ? 'bg-emerald-100 text-emerald-600'
                                            : 'bg-red-100 text-red-600'}`}>
                                            <Wallet className="w-4 h-4" />
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-gray-400 mt-2">{acct.currency}</p>
                                </div>
                            ))
                        }
                    </div>
                </div>
            )}

            {/* ── Recent Journal Entries Table ────────────── */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                {/* Table Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        {t.recentJournalEntries}
                    </h3>
                    <div className="flex items-center gap-2">
                        {jeLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
                        <button
                            onClick={() => router.push('/accounting/journal-entries')}
                            className="text-[12px] font-medium text-blue-600 hover:underline flex items-center gap-1"
                        >
                            {t.viewAll}
                            <ArrowLeft className={`w-3 h-3 ${isRTL ? '' : 'rotate-180'}`} />
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50">
                                {[
                                    t.voucherType,
                                    t.postingDate,
                                    t.totalDebit,
                                    t.totalCredit,
                                    t.remarks,
                                    t.status,
                                ].map((header) => (
                                    <th
                                        key={header}
                                        className="text-start px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                                    >
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {jeLoading
                                ? [...Array(5)].map((_, i) => <JERowSkeleton key={i} />)
                                : journalEntries.length === 0
                                    ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-16 text-gray-400">
                                                <div className="flex flex-col items-center gap-3">
                                                    <BookOpen className="w-10 h-10 opacity-30" />
                                                    <p className="text-sm">{t.noEntries}</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                    : journalEntries.map((entry) => {
                                        const s = entryStatus(entry)
                                        const typeLabel = locale === 'ar'
                                            ? (voucherTypeAr[entry.voucher_type ?? ''] ?? entry.voucher_type ?? '-')
                                            : (entry.voucher_type ?? '-')
                                        return (
                                            <tr
                                                key={entry.name}
                                                className="border-b border-gray-50 hover:bg-gray-50/70 transition-colors cursor-pointer"
                                                onClick={() => router.push('/accounting/journal-entries')}
                                            >
                                                {/* Voucher type */}
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className="font-semibold text-gray-800 text-[13px]">
                                                        {typeLabel}
                                                    </span>
                                                    <p className="text-[11px] text-gray-400 mt-0.5">
                                                        {entry.name}
                                                    </p>
                                                </td>

                                                {/* Date */}
                                                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                                    {formatDate(entry.posting_date)}
                                                </td>

                                                {/* Debit */}
                                                <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap tabular-nums">
                                                    {formatCurrency(entry.total_debit, locale)}
                                                </td>

                                                {/* Credit */}
                                                <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap tabular-nums">
                                                    {formatCurrency(entry.total_credit, locale)}
                                                </td>

                                                {/* Remarks */}
                                                <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">
                                                    {entry.user_remark ?? entry.title ?? '-'}
                                                </td>

                                                {/* Status Badge */}
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusBadgeClass(s)}`}>
                                                        {statusIcon(s)}
                                                        {t[s]}
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    })
                            }
                        </tbody>
                    </table>
                </div>

                {/* Table Footer */}
                {!jeLoading && journalEntries.length > 0 && (
                    <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                        <p className="text-[11px] text-gray-400">
                            {`${t.showingLast} ${journalEntries.length} ${t.entries}`}
                        </p>
                        <button
                            onClick={() => router.push('/accounting/journal-entries')}
                            className="text-[12px] font-medium text-blue-600 hover:underline"
                        >
                            {t.viewAllEntries}
                        </button>
                    </div>
                )}
            </div>

            {/* ── Bottom padding ─────────────────────────── */}
            <div className="h-8" />
        </div>
    )
}
