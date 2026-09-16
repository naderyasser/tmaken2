'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronUp, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { RAIL_SECTIONS, type RailItem } from './routes'

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

  // Apex: every section starts collapsed; the one holding the active page opens itself.
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState('')
  const toggle = (id: string, isOpen: boolean) => setOpen((prev) => ({ ...prev, [id]: !isOpen }))

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase()
    return RAIL_SECTIONS.map((s) => ({
      ...s,
      items: s.items.filter((i) => {
        if (isEmployee && i.visibility !== 'all') return false
        if (!myEmployee && i.requiresEmployee) return false
        if (q && !(i.label ?? t(i.labelKey)).toLowerCase().includes(q)
            && !(i.children ?? []).some((c) => (c.label ?? t(c.labelKey)).toLowerCase().includes(q))) return false
        return true
      }),
    })).filter((s) => s.items.length > 0)
  }, [isEmployee, myEmployee, query, t])

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
        {sections.map((section) => {
          const SectionIcon = section.icon
          const hasActive = section.items.some((i) => itemActive(i, pathname, moduleParam))
          const isOpen = searching || (section.id in open ? open[section.id] : hasActive)
          return (
            <div key={section.id} className="mb-px">
              <button
                type="button"
                onClick={() => toggle(section.id, isOpen)}
                className={cn(
                  'relative w-full h-[57px] px-2 flex items-center justify-between text-white transition-colors',
                  isOpen || hasActive ? 'bg-[#2e71c8]' : 'bg-[#2960b6] hover:bg-[#2b68bf]'
                )}
              >
                {isOpen ? (
                  <ChevronUp className="h-[18px] w-[18px] shrink-0" />
                ) : (
                  <ChevronDown className="h-[18px] w-[18px] shrink-0" />
                )}
                <span className="flex-1 text-center text-[16px]">{t(section.labelKey)}</span>
                <SectionIcon className="h-[21px] w-[21px] shrink-0" />
              </button>

              {isOpen && (
                <div className="bg-[#2e71c8] py-2">
                  {section.items.map((item) => (
                    <RailEntry key={item.id} item={item} pathname={pathname} moduleParam={moduleParam} depth={0} />
                  ))}
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

function itemActive(item: RailItem, pathname: string, moduleParam: string | null): boolean {
  return item.match(pathname, moduleParam) || (item.children ?? []).some((c) => itemActive(c, pathname, moduleParam))
}

/**
 * One sidebar entry — a link, or (Apex «التقارير») a nested collapsible group.
 * Items are right-aligned, 55px tall, and light up with a pale pill on hover/active.
 */
function RailEntry({ item, pathname, moduleParam, depth }: {
  item: RailItem; pathname: string; moduleParam: string | null; depth: number
}) {
  const { t } = useI18n()
  const label = item.label ?? t(item.labelKey)
  const active = item.match(pathname, moduleParam)
  const [groupOpen, setGroupOpen] = useState<boolean | null>(null)
  const isGroup = !!item.children?.length
  const childActive = isGroup && (item.children ?? []).some((c) => itemActive(c, pathname, moduleParam))
  const opened = groupOpen ?? childActive

  const rowClass = cn(
    'flex items-center justify-between h-[55px] mx-2 px-4 rounded text-[16px] transition-colors',
    active && !isGroup ? 'bg-[#dbe7f7] text-[#2960b6]' : 'text-white hover:bg-[#dbe7f7] hover:text-[#2960b6]'
  )
  const indent = { paddingRight: `${16 + depth * 16}px` }

  if (isGroup) {
    return (
      <div>
        <button type="button" onClick={() => setGroupOpen(!opened)} className={cn(rowClass, 'w-[calc(100%-16px)]')} style={indent}>
          <span>{label}</span>
          {opened ? <ChevronUp className="h-[18px] w-[18px]" /> : <ChevronDown className="h-[18px] w-[18px]" />}
        </button>
        {opened && (
          <div>
            {(item.children ?? []).map((c) => (
              <RailEntry key={c.id} item={c} pathname={pathname} moduleParam={moduleParam} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }
  return (
    <Link href={item.href} className={rowClass} style={indent}>
      <span>{label}</span>
    </Link>
  )
}
