'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Per-tenant logo: derive `/<subdomain>.png` from the host (e.g.
 * rifad.base.meena.sa → /rifad.png). Returns null until resolved or if the file
 * 404s (the caller falls back to the generic icon).
 */
function useTenantLogo(): { src: string | null; fail: () => void } {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    try {
      const sub = window.location.hostname.split('.')[0]
      if (sub) setSrc(`/${sub}.png`)
    } catch { /* */ }
  }, [])
  return { src, fail: () => setSrc(null) }
}
import {
  LayoutDashboard, Users, FileText, Receipt, Menu, X, Languages, Briefcase,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { LoginPage } from '@/components/login-page'
import { Button } from '@/components/ui/button'

// ---------------------------------------------------------------------------
// Dedicated freelancer nav — NOT the company ERP sidebar.
// ---------------------------------------------------------------------------

interface NavItem {
  href: string
  labelKey: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { href: '/freelancer', labelKey: 'fl.nav.dashboard', icon: LayoutDashboard },
  { href: '/freelancer/clients', labelKey: 'fl.nav.clients', icon: Users },
  { href: '/freelancer/proposals', labelKey: 'fl.nav.proposals', icon: FileText },
  { href: '/freelancer/invoices', labelKey: 'fl.nav.invoices', icon: Receipt },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/freelancer') return pathname === '/freelancer'
  return pathname === href || pathname.startsWith(href + '/')
}

export function FreelancerShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const { t, isRTL, lang, setLang } = useI18n()
  const pathname = usePathname() || ''
  const [mobileOpen, setMobileOpen] = useState(false)
  const logo = useTenantLogo()

  if (isLoading) {
    return (
      <div className="theme-freelancer min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) return <LoginPage />

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => {
        const active = isActive(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Icon className="h-4.5 w-4.5 shrink-0" />
            <span className="truncate">{t(labelKey)}</span>
          </Link>
        )
      })}
    </nav>
  )

  const Brand = () => (
    <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-200">
      {logo.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo.src} alt="" onError={logo.fail} className="h-9 w-9 rounded-lg object-contain shadow-sm" />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(var(--fl-green-light))] to-[hsl(var(--fl-green))] text-white shadow-sm">
          <Briefcase className="h-5 w-5" />
        </div>
      )}
      <div className="leading-tight">
        <p className="text-sm font-bold text-slate-900">{isRTL ? 'مساحة المستقلّين' : 'Freelancer'}</p>
        <p className="text-[11px] text-slate-500">{isRTL ? 'Freelancer Workspace' : 'مساحة المستقلّين'}</p>
      </div>
    </div>
  )

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="theme-freelancer min-h-screen bg-slate-50 text-slate-900">
      {/* Top header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label={isRTL ? 'فتح القائمة' : 'Open menu'}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 lg:hidden">
            <Briefcase className="h-5 w-5 text-primary" />
            <span className="text-sm font-bold">{isRTL ? 'مساحة المستقلّين' : 'Freelancer'}</span>
          </div>
          <h1 className="hidden text-sm font-semibold text-slate-700 lg:block">
            {isRTL ? 'مساحة المستقلّين — Freelancer Workspace' : 'Freelancer Workspace — مساحة المستقلّين'}
          </h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
          className="gap-1.5"
        >
          <Languages className="h-4 w-4" />
          {lang === 'ar' ? 'EN' : 'ع'}
        </Button>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 border-e border-slate-200 bg-white lg:block">
          <Brand />
          <NavLinks />
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileOpen(false)}
            />
            <div
              className={`absolute top-0 ${isRTL ? 'right-0' : 'left-0'} h-full w-72 bg-white shadow-xl`}
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <span className="text-sm font-bold">{isRTL ? 'مساحة المستقلّين' : 'Freelancer'}</span>
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label={isRTL ? 'إغلاق' : 'Close'}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <NavLinks onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="min-w-0 flex-1 p-4 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
