'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronDown, Check, UserCircle2, Calendar, LogOut } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { logout as apiLogout } from '@/lib/api'
import { frappeClient } from '@/lib/api-client'
import { useBrand } from '@/hooks/use-brand'
import { useCompanySafe } from '@/hooks/use-company'
import { NotificationsPanel } from '@/components/notifications-panel'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TOPBAR_ACTIONS } from './routes'
import { accountingApi, type FiscalYear } from '@/lib/accounting-api'

/**
 * Apex ERP Topbar — single dark-navy bar, matching the reference:
 *   right → ☰ · logo
 *   middle → fiscal period · 🔔 · language · الادارة · company
 *   left  → avatar · name/role · logout icon
 */
/** Arabic label for the most relevant role — roles[0] is arbitrary (Frappe order). */
const ROLE_LABELS: [string, string][] = [
  ['Administrator', 'مدير النظام'],
  ['System Manager', 'مدير النظام'],
  ['HR Manager', 'مدير الموارد البشرية'],
  ['HR User', 'مستخدم الموارد البشرية'],
  ['Company Admin', 'مدير الشركة'],
  ['Employee', 'موظف'],
]
function roleLabel(roles?: string[]): string {
  const have = new Set(roles || [])
  return ROLE_LABELS.find(([r]) => have.has(r))?.[1] || roles?.[0] || 'مدير النظام'
}

const SHOW_COMPANY_NAME = false

