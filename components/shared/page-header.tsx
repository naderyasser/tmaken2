'use client'

/**
 * PageHeader — the standard heading block for every HR screen (Jisr redesign).
 *
 * Title + optional description, an optional tinted-teal icon square, an actions
 * slot pinned to the inline-end, an optional breadcrumb trail on top, and an
 * optional `children` slot below (used for a SegmentedControl / tab row).
 *
 * Token-only + logical RTL: mirrors automatically under dir="rtl".
 */

import * as React from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'
import { useBreadcrumbs } from '@/lib/breadcrumbs'

export interface PageHeaderProps {
  title: string
  description?: string
  icon?: LucideIcon
  /** Render the breadcrumb trail (from useBreadcrumbs) above the title. */
  breadcrumbs?: boolean
  /** Right-aligned (inline-end) actions — buttons, menus, etc. */
  actions?: React.ReactNode
  /** Extra content below the title row (e.g. a SegmentedControl). */
  children?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  breadcrumbs = false,
  actions,
  children,
  className,
}: PageHeaderProps) {
  const { isRTL } = useI18n()
  // Hooks must run unconditionally; we only render the trail when asked.
  const crumbs = useBreadcrumbs()
  const Chevron = isRTL ? ChevronLeft : ChevronRight

  return (
    <header className={cn('mb-6', className)}>
      {breadcrumbs && crumbs.length > 1 && (
        <nav aria-label="breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {crumbs.map((crumb, idx) => {
              const isLast = idx === crumbs.length - 1
              return (
                <li key={idx} className="flex items-center gap-1">
                  {idx > 0 && <Chevron className="h-3.5 w-3.5 shrink-0 opacity-60" />}
                  {isLast ? (
                    <span className="font-medium text-foreground">{crumb.label}</span>
                  ) : crumb.href ? (
                    <Link href={crumb.href} className="transition-colors hover:text-foreground">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span>{crumb.label}</span>
                  )}
                </li>
              )
            })}
          </ol>
        </nav>
      )}

      <div className="flex items-start gap-3">
        {Icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="ms-auto flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      {children && <div className="mt-4">{children}</div>}
    </header>
  )
}
