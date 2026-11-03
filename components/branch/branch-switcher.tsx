'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import { getMyBranches } from '@/lib/api'
import { GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BranchSwitcherProps {
    value?: string | null
    onChange?: (branch: string | null) => void
}

interface BranchInfo {
    branch: string
    company: string
    latitude?: number
    longitude?: number
    checkin_radius?: number
}

export function BranchSwitcher({ value, onChange }: BranchSwitcherProps) {
    const { isHRManager } = useAuth()
    const { t, isRTL } = useI18n()
    const [branches, setBranches] = useState<BranchInfo[]>([])
    const [selected, setSelected] = useState<string>(value || 'all')

    useEffect(() => {
        if (!isHRManager) return
        getMyBranches()
            .then((data) => setBranches(data || []))
            .catch(() => setBranches([]))
    }, [isHRManager])

    useEffect(() => {
        setSelected(value || 'all')
    }, [value])

    // Don't render for non-HR managers or if no branches assigned
    if (!isHRManager || branches.length === 0) return null

    const handleChange = (val: string) => {
        setSelected(val)
        onChange?.(val === 'all' ? null : val)
    }

    return (
        <div className={cn(
            'flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm',
            isRTL && 'flex-row-reverse'
        )}>
            <GitBranch className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <select
                value={selected}
                onChange={(e) => handleChange(e.target.value)}
                className={cn(
                    'flex-1 text-sm font-medium text-gray-700 bg-transparent outline-none cursor-pointer appearance-none',
                    isRTL && 'text-right'
                )}
                dir={isRTL ? 'rtl' : 'ltr'}
            >
                <option value="all">{t('branch.all_branches')}</option>
                {branches.map((b) => (
                    <option key={b.branch} value={b.branch}>
                        {b.branch}
                    </option>
                ))}
            </select>
            <svg className="h-4 w-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </div>
    )
}
