'use client'

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

// ═══════════════════════════════════════════════════════════════════
// Tab state management for GnuCash-style account register tabs
// ═══════════════════════════════════════════════════════════════════

export interface RegisterTab {
    /** Account doctype name (unique key), or '__accounts__' for the tree tab */
    id: string
    /** Display label (account_name) */
    label: string
    /** Account root_type for color coding */
    rootType?: string
    /** Account type (Bank, Cash, Receivable, etc.) */
    accountType?: string
    /** Company name (required for creating journal entries) */
    company?: string
}

/** The permanent first tab — always open */
export const ACCOUNTS_TAB: RegisterTab = {
    id: '__accounts__',
    label: 'Accounts',
    rootType: undefined,
    accountType: undefined,
}

interface RegisterStoreValue {
    tabs: RegisterTab[]
    activeTabId: string
    openTab: (tab: RegisterTab) => void
    closeTab: (tabId: string) => void
    setActiveTab: (tabId: string) => void
}

const RegisterStoreContext = createContext<RegisterStoreValue | null>(null)

export function RegisterStoreProvider({ children }: { children: ReactNode }) {
    const [tabs, setTabs] = useState<RegisterTab[]>([ACCOUNTS_TAB])
    const [activeTabId, setActiveTabId] = useState(ACCOUNTS_TAB.id)

    const openTab = useCallback((tab: RegisterTab) => {
        setTabs(prev => {
            const exists = prev.find(t => t.id === tab.id)
            if (exists) return prev
            return [...prev, tab]
        })
        setActiveTabId(tab.id)
    }, [])

    const closeTab = useCallback((tabId: string) => {
        if (tabId === ACCOUNTS_TAB.id) return // can't close accounts tab
        setTabs(prev => {
            const next = prev.filter(t => t.id !== tabId)
            return next
        })
        setActiveTabId(prev => {
            if (prev === tabId) return ACCOUNTS_TAB.id
            return prev
        })
    }, [])

    const setActiveTab = useCallback((tabId: string) => {
        setActiveTabId(tabId)
    }, [])

    return (
        <RegisterStoreContext.Provider value={{ tabs, activeTabId, openTab, closeTab, setActiveTab }}>
            {children}
        </RegisterStoreContext.Provider>
    )
}

export function useRegisterStore() {
    const ctx = useContext(RegisterStoreContext)
    if (!ctx) throw new Error('useRegisterStore must be used within RegisterStoreProvider')
    return ctx
}
