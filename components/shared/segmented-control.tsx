'use client'

/**
 * SegmentedControl — Jisr-style pill tabs (My Requests / Tasks / …, status
 * filters, lifecycle segments). Optional per-option count badge. One line,
 * scrolls horizontally on overflow. Token-only + logical RTL (flex flips by dir).
 */

import * as React from 'react'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SegmentOption {
  id: string
  label: string
  count?: number
  icon?: LucideIcon
}

export interface SegmentedControlProps {
  options: SegmentOption[]
  value: string
  onChange: (id: string) => void
  size?: 'sm' | 'md'
  className?: string
}

export function SegmentedControl({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: SegmentedControlProps) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-muted p-1 scrollbar-thin',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.id === value
        const Icon = opt.icon
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-current={active ? 'true' : undefined}
            onClick={() => onChange(opt.id)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              pad,
              active
                ? 'bg-card text-primary font-semibold shadow-sm ring-1 ring-border/70'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            <span>{opt.label}</span>
            {typeof opt.count === 'number' && (
              <span
                className={cn(
                  'ms-0.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums',
                  active ? 'bg-accent text-primary' : 'bg-background text-muted-foreground',
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
