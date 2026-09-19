'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { LogOut, Home, LayoutDashboard, ChevronDown, ChevronUp, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { useBrand } from '@/hooks/use-brand'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { RAIL_SECTIONS } from './routes'

/**
 * Mobile drawer — identical metrics to the desktop rail (measured from the
 * reference): 272px · #2960b6 · 57px centred section headers · 16px items.
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
        className="w-[272px] sm:max-w-[272px] p-0 flex flex-col bg-[var(--apex-blue)] text-white border-0"
        dir="rtl"
      >
        <SheetHeader className="h-[55px] px-4 flex-row items-center gap-2.5 border-b border-white/15 text-start shrink-0">
          <Image
            src={brand.logo || '/logo.jpeg'}
            alt={brand.appName || 'Tamkeen'}
            width={32}
            height={32}
            className="rounded object-cover shrink-0 bg-white"
          />
          <div className="leading-tight">
            <SheetTitle className="text-[15px] font-semibold text-white">
              {brand.appName || t('app.name')}
            </SheetTitle>
            <p className="text-[11px] text-white/75">{brand.tagline || t('app.subtitle')}</p>
          </div>
        </SheetHeader>

        {/* Search */}
        <div className="px-[10px] pt-4 shrink-0">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث"
              className="w-full h-[37px] rounded bg-white text-[14px] text-[var(--apex-input-text)] pr-[11px] pl-9 placeholder:text-slate-400 outline-none"
            />
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-500" />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto pt-3 pb-12">
          {dashItem && (
            <div className="mb-px">
              <div className="relative w-full h-[57px] px-2 bg-[var(--apex-blue-light)] flex items-center justify-between text-white">
                <ChevronUp className="h-[18px] w-[18px] shrink-0" />
                <span className="flex-1 text-center text-[16px]">{t('nav.dashboard_section')}</span>
                <LayoutDashboard className="h-[21px] w-[21px] shrink-0" />
              </div>
              <div className="bg-[var(--apex-blue-light)] px-[10px] pt-0 pb-[15px]">
                <Link
                  href={dashItem.href}
                  onClick={close}
                  className={cn(
                    'block py-2 text-[16px] transition-colors',
                    dashItem.match(pathname, moduleParam) ? 'text-white underline' : 'text-white hover:underline'
                  )}
                >
                  {t('nav.dashboard_home')}
                </Link>
              </div>
            </div>
          )}

          {sections
            .filter((s) => s.id !== 'dashboard')
            .map((section) => {
              const SectionIcon = section.icon
              const isCollapsed = !searching && !!collapsed[section.id]
              const bg = isCollapsed ? 'bg-[var(--apex-blue)]' : 'bg-[var(--apex-blue-light)]'
              return (
                <div key={section.id} className="mb-px">
                  <button
                    type="button"
                    onClick={() => toggle(section.id)}
                    className={cn(
                      'relative w-full h-[57px] px-2 flex items-center justify-between text-white transition-colors',
                      bg
                    )}
                  >
                    {isCollapsed ? (
                      <ChevronDown className="h-[18px] w-[18px] shrink-0" />
                    ) : (
                      <ChevronUp className="h-[18px] w-[18px] shrink-0" />
                    )}
                    <span className="flex-1 text-center text-[16px]">{t(section.labelKey)}</span>
                    <SectionIcon className="h-[21px] w-[21px] shrink-0" />
                  </button>

                  {!isCollapsed && (
                    <div className={cn(bg, 'px-[10px] pt-0 pb-[15px]')}>
                      {section.items.map((item) => {
                        const active = item.match(pathname, moduleParam)
                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            onClick={close}
                            className={cn(
                              'block py-2 text-[16px] transition-colors',
                              active ? 'text-white underline' : 'text-white hover:underline'
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
        <div className="shrink-0 border-t border-white/15 px-3 py-2 space-y-0.5">
          <Link
            href="/"
            onClick={close}
            className="flex items-center gap-2.5 py-2 text-[14px] text-white/90 hover:underline"
          >
            <Home className="h-[18px] w-[18px] shrink-0" />
            <span>{t('guard.back_home')}</span>
          </Link>
          <button
            onClick={() => { close(); logout() }}
            className="flex items-center gap-2.5 py-2 text-[14px] text-white hover:underline w-full"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            <span>{t('nav.logout')}</span>
          </button>
          <div className="pt-2 h-11 text-center">
            <span className="text-[12px] text-white">مينا للحلول التقنية {process.env.NEXT_PUBLIC_APP_VERSION || 'v1.0.11'}</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
