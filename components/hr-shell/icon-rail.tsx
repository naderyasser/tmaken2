'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronUp, LayoutDashboard, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { RAIL_SECTIONS } from './routes'

/**
 * Apex HR Sidebar — values measured from the live reference:
 *   aside 272px · #2960b6 · section header 57px, label centred, icon 21px right,
 *   chevron left · expanded card header #2e71c8 · items 16px · search 37px/14px ·
 *   footer 12px white.
 */
export function IconRail() {
  const { t } = useI18n()
  const { isHRUser, isManager, isAuthenticated, myEmployee } = useAuth()
  const isEmployee = isAuthenticated && !isHRUser && !isManager
  const pathname = usePathname() || ''
  const searchParams = useSearchParams()
  const moduleParam = searchParams.get('module')

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState('')
  const toggle = (id: string) => setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase()
    return RAIL_SECTIONS.map((s) => ({
      ...s,
      items: s.items.filter((i) => {
        if (isEmployee && i.visibility !== 'all') return false
        if (!myEmployee && i.requiresEmployee) return false
        if (q && !t(i.labelKey).toLowerCase().includes(q) && s.id !== 'dashboard') return false
        return true
      }),
    })).filter((s) => s.items.length > 0)
  }, [isEmployee, myEmployee, query, t])

  const dashSection = sections.find((s) => s.id === 'dashboard')
  const dashItem = dashSection?.items[0]
  const dashActive = dashItem ? dashItem.match(pathname, moduleParam) : false
  const searching = query.trim().length > 0

  return (
    <aside
      className="hidden lg:flex flex-col w-[272px] shrink-0 bg-[#2960b6] text-white h-full overflow-hidden pt-4"
      dir="rtl"
    >
      {/* Search — 37px / 14px as measured */}
      <div className="px-[10px] shrink-0">
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث"
            className="w-full h-[37px] rounded bg-white text-[14px] text-[#495057] pr-[11px] pl-9 placeholder:text-slate-400 outline-none"
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-500" />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto pt-3 pb-12">
        {/* Dashboard card — header + one child link, as in the reference */}
        {dashItem && (
          <div className="mb-px">
            <div className="relative w-full h-[57px] px-2 bg-[#2e71c8] flex items-center justify-between">
              <ChevronUp className="h-[18px] w-[18px] text-white shrink-0" />
              <span className="flex-1 text-center text-[16px] text-white">{t('nav.dashboard_section')}</span>
              <LayoutDashboard className="h-[21px] w-[21px] shrink-0" />
            </div>
            <div className="bg-[#2e71c8] px-[10px] py-[15px] pt-0">
              <Link
                href={dashItem.href}
                className={cn(
                  'block py-2 text-[16px] transition-colors',
                  dashActive ? 'text-white underline' : 'text-white hover:underline'
                )}
              >
                {t('nav.dashboard_home')}
              </Link>
            </div>
          </div>
        )}

        {/* Collapsible section cards */}
        {sections
          .filter((s) => s.id !== 'dashboard')
          .map((section) => {
            const SectionIcon = section.icon
            const isCollapsed = !searching && !!collapsed[section.id]
            const bg = isCollapsed ? 'bg-[#2960b6]' : 'bg-[#2e71c8]'
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
                  <div className={cn(bg, 'px-[10px] py-[15px] pt-0')}>
                    {section.items.map((item) => {
                      const active = item.match(pathname, moduleParam)
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
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

      {/* Bottom bar — 44px, 12px white */}
      <div className="h-11 pt-3 shrink-0 text-center">
        <span className="text-[12px] text-white">Powered By Taif Alalmas v1.0.11</span>
      </div>
    </aside>
  )
}