/** dd-mm-yyyy → dd/mm/yyyy, matching the reference's fiscal-period label. */
const fmtDMY = (d: string) => {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

export function Topbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const brand = useBrand()
  const { company: activeCompany } = useCompanySafe()

  // ── Fiscal year from backend ──────────────────────────────────────────────
  const [fiscalLabel, setFiscalLabel] = useState<string>('')
  const [currentFyName, setCurrentFyName] = useState<string>('')
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([])
  const [fyOpen, setFyOpen] = useState(false)
  const [fySaving, setFySaving] = useState(false)
  const [fyRefreshTick, setFyRefreshTick] = useState(0)

  // Auth/brand/company data only exists on the client. Rendering it during SSR and
  // again with data on hydration breaks Radix ids, so auth-derived bits mount-only.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      accountingApi.getCurrentFiscalYear(activeCompany ?? undefined),
      accountingApi.getFiscalYears(),
    ])
      .then(([fy, years]) => {
        if (cancelled) return
        if (fy) {
          setFiscalLabel(`${fmtDMY(fy.year_end_date)} - ${fmtDMY(fy.year_start_date)}`)
          setCurrentFyName(fy.name)
        }
        setFiscalYears(years)
      })
      .catch(() => { /* non-blocking */ })
    return () => { cancelled = true }
  }, [activeCompany, fyRefreshTick])

  const selectFiscalYear = async (fy: FiscalYear) => {
    if (fySaving) return
    if (fy.name === currentFyName) { setFyOpen(false); return }
    setFySaving(true)
    try {
      await frappeClient.call('base_meena.api.hr_settings.save_fiscal_year', {
        start: fy.year_start_date,
        end: fy.year_end_date,
      })
      setFyOpen(false)
      setFyRefreshTick((n) => n + 1)
    } catch (e) {
      console.error('Failed to switch fiscal year:', e)
    } finally {
      setFySaving(false)
    }
  }

  const userName = mounted ? (user?.full_name || user?.email || 'مدير النظام') : 'مدير النظام'
  const userRole = mounted ? roleLabel(user?.roles) : 'مدير النظام'

  return (
    <header className="shrink-0 z-40" dir="rtl">
      <div className="h-[55px] bg-[var(--apex-blue-light)] text-white flex items-center justify-between gap-3 px-4 shadow-sm">

        {/* ── Right (start): hamburger + logo ── */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => {
              // Matches the live reference: the hamburger only substitutes for the
              // full rail below its `lg` breakpoint (aside is `hidden lg:flex`
              // there too) — clicking it at desktop width does nothing in Apex
              // (verified against the reference), because the full sidebar is
              // already showing; opening the mobile drawer on top of it there
              // is what produced the "two sidebars" bug.
              if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) return
              onOpenMobileNav()
            }}
            title="القائمة"
            aria-label="القائمة"
            className="flex items-center justify-center w-9 h-9 rounded hover:bg-white/10 transition-colors shrink-0"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link href="/hr" className="flex items-center gap-2 shrink-0">
            {mounted && brand.logo ? (
              <span className="relative block h-9 w-[120px] shrink-0">
                <Image src={brand.logo} alt="Logo" fill sizes="120px" className="object-contain" unoptimized />
              </span>
            ) : (
              <>
                <span className="font-serif italic font-bold text-[24px] leading-none tracking-wide">Apex</span>
                <span className="bg-white text-[var(--apex-blue-deep)] rounded px-1.5 py-[3px] text-[11px] font-extrabold not-italic leading-none">ERP</span>
              </>
            )}
          </Link>
        </div>

        {/* ── Middle: fiscal · bell · language · company · breadcrumb ── */}
        <div className="hidden md:flex items-center gap-2.5 flex-1 min-w-0 justify-end">

          {mounted && fiscalLabel && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[12px] font-bold whitespace-nowrap">{t('nav.fiscal_period') || 'الفترة المالية'}</span>
              {fiscalYears.length > 1 ? (
                <Popover open={fyOpen} onOpenChange={setFyOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={fySaving}
                      className="flex items-center gap-1.5 bg-white text-[var(--apex-blue-deep)] rounded px-2.5 py-1 text-[12px] font-bold whitespace-nowrap disabled:opacity-60"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{fiscalLabel}</span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-60 p-1.5" dir="rtl">
                    {fiscalYears.map((fy) => (
                      <button
                        key={fy.name}
                        type="button"
                        onClick={() => selectFiscalYear(fy)}
                        className="flex w-full items-center justify-between gap-2 rounded px-2.5 py-2 text-[13px] text-slate-700 hover:bg-slate-100"
                      >
                        <span>{fy.name}</span>
                        {fy.name === currentFyName && <Check className="h-3.5 w-3.5 text-[var(--apex-blue)]" />}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              ) : (
                <span className="flex items-center gap-1.5 bg-white text-[var(--apex-blue-deep)] rounded px-2.5 py-1 text-[12px] font-bold whitespace-nowrap">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{fiscalLabel}</span>
                </span>
              )}
            </div>
          )}

          {mounted && (
            <div className="text-white shrink-0 [&_button]:text-white [&_svg]:text-white">
              <NotificationsPanel />
            </div>
          )}

          {/* «الادارة» — Apex module switcher; the HR shell is the only module here */}
          <span className="hidden xl:block h-5 w-px bg-white/30 shrink-0" />
          <Link href="/hr" className="hidden xl:inline text-[12.5px] font-medium hover:text-white/80 whitespace-nowrap">الادارة</Link>
          <span className="hidden xl:block h-5 w-px bg-white/30 shrink-0" />

          {/* Company name hidden per client request until the system is handed
              over to the receiving company (2026-09-16) — flip SHOW_COMPANY_NAME
              back on at handover. */}
          {SHOW_COMPANY_NAME && mounted && activeCompany && (
            <span className="hidden xl:inline font-bold truncate max-w-[260px] text-[13px]" title={activeCompany}>
              {activeCompany}
            </span>
          )}
        </div>

        {/* ── Left (end): avatar · name/role (login-free build: no logout) ── */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center overflow-hidden shrink-0">
            {mounted && user?.user_image ? (
              <Image src={user.user_image} alt={userName} width={36} height={36} className="object-cover" unoptimized />
            ) : (
              <UserCircle2 className="h-8 w-8 text-white/90 mt-1" />
            )}
          </div>

          <div className="hidden sm:flex flex-col leading-tight min-w-0 text-start">
            <span className="text-[13px] font-bold truncate max-w-[160px]">{userName}</span>
            <span className="text-[11px] text-white/75 truncate max-w-[160px]">{userRole}</span>
          </div>

          {/* Real logout (2026-09-16): calls the raw API directly (not the
              AuthContext logout(), which sets user=null while still mounted here
              and trips hr-guard's walkthrough-relogin fallback before this
              navigation can land) and hard-navigates to /login only once the
              server session is actually gone. */}
          <button
            onClick={() => { apiLogout().finally(() => { window.location.href = '/login' }) }}
            title="خروج"
            aria-label="خروج"
            className="ms-2 flex items-center justify-center w-9 h-9 rounded hover:bg-white/10"
          >
            <LogOut className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Feature-phase topbar widgets (seam for future additions) */}
      <div className="hidden">
        {TOPBAR_ACTIONS.map((Action, i) => <Action key={i} />)}
      </div>
    </header>
  )
}
