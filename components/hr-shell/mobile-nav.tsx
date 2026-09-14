'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  LogOut, Home, LayoutDashboard, ChevronDown, ChevronUp, Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { useBrand } from '@/hooks/use-brand'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { RAIL_SECTIONS } from './routes'

/**
 * Mobile navigation drawer — same blue Apex look as the desktop IconRail:
 * search box, collapsible sections (section icon right, chevron left) and plain
 * indented items. Opens from the right edge in RTL.
 */
export function MobileNav({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t, isRTL } = useI18n()
  const { logout, myEmployee } = useAuth()
  const brand = useBrand()
  const pathname = usePathname() || ''
  const searchParams = useSearchParams()
  const moduleParam = searchParams.get('module')
  const close = () => onOpenChange(false)

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState('')
  const toggle = (id: string) => setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase()
    return RAIL_SECTIONS.map((s) => ({
      ...s,
      items: s.items.filter((i) => {
        if (!myEmployee && i.requiresEmployee) return false
        if (q && !t(i.labelKey).toLowerCase().includes(q) && s.id !== 'dashboard') return false
        return true
      }),
    })).filter((s) => s.items.length > 0)
  }, [myEmployee, query, t])

  const dashItem = sections.find((s) => s.id === 'dashboard')?.items[0]
  const searching = query.trim().length > 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isRTL ? 'right' : 'left'}
        className="w-[260px] sm:max-w-[260px] p-0 flex flex-col bg-[#1b5b9f] text-white border-0"
        dir="rtl"
      >
        {/* Header */}
        <SheetHeader className="h-14 px-4 flex-row items-center gap-2.5 border-b border-white/15 text-start shrink-0">
          <Image
            src={brand.logo || '/logo.jpeg'}
            alt={brand.appName || 'Tamkeen'}
            width={32}
            height={32}
            className="rounded-lg object-cover shrink-0 bg-white"
          />
          <div className="leading-tight">
            <SheetTitle className="text-base font-bold text-white">
              {brand.appName || t('app.name')}
            </SheetTitle>
            <p className="text-[10px] text-white/70">
              {brand.tagline || t('app.subtitle')}
            </p>
          </div>
        </SheetHeader>

        {/* Search */}
        <div className="p-3 shrink-0">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="أبحث"
              className="w-full h-9 rounded-md bg-white text-slate-700 text-[13px] pr-3 pl-9 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-white/50"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto pb-2">
          {dashItem && (
            <div className="px-2">
              <Link
                href={dashItem.href}
                onClick={close}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2.5 text-[13.5px] transition-colors w-full',
                  dashItem.match(pathname, moduleParam)
                    ? 'bg-[#dbeafe] text-[#17356b] font-bold'
                    : 'text-white font-bold hover:bg-white/10'
                )}
              >
                <LayoutDashboard className="h-4 w-4 shrink-0" />
                <span>{t('nav.dashboard_section')}</span>
              </Link>
            </div>
          )}

          {sections
            .filter((s) => s.id !== 'dashboard')
            .map((section) => {
              const SectionIcon = section.icon
              const isCollapsed = !searching && !!collapsed[section.id]
              return (
                <div key={section.id}>
                  <button
                    type="button"
                    onClick={() => toggle(section.id)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-[13.5px] font-bold text-white hover:bg-white/10 transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <SectionIcon className="h-4 w-4 shrink-0 text-white" />
                      <span>{t(section.labelKey)}</span>
                    </span>
                    {isCollapsed ? (
                      <ChevronDown className="h-4 w-4 text-white/80 shrink-0" />
                    ) : (
                      <ChevronUp className="h-4 w-4 text-white/80 shrink-0" />
                    )}
                  </button>

                  {!isCollapsed && (
                    <div className="mx-2 mb-1 rounded-md bg-white/[0.07] py-1">
                      {section.items.map((item) => {
                        const active = item.match(pathname, moduleParam)
                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            onClick={close}
                            className={cn(
                              'block mx-1 my-0.5 rounded-md px-3 py-2 text-[13px] transition-colors',
                              active
                                ? 'bg-[#dbeafe] text-[#17356b] font-bold'
                                : 'text-white/90 hover:bg-white/10 hover:text-white'
                            )}
                          >
                            {t(item.labelKey)}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-3 shrink-0 space-y-1 border-t border-white/15">
          <Link
            href="/"
            onClick={close}
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium text-white/90 hover:bg-white/10 transition-colors w-full"
          >
            <Home className="h-4 w-4 shrink-0" />
            <span>{t('guard.back_home')}</span>
          </Link>
          <button
            onClick={() => { close(); logout() }}
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-bold bg-white/10 text-white hover:bg-white/20 transition-colors w-full"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>{t('nav.logout')}</span>
          </button>
          <div className="px-2 pt-1 text-[10px] text-white/70 text-center">
            Powered By Taif Alalmas v1.0.11
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
