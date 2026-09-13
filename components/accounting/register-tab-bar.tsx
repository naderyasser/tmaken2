'use client'

import { useRef, useEffect } from 'react'
import { X, TreePine, Landmark, Banknote, CreditCard, TrendingUp, TrendingDown, Wallet, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRegisterStore, ACCOUNTS_TAB, type RegisterTab } from '@/lib/register-store'
import { useI18n } from '@/lib/i18n'

type Locale = 'ar' | 'en'

const L = {
    en: { accounts: 'Accounts', closeTab: 'Close tab' },
    ar: { accounts: 'الحسابات', closeTab: 'إغلاق' },
} as const

function tabIcon(tab: RegisterTab) {
    if (tab.id === ACCOUNTS_TAB.id) return <TreePine className="h-3.5 w-3.5" />
    switch (tab.accountType) {
        case 'Bank': return <Landmark className="h-3.5 w-3.5" />
        case 'Cash': return <Banknote className="h-3.5 w-3.5" />
        case 'Receivable': return <TrendingUp className="h-3.5 w-3.5" />
        case 'Payable': return <TrendingDown className="h-3.5 w-3.5" />
        case 'Equity': return <Wallet className="h-3.5 w-3.5" />
        default: return <FileText className="h-3.5 w-3.5" />
    }
}

function rootTypeColor(rt?: string): string {
    switch (rt) {
        case 'Asset': return 'text-blue-600'
        case 'Liability': return 'text-rose-600'
        case 'Equity': return 'text-purple-600'
        case 'Income': return 'text-emerald-600'
        case 'Expense': return 'text-amber-600'
        default: return 'text-indigo-600'
    }
}

export function RegisterTabBar() {
    const { tabs, activeTabId, setActiveTab, closeTab } = useRegisterStore()
    const { lang } = useI18n()
    const locale: Locale = lang === 'ar' ? 'ar' : 'en'
    const t = L[locale]
    const scrollRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to active tab
    useEffect(() => {
        if (!scrollRef.current) return
        const activeEl = scrollRef.current.querySelector(`[data-tab-id="${CSS.escape(activeTabId)}"]`) as HTMLElement | null
        activeEl?.scrollIntoView({ inline: 'nearest', behavior: 'smooth' })
    }, [activeTabId])

    if (tabs.length <= 1) return null // Only accounts tab = no bar needed

    return (
        <div className="border-b border-gray-200 bg-white">
            <div
                ref={scrollRef}
                className="flex items-end gap-0 overflow-x-auto scrollbar-none"
                role="tablist"
            >
                {tabs.map((tab) => {
                    const active = tab.id === activeTabId
                    const isAccountsTab = tab.id === ACCOUNTS_TAB.id
                    const label = isAccountsTab ? t.accounts : tab.label

                    return (
                        <div
                            key={tab.id}
                            data-tab-id={tab.id}
                            role="tab"
                            aria-selected={active}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'group relative flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors select-none whitespace-nowrap',
                                active
                                    ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700'
                                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700'
                            )}
                        >
                            <span className={cn('shrink-0', active ? rootTypeColor(tab.rootType) : 'text-gray-400')}>
                                {tabIcon(tab)}
                            </span>
                            <span className="max-w-[140px] truncate">{label}</span>
                            {!isAccountsTab && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                                    className={cn(
                                        'ms-1 inline-flex h-4 w-4 items-center justify-center rounded-sm transition-colors',
                                        active
                                            ? 'text-indigo-500 hover:bg-indigo-200 hover:text-indigo-700'
                                            : 'text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-200 hover:text-gray-600'
                                    )}
                                    aria-label={t.closeTab}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
