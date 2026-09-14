'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronUp, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { RAIL_SECTIONS } from './routes'

/**
 * Apex ERP Sidebar — matches the reference screenshot.
 * White panel, collapsible section headers (icon on the right, chevron on the
 * left) and plain indented item labels (no per-item icons). Role filtering and
 * active-route matching are unchanged.
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
  const toggle = (id: string) => setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))

  const sections = RAIL_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((i) => {
      if (isEmployee && i.visibility !== 'all') return false
      if (!myEmployee && i.requiresEmployee) return false
      return true
    }),
  })).filter((s) => s.items.length > 0)

  const dashSection = sections.find((s) => s.id === 'dashboard')
  const dashItem = dashSection?.items[0]
  const dashActive = dashItem ? dashItem.match(pathname, moduleParam) : false

  return (
    <aside
      className="hidden lg:flex flex-col w-[240px] shrink-0 bg-white text-gray-800 h-full overflow-y-auto border-l border-gray-200"
      dir="rtl"
    >
      {/* ── Dashboard single link ─────────────────────────── */}
      {dashItem && (
        <div className="p-2">
          <Link
            href={dashItem.href}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-3 py-2.5 text-[13.5px] transition-colors w-full',
              dashActive
                ? 'bg-[#e8f0fb] text-[#17356b] font-bold'
                : 'text-gray-700 hover:bg-blue-50 hover:text-[#17356b] font-medium'
            )}
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            <span>{t('nav.dashboard_section')}</span>
          </Link>
        </div>
      )}

      {/* ── Collapsible sections ──────────────────────────── */}
      <nav className="flex-1 pb-2">
        {sections
          .filter((s) => s.id !== 'dashboard')
          .map((section) => {
            const SectionIcon = section.icon
            const isCollapsed = !!collapsed[section.id]
            return (
              <div key={section.id}>
                {/* Section header */}
                <button
                  type="button"
                  onClick={() => toggle(section.id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-[13px] font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <SectionIcon className="h-4 w-4 shrink-0 text-[#2456a6]" />
                    <span>{t(section.labelKey)}</span>
                  </span>
                  {isCollapsed ? (
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronUp className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  )}
                </button>

                {/* Items */}
                {!isCollapsed && (
                  <div className="pb-1">
                    {section.items.map((item) => {
                      const active = item.match(pathname, moduleParam)
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          className={cn(
                            'block pr-10 pl-3 py-2 text-[13px] transition-colors border-r-[3px]',
                            active
                              ? 'border-[#2456a6] bg-[#eef4fc] text-[#17356b] font-semibold'
                              : 'border-transparent text-slate-600 hover:bg-blue-50 hover:text-[#17356b]'
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

      {/* ── Footer ────────────────────────────────────────── */}
      <div className="border-t border-gray-200 px-3 py-3 shrink-0">
        <div className="text-[10px] text-gray-400 text-center">
          Powered By Taif Alalmas v1.0.11
        </div>
      </div>
    </aside>
  )
}
