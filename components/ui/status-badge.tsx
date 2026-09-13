'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getStatusClass } from '@/lib/status-config'

interface StatusBadgeProps {
  /** The status key used to look up colours (e.g. "Pending", "Active"). */
  status: string | undefined | null
  /** Optional display label override. Defaults to `status`. */
  label?: string
  /** Extra Tailwind classes applied to the Badge. */
  className?: string
}

/**
 * Renders a coloured badge for any record status.
 * Colours are driven by `lib/status-config.ts` — update that file,
 * not this component, to change badge colours.
 */
export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <Badge className={cn(getStatusClass(status), 'hover:opacity-90', className)}>
      {label ?? status ?? '—'}
    </Badge>
  )
}
