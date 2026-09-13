'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'
import type { RailSection } from './routes'

/**
 * The panel shown when hovering a section icon on the COLLAPSED rail. Lists the
 * section's items as links with active state. Rendered inside a portaled
 * HoverCard (see icon-rail) so it escapes the rail's scroll/overflow.
 */
export function RailFlyout({
  section, pathname, moduleParam, onNavigate,
}: {
  section: RailSection
  pathname: string
  moduleParam: string | null
  onNavigate?: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="min-w-[210px] rounded-lg border border-border bg-popover text-popover-foreground shadow-card-hover p-1.5">
      <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t(section.labelKey)}
      </p>
      <div className="space-y-0.5">
        {section.items.map((item) => {
          const active = item.match(pathname, moduleParam)
          const ItemIcon = item.icon
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors',
                active ? 'bg-accent text-primary' : 'text-foreground hover:bg-accent/60',
              )}
            >
              {ItemIcon && <ItemIcon className={cn('h-4 w-4 flex-shrink-0', active ? 'text-primary' : 'text-muted-foreground/70')} />}
              {t(item.labelKey)}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
