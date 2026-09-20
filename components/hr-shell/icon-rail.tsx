'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronDown, Search } from 'lucide-react'
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

  // Apex: every section starts collapsed on a fresh load — confirmed against the
  // live reference (a hard reload on any page, including one whose own section
  // e.g. الاعدادات, leaves every card closed). It does not auto-open the active
  // page's section; it only remembers whatever the visitor toggled themselves,
  // via sessionStorage (mirrored here so a reload keeps the same state).
  const [open, setOpen] = useState<Record<string, boolean>>({})
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('railOpen')
      if (saved) setOpen(JSON.parse(saved))
    } catch { /* storage unavailable */ }
  }, [])
  const [query, setQuery] = useState('')
  const toggle = (id: string, isOpen: boolean) => setOpen((prev) => {
    const next = { ...prev, [id]: !isOpen }
    try { sessionStorage.setItem('railOpen', JSON.stringify(next)) } catch { /* storage unavailable */ }
    return next
  })

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
      className="hidden lg:flex flex-col w-[272px] shrink-0 bg-[var(--apex-blue)] text-white h-full overflow-hidden pt-4"
      dir="rtl"
    >
      {/* Search — 175×37, radius 4/5/5/4, magnifier at the left end (S5) */}
      <div className="px-[10px] shrink-0">
        <div className="relative w-[175px]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث"
            className="w-[175px] h-[37px] rounded-[4px_5px_5px_4px] bg-white text-[14px] text-[var(--apex-input-text)] pr-[11px] pl-9 placeholder:text-slate-400 outline-none"
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-500" />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto pt-3 pb-12">
        {sections.map((section) => {
          const SectionIcon = section.icon
          const isOpen = searching || !!open[section.id]
          return (
            <div key={section.id} className="mb-px">
              {/* S1: header always bg --apex-blue-light (lighter than the panel),
                  56px→57px, text centered, group icon at the RIGHT edge, a 24px
                  expand_more chevron at the LEFT edge (rotates when open). All
                  sections start closed (sessionStorage state above, unchanged). */}
              <button
                type="button"
                onClick={() => toggle(section.id, isOpen)}
                aria-expanded={isOpen}
                className="relative w-full h-[57px] px-2 flex items-center justify-between text-white bg-[var(--apex-blue-light)] transition-colors"
              >
                <SectionIcon className="h-[21px] w-[21px] shrink-0 text-white" />
                <span className="flex-1 text-center text-[16px] font-normal">{t(section.labelKey)}</span>
                <ChevronDown
                  className={cn('h-6 w-6 shrink-0 transition-transform', isOpen && 'rotate-180')}
                />
              </button>

              {/* (D) confirmed 2026-09-20: the expanded group's own panel —
                  radius 10, shadow, padding 16px/10px — items (40px, 15px
                  gaps) already match S2 above. */}
              {isOpen && (
                <div className="bg-[var(--apex-blue-light)] rounded-[10px] shadow-[0_4px_10px_rgba(0,0,0,.18)] py-4 px-[10px]">
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
        <span className="text-[12px] text-white">مينا للحلول التقنية {process.env.NEXT_PUBLIC_APP_VERSION || 'v1.0.11'}</span>
      </div>
    </aside>
  )
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
  // Matches the section-level rule: nested groups (التقارير) also start closed
  // on a fresh load, even when they hold the active page — verified against
  // the live reference on /hr/daystatus.
  useEffect(() => {
    if (groupOpen !== null) return
    try {
      const saved = sessionStorage.getItem(`railGroup:${item.id}`)
      if (saved) setGroupOpen(saved === '1')
    } catch { /* storage unavailable */ }
  }, [])
  const opened = !!groupOpen

  // S2/S3/S4: li 40px, padding 5px 10px, margin-bottom 15px, radius 4, white
  // 16px/400, width 220, no icon; active bg --apex-active text --apex-active-text
  // (#80868d); hover bg --apex-active text --apex-blue-light.
  const rowClass = cn(
    'flex items-center h-[40px] w-[220px] mx-auto px-[10px] py-[5px] mb-[15px] rounded text-[16px] font-normal transition-colors',
    active && !isGroup
      ? 'bg-[var(--apex-active)] text-[var(--apex-active-text)]'
      : 'text-white hover:bg-[var(--apex-active)] hover:text-[var(--apex-blue-light)]',
    isGroup && 'justify-between'
  )
  const indent = depth > 0 ? { paddingRight: `${10 + depth * 16}px` } : undefined

  if (isGroup) {
    return (
      <div>
        <button type="button" onClick={() => { const next = !opened; setGroupOpen(next); try { sessionStorage.setItem(`railGroup:${item.id}`, next ? '1' : '0') } catch {} }} aria-expanded={opened} className={rowClass} style={indent}>
          <span>{label}</span>
          <ChevronDown className={cn('h-[18px] w-[18px] transition-transform', opened && 'rotate-180')} />
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
