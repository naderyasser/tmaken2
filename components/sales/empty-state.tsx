'use client'

import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Shared empty state for the sales admin: icon + title + optional hint/action.
 * Use inside table bodies via a full-colspan cell, or standalone in cards.
 */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  compact = false,
  className,
}: {
  icon?: ComponentType<{ className?: string }>
  title: string
  hint?: string
  action?: ReactNode
  compact?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'py-6' : 'py-12', className)}>
      {Icon && (
        <div className={cn('rounded-2xl bg-gray-50 flex items-center justify-center mb-3', compact ? 'w-10 h-10' : 'w-14 h-14')}>
          <Icon className={cn('text-gray-300', compact ? 'h-5 w-5' : 'h-7 w-7')} />
        </div>
      )}
      <p className={cn('font-semibold text-gray-500', compact ? 'text-xs' : 'text-sm')}>{title}</p>
      {hint && <p className="text-xs text-gray-400 mt-1 max-w-xs leading-relaxed">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
