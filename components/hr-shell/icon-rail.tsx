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
 * Apex HR Sidebar — blue panel with a search box, collapsible sections
 * (section icon on the right, chevron on the left) and plain indented items.
 * Role filtering and active-route matching are unchanged.
 */
export function IconRail() {
  const { t } = useI18n()
  const { isHRUser, isManager, isAuthenticated, myEmployee } = useAuth()
  // A guest (public HR demo) sees the full menu; a plain employee sees the
  // reduced self-service rail.
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
      items: s.items
        .filter((i) => {
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
      className="hidden lg:flex flex-col w-[248px] shrink-0 bg-[#1b5b9f] text-white h-full overflow-hidden"
      dir="rtl"
    >
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

      <nav className="flex-1 overflow-y-auto pb-2">
        {/* Dashboard single link */}
        {dashItem && (
          <div className="px-2">
            <Link
              href={dashItem.href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2.5 text-[13.5px] transition-colors w-full',
                dashActive ? 'bg-[#dbeafe] text-[#17356b] font-bold' : 'text-white font-bold hover:bg-white/10'
              )}
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              <span>{t('nav.dashboard_section')}</span>
            </Link>
          </div>
        )}

        {/* Collapsible sections */}
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

      {/* Footer */}
      <div className="px-3 py-3 shrink-0">
        <div className="text-[10px] text-white/70 text-center">
          Powered By Taif Alalmas v1.0.11
        </div>
      </div>
    </aside>
  )
}
