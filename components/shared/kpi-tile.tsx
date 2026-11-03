'use client'

/**
 * KpiTile — a single stat card for HR dashboards / KPI rows (Jisr redesign).
 *
 * White card with one soft elevation (shadow-card), a large tabular-nums value,
 * an optional trend delta, and an optional tinted icon square whose tint follows
 * `tone`. Becomes a real <button> when `onClick` is passed; renders skeletons
 * when `loading`. Token-only + logical RTL.
 */

import * as React from 'react'
import { ArrowUp, ArrowDown, Minus, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info'

export interface KpiTileProps {
  label: string
  value: React.ReactNode
  delta?: { value: string | number; direction: 'up' | 'down' | 'flat' }
  icon?: LucideIcon
  tone?: Tone
  loading?: boolean
  onClick?: () => void
  className?: string
}

const TONE_TINT: Record<Tone, string> = {
  default: 'bg-accent text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-destructive/10 text-destructive',
  info: 'bg-info/10 text-info',
}

const DELTA_STYLE = {
  up: { Icon: ArrowUp, cls: 'text-success' },
  down: { Icon: ArrowDown, cls: 'text-destructive' },
  flat: { Icon: Minus, cls: 'text-muted-foreground' },
} as const

const CARD_BASE = 'rounded-lg border border-border bg-card text-card-foreground shadow-card p-4 sm:p-5'

export function KpiTile({
  label,
  value,
  delta,
  icon: Icon,
  tone = 'default',
  loading = false,
  onClick,
  className,
}: KpiTileProps) {
  if (loading) {
    return (
      <div className={cn(CARD_BASE, className)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-16" />
          </div>
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
      </div>
    )
  }

  const deltaInfo = delta ? DELTA_STYLE[delta.direction] : null

  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
        {delta && deltaInfo && (
          <p className={cn('mt-1 flex items-center gap-1 text-xs font-medium', deltaInfo.cls)}>
            <deltaInfo.Icon className="h-3.5 w-3.5" />
            <span className="tabular-nums">{delta.value}</span>
          </p>
        )}
      </div>
      {Icon && (
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', TONE_TINT[tone])}>
          <Icon className="h-5 w-5" />
        </span>
      )}
    </div>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          CARD_BASE,
          'hr-lift w-full cursor-pointer text-start hover:shadow-card-hover focus-visible:outline-none',
          className,
        )}
      >
        {body}
      </button>
    )
  }

  return <div className={cn(CARD_BASE, className)}>{body}</div>
}
