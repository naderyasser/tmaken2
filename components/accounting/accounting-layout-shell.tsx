'use client'

import type { ReactNode } from 'react'
import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
    BookMarked,
    BookOpen,
    LayoutDashboard,
    LineChart,
    Scale,
    Table,
    FileText,
    Clock,
    TrendingUp,
    TrendingDown,
    Banknote,
    Receipt,
    Landmark,
    Lock,
    CreditCard,
    ShoppingCart,
    Package,
} from 'lucide-react'
import { Header } from '@/components/header'
import {
    Sheet,
    SheetContent,
    SheetTitle,
} from '@/components/ui/sheet'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { RegisterStoreProvider, useRegisterStore, ACCOUNTS_TAB } from '@/lib/register-store'
import { RegisterTabBar } from '@/components/accounting/register-tab-bar'
import { AccountRegister } from '@/components/accounting/account-register'

type Locale = 'ar' | 'en'

const L = {
    en: {
        module: 'Accounting',
        navigation: 'Navigation',
        // Groups
        core: 'Core',
        documents: 'Documents',
        reports: 'Reports',
        tools: 'Tools',
        // Items
        dashboard: 'Dashboard',
        chartOfAccounts: 'Chart of Accounts',
        journalEntries: 'Journal Entries',
        generalLedger: 'General Ledger',
        salesInvoices: 'Sales Invoices',
        purchaseInvoices: 'Purchase Invoices',
        paymentEntries: 'Payment Entries',
        trialBalance: 'Trial Balance',
        balanceSheet: 'Balance Sheet',
        profitAndLoss: 'Profit & Loss',
        cashFlow: 'Cash Flow',
        arAging: 'Receivables Aging',
        apAging: 'Payables Aging',
        vat: 'VAT Reconciliation',
        bankReconciliation: 'Bank Reconciliation',
        periodClosing: 'Period Closing',
    },
    ar: {
        module: 'المحاسبة',
        navigation: 'القائمة الجانبية',
        core: 'الأساسيات',
        documents: 'المستندات',
        reports: 'التقارير',
        tools: 'الأدوات',
        dashboard: 'لوحة التحكم',
        chartOfAccounts: 'شجرة الحسابات',
        journalEntries: 'قيود اليومية',
        generalLedger: 'دفتر الأستاذ',
        salesInvoices: 'فواتير المبيعات',
        purchaseInvoices: 'فواتير المشتريات',
        paymentEntries: 'قيود الدفع',
        trialBalance: 'ميزان المراجعة',
        balanceSheet: 'الميزانية العمومية',
        profitAndLoss: 'قائمة الدخل',
        cashFlow: 'التدفق النقدي',
        arAging: 'أعمار ديون العملاء',
        apAging: 'أعمار ديون الموردين',
        vat: 'تسوية ضريبة القيمة المضافة',
        bankReconciliation: 'المطابقة البنكية',
        periodClosing: 'إقفال الفترات',
    },
} as const

interface NavItem {
    href: string
    label: string
    icon: React.ReactNode
}

interface NavGroup {
    title: string
    items: NavItem[]
}

function isItemActive(pathname: string, href: string): boolean {
    if (href === '/accounting') {
        return pathname === '/accounting'
    }

    return pathname === href || pathname.startsWith(`${href}/`)
}

