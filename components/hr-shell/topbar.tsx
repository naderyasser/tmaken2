'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronDown, ChevronLeft, UserCircle2, LogOut, Calendar } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { useBrand } from '@/hooks/use-brand'
import { useCompanySafe } from '@/hooks/use-company'
import { NotificationsPanel } from '@/components/notifications-panel'
import { GlobalSearch } from './global-search'
import { TOPBAR_ACTIONS } from './routes'
import { useBreadcrumbs } from '@/lib/breadcrumbs'
import { accountingApi } from '@/lib/accounting-api'

/**
 * Apex ERP Topbar — two stacked bars, matching the reference screenshot:
 *
 *   Row 1 (navy #17356b): ☰ · avatar · name/role · خرج      …      Apex ERP logo
 *   Row 2 (blue #2456a6): الرئيسية ‹ …crumb · company        …      أبحث · الفترة المالية · 🔔
 *
 * All backend hooks preserved:
 *   useBrand · useCompanySafe · useAuth · NotificationsPanel · accountingApi
 */
export function Topbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const { t } = useI18n()
  const { logout, user } = useAuth()
  const brand = useBrand()
  const { company: activeCompany } = useCompanySafe()
  const crumbs = useBreadcrumbs()

  // ── Fiscal year from backend ──────────────────────────────────────────────
  const [fiscalLabel, setFiscalLabel] = useState<string>('')

  // The header reflects auth/brand/company data that only exists on the client.
  // Rendering it during SSR and again with data on hydration changes the tree and
  // breaks Radix's generated ids (aria-controls) — so auth-derived bits only render
  // after mount, keeping the server HTML and the first client render identical.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    let cancelled = false
    accountingApi.getCurrentFiscalYear(activeCompany ?? undefined)
      .then((fy) => {
        if (cancelled || !fy) return
        const fmt = (d: string) => {
          const [y, m, day] = d.split('-')
          return `${day}/${m}/${y}`
        }
        setFiscalLabel(`${fmt(fy.year_end_date)} - ${fmt(fy.year_start_date)}`)
      })
      .catch(() => { /* non-blocking */ })
    return () => { cancelled = true }
  }, [activeCompany])
  // ─────────────────────────────────────────────────────────────────────────

  const userName = mounted ? (user?.full_name || user?.email || 'مدير النظام') : 'مدير النظام'
  const userRole = mounted ? (user?.roles?.[0] || 'مدير النظام') : 'مدير النظام'

  return (
    <header className="shrink-0 z-40" dir="rtl">

      {/* ───────────── Row 1 — brand & user ───────────── */}
      <div className="h-14 bg-[#17356b] text-white flex items-center justify-between px-3 shadow-sm">

        {/* Right (start): hamburger · avatar · name/role · logout */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={onOpenMobileNav}
            title="القائمة"
            className="flex items-center justify-center w-9 h-9 rounded hover:bg-white/10 transition-colors shrink-0"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center overflow-hidden shrink-0">
            {mounted && user?.user_image ? (
              <Image src={user.user_image} alt={userName} width={36} height={36} className="object-cover" unoptimized />
            ) : (
              <UserCircle2 className="h-8 w-8 text-white/90 mt-1" />
            )}
          </div>

          <div className="hidden sm:flex flex-col leading-tight min-w-0">
            <span className="text-[13px] font-bold truncate max-w-[180px]">{userName}</span>
            <span className="text-[11px] text-white/80 truncate max-w-[180px]">{userRole}</span>
          </div>

          <button
            onClick={() => logout()}
            title={t('nav.logout')}
            className="flex items-center gap-1.5 text-[12.5px] font-medium hover:text-white/80 transition-colors pr-3 mr-1 border-r border-white/25"
          >
            <LogOut className="h-[15px] w-[15px]" />
            <span className="hidden sm:inline">خرج</span>
          </button>
        </div>

        {/* Left (end): logo */}
        <Link href="/hr" className="flex items-center gap-2 shrink-0">
          {mounted && brand.logo ? (
            <span className="relative block h-9 w-[130px] shrink-0">
              <Image
                src={brand.logo}
                alt="Logo"
                fill
                sizes="130px"
                className="object-contain"
                unoptimized
              />
            </span>
          ) : (
            <>
              <span className="font-serif italic font-bold text-[26px] leading-none tracking-wide">Apex</span>
              <span className="bg-white text-[#17356b] rounded px-1.5 py-[3px] text-[11px] font-extrabold not-italic leading-none">ERP</span>
            </>
          )}
        </Link>
      </div>

      {/* ───────────── Row 2 — breadcrumb, company, search, period ───────────── */}
      <div className="h-11 bg-[#2456a6] text-white flex items-center justify-between px-3 text-[12.5px]">

        {/* Right (start): breadcrumb · company */}
        <div className="flex items-center gap-3 min-w-0">
          <nav className="flex items-center gap-1 min-w-0 whitespace-nowrap">
            <Link href="/" className="hover:underline text-white/95">الرئيسية</Link>
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1 min-w-0">
                <ChevronLeft className="h-3.5 w-3.5 text-white/60 shrink-0" />
                {c.href && i < crumbs.length - 1 ? (
                  <Link href={c.href} className="hover:underline truncate max-w-[160px]">{c.label}</Link>
                ) : (
                  <span className="font-semibold truncate max-w-[200px]">{c.label}</span>
                )}
              </span>
            ))}
          </nav>

          {mounted && activeCompany && (
            <>
              <div className="hidden md:block h-5 w-px bg-white/30 shrink-0" />
              <span className="hidden md:inline font-semibold truncate max-w-[260px]">{activeCompany}</span>
            </>
          )}
        </div>

        {/* Left (end): search · fiscal period · notifications */}
        <div className="flex items-center gap-2 shrink-0">
          {mounted && (
            <div className="hidden lg:block w-[230px]">
              <GlobalSearch />
            </div>
          )}

          {mounted && fiscalLabel && (
            <div className="hidden md:flex items-center gap-2">
              <span className="text-[12.5px] font-bold">{t('nav.fiscal_period') || 'الفترة المالية'}</span>
              <div className="flex items-center gap-1.5 bg-white text-[#17356b] rounded px-2.5 py-1 text-[12px] font-bold">
                <Calendar className="h-3.5 w-3.5" />
                <span>{fiscalLabel}</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </div>
            </div>
          )}

          {mounted && (
            <div className="text-white [&_button]:text-white [&_svg]:text-white">
              <NotificationsPanel />
            </div>
          )}
        </div>
      </div>

      {/* Feature-phase topbar widgets (seam for future additions) */}
      <div className="hidden">
        {TOPBAR_ACTIONS.map((Action, i) => <Action key={i} />)}
      </div>
    </header>
  )
}
