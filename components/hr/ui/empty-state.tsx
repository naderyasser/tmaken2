import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Compact empty state for panels, drawers, cards and small tables.
 * The full-page Apex list illustration lives in components/hr/apex-empty-state.tsx —
 * use that for a whole empty list, this for everything smaller.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-10 text-center', className)}>
      <span className="flex size-12 items-center justify-center rounded-full bg-[var(--apex-bg)] text-[var(--apex-slate)]">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="text-[15px] font-bold text-[var(--apex-navy)]">{title}</p>
      {description && <p className="max-w-md text-[13px] text-[var(--apex-slate)]">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
