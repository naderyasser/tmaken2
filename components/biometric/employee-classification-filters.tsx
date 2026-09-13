'use client'

import { useState, useEffect } from 'react'
import { frappeClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { X } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClassificationFilters {
    branch?: string
    gender?: string
    nationality?: string
    work_shift_system?: string
}

interface Props {
    /** Branch list — pass from parent (already loaded via adms.get_branches) */
    branches: string[]
    filters: ClassificationFilters
    onChange: (filters: ClassificationFilters) => void
    /** Hide specific fields when a global filter already fixes them */
    hideBranch?: boolean
}

// Static Gender options — English values (stored in DB), Arabic labels
const GENDER_OPTIONS = [
    { value: 'Male', label: 'ذكر' },
    { value: 'Female', label: 'أنثى' },
    { value: 'Other', label: 'أخرى' },
]

// Static Work Shift System options (must match Select field options in fixture)
const SHIFT_OPTIONS = [
    { value: 'فترة واحدة', label: 'فترة واحدة' },
    { value: 'فترتين', label: 'فترتين' },
]

const UNSET = '__unset__'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmployeeClassificationFilters({
    branches,
    filters,
    onChange,
    hideBranch = false,
}: Props) {
    const [countries, setCountries] = useState<string[]>([])
    const [loadingCountries, setLoadingCountries] = useState(false)

    // Fetch country list once
    useEffect(() => {
        setLoadingCountries(true)
        frappeClient
            .call<string[]>('frappe.client.get_list', {
                doctype: 'Country',
                fields: ['name'],
                limit_page_length: 300,
                order_by: 'name asc',
            })
            .then((resp: any) => {
                const rows = resp?.message ?? resp?.data ?? []
                setCountries(rows.map((r: any) => (typeof r === 'string' ? r : r.name)))
            })
            .catch(() => {
                // Silently fail — nationality filter just won't show options
            })
            .finally(() => setLoadingCountries(false))
    }, [])

    const set = (key: keyof ClassificationFilters, value: string | undefined) => {
        onChange({ ...filters, [key]: value })
    }

    const hasAnyFilter =
        !!filters.branch || !!filters.gender || !!filters.nationality || !!filters.work_shift_system

    const clearAll = () => onChange({})

    return (
        <div className="flex flex-wrap gap-3 items-end">
            {/* Branch */}
            {!hideBranch && (
                <div className="flex flex-col gap-1 min-w-[140px]">
                    <Label className="text-xs text-muted-foreground font-medium">الفرع</Label>
                    <Select
                        value={filters.branch || UNSET}
                        onValueChange={(v) => set('branch', v === UNSET ? undefined : v)}
                    >
                        <SelectTrigger aria-label="كل الفروع" className="h-9 text-sm">
                            <SelectValue placeholder="كل الفروع" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={UNSET}>كل الفروع</SelectItem>
                            {branches.map((b) => (
                                <SelectItem key={b} value={b}>
                                    {b}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Gender */}
            <div className="flex flex-col gap-1 min-w-[120px]">
                <Label className="text-xs text-muted-foreground font-medium">الجنس</Label>
                <Select
                    value={filters.gender || UNSET}
                    onValueChange={(v) => set('gender', v === UNSET ? undefined : v)}
                >
                    <SelectTrigger aria-label="الكل" className="h-9 text-sm">
                        <SelectValue placeholder="الكل" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={UNSET}>الكل</SelectItem>
                        {GENDER_OPTIONS.map((g) => (
                            <SelectItem key={g.value} value={g.value}>
                                {g.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Nationality */}
            <div className="flex flex-col gap-1 min-w-[150px]">
                <Label className="text-xs text-muted-foreground font-medium">الجنسية</Label>
                <Select
                    value={filters.nationality || UNSET}
                    onValueChange={(v) => set('nationality', v === UNSET ? undefined : v)}
                    disabled={loadingCountries}
                >
                    <SelectTrigger aria-label={loadingCountries ? 'جاري التحميل…' : 'الكل'} className="h-9 text-sm">
                        <SelectValue placeholder={loadingCountries ? 'جاري التحميل…' : 'الكل'} />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                        <SelectItem value={UNSET}>الكل</SelectItem>
                        {countries.map((c) => (
                            <SelectItem key={c} value={c}>
                                {c}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Work Shift System */}
            <div className="flex flex-col gap-1 min-w-[140px]">
                <Label className="text-xs text-muted-foreground font-medium">نظام الوردية</Label>
                <Select
                    value={filters.work_shift_system || UNSET}
                    onValueChange={(v) => set('work_shift_system', v === UNSET ? undefined : v)}
                >
                    <SelectTrigger aria-label="الكل" className="h-9 text-sm">
                        <SelectValue placeholder="الكل" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={UNSET}>الكل</SelectItem>
                        {SHIFT_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                                {s.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Clear button */}
            {hasAnyFilter && (
                <div className="flex flex-col justify-end">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAll}
                        className="h-9 text-xs text-muted-foreground hover:text-red-600 gap-1"
                    >
                        <X className="h-3.5 w-3.5" />
                        مسح الفلاتر
                    </Button>
                </div>
            )}
        </div>
    )
}
