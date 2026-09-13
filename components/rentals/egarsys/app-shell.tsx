'use client'

// Ported from egarsys src/app/page.tsx — the app shell: right-side sidebar +
// top bar + section frame, section-based navigation (not routes). Trimmed to
// the rentals sections; notification bell / command palette / login dropped.

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Menu, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/rentals/egarsys/ui/button'
import { ShareLinkButton, buildRentalsLink } from '@/components/rentals/egarsys/ui/share-link-button'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { RentalsShellProvider, useRentalsShell, type PendingFocus } from '@/components/rentals/egarsys/store'
import AppSidebar from '@/components/rentals/egarsys/app-sidebar'
import { SectionPlaceholder } from '@/components/rentals/egarsys/section-placeholder'

// Once-a-day «تذكير اليوم» popup (overdue + due-soon tenants). Lazy + client-only:
// it self-gates on localStorage and self-hides when empty / on fetch error.
const DailyPaymentsReminder = dynamic(
  () => import('@/components/rentals/egarsys/daily-payments-reminder'),
  { ssr: false },
)

const DashboardSection = dynamic(
  () => import('@/components/rentals/egarsys/dashboard'),
  { ssr: false },
)

const ContractsSection = dynamic(
  () => import('@/components/rentals/egarsys/contracts'),
  { ssr: false },
)

const EndedContractsSection = dynamic(
  () => import('@/components/rentals/egarsys/ended-contracts'),
  { ssr: false },
)

const InvoicesSection = dynamic(
  () => import('@/components/rentals/egarsys/invoices'),
  { ssr: false },
)

const PropertiesSection = dynamic(
  () => import('@/components/rentals/egarsys/properties'),
  { ssr: false },
)

const TenantsSection = dynamic(
  () => import('@/components/rentals/egarsys/tenants'),
  { ssr: false },
)

const ContractsSummarySection = dynamic(
  () => import('@/components/rentals/egarsys/contracts-summary'),
  { ssr: false },
)

const PropertyStatementSection = dynamic(
  () => import('@/components/rentals/egarsys/property-statement'),
  { ssr: false },
)

const ZatcaSection = dynamic(
  () => import('@/components/rentals/egarsys/zatca'),
  { ssr: false },
)

const AccountingSection = dynamic(
  () => import('@/components/rentals/egarsys/accounting'),
  { ssr: false },
)

const HrSection = dynamic(
  () => import('@/components/rentals/egarsys/hr'),
  { ssr: false },
)

const SECTION_TITLES: Record<string, string> = {
  dashboard: 'لوحة التحكم',
  contracts: 'العقود',
  'ended-contracts': 'أرشيف العقود',
  'contracts-summary': 'مختصر العقارات',
  'property-statement': 'جرد العقارات',
  invoices: 'الفواتير',
  zatca: 'الفوترة الإلكترونية',
  properties: 'العقارات',
  tenants: 'المستأجرون',
  accounting: 'المحاسبة',
  hr: 'الموارد البشرية',
}

// Whitelist for deep-link `?section=` — every id the render switch understands.
const VALID_SECTIONS = new Set(Object.keys(SECTION_TITLES))

