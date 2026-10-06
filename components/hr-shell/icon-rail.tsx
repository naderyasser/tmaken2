'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { RAIL_SECTIONS, type RailItem, type RailSection } from './routes'

/**
 * Masar Time sidebar — full-height dark-teal column: the white «masar TIME»
 * logo on top, then one row per section (icon + label). A section with a
 * single page is a direct link (لوحة القيادة); the others fold open, and the
 * one holding the current page starts open. Menu search lives in the topbar.
 */
export function IconRail() {
  const { t } = useI18n()
  const { isHRUser, isManager, isAuthenticated, myEmployee } = useAuth()
  const isEmployee = isAuthenticated && !isHRUser && !isManager
  const pathname = usePathname() || ''
  const moduleParam = useSearchParams().get('module')

  const sections = useMemo(() => RAIL_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((i) => !(isEmployee && i.visibility !== 'all') && !(!myEmployee && i.requiresEmployee)),
  })).filter((s) => s.items.length > 0), [isEmployee, myEmployee])

  const holds = (s: RailSection) => s.items.some((i) => i.match(pathname, moduleParam)
    || (i.children ?? []).some((c) => c.match(pathname, moduleParam)))

  const [open, setOpen] = useState<Record<string, boolean>>({})
  useEffect(() => {
    try { const saved = sessionStorage.getItem('masarRailOpen'); if (saved) setOpen(JSON.parse(saved)) } catch { /* no storage */ }
  }, [])
  const toggle = (id: string, isOpen: boolean) => setOpen((prev) => {
    const next = { ...prev, [id]: !isOpen }
    try { sessionStorage.setItem('masarRailOpen', JSON.stringify(next)) } catch { /* no storage */ }
    return next
  })

  const [updated, setUpdated] = useState('')
  useEffect(() => {
    const fmt = () => new Date().toLocaleString('ar-SA-u-nu-latn', { weekday: 'long', hour: '2-digit', minute: '2-digit' })
    setUpdated(fmt())
    const id = setInterval(() => setUpdated(fmt()), 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <aside className="hidden lg:flex flex-col w-[250px] shrink-0 bg-[var(--masar-ink)] text-white h-full overflow-hidden" dir="rtl">
      <Link href="/hr" className="flex h-[92px] shrink-0 items-center justify-center border-b border-white/10 px-6" aria-label="Masar Time">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/branding/masar/masar-logo-white.png" alt="masar TIME" className="h-[54px] w-auto object-contain" />
      </Link>

      <nav className="flex-1 overflow-y-auto py-3">
        {sections.map((section) => {
          const SectionIcon = section.icon
          const active = holds(section)
          const single = section.items.length === 1 && !section.items[0].children?.length
          if (single) {
            const item = section.items[0]
            return (
              <Link key={section.id} href={item.href}
                className={cn('relative flex h-12 items-center gap-3 px-5 text-[15px] font-bold transition-colors',
                  active ? 'bg-[var(--apex-active)]' : 'hover:bg-white/10')}>
                {active && <span aria-hidden className="absolute inset-y-0 right-0 w-1 bg-[var(--masar-green)]" />}
                <SectionIcon className="h-5 w-5 shrink-0" />
                <span className="truncate">{section.id === 'dashboard' ? 'لوحة القيادة' : (item.label ?? t(item.labelKey))}</span>
              </Link>
            )
          }
          const isOpen = open[section.id] ?? active
          return (
            <div key={section.id}>
              <button type="button" onClick={() => toggle(section.id, isOpen)} aria-expanded={isOpen}
                className={cn('flex h-12 w-full items-center gap-3 px-5 text-[15px] font-bold transition-colors hover:bg-white/10',
                  active && 'text-white', !active && 'text-white/90')}>
                <SectionIcon className="h-5 w-5 shrink-0" />
                <span className="flex-1 truncate text-start">{t(section.labelKey)}</span>
                <ChevronDown className={cn('h-4 w-4 shrink-0 opacity-60 transition-transform', isOpen && 'rotate-180')} />
              </button>
              {isOpen && (
                <div className="bg-black/10 py-1">
                  {section.items.map((item) => (
                    <RailEntry key={item.id} item={item} pathname={pathname} moduleParam={moduleParam} depth={0} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10 px-5 py-3 text-[11.5px] leading-6 text-white/70">
        <div>آخر تحديث: <span className="text-white/90">{updated}</span></div>
        <div>Masar Time {process.env.NEXT_PUBLIC_APP_VERSION || ''}</div>
      </div>
    </aside>
  )
}

function RailEntry({ item, pathname, moduleParam, depth }: {
  item: RailItem; pathname: string; moduleParam: string | null; depth: number
}) {
  const { t } = useI18n()
  const label = item.label ?? t(item.labelKey)
  const isGroup = !!item.children?.length
  const active = item.match(pathname, moduleParam)
  const childActive = (item.children ?? []).some((c) => c.match(pathname, moduleParam))
  const [groupOpen, setGroupOpen] = useState<boolean | null>(null)
  const opened = groupOpen ?? childActive
  const Icon = item.icon
  const row = cn(
    'relative flex h-10 w-full items-center gap-2.5 text-[14px] transition-colors',
    active && !isGroup ? 'bg-[var(--apex-active)] font-bold text-white' : 'text-white/85 hover:bg-white/10 hover:text-white',
  )
  const pad = { paddingRight: `${44 + depth * 16}px`, paddingLeft: '16px' }
  if (isGroup) {
    return (
      <div>
        <button type="button" onClick={() => setGroupOpen(!opened)} aria-expanded={opened} className={row} style={pad}>
          {Icon && <Icon className="h-4 w-4 shrink-0 opacity-80" />}
          <span className="flex-1 truncate text-start">{label}</span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 opacity-60 transition-transform', opened && 'rotate-180')} />
        </button>
        {opened && (item.children ?? []).map((c) => (
          <RailEntry key={c.id} item={c} pathname={pathname} moduleParam={moduleParam} depth={depth + 1} />
        ))}
      </div>
    )
  }
  return (
    <Link href={item.href} className={row} style={pad}>
      {active && <span aria-hidden className="absolute inset-y-0 right-0 w-1 bg-[var(--masar-green)]" />}
      {Icon && <Icon className="h-4 w-4 shrink-0 opacity-80" />}
      <span className="truncate">{label}</span>
    </Link>
  )
}
