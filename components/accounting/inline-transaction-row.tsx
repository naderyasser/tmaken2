'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { accountingApi, type Account } from '@/lib/accounting-api'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/components/ui/use-toast'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { Check, Loader2, X } from 'lucide-react'
import { cn, localToday } from '@/lib/utils'

type Locale = 'ar' | 'en'

const L = {
    en: {
        datePlaceholder: 'Date',
        descPlaceholder: 'Description / memo',
        transferPlaceholder: 'Transfer account...',
        amountPlaceholder: '0.00',
        save: 'Save',
        cancel: 'Cancel',
        saveError: 'Failed to create entry',
        missingFields: 'Account, date and amount are required',
        increase: 'Increase',
        decrease: 'Decrease',
        noMatch: 'No matching accounts',
        recentlyUsed: 'Recently Used',
        allAccounts: 'All Accounts',
        party: 'Party',
        partyPlaceholder: 'Select party...',
        customer: 'Customer',
        supplier: 'Supplier',
    },
    ar: {
        datePlaceholder: 'التاريخ',
        descPlaceholder: 'الوصف / ملاحظة',
        transferPlaceholder: 'الحساب المقابل...',
        amountPlaceholder: '0.00',
        save: 'حفظ',
        cancel: 'إلغاء',
        saveError: 'فشل إنشاء القيد',
        missingFields: 'الحساب والتاريخ والمبلغ مطلوبة',
        increase: 'زيادة',
        decrease: 'نقص',
        noMatch: 'لا توجد حسابات مطابقة',
        recentlyUsed: 'مستخدمة مؤخراً',
        allAccounts: 'كل الحسابات',
        party: 'الطرف',
        partyPlaceholder: 'اختر الطرف...',
        customer: 'عميل',
        supplier: 'مورد',
    },
} as const

function isDebitNature(rootType?: string): boolean {
    return rootType === 'Asset' || rootType === 'Expense'
}

const ROOT_TYPE_COLORS: Record<string, string> = {
    Asset: 'bg-blue-50 text-blue-600',
    Liability: 'bg-rose-50 text-rose-600',
    Equity: 'bg-purple-50 text-purple-600',
    Income: 'bg-emerald-50 text-emerald-600',
    Expense: 'bg-amber-50 text-amber-600',
}

// Account types that can only be updated via Stock Transactions (not JEs)
const STOCK_ACCOUNT_TYPES = new Set(['Stock', 'Stock Received But Not Billed', 'Stock Adjustment'])

/** Build a hierarchy path map: account name → "Parent > Child" */
function buildPathMap(accounts: Account[]): Map<string, string> {
    const parentMap = new Map<string, string>()
    for (const a of accounts) {
        if (a.parent_account) parentMap.set(a.name, a.parent_account)
    }
    const nameMap = new Map<string, string>()
    for (const a of accounts) {
        nameMap.set(a.name, a.account_name)
    }
    const pathCache = new Map<string, string>()
    function getPath(name: string, depth = 0): string {
        if (depth > 10) return nameMap.get(name) ?? name
        if (pathCache.has(name)) return pathCache.get(name)!
        const parent = parentMap.get(name)
        const display = nameMap.get(name) ?? name
        const path = parent ? `${getPath(parent, depth + 1)}:${display}` : display
        pathCache.set(name, path)
        return path
    }
    const result = new Map<string, string>()
    for (const a of accounts) {
        result.set(a.name, getPath(a.name))
    }
    return result
}

/** Highlight matching substring in text */
function highlightMatch(text: string, query: string): React.ReactNode {
    if (!query.trim()) return text
    const lower = text.toLowerCase()
    const idx = lower.indexOf(query.toLowerCase())
    if (idx === -1) return text
    return (
        <>
            {text.slice(0, idx)}
            <mark className="bg-amber-200/60 text-inherit rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
            {text.slice(idx + query.length)}
        </>
    )
}

// ── Recently used accounts (session-level, shared across instances) ──
const RECENT_ACCOUNTS_KEY = '__gnucash_recent_accounts__'
function getRecentAccounts(): string[] {
    try {
        return JSON.parse(sessionStorage.getItem(RECENT_ACCOUNTS_KEY) || '[]')
    } catch { return [] }
}
function addRecentAccount(accountId: string) {
    const recent = getRecentAccounts().filter(id => id !== accountId)
    recent.unshift(accountId)
    sessionStorage.setItem(RECENT_ACCOUNTS_KEY, JSON.stringify(recent.slice(0, 20)))
}