export function AccountingLayoutShell({ children }: { children: ReactNode }) {
    const pathname = usePathname()
    const { lang, isRTL } = useI18n()
    const [mobileOpen, setMobileOpen] = useState(false)

    // Embedded mode: when an accounting tool is loaded inside the egarsys rentals
    // «المحاسبة» hub via <iframe src="/accounting/<tool>?embed=1">, render ONLY the
    // tool content — no sidebar / topbar / register-tab chrome. The flag is read
    // client-side (window.location) rather than via useSearchParams so that (a) the
    // non-embed SSR output and behaviour stay 100% unchanged and (b) no new Suspense
    // boundary is required at the layout level. RegisterStoreProvider is KEPT because
    // some tool pages (e.g. chart-of-accounts) call useRegisterStore() unconditionally.
    const [embed, setEmbed] = useState(false)
    useEffect(() => {
        try {
            setEmbed(new URLSearchParams(window.location.search).get('embed') === '1')
        } catch {
            /* noop */
        }
    }, [])

    if (embed) {
        return (
            <RegisterStoreProvider>
                <div className="h-full min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
                    {children}
                </div>
            </RegisterStoreProvider>
        )
    }

    const locale: Locale = lang === 'ar' ? 'ar' : 'en'
    const t = L[locale]

    const IC = "h-[18px] w-[18px]"

    const groups: NavGroup[] = [
        {
            title: t.core,
            items: [
                { href: '/accounting', label: t.dashboard, icon: <LayoutDashboard className={IC} /> },
                { href: '/accounting/chart-of-accounts', label: t.chartOfAccounts, icon: <BookMarked className={IC} /> },
                { href: '/accounting/journal-entries', label: t.journalEntries, icon: <BookOpen className={IC} /> },
                { href: '/accounting/general-ledger', label: t.generalLedger, icon: <FileText className={IC} /> },
            ],
        },
        {
            title: t.documents,
            items: [
                { href: '/accounting/sales-invoices', label: t.salesInvoices, icon: <ShoppingCart className={IC} /> },
                { href: '/accounting/purchase-invoices', label: t.purchaseInvoices, icon: <Package className={IC} /> },
                { href: '/accounting/payment-entries', label: t.paymentEntries, icon: <CreditCard className={IC} /> },
            ],
        },
        {
            title: t.reports,
            items: [
                { href: '/accounting/trial-balance', label: t.trialBalance, icon: <Table className={IC} /> },
                { href: '/accounting/balance-sheet', label: t.balanceSheet, icon: <Scale className={IC} /> },
                { href: '/accounting/pnl', label: t.profitAndLoss, icon: <LineChart className={IC} /> },
                { href: '/accounting/cash-flow', label: t.cashFlow, icon: <Banknote className={IC} /> },
                { href: '/accounting/ar-aging', label: t.arAging, icon: <TrendingUp className={IC} /> },
                { href: '/accounting/ap-aging', label: t.apAging, icon: <TrendingDown className={IC} /> },
            ],
        },
        {
            title: t.tools,
            items: [
                { href: '/accounting/vat', label: t.vat, icon: <Receipt className={IC} /> },
                { href: '/accounting/bank-reconciliation', label: t.bankReconciliation, icon: <Landmark className={IC} /> },
                { href: '/accounting/period-closing', label: t.periodClosing, icon: <Lock className={IC} /> },
            ],
        },
    ]

    const navContent = (closeOnClick?: () => void) => (
        <div className="flex h-full flex-col">
            <div className="border-b border-gray-200 px-4 py-4">
                <p className="text-xs font-semibold tracking-wide text-indigo-600">{t.module}</p>
                <p className="mt-0.5 text-[11px] text-gray-500">{t.navigation}</p>
            </div>

            <nav className="flex-1 overflow-y-auto p-3 space-y-4">
                {groups.map((group) => (
                    <div key={group.title}>
                        <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">{group.title}</p>
                        <div className="space-y-0.5">
                            {group.items.map((item) => {
                                const active = isItemActive(pathname, item.href)
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={closeOnClick}
                                        className={cn(
                                            'flex items-center gap-3 rounded-xl border px-3 py-2 text-[13px] font-medium transition-colors',
                                            active
                                                ? 'border-indigo-100 bg-indigo-50 text-indigo-700'
                                                : 'border-transparent text-gray-600 hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900'
                                        )}
                                    >
                                        <span className={cn('shrink-0', active ? 'text-indigo-600' : 'text-gray-500')}>
                                            {item.icon}
                                        </span>
                                        <span className="truncate">{item.label}</span>
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </nav>
        </div>
    )

    return (
        <RegisterStoreProvider>
            <div className="flex h-screen flex-col bg-[#f8f9fb]" dir={isRTL ? 'rtl' : 'ltr'}>
                <Suspense fallback={<div className="h-16 border-b border-gray-200 bg-white" />}>
                    <Header onToggleSidebar={() => setMobileOpen(true)} showHomeButton />
                </Suspense>

                <div className="flex flex-1 overflow-hidden">
                    <aside
                        className={cn(
                            'hidden w-72 flex-col bg-white lg:flex',
                            isRTL ? 'border-l border-gray-200' : 'border-r border-gray-200'
                        )}
                    >
                        {navContent()}
                    </aside>

                    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                        <SheetContent
                            side={isRTL ? 'right' : 'left'}
                            className="w-[85%] border-gray-200 bg-white p-0 sm:max-w-sm"
                        >
                            <SheetTitle className="sr-only">{t.navigation}</SheetTitle>
                            {navContent(() => setMobileOpen(false))}
                        </SheetContent>
                    </Sheet>

                    <div className="flex flex-1 flex-col overflow-hidden">
                        <RegisterTabBar />
                        <AccountingContent>{children}</AccountingContent>
                    </div>
                </div>
            </div>
        </RegisterStoreProvider>
    )
}

/**
 * Switches between route-based children (normal pages) and
 * AccountRegister when an account tab is active.
 */
function AccountingContent({ children }: { children: ReactNode }) {
    const { tabs, activeTabId } = useRegisterStore()
    const isAccountTab = activeTabId !== ACCOUNTS_TAB.id
    const activeTab = tabs.find(t => t.id === activeTabId)

    return (
        <>
            {/* Normal route content — hidden (not unmounted) when a register tab is active */}
            <main
                className="flex-1 overflow-auto bg-[#f8f9fb]"
                style={{ display: isAccountTab ? 'none' : undefined }}
            >
                {children}
            </main>

            {/* Account register — shown when an account tab is active */}
            {isAccountTab && activeTab && (
                <div className="flex-1 overflow-hidden bg-white">
                    <AccountRegister
                        key={activeTab.id}
                        accountId={activeTab.id}
                        accountName={activeTab.label}
                        rootType={activeTab.rootType}
                        accountType={activeTab.accountType}
                        company={activeTab.company}
                    />
                </div>
            )}
        </>
    )
}