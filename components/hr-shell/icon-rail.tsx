'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { PanelLeftClose, PanelLeftOpen, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card'
import { BOTTOM_ITEMS, visibleRailSections, type RailSection } from './routes'
import { RailFlyout } from './rail-flyout'

const RAIL_STORAGE_KEY = 'hr:rail:expanded'

/**
 * Slim vertical navigation rail (Jisr-style). Two modes:
 *  - collapsed (72px): section icons only; hovering an icon opens a portaled
 *    flyout (HoverCard) listing that section's items.
 *  - expanded (264px): labeled sections with their items.
 * Sits on the inline-START edge; because the shell sets `dir`, RTL lands it on
 * the right automatically (logical `border-e`, `start-0`). Reads `?module=` so
 * it must be rendered inside a Suspense boundary (the shell provides one).
 */
export function IconRail() {
  const { t, isRTL } = useI18n()
  const { logout, isHRUser, isManager, myEmployee, hrFingerprintOnly } = useAuth()
  const isEmployee = !isHRUser && !isManager
  const sections = visibleRailSections({ isEmployee, hasEmployee: !!myEmployee, hrFingerprintOnly })
  const pathname = usePathname() || ''
  const searchParams = useSearchParams()
  const moduleParam = searchParams.get('module')
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RAIL_STORAGE_KEY)
      if (saved !== null) setExpanded(saved === '1')
    } catch { /* ignore */ }
  }, [])

  const toggle = () => {
    setExpanded((v) => {
      const next = !v
      try { localStorage.setItem(RAIL_STORAGE_KEY, next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }

  const sectionActive = (section: RailSection) => section.items.some((i) => i.match(pathname, moduleParam))

  // The attendance-only package hides Settings + "Back to hub" (both leave the
  // bundle). Only Logout remains at the bottom. Full-system tenants keep both.
  const bottomItems = hrFingerprintOnly ? [] : BOTTOM_ITEMS

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col bg-sidebar text-sidebar-foreground border-e border-border shrink-0 transition-[width] duration-200 ease-in-out',
        expanded ? 'w-[264px]' : 'w-[72px]',
      )}
    >
      {/* Collapse toggle */}
      <div className={cn('h-14 flex items-center border-b border-border', expanded ? 'px-3 justify-end' : 'justify-center')}>
        <button
          onClick={toggle}
          aria-label="Toggle navigation"
          className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          {expanded
            ? (isRTL ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />)
            : (isRTL ? <PanelLeftClose className="h-[18px] w-[18px]" /> : <PanelLeftOpen className="h-[18px] w-[18px]" />)}
        </button>
      </div>

      {/* Sections */}
      <nav className={cn('flex-1 overflow-y-auto scrollbar-thin py-3', expanded ? 'px-2 space-y-1' : 'px-0 space-y-1')}>
        {sections.map((section) => {
          const Icon = section.icon
          if (expanded) {
            return (
              <div key={section.id} className="pt-3 first:pt-0 mt-1 first:mt-0 border-t border-border/60 first:border-t-0">
                {/* Group header — section icon + bolder, wider-tracked label for clearer hierarchy */}
                <div className="px-3 mt-2 mb-1.5 flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground/70 flex-shrink-0" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/90">{t(section.labelKey)}</p>
                </div>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = item.match(pathname, moduleParam)
                    const ItemIcon = item.icon
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        className={cn(
                          'relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors',
                          active
                            ? 'bg-accent text-primary font-semibold'
                            : 'text-sidebar-foreground/80 hover:bg-accent/60 hover:text-foreground font-medium',
                        )}
                      >
                        {active && <span className="absolute top-1/2 -translate-y-1/2 start-0 w-[3px] h-5 rounded-e-full bg-primary" />}
                        {ItemIcon && <ItemIcon className={cn('h-4 w-4 flex-shrink-0', active ? 'text-primary' : 'text-muted-foreground/70')} />}
                        <span className="truncate">{t(item.labelKey)}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          }
          // Collapsed: icon + portaled hover flyout
          const secActive = sectionActive(section)
          return (
            <div key={section.id} className="flex justify-center">
              <HoverCard openDelay={80} closeDelay={120}>
                <HoverCardTrigger asChild>
                  <Link
                    href={section.items[0]?.href || '/hr'}
                    aria-label={t(section.labelKey)}
                    className={cn(
                      'h-11 w-11 flex items-center justify-center rounded-lg transition-colors',
                      secActive ? 'bg-accent text-primary' : 'text-sidebar-foreground/70 hover:bg-accent/60 hover:text-foreground',
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </Link>
                </HoverCardTrigger>
                <HoverCardContent
                  side={isRTL ? 'left' : 'right'}
                  align="start"
                  sideOffset={10}
                  className="w-auto border-0 bg-transparent p-0 shadow-none"
                >
                  <RailFlyout section={section} pathname={pathname} moduleParam={moduleParam} />
                </HoverCardContent>
              </HoverCard>
            </div>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className={cn('border-t border-border p-2 space-y-0.5', !expanded && 'flex flex-col items-center')}>
        {bottomItems.map((item) => {
          const Icon = item.icon
          const active = item.match?.(pathname, moduleParam) ?? false
          return (
            <Link
              key={item.id}
              href={item.href}
              title={!expanded ? t(item.labelKey) : undefined}
              aria-label={!expanded ? t(item.labelKey) : undefined}
              className={cn(
                'relative flex items-center rounded-lg transition-colors',
                expanded ? 'w-full gap-3 px-3 py-2' : 'h-11 w-11 justify-center',
                active ? 'bg-accent text-primary' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
              )}
            >
              {active && expanded && <span className="absolute top-1/2 -translate-y-1/2 start-0 w-[3px] h-5 rounded-e-full bg-primary" />}
              <Icon className="h-[18px] w-[18px] flex-shrink-0" />
              {expanded && <span className="text-[13px] font-medium">{t(item.labelKey)}</span>}
            </Link>
          )
        })}
        <button
          onClick={() => logout()}
          title={!expanded ? t('nav.logout') : undefined}
          aria-label={!expanded ? t('nav.logout') : undefined}
          className={cn(
            'flex items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors',
            expanded ? 'w-full gap-3 px-3 py-2' : 'h-11 w-11 justify-center',
          )}
        >
          <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
          {expanded && <span className="text-[13px] font-medium">{t('nav.logout')}</span>}
        </button>
      </div>
    </aside>
  )
}
