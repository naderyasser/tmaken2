'use client'

/**
 * Data-quality flags — a small amber badge that surfaces rows missing key
 * fields (phone, region, stage…). Sections compute the flags per row and render
 * <DataQualityFlags> in a column; a "Complete data" row action opens the edit
 * form to fix them. Uses a native title tooltip (no TooltipProvider dependency).
 */

import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface DataFlag {
  key: string
  label: string
}

/** Keep only the specs whose `missing` is true. */
export function missingFlags(
  specs: { key: string; label: string; missing: boolean }[],
): DataFlag[] {
  return specs.filter((s) => s.missing).map((s) => ({ key: s.key, label: s.label }))
}

export function DataQualityFlags({
  flags,
  isRTL,
  className,
}: {
  flags: DataFlag[]
  isRTL?: boolean
  className?: string
}) {
  if (!flags.length) return null
  const text =
    (isRTL ? 'حقول ناقصة: ' : 'Missing: ') + flags.map((f) => f.label).join(isRTL ? '، ' : ', ')
  return (
    <span title={text} aria-label={text} className="inline-flex">
      <Badge
        variant="outline"
        className={cn('gap-1 border-amber-300 bg-amber-50 text-amber-700', className)}
      >
        <AlertTriangle className="h-3 w-3" />
        {flags.length}
      </Badge>
    </span>
  )
}
