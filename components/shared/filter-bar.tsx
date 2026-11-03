'use client'

/**
 * FilterBar — the sticky toolbar row under a PageHeader on list screens.
 * Optional leading search box, a `children` slot for the caller's Selects /
 * date inputs / BranchSwitcher, and an optional reset control. Token-only +
 * logical RTL (search icon sits at the inline-start via `start-3`).
 */

import * as React from 'react'
import { Search, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export interface FilterBarProps {
  search?: { value: string; onChange: (v: string) => void; placeholder?: string }
  onReset?: () => void
  /** Optional visible label for the reset button; icon-only (with aria-label) if omitted. */
  resetLabel?: string
  children?: React.ReactNode
  className?: string
}

export function FilterBar({ search, onReset, resetLabel, children, className }: FilterBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {search && (
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder}
            className="ps-9"
          />
        </div>
      )}
      {children}
      {onReset && (
        <Button
          type="button"
          variant="ghost"
          size={resetLabel ? 'sm' : 'icon'}
          onClick={onReset}
          aria-label={resetLabel ? undefined : 'reset'}
          className={cn(!resetLabel && 'h-9 w-9')}
        >
          <RotateCcw className="h-4 w-4" />
          {resetLabel && <span>{resetLabel}</span>}
        </Button>
      )}
    </div>
  )
}