/** Determine party_type from account_type */
function partyTypeForAccount(accountType?: string): 'Customer' | 'Supplier' | null {
    if (accountType === 'Receivable') return 'Customer'
    if (accountType === 'Payable') return 'Supplier'
    return null
}

interface InlineTransactionRowProps {
    currentAccountId: string
    currentAccountName: string
    rootType?: string
    currentAccountType?: string
    company: string
    accounts: Account[]
    allAccounts?: Account[] // includes groups, for path building
    locale: Locale
    onSave: () => void | Promise<void>
    onCancel: () => void
}

export function InlineTransactionRow({
    currentAccountId,
    currentAccountName,
    rootType,
    currentAccountType,
    company,
    accounts,
    allAccounts,
    locale,
    onSave,
    onCancel,
}: InlineTransactionRowProps) {
    const { toast } = useToast()
    const t = L[locale]
    const isDebit = isDebitNature(rootType)

    const [date, setDate] = useState(() => localToday())
    const [description, setDescription] = useState('')
    const [transferQuery, setTransferQuery] = useState('')
    const [transferAccount, setTransferAccount] = useState<Account | null>(null)
    const [increase, setIncrease] = useState('')
    const [decrease, setDecrease] = useState('')
    const [saving, setSaving] = useState(false)
    const [showDropdown, setShowDropdown] = useState(false)
    const [highlightIndex, setHighlightIndex] = useState(-1)
    const [userNavigated, setUserNavigated] = useState(false)
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)

    // ── Party picker state (for Receivable/Payable accounts) ──
    const [partyQuery, setPartyQuery] = useState('')
    const [party, setParty] = useState('')
    const [partySuggestions, setPartySuggestions] = useState<string[]>([])
    const [showPartyDropdown, setShowPartyDropdown] = useState(false)
    const [partyHighlight, setPartyHighlight] = useState(-1)
    const [partyDropdownPos, setPartyDropdownPos] = useState<{ top: number; left: number } | null>(null)
    const partyRef = useRef<HTMLInputElement>(null)
    const partyDropdownRef = useRef<HTMLDivElement>(null)

    const dateRef = useRef<HTMLInputElement>(null)
    const transferRef = useRef<HTMLInputElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const listRef = useRef<HTMLDivElement>(null)

    // Build hierarchy paths for display like GnuCash "Expenses:Office Supplies"
    const pathMap = useMemo(
        () => buildPathMap(allAccounts ?? accounts),
        [allAccounts, accounts]
    )

    // Focus date field on mount
    useEffect(() => {
        dateRef.current?.focus()
    }, [])

    // Recompute dropdown position when it opens or on scroll/resize
    const updateDropdownPos = useCallback(() => {
        if (transferRef.current) {
            const rect = transferRef.current.getBoundingClientRect()
            setDropdownPos({ top: rect.bottom + 4, left: rect.left })
        }
    }, [])

    useEffect(() => {
        if (!showDropdown) return
        updateDropdownPos()
        const scrollParent = transferRef.current?.closest('.overflow-auto')
        scrollParent?.addEventListener('scroll', updateDropdownPos)
        window.addEventListener('scroll', updateDropdownPos, true)
        window.addEventListener('resize', updateDropdownPos)
        return () => {
            scrollParent?.removeEventListener('scroll', updateDropdownPos)
            window.removeEventListener('scroll', updateDropdownPos, true)
            window.removeEventListener('resize', updateDropdownPos)
        }
    }, [showDropdown, updateDropdownPos])

    // Close dropdown when clicking outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    // Filter & sort accounts — GnuCash style: recently used first, then alphabetical by path
    const filteredAccounts = useMemo(() => {
        const q = transferQuery.trim().toLowerCase()
        const recent = getRecentAccounts()

        let candidates = accounts.filter(a => {
            if (a.name === currentAccountId) return false
            if (a.is_group) return false
            // Stock accounts can only be updated via Stock Transactions, not JEs
            if (a.account_type && STOCK_ACCOUNT_TYPES.has(a.account_type)) return false
            if (!q) return true
            const path = (pathMap.get(a.name) ?? a.account_name).toLowerCase()
            const name = a.account_name.toLowerCase()
            const code = a.name.toLowerCase()
            return path.includes(q) || name.includes(q) || code.includes(q)
        })

        // Sort: recently used first, then by hierarchy path
        candidates.sort((a, b) => {
            const aRecent = recent.indexOf(a.name)
            const bRecent = recent.indexOf(b.name)
            if (aRecent !== -1 && bRecent !== -1) return aRecent - bRecent
            if (aRecent !== -1) return -1
            if (bRecent !== -1) return 1
            const aPath = pathMap.get(a.name) ?? a.account_name
            const bPath = pathMap.get(b.name) ?? b.account_name
            return aPath.localeCompare(bPath, locale)
        })

        return candidates.slice(0, 30)
    }, [accounts, transferQuery, currentAccountId, pathMap, locale])

    // Reset highlight when filter changes — don't pre-select anything
    useEffect(() => {
        setHighlightIndex(-1)
        setUserNavigated(false)
    }, [transferQuery])

    // Scroll highlighted item into view
    useEffect(() => {
        if (!listRef.current) return
        const el = listRef.current.children[highlightIndex] as HTMLElement | undefined
        el?.scrollIntoView({ block: 'nearest' })
    }, [highlightIndex])

    // Determine which account lines need party
    const currentNeedsParty = partyTypeForAccount(currentAccountType)
    const transferNeedsParty = partyTypeForAccount(transferAccount?.account_type)
    const needsParty = currentNeedsParty || transferNeedsParty
    const partyType = transferNeedsParty || currentNeedsParty
    const partyDoctype = partyType === 'Customer' ? 'Customer' : partyType === 'Supplier' ? 'Supplier' : null

    // Fetch party suggestions when query changes
    useEffect(() => {
        if (!partyDoctype || !showPartyDropdown) return
        const q = partyQuery.trim()
        let cancelled = false
        frappeClient.getList<{ name: string }>(partyDoctype, {
            fields: ['name'],
            filters: q ? [[partyDoctype, 'name', 'like', `%${q}%`]] : [],
            limit_page_length: 20,
            order_by: 'name asc',
        }).then(result => {
            if (!cancelled) setPartySuggestions(result.map(r => r.name))
        }).catch(() => { if (!cancelled) setPartySuggestions([]) })
        return () => { cancelled = true }
    }, [partyQuery, partyDoctype, showPartyDropdown])

    // Position party dropdown
    const updatePartyDropdownPos = useCallback(() => {
        if (partyRef.current) {
            const rect = partyRef.current.getBoundingClientRect()
            setPartyDropdownPos({ top: rect.bottom + 4, left: rect.left })
        }
    }, [])

    useEffect(() => {
        if (!showPartyDropdown) return
        updatePartyDropdownPos()
        const scrollParent = partyRef.current?.closest('.overflow-auto')
        scrollParent?.addEventListener('scroll', updatePartyDropdownPos)
        window.addEventListener('scroll', updatePartyDropdownPos, true)
        window.addEventListener('resize', updatePartyDropdownPos)
        return () => {
            scrollParent?.removeEventListener('scroll', updatePartyDropdownPos)
            window.removeEventListener('scroll', updatePartyDropdownPos, true)
            window.removeEventListener('resize', updatePartyDropdownPos)
        }
    }, [showPartyDropdown, updatePartyDropdownPos])

    // Close party dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (partyDropdownRef.current && !partyDropdownRef.current.contains(e.target as Node)) {
                setShowPartyDropdown(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const handleSelectParty = useCallback((p: string) => {
        setParty(p)
        setPartyQuery(p)
        setShowPartyDropdown(false)
    }, [])

    // Reset party when transfer changes and doesn't need party anymore
    useEffect(() => {
        if (!needsParty) {
            setParty('')
            setPartyQuery('')
        }
    }, [needsParty])

    const handleSelectTransfer = useCallback((acct: Account) => {
        setTransferAccount(acct)
        setTransferQuery(pathMap.get(acct.name) ?? acct.account_name)
        setShowDropdown(false)
        addRecentAccount(acct.name)
        // If newly selected account needs party, focus the party field
        if (partyTypeForAccount(acct.account_type)) {
            setTimeout(() => partyRef.current?.focus(), 50)
        }
    }, [pathMap])

    const handleSave = useCallback(async () => {
        if (!transferAccount || !date) {
            toast({ title: t.missingFields, variant: 'destructive' })
            return
        }

        // Validate party is set when needed
        if (needsParty && !party) {
            toast({ title: t.missingFields, variant: 'destructive' })
            return
        }

        const increaseAmt = parseFloat(increase) || 0
        const decreaseAmt = parseFloat(decrease) || 0
        if (increaseAmt === 0 && decreaseAmt === 0) {
            toast({ title: t.missingFields, variant: 'destructive' })
            return
        }

        let currentDebit = 0, currentCredit = 0
        let transferDebit = 0, transferCredit = 0

        if (increaseAmt > 0) {
            if (isDebit) {
                currentDebit = increaseAmt
                transferCredit = increaseAmt
            } else {
                currentCredit = increaseAmt
                transferDebit = increaseAmt
            }
        } else if (decreaseAmt > 0) {
            if (isDebit) {
                currentCredit = decreaseAmt
                transferDebit = decreaseAmt
            } else {
                currentDebit = decreaseAmt
                transferCredit = decreaseAmt
            }
        }

        // Build JE account lines with party when needed
        const currentLine: {
            account: string
            debit_in_account_currency?: number
            credit_in_account_currency?: number
            party_type?: string
            party?: string
        } = {
            account: currentAccountId,
            debit_in_account_currency: currentDebit || undefined,
            credit_in_account_currency: currentCredit || undefined,
        }
        const transferLine: {
            account: string
            debit_in_account_currency?: number
            credit_in_account_currency?: number
            party_type?: string
            party?: string
        } = {
            account: transferAccount.name,
            debit_in_account_currency: transferDebit || undefined,
            credit_in_account_currency: transferCredit || undefined,
        }

        // Attach party to the correct line(s)
        if (currentNeedsParty && party) {
            currentLine.party_type = currentNeedsParty
            currentLine.party = party
        }
        if (transferNeedsParty && party) {
            transferLine.party_type = transferNeedsParty
            transferLine.party = party
        }

        try {
            setSaving(true)

            const je = await accountingApi.createJournalEntry({
                company,
                posting_date: date,
                voucher_type: 'Journal Entry',
                user_remark: description || undefined,
                accounts: [currentLine, transferLine],
            })

            await accountingApi.submitJournalEntry(je.name)
            addRecentAccount(transferAccount.name)
            await onSave()
        } catch (err: any) {
            toast({
                title: t.saveError,
                description: err?.message ?? '',
                variant: 'destructive',
            })
        } finally {
            setSaving(false)
        }
    }, [transferAccount, date, increase, decrease, isDebit, company, currentAccountId, description, onSave, toast, t, needsParty, party, currentNeedsParty, transferNeedsParty])

    // Handle keyboard in transfer field — GnuCash style navigation
    // Enter does NOT auto-select. User must use Tab or click to pick an account.
    // Arrow keys navigate the list; Tab accepts the highlighted item.
    const handleTransferKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!showDropdown || filteredAccounts.length === 0) {
            if (e.key === 'Enter' && !saving) { e.preventDefault(); void handleSave() }
            if (e.key === 'Escape') onCancel()
            return
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setUserNavigated(true)
                setHighlightIndex(prev => {
                    const next = prev + 1
                    return next >= filteredAccounts.length ? 0 : next
                })
                break
            case 'ArrowUp':
                e.preventDefault()
                setUserNavigated(true)
                setHighlightIndex(prev => {
                    const next = prev - 1
                    return next < 0 ? filteredAccounts.length - 1 : next
                })
                break
            case 'Tab':
                // Tab always selects the highlighted item (or first if nothing highlighted)
                if (filteredAccounts.length > 0) {
                    e.preventDefault()
                    const idx = highlightIndex >= 0 ? highlightIndex : 0
                    handleSelectTransfer(filteredAccounts[idx])
                }
                break
            case 'Enter':
                // Enter only selects if user explicitly navigated with arrow keys
                if (userNavigated && highlightIndex >= 0 && filteredAccounts[highlightIndex]) {
                    e.preventDefault()
                    handleSelectTransfer(filteredAccounts[highlightIndex])
                }
                // Otherwise, Enter does nothing in the transfer field (don't save yet)
                // User needs to Tab to select first, then Enter in amount fields to save
                e.preventDefault()
                break
            case 'Escape':
                e.preventDefault()
                setShowDropdown(false)
                setUserNavigated(false)
                break
        }
    }, [showDropdown, filteredAccounts, highlightIndex, userNavigated, handleSelectTransfer, handleSave, onCancel, saving])

    // Handle Enter/Escape in other fields
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !saving) {
            e.preventDefault()
            void handleSave()
        }
        if (e.key === 'Escape') {
            onCancel()
        }
    }, [handleSave, onCancel, saving])

    return (
        <TableRow className="bg-amber-50/40 border-t-2 border-amber-200 hover:bg-amber-50/60">
            {/* Date */}
            <TableCell className="p-1">
                <Input
                    ref={dateRef}
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="h-7 text-xs border-amber-200 bg-white focus:border-indigo-400"
                    disabled={saving}
                />
            </TableCell>

            {/* Num (auto-generated) */}
            <TableCell className="p-1">
                <span className="text-[10px] italic text-slate-400">auto</span>
            </TableCell>

            {/* Description */}
            <TableCell className="p-1">
                <Input
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t.descPlaceholder}
                    className="h-7 text-xs border-amber-200 bg-white focus:border-indigo-400"
                    disabled={saving}
                />
            </TableCell>

            {/* Transfer account picker — GnuCash style */}
            <TableCell className="p-1">
                <div className="relative" ref={dropdownRef}>
                    <Input
                        ref={transferRef}
                        value={transferQuery}
                        onChange={e => {
                            setTransferQuery(e.target.value)
                            setTransferAccount(null)
                            setShowDropdown(true)
                        }}
                        onFocus={() => setShowDropdown(true)}
                        onKeyDown={handleTransferKeyDown}
                        placeholder={t.transferPlaceholder}
                        autoComplete="off"
                        className={cn(
                            'h-7 text-xs border-amber-200 bg-white focus:border-indigo-400',
                            transferAccount && 'border-emerald-300 bg-emerald-50/70 font-medium text-emerald-800'
                        )}
                        disabled={saving}
                    />
                    {showDropdown && dropdownPos && (
                        <div
                            className="fixed z-[9999] w-80 rounded-lg border border-gray-200 bg-white shadow-xl ring-1 ring-black/5"
                            style={{ top: dropdownPos.top, left: dropdownPos.left }}
                        >
                            {filteredAccounts.length === 0 ? (
                                <div className="px-3 py-4 text-center text-xs text-slate-400">{t.noMatch}</div>
                            ) : (
                                <div ref={listRef} className="max-h-64 overflow-auto py-1">
                                    {filteredAccounts.map((acct, idx) => {
                                        const path = pathMap.get(acct.name) ?? acct.account_name
                                        const isHighlighted = idx === highlightIndex
                                        const recent = getRecentAccounts()
                                        const isRecent = recent.includes(acct.name)

                                        return (
                                            <button
                                                key={acct.name}
                                                type="button"
                                                className={cn(
                                                    'flex w-full items-center gap-2 px-3 py-1.5 text-start transition-colors',
                                                    isHighlighted
                                                        ? 'bg-indigo-50 text-indigo-900'
                                                        : 'text-slate-700 hover:bg-slate-50'
                                                )}
                                                onMouseEnter={() => setHighlightIndex(idx)}
                                                onClick={() => handleSelectTransfer(acct)}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <p className="truncate text-xs font-medium">
                                                        {highlightMatch(path, transferQuery)}
                                                    </p>
                                                    {acct.account_number && (
                                                        <p className="truncate text-[10px] text-slate-400 font-mono">{acct.account_number}</p>
                                                    )}
                                                </div>
                                                {isRecent && (
                                                    <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-medium bg-slate-100 text-slate-500">
                                                        ↻
                                                    </span>
                                                )}
                                                {acct.root_type && (
                                                    <span className={cn(
                                                        'shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold',
                                                        ROOT_TYPE_COLORS[acct.root_type] ?? 'bg-slate-50 text-slate-600',
                                                    )}>
                                                        {acct.root_type}
                                                    </span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                            <div className="border-t border-gray-100 px-3 py-1.5 text-[10px] text-slate-400">
                                ↑↓ navigate &nbsp;·&nbsp; Tab select &nbsp;·&nbsp; Esc close
                            </div>
                        </div>
                    )}
                </div>
                {/* Party picker — shown when Receivable/Payable account is used */}
                {needsParty && (
                    <div className="relative mt-1" ref={partyDropdownRef}>
                        <Input
                            ref={partyRef}
                            value={partyQuery}
                            onChange={e => {
                                setPartyQuery(e.target.value)
                                setParty('')
                                setShowPartyDropdown(true)
                            }}
                            onFocus={() => setShowPartyDropdown(true)}
                            onKeyDown={e => {
                                if (!showPartyDropdown || partySuggestions.length === 0) {
                                    if (e.key === 'Enter' && !saving) { e.preventDefault(); void handleSave() }
                                    if (e.key === 'Escape') { onCancel(); e.preventDefault() }
                                    return
                                }
                                switch (e.key) {
                                    case 'ArrowDown':
                                        e.preventDefault()
                                        setPartyHighlight(prev => (prev + 1) >= partySuggestions.length ? 0 : prev + 1)
                                        break
                                    case 'ArrowUp':
                                        e.preventDefault()
                                        setPartyHighlight(prev => prev <= 0 ? partySuggestions.length - 1 : prev - 1)
                                        break
                                    case 'Tab':
                                    case 'Enter':
                                        if (partySuggestions.length > 0) {
                                            e.preventDefault()
                                            const idx = partyHighlight >= 0 ? partyHighlight : 0
                                            handleSelectParty(partySuggestions[idx])
                                        }
                                        break
                                    case 'Escape':
                                        e.preventDefault()
                                        setShowPartyDropdown(false)
                                        break
                                }
                            }}
                            placeholder={`${partyType === 'Customer' ? t.customer : t.supplier}: ${t.partyPlaceholder}`}
                            autoComplete="off"
                            className={cn(
                                'h-6 text-[11px] border-amber-200 bg-white focus:border-indigo-400',
                                party && 'border-emerald-300 bg-emerald-50/70 font-medium text-emerald-800'
                            )}
                            disabled={saving}
                        />
                        {showPartyDropdown && partyDropdownPos && partySuggestions.length > 0 && (
                            <div
                                className="fixed z-[9999] w-64 rounded-lg border border-gray-200 bg-white shadow-xl ring-1 ring-black/5"
                                style={{ top: partyDropdownPos.top, left: partyDropdownPos.left }}
                            >
                                <div className="max-h-48 overflow-auto py-1">
                                    {partySuggestions.map((p, idx) => (
                                        <button
                                            key={p}
                                            type="button"
                                            className={cn(
                                                'flex w-full items-center px-3 py-1.5 text-start text-xs transition-colors',
                                                idx === partyHighlight
                                                    ? 'bg-indigo-50 text-indigo-900'
                                                    : 'text-slate-700 hover:bg-slate-50'
                                            )}
                                            onMouseEnter={() => setPartyHighlight(idx)}
                                            onClick={() => handleSelectParty(p)}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </TableCell>

            {/* Reconciled */}
            <TableCell className="p-1 text-center">
                <span className="text-[10px] text-slate-400">n</span>
            </TableCell>

            {/* Increase */}
            <TableCell className="p-1">
                <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={increase}
                    onChange={e => { setIncrease(e.target.value); if (e.target.value) setDecrease('') }}
                    onKeyDown={handleKeyDown}
                    placeholder={t.amountPlaceholder}
                    className="h-7 w-full text-xs text-end tabular-nums border-amber-200 bg-white focus:border-emerald-400"
                    disabled={saving || !!decrease}
                />
            </TableCell>

            {/* Decrease */}
            <TableCell className="p-1">
                <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={decrease}
                    onChange={e => { setDecrease(e.target.value); if (e.target.value) setIncrease('') }}
                    onKeyDown={handleKeyDown}
                    placeholder={t.amountPlaceholder}
                    className="h-7 w-full text-xs text-end tabular-nums border-amber-200 bg-white focus:border-rose-400"
                    disabled={saving || !!increase}
                />
            </TableCell>

            {/* Action buttons */}
            <TableCell className="p-1">
                <div className="flex items-center gap-1 justify-end">
                    <Button
                        size="sm"
                        className="h-6 w-6 p-0 bg-emerald-600 hover:bg-emerald-700"
                        onClick={handleSave}
                        disabled={saving || !transferAccount || (!increase && !decrease) || (!!needsParty && !party)}
                    >
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-slate-500 hover:text-red-600"
                        onClick={onCancel}
                        disabled={saving}
                    >
                        <X className="h-3 w-3" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    )
}
