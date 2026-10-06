'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, LogOut, MapPin, Search, UserCircle2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { logout as apiLogout } from '@/lib/api'
import { frappeClient } from '@/lib/api-client'
import { NotificationsPanel } from '@/components/notifications-panel'
import { RAIL_SECTIONS, TOPBAR_ACTIONS, type RailItem } from './routes'

/**
 * Masar Time topbar — one flat dark-teal bar over the content column:
 *   right → user (avatar · name · role ▾ with خروج) · «فرع:» branch filter
 *   middle → «بحث هنا…» quick search over every screen
 *   left  → «مسار تايم - النظام الذكي»
 * The branch filter drives the dashboard (/hr?branch=…).
 */
const ROLE_LABELS: [string, string][] = [
  ['Administrator', 'مدير النظام'], ['System Manager', 'مدير النظام'], ['HR Manager', 'مدير الموارد البشرية'],
  ['HR User', 'مستخدم الموارد البشرية'], ['Company Admin', 'مدير الشركة'], ['Employee', 'موظف'],
]
const roleLabel = (roles?: string[]) => {
  const have = new Set(roles || [])
  return ROLE_LABELS.find(([r]) => have.has(r))?.[1] || roles?.[0] || 'مدير النظام'
}

function flatten(items: RailItem[]): RailItem[] {
  return items.flatMap((i) => (i.children?.length ? flatten(i.children) : [i]))
}

export function Topbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname() || ''
  const params = useSearchParams()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // ── branch filter ──
  const [branches, setBranches] = useState<string[]>([])
  useEffect(() => {
    frappeClient.getList<{ name: string }>('Branch', { fields: ['name'], order_by: 'name asc', limit_page_length: 0 })
      .then((rows) => setBranches(rows.map((b) => b.name))).catch(() => setBranches([]))
  }, [])
  const branch = pathname === '/hr' ? params.get('branch') || '' : ''
  const pickBranch = (b: string) => router.push(b ? `/hr?branch=${encodeURIComponent(b)}` : '/hr')

  // ── quick search over every screen ──
  const pages = useMemo(() => RAIL_SECTIONS.flatMap((s) => flatten(s.items))
    .map((i) => ({ href: i.href, label: i.label ?? t(i.labelKey) })), [t])
  const [q, setQ] = useState('')
  const [focus, setFocus] = useState(false)
  const hits = q.trim() ? pages.filter((p) => p.label.includes(q.trim())).slice(0, 8) : []
  const go = (href: string) => { setQ(''); setFocus(false); router.push(href) }

  // ── user menu ──
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  const userName = mounted ? (user?.full_name || user?.email || 'مدير النظام') : 'مدير النظام'
  const userRole = mounted ? roleLabel(user?.roles) : 'مدير النظام'

  return (
    <header className="z-40 shrink-0" dir="rtl">
      <div className="flex h-[60px] items-center gap-3 bg-[var(--masar-ink-2)] px-3 text-white shadow-[0_2px_8px_rgba(0,0,0,.12)] md:px-5">
        <button type="button" onClick={onOpenMobileNav} aria-label="القائمة" title="القائمة"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded hover:bg-white/10 lg:hidden">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>

        {/* user */}
        <div ref={menuRef} className="relative shrink-0">
          <button type="button" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu}
            className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-white/10">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white/15 ring-2 ring-white/25">
              {mounted && user?.user_image
                ? <Image src={user.user_image} alt={userName} width={36} height={36} className="object-cover" unoptimized />
                : <UserCircle2 className="h-8 w-8 text-white/90" />}
            </span>
            <span className="hidden max-w-[150px] truncate text-[14px] font-bold sm:inline">{userName}</span>
            <ChevronDown className="h-4 w-4 opacity-70" />
          </button>
          {menu && (
            <div role="menu" className="absolute right-0 top-[calc(100%+6px)] w-56 overflow-hidden rounded-lg bg-white text-slate-700 shadow-xl ring-1 ring-black/5">
              <div className="border-b border-slate-100 px-4 py-3">
                <div className="truncate text-[14px] font-bold text-slate-800">{userName}</div>
                <div className="text-[12px] text-slate-500">{userRole}</div>
              </div>
              <button type="button" role="menuitem" onClick={() => { apiLogout().finally(() => { window.location.href = '/login' }) }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-[13.5px] hover:bg-slate-50">
                <LogOut className="h-4 w-4" />خروج
              </button>
            </div>
          )}
        </div>

        {/* branch */}
        <label className="hidden shrink-0 items-center gap-1.5 text-[14px] md:flex">
          <MapPin className="h-4 w-4 opacity-80" />
          <span className="opacity-85">فرع:</span>
          <select value={branch} onChange={(e) => pickBranch(e.target.value)} aria-label="الفرع"
            className="max-w-[190px] cursor-pointer appearance-none bg-transparent pe-5 font-bold outline-none [&>option]:text-slate-800">
            <option value="">كل الفروع</option>
            {branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <ChevronDown className="-ms-5 h-4 w-4 opacity-70 pointer-events-none" />
        </label>

        <div className="flex-1" />

        {/* search */}
        <div className="relative hidden w-[300px] md:block">
          <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 150)}
            onKeyDown={(e) => { if (e.key === 'Enter' && hits[0]) go(hits[0].href) }}
            placeholder="بحث هنا..." aria-label="بحث"
            className="h-10 w-full rounded-md bg-[var(--masar-ink)] pe-10 ps-3 text-[14px] text-white outline-none ring-1 ring-white/10 placeholder:text-white/55 focus:ring-white/30" />
          <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/70" />
          {focus && hits.length > 0 && (
            <div className="absolute inset-x-0 top-[calc(100%+6px)] overflow-hidden rounded-lg bg-white py-1 text-slate-700 shadow-xl ring-1 ring-black/5">
              {hits.map((h) => (
                <button key={h.href} type="button" onMouseDown={() => go(h.href)} className="block w-full px-4 py-2 text-start text-[13.5px] hover:bg-slate-50">{h.label}</button>
              ))}
            </div>
          )}
        </div>

        {mounted && (
          <div className="relative shrink-0 text-white [&_button]:text-white [&_svg]:text-white [&_.bg-red-500]:hidden">
            <NotificationsPanel />
          </div>
        )}

        {/* system */}
        <div className="hidden shrink-0 items-center gap-1.5 text-[14px] font-bold xl:flex">
          مسار تايم - النظام الذكي
          <ChevronDown className="h-4 w-4 opacity-70" />
        </div>
      </div>

      <div className="hidden">{TOPBAR_ACTIONS.map((Action, i) => <Action key={i} />)}</div>
    </header>
  )
}
