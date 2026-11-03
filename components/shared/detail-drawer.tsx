'use client'

/**
 * DetailDrawer — a right/left side panel for record detail views (leave, expense,
 * violation, approval…). Built on components/ui/sheet. Opens from the inline-END
 * edge: in RTL that's the left edge, in LTR the right edge (so it slides in from
 * the reading-end, opposite the nav rail). Header / scrollable body / pinned
 * footer. Token-only.
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'

export interface DetailDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  /** Extra content in the header (e.g. a status badge row). */
  headerExtra?: React.ReactNode
  /** Pinned bottom action bar. */
  footer?: React.ReactNode
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_MAX: Record<NonNullable<DetailDrawerProps['size']>, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
}

export function DetailDrawer({
  open,
  onOpenChange,
  title,
  description,
  headerExtra,
  footer,
  children,
  size = 'md',
  className,
}: DetailDrawerProps) {
  const { isRTL } = useI18n()
  // Inline-end edge: left in RTL, right in LTR.
  const side = isRTL ? 'left' : 'right'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn('flex w-full flex-col gap-0 p-0', SIZE_MAX[size], className)}
      >
        <SheetHeader className="space-y-2 border-b border-border px-6 pb-4 pt-6 text-start">
          <SheetTitle className="text-start text-lg font-semibold text-foreground">{title}</SheetTitle>
          {description && (
            <SheetDescription className="text-start text-sm text-muted-foreground">
              {description}
            </SheetDescription>
          )}
          {headerExtra}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>

        {footer && (
          <div className="mt-auto flex items-center justify-end gap-2 border-t border-border p-4">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
