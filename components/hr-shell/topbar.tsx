'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Menu, Globe, Building2, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { useBrand } from '@/hooks/use-brand'
import { useCompanySafe } from '@/hooks/use-company'
import { NotificationsPanel } from '@/components/notifications-panel'
import { GlobalSearch } from './global-search'
import { UserMenu } from './user-menu'
import { TOPBAR_ACTIONS, FINGERPRINT_HOME } from './routes'

/** Jisr-style top bar for the HR shell. */
export function Topbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const { t, lang, setLang } = useI18n()
  const { hrFingerprintOnly } = useAuth()
  // Per-tenant lockup. app.name/app.subtitle are GENERIC i18n strings («تمكين»),
  // so without this every white-labelled tenant saw the platform's own brand once
  // logged in even with a logo configured — only the login page honoured it.
  const brand = useBrand()
  const { company: activeCompany, isAdmin, allCompanies, switchCompany } = useCompanySafe()

  return (
    <header className="h-14 bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-40">
      <div className="h-full px-3 md:px-5 flex items-center gap-3">
        {/* Mobile nav trigger */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenMobileNav}
          aria-label="Menu"
          className="h-9 w-9 text-muted-foreground hover:bg-accent rounded-lg lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Logo — the attendance-only package rebrands to "تمكين حضور" and links to
            its own home (the HR dashboard is out of that package's bundle). */}
        <Link href={hrFingerprintOnly ? FINGERPRINT_HOME : '/hr'} className="flex items-center gap-2.5 flex-shrink-0">
          <Image src={brand.logo || '/logo.jpeg'} alt={brand.appName || 'Tamkeen'} width={32} height={32} className="rounded-lg object-cover" />
          <div className="hidden sm:block leading-tight">
            <h1 className="text-sm font-bold text-foreground">{brand.appName || t(hrFingerprintOnly ? 'app.attendance_name' : 'app.name')}</h1>
            <p className="text-[10px] text-muted-foreground">{brand.tagline || t(hrFingerprintOnly ? 'app.attendance_subtitle' : 'app.subtitle')}</p>
          </div>
        </Link>

        {/* Global search — centered, grows. Hidden for the attendance-only package
            (it would surface HR pages/modules outside that package's bundle). */}
        <div className="flex-1 flex justify-center px-2">
          {!hrFingerprintOnly && <GlobalSearch />}
        </div>

        {/* End cluster */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {TOPBAR_ACTIONS.map((Action, i) => <Action key={i} />)}

          {/* Company switcher (admin, multi-company) */}
          {isAdmin && allCompanies.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 px-2.5 rounded-lg text-muted-foreground hover:bg-accent flex items-center gap-1.5">
                  <Building2 className="h-[18px] w-[18px]" />
                  <span className="text-xs font-medium hidden sm:inline max-w-[100px] truncate">{activeCompany || t('header.all_companies')}</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 max-h-72 overflow-y-auto">
                <DropdownMenuLabel>{t('header.switch_company')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {allCompanies.map((c) => (
                  <DropdownMenuItem key={c} onClick={() => switchCompany(c)} className={activeCompany === c ? 'bg-accent text-primary font-medium' : ''}>
                    <Building2 className="me-2 h-4 w-4 flex-shrink-0" /><span className="truncate">{c}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Language toggle — globe icon only (label lives in tooltip/aria) */}
          <Button
            variant="ghost"
            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
            title={t('lang.switch')}
            aria-label={t('lang.switch')}
            className="h-9 w-9 p-0 rounded-lg text-muted-foreground hover:bg-accent flex items-center justify-center"
          >
            <Globe className="h-[18px] w-[18px]" />
          </Button>

          <NotificationsPanel />

          <div className="w-px h-6 bg-border mx-1 hidden sm:block" />

          <UserMenu />
        </div>
      </div>
    </header>
  )
}