function Shell() {
  const { currentSection, setCurrentSection, companyName, theme, toggleTheme, mounted } = useRentalsShell()
  const isDark = theme === 'dark'
  const router = useRouter()

  // URL sync — keep the address bar reflecting the current view so any state can be
  // shared/reloaded (mirrors hr/page.tsx). router.replace (not push) → doesn't fight
  // the back button; a deep-link's type/key drop off once its section is shown (the
  // record focus already lives in pendingFocus state, so nothing is lost).
  useEffect(() => {
    const target =
      currentSection === 'dashboard'
        ? '/rentals-native'
        : `/rentals-native?section=${encodeURIComponent(currentSection)}`
    router.replace(target, { scroll: false })
  }, [currentSection, router])

  // Fallback for unknown sections: land on the dashboard rather than a dead placeholder.
  useEffect(() => {
    if (!VALID_SECTIONS.has(currentSection)) setCurrentSection('dashboard')
  }, [currentSection, setCurrentSection])

  const renderSection = () => {
    switch (currentSection) {
      case 'dashboard':
        return <DashboardSection />
      case 'contracts':
        return <ContractsSection />
      case 'ended-contracts':
        return <EndedContractsSection />
      case 'contracts-summary':
        return <ContractsSummarySection />
      case 'property-statement':
        return <PropertyStatementSection />
      case 'invoices':
        return <InvoicesSection />
      case 'zatca':
        return <ZatcaSection />
      case 'properties':
        return <PropertiesSection />
      case 'tenants':
        return <TenantsSection />
      case 'accounting':
        return <AccountingSection />
      case 'hr':
        return <HrSection />
      default:
        return <SectionPlaceholder title={SECTION_TITLES[currentSection] || 'القسم'} />
    }
  }

  return (
    <SidebarProvider>
      <div
        className={cn('flex h-screen w-full overflow-hidden', isDark && 'dark egarsys-dark')}
        dir="rtl"
      >
        <AppSidebar />

        <main className="flex-1 min-w-0 flex flex-col min-h-0">
          <header className="shrink-0 z-30 flex items-center gap-3 px-4 lg:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 bg-background/95 backdrop-blur-sm border-b">
            <SidebarTrigger>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SidebarTrigger>

            {/* Active company branding (start / right in RTL) */}
            {companyName && (
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-full px-3 py-1">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {companyName}
                </span>
              </div>
            )}

            <div className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground mr-2">
              <span>الرئيسية</span>
              <span className="text-[10px]">›</span>
              <span className="text-foreground font-medium">
                {SECTION_TITLES[currentSection] || 'لوحة التحكم'}
              </span>
            </div>

            <div className="flex-1" />

            {/* Mowatheq badge with Mina logo (end / left in RTL) */}
            <div className="flex items-center gap-1.5 px-3 py-1 border border-emerald-200 bg-emerald-50 rounded-full text-emerald-700">
              <img src="/rentals-native/logo.jpg" alt="مينا العقارية" className="w-4 h-4 object-contain rounded-sm" />
              <span className="text-xs font-bold">برنامج موثّق</span>
            </div>

            {/* Share the CURRENT page (module) as a deep link. Gated on `mounted`
                so window.location.origin is available (no SSR/hydration mismatch). */}
            {mounted && (
              <ShareLinkButton
                url={buildRentalsLink(currentSection)}
                label="مشاركة"
                title="مشاركة هذه الصفحة"
                variant="ghost"
                className="hidden sm:inline-flex"
              />
            )}

            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={toggleTheme}
                title={isDark ? 'الوضع النهاري' : 'الوضع الليلي'}
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            )}
          </header>

          <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            {renderSection()}
          </div>
        </main>

        {/* Fires on app open regardless of the active section (self-gated once/day). */}
        <DailyPaymentsReminder />
      </div>
    </SidebarProvider>
  )
}

export default function RentalsAppShell() {
  // URL → state (deep link): read once for the FIRST mount. `?section=` picks the
  // module; `?type=&key=` additionally focuses a record via that section's
  // pendingFocus consumer. Invalid sections are dropped (fall back to dashboard).
  // Requires a <Suspense> boundary above (see rentals-native/page.tsx).
  const searchParams = useSearchParams()
  const rawSection = searchParams.get('section')
  const initialSection = rawSection && VALID_SECTIONS.has(rawSection) ? rawSection : undefined
  const type = searchParams.get('type')
  const key = searchParams.get('key')
  const initialFocus: PendingFocus =
    initialSection && type && key ? { section: initialSection, contentType: type, key } : null

  return (
    <RentalsShellProvider initialSection={initialSection} initialFocus={initialFocus}>
      <Shell />
    </RentalsShellProvider>
  )
}
