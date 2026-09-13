/**
 * Sales Reps & POS Module - Main Page
 * Complete POS operations: Reps, Customers, Visits, Routes, Inventory, Payments, Reports
 */

'use client'

import { useState, useEffect, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import { LoginPage } from '@/components/login-page'
import { Toaster } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import {
  LayoutDashboard, UserCheck, MapPin, Route, BarChart3,
  ChevronLeft, ChevronRight, ChevronDown, Home, LogOut, ArrowLeft, ArrowRight, Users2,
  Users, Package, CreditCard, FileBarChart, Calendar, Map, Truck, ArrowLeftRight, Wallet,
  RefreshCw, ShoppingCart, AlertTriangle, TrendingUp, Layers, Percent,
} from 'lucide-react'
import { salesApi, localDateISO } from '@/lib/sales-api'
import { useCompany } from '@/hooks/use-company'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Sales components
import { SalesRepsList } from '@/components/sales/sales-reps-list'
import { SalesLangSwitcher } from '@/components/sales/lang-switcher'
import { CustomersList } from '@/components/sales/customers-list'
import { CustomerGroupsAdmin } from '@/components/sales/customer-groups-admin'
import { VisitsList } from '@/components/sales/visits-list'
import { TodaysSchedule } from '@/components/sales/todays-schedule'
import { RoutePlansList } from '@/components/sales/route-plans-list'
const RouteMapPage = dynamic(() => import('@/components/sales/route-map-page').then(m => m.RouteMapPage), { ssr: false, loading: () => <div className="h-[400px] rounded-lg bg-gray-100 animate-pulse" /> })
const RepStopsTracker = dynamic(() => import('@/components/sales/rep-stops-tracker').then(m => m.RepStopsTracker), { ssr: false, loading: () => <div className="h-[400px] rounded-lg bg-gray-100 animate-pulse" /> })
import { RouteAnalyticsList } from '@/components/sales/route-analytics-list'
import { InventoryManagement } from '@/components/sales/inventory-management'
import { PaymentEntries } from '@/components/sales/payment-entries'
import { ReportsDashboard } from '@/components/sales/reports-dashboard'
import { DeliveryNotesList } from '@/components/sales/delivery-notes-list'
import { StockRequestsAdmin } from '@/components/sales/stock-requests-admin'
import { WalletManagement } from '@/components/sales/wallet-management'
import { CommissionManagement } from '@/components/sales/commission-management'

export type SalesRepsSection =
  | 'dashboard' | 'sales-reps' | 'customers' | 'customer-groups' | 'visits' | 'todays-schedule'
  | 'route-plans' | 'route-map' | 'route-analytics' | 'stops'
  | 'inventory' | 'delivery-notes' | 'stock-requests' | 'payments' | 'wallets' | 'commission' | 'reports'

interface RepsNavItem {
  id: SalesRepsSection
  labelKey: string
  icon: React.ReactNode
  color: string
}

interface RepsNavSection {
  titleKey: string
  items: RepsNavItem[]
}

const repsNavSections: RepsNavSection[] = [
  {
    titleKey: '',
    items: [
      { id: 'dashboard', labelKey: 'sr.admin.nav.dashboard', icon: <LayoutDashboard className="h-4 w-4" />, color: 'text-blue-600' },
    ],
  },
  {
    titleKey: 'sr.admin.nav.section_people',
    items: [
      { id: 'sales-reps', labelKey: 'sr.admin.nav.reps', icon: <UserCheck className="h-4 w-4" />, color: 'text-blue-600' },
      { id: 'customers', labelKey: 'sr.admin.nav.customers', icon: <Users className="h-4 w-4" />, color: 'text-emerald-600' },
      { id: 'customer-groups', labelKey: 'sr.admin.nav.customer_groups', icon: <Layers className="h-4 w-4" />, color: 'text-emerald-700' },
    ],
  },
  {
    titleKey: 'sr.admin.nav.section_field_ops',
    items: [
      { id: 'todays-schedule', labelKey: 'sr.admin.nav.todays_schedule', icon: <Calendar className="h-4 w-4" />, color: 'text-violet-600' },
      { id: 'visits', labelKey: 'sr.admin.nav.visits', icon: <MapPin className="h-4 w-4" />, color: 'text-rose-600' },
    ],
  },
  {
    titleKey: 'sr.admin.nav.section_route_planning',
    items: [
      { id: 'route-plans', labelKey: 'sr.admin.nav.route_plans', icon: <Route className="h-4 w-4" />, color: 'text-cyan-600' },
      { id: 'route-map', labelKey: 'sr.admin.nav.route_map', icon: <Map className="h-4 w-4" />, color: 'text-teal-600' },
      { id: 'stops', labelKey: 'sr.admin.nav.stops', icon: <MapPin className="h-4 w-4" />, color: 'text-amber-600' },
      { id: 'route-analytics', labelKey: 'sr.admin.nav.analytics', icon: <BarChart3 className="h-4 w-4" />, color: 'text-orange-600' },
    ],
  },
  {
    titleKey: 'sr.admin.nav.section_operations',
    items: [
      { id: 'inventory', labelKey: 'sr.admin.nav.inventory', icon: <Package className="h-4 w-4" />, color: 'text-amber-600' },
      { id: 'stock-requests', labelKey: 'sr.admin.nav.stock_requests', icon: <ArrowLeftRight className="h-4 w-4" />, color: 'text-violet-600' },
      { id: 'delivery-notes', labelKey: 'sr.admin.nav.delivery_notes', icon: <Truck className="h-4 w-4" />, color: 'text-cyan-600' },
      { id: 'payments', labelKey: 'sr.admin.nav.payments', icon: <CreditCard className="h-4 w-4" />, color: 'text-green-600' },
      { id: 'wallets', labelKey: 'sr.admin.nav.wallets', icon: <Wallet className="h-4 w-4" />, color: 'text-emerald-600' },
      { id: 'commission', labelKey: 'sr.admin.nav.commission', icon: <Percent className="h-4 w-4" />, color: 'text-rose-600' },
    ],
  },
  {
    titleKey: 'sr.admin.nav.section_insights',
    items: [
      { id: 'reports', labelKey: 'sr.admin.nav.reports', icon: <FileBarChart className="h-4 w-4" />, color: 'text-indigo-600' },
    ],
  },
]

export default function SalesRepsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-[3px] border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SalesRepsPageContent />
    </Suspense>
  )
}

function SalesRepsPageContent() {
  const { isAuthenticated, isLoading, isSalesRepsUser, isAdmin, logout, user } = useAuth()
  const { isRTL, t, dir } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeSection, setActiveSection] = useState<SalesRepsSection>('dashboard')
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [tenantBrand, setTenantBrand] = useState<{ name?: string; icon?: string } | null>(null)
  // Scoped warm theme for themed sales tenants (e.g. لذعة → "theme-lazaa", globals.css).
  // "" for Mandoob and every other tenant → the shell below renders unchanged.
  const [themeClass, setThemeClass] = useState('')
  // Tenant flag `rep_backoffice:false` (hiddenFeatures via /sales-brand): plain reps
  // (Sales User, not manager/admin) are locked to the PWA — the back office redirects
  // them to /sales-rep. Default ON for every tenant → behaviour unchanged elsewhere.
  const [repBackofficeHidden, setRepBackofficeHidden] = useState(false)
  const isBackOfficeUser =
    isAdmin || (user?.roles?.some((r) => ['Sales Manager', 'Sales Master Manager'].includes(r)) ?? false)
  const repLockedOut = repBackofficeHidden && !isBackOfficeUser

  // Tenant brand (sales-flavor tenants only): tab title + favicon + sidebar
  // logo/name from /sales-brand. The shared root layout carries the legacy
  // default title, which is wrong for a rebranded sales client; non-sales
  // tenants keep all defaults.
  useEffect(() => {
    try {
      const snap = localStorage.getItem('sales_theme') || ''
      if (snap) setThemeClass(`theme-${snap}`)
    } catch { /* */ }
    let cancelled = false
    fetch('/sales-brand')
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        if (cancelled || !b || b.tenantType !== 'sales') return
        const icon = b.icon192 || b.logo || undefined
        setTenantBrand({ name: b.appName || undefined, icon })
        if (b.appName) document.title = b.appName
        const theme = b.theme ? String(b.theme) : ''
        setThemeClass(theme ? `theme-${theme}` : '')
        try { localStorage.setItem('sales_theme', theme) } catch { /* */ }
        if (Array.isArray(b.hiddenFeatures) && b.hiddenFeatures.includes('rep_backoffice')) {
          setRepBackofficeHidden(true)
        }
        if (icon) {
          let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null
          if (!link) {
            link = document.createElement('link')
            link.rel = 'icon'
            document.head.appendChild(link)
          }
          link.href = icon
        }
      })
      .catch(() => { /* keep defaults */ })
    return () => { cancelled = true }
  }, [])

  // Sync section from URL
  useEffect(() => {
    const section = searchParams.get('section') as SalesRepsSection | null
    if (section) setActiveSection(section)
  }, [searchParams])

  const handleSectionChange = (section: SalesRepsSection) => {
    setActiveSection(section)
    router.replace(`/sales-reps?section=${section}`, { scroll: false })
  }

  // Rep locked out of the back office (tenant flag) → send them to their PWA.
  useEffect(() => {
    if (repLockedOut && !isLoading && isAuthenticated) router.replace('/sales-rep')
  }, [repLockedOut, isLoading, isAuthenticated, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Image src="/logo.jpeg" alt="Tamkeen" width={56} height={56} priority className="rounded-2xl mx-auto mb-4 animate-pulse shadow-lg" />
          <div className="w-8 h-8 border-[3px] border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">{t('sr.admin.common.loading')}</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return <LoginPage />

  // Cover the page while the locked-out-rep redirect above navigates away.
  if (repLockedOut) {
    return (
      <div className={cn('min-h-screen flex items-center justify-center bg-gray-50', themeClass)}>
        <div className="text-center">
          <div className="w-8 h-8 border-[3px] border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">{t('sr.admin.common.loading')}</p>
        </div>
      </div>
    )
  }

  if (!isSalesRepsUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users2 className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('sr.admin.nav.unauthorized_title')}</h2>
          <p className="text-gray-500 mb-4">{t('sr.admin.nav.unauthorized_desc')}</p>
          <button onClick={() => router.push('/')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            {t('sr.admin.nav.go_home')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex h-screen bg-[#f4f5f7] overflow-hidden", themeClass)} dir={dir}>
      {/* ── Dark Sidebar ── */}
      <aside className={cn(
        'relative flex flex-col h-full bg-slate-900 flex-shrink-0 transition-all duration-300 ease-in-out group/sidebar',
        sidebarExpanded ? 'w-[232px]' : 'w-[60px]'
      )}>
        {/* Brand header */}
        <div className={cn(
          'flex items-center gap-3 px-3 py-4 border-b border-slate-800',
          !sidebarExpanded && 'justify-center'
        )}>
          {tenantBrand?.icon ? (
            <img
              src={tenantBrand.icon}
              alt=""
              className="w-8 h-8 rounded-xl object-cover flex-shrink-0 shadow-lg bg-white"
            />
          ) : (
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-900/40">
              <UserCheck className="h-4 w-4 text-white" />
            </div>
          )}
          {sidebarExpanded && (
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-white truncate leading-tight">{tenantBrand?.name ?? t('sr.admin.nav.brand_title')}</p>
              <p className="text-[10px] text-slate-500 truncate">{t('sr.admin.nav.brand_subtitle')}</p>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
          className={cn(
            'absolute top-[52px] z-20 w-5 h-5 bg-slate-700 border border-slate-600 rounded-full flex items-center justify-center shadow-md hover:bg-slate-600 transition-all opacity-0 group-hover/sidebar:opacity-100',
            isRTL ? '-left-2.5' : '-right-2.5'
          )}
        >
          {sidebarExpanded
            ? (isRTL ? <ChevronRight className="h-2.5 w-2.5 text-slate-300" /> : <ChevronLeft className="h-2.5 w-2.5 text-slate-300" />)
            : (isRTL ? <ChevronLeft className="h-2.5 w-2.5 text-slate-300" /> : <ChevronRight className="h-2.5 w-2.5 text-slate-300" />)
          }
        </button>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 space-y-0.5 scrollbar-none">
          {repsNavSections.map((section, sIdx) => (
            <div key={sIdx} className={cn(sIdx > 0 && 'mt-4')}>
              {section.titleKey && sidebarExpanded && (
                <p className={cn(
                  'text-[9px] font-bold text-slate-600 uppercase tracking-[0.12em] px-3 mb-1',
                  isRTL && 'text-right'
                )}>
                  {t(section.titleKey)}
                </p>
              )}
              {section.titleKey && !sidebarExpanded && sIdx > 0 && (
                <div className="h-px bg-slate-800 mx-1 my-2" />
              )}
              {section.items.map((item) => {
                const isActive = activeSection === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSectionChange(item.id)}
                    title={!sidebarExpanded ? t(item.labelKey) : undefined}
                    className={cn(
                      'w-full flex items-center gap-2.5 rounded-xl transition-all duration-150 relative group/item',
                      sidebarExpanded ? 'px-3 py-2' : 'px-0 py-2.5 justify-center',
                      isActive
                        ? 'bg-violet-600/20 text-white'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    )}
                  >
                    {isActive && (
                      <div className={cn(
                        'absolute top-1/2 -translate-y-1/2 w-0.5 h-5 bg-violet-400 rounded-full',
                        isRTL ? 'right-0' : 'left-0'
                      )} />
                    )}
                    <span className={cn('flex-shrink-0', isActive ? 'text-violet-300' : '')}>{item.icon}</span>
                    {sidebarExpanded && (
                      <span className={cn('text-[13px]', isActive ? 'font-semibold text-white' : 'font-medium')}>
                        {t(item.labelKey)}
                      </span>
                    )}
                    {!sidebarExpanded && (
                      <div className={cn(
                        'absolute px-2.5 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/item:opacity-100 transition-opacity shadow-xl z-50 border border-slate-700',
                        isRTL ? 'right-full mr-2' : 'left-full ml-2'
                      )}>
                        {t(item.labelKey)}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className={cn('border-t border-slate-800 p-2 space-y-0.5')}>
          {sidebarExpanded && (
            <div className="px-1 pb-1.5">
              <SalesLangSwitcher compact className="w-full justify-between bg-slate-800 border-slate-700" />
            </div>
          )}
          <button
            onClick={() => router.push('/')}
            className={cn(
              'w-full flex items-center gap-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-blue-400 transition-colors group/item relative',
              sidebarExpanded ? 'px-3 py-2' : 'px-0 py-2.5 justify-center'
            )}
          >
            <Home className="h-4 w-4 flex-shrink-0" />
            {sidebarExpanded && <span className="text-[13px] font-medium">{t('sr.admin.nav.home')}</span>}
            {!sidebarExpanded && (
              <div className={cn(
                'absolute px-2.5 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/item:opacity-100 transition-opacity shadow-xl z-50 border border-slate-700',
                isRTL ? 'right-full mr-2' : 'left-full ml-2'
              )}>
                {t('sr.admin.nav.home')}
              </div>
            )}
          </button>
          <button
            onClick={logout}
            className={cn(
              'w-full flex items-center gap-2.5 rounded-xl text-slate-400 hover:bg-red-900/30 hover:text-red-400 transition-colors group/item relative',
              sidebarExpanded ? 'px-3 py-2' : 'px-0 py-2.5 justify-center'
            )}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {sidebarExpanded && <span className="text-[13px] font-medium">{t('sr.admin.nav.logout')}</span>}
            {!sidebarExpanded && (
              <div className={cn(
                'absolute px-2.5 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/item:opacity-100 transition-opacity shadow-xl z-50 border border-slate-700',
                isRTL ? 'right-full mr-2' : 'left-full ml-2'
              )}>
                {t('sr.admin.nav.logout')}
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-3 h-14 px-4 bg-white border-b border-gray-200/80 flex-shrink-0">
          <button
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className={cn('flex-1 flex items-center gap-2', isRTL && 'flex-row-reverse')}>
            <span className="text-xs text-gray-400">{t('sr.admin.nav.module_title')}</span>
            <span className="text-xs text-gray-300">/</span>
            <span className="text-xs font-semibold text-gray-700">
              {(() => {
                const activeItem = repsNavSections.flatMap(s => s.items).find(i => i.id === activeSection)
                return activeItem ? t(activeItem.labelKey) : activeSection
              })()}
            </span>
          </div>
          <button onClick={() => router.push('/')} className="text-xs text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1.5">
            <Home className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('sr.admin.nav.home')}</span>
          </button>

          {/* Account menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-gray-100 transition-colors" aria-label={t('sr.admin.nav.logout')}>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                  {(user?.full_name || user?.email || 'A').charAt(0).toUpperCase()}
                </div>
                <ChevronDown className="h-3 w-3 text-gray-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="w-56">
              <DropdownMenuLabel>
                <p className="text-sm font-semibold truncate">{user?.full_name || t('sr.admin.nav.module_title')}</p>
                {user?.email && <p className="text-xs font-normal text-gray-400 truncate" dir="ltr">{user.email}</p>}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/')}>
                <Home className="h-4 w-4 mr-2" /> {t('sr.admin.nav.home')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout} className="text-red-600 focus:text-red-600">
                <LogOut className="h-4 w-4 mr-2" /> {t('sr.admin.nav.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          {activeSection === 'dashboard' && <RepsDashboard onNavigate={handleSectionChange} />}
          {activeSection === 'sales-reps' && <SalesRepsList />}
          {activeSection === 'customers' && <CustomersList />}
          {activeSection === 'customer-groups' && <CustomerGroupsAdmin />}
          {activeSection === 'todays-schedule' && <TodaysSchedule />}
          {activeSection === 'visits' && <VisitsList />}
          {activeSection === 'route-plans' && <RoutePlansList />}
          {activeSection === 'route-map' && <RouteMapPage />}
          {activeSection === 'stops' && <RepStopsTracker />}
          {activeSection === 'route-analytics' && <RouteAnalyticsList />}
          {activeSection === 'inventory' && <InventoryManagement />}
          {activeSection === 'stock-requests' && <StockRequestsAdmin />}
          {activeSection === 'delivery-notes' && <DeliveryNotesList />}
          {activeSection === 'payments' && <PaymentEntries />}
          {activeSection === 'wallets' && <WalletManagement />}
          {activeSection === 'commission' && <CommissionManagement />}
          {activeSection === 'reports' && <ReportsDashboard />}
        </main>
      </div>
      <Toaster />
    </div>
  )
}


/** Dashboard for Sales Reps & POS module with live KPI stats */
function RepsDashboard({ onNavigate }: { onNavigate: (s: SalesRepsSection) => void }) {
  const { isRTL, t } = useI18n()
  const { company: activeCompany } = useCompany()

  const [stats, setStats] = useState<{
    totalReps: number
    activeReps: number
    visitsToday: number
    ordersToday: number
    unpaidInvoices: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadStats = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      const today = localDateISO()
      const [reps, visits, orders, invoices] = await Promise.all([
        // Same source + scoping as the Sales Reps page (leaf reps of the
        // active company) so the KPI can never disagree with the list.
        salesApi.getSalesPersons({ company: activeCompany || undefined, limit_page_length: 500 }).catch(() => [] as any[]),
        salesApi.getVisits({ filters: [['Sales Person Visit', 'visit_date', '=', today]] as any, limit_page_length: 500, fields: ['name', 'visit_status'] as any }).catch(() => [] as any[]),
        salesApi.getSalesOrders({ filters: [['Sales Order', 'transaction_date', '=', today]] as any, limit_page_length: 500, fields: ['name', 'docstatus'] }).catch(() => [] as any[]),
        salesApi.getSalesInvoices({ filters: [['Sales Invoice', 'status', 'in', ['Unpaid', 'Overdue']]] as any, limit_page_length: 0, fields: ['name'] }).catch(() => [] as any[]),
      ])
      setStats({
        totalReps: reps.length,
        activeReps: reps.filter((r: any) => r.enabled !== 0).length,
        visitsToday: visits.length,
        ordersToday: orders.filter((o: any) => o.docstatus !== 2).length,
        unpaidInvoices: invoices.length,
      })
    } catch (e) {
      console.error('Dashboard stats error', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeCompany])

  useEffect(() => { loadStats() }, [loadStats])

  return (
    <div className="min-h-screen bg-gray-50/80">

      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden bg-white border-b border-gray-100">
        {/* Decorative blobs */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 left-8 w-32 h-32 bg-violet-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative px-6 py-5">
          <div className={cn('flex items-center justify-between', isRTL && 'flex-row-reverse')}>
            <div className={cn('flex items-center gap-4', isRTL && 'flex-row-reverse')}>
              <div className="relative">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <ShoppingCart className="h-5 w-5 text-white" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-gray-900 tracking-tight leading-none">
                  {t('sr.admin.nav.module_title')}
                </h1>
                <p className="text-[11px] text-gray-400 mt-1">
                  {t('sr.admin.stats.hero_subtitle')}
                </p>
              </div>
            </div>
            <button
              onClick={() => loadStats(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors py-1.5 px-2.5 rounded-lg hover:bg-gray-100"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              <span className="hidden sm:inline">{t('sr.admin.stats.refresh')}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-5">

        {/* ── KPI Row ── */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {([
              { label: t('sr.admin.stats.active_reps'), value: stats?.activeReps ?? 0, hint: `/ ${stats?.totalReps ?? 0}`, Icon: UserCheck, accent: 'bg-blue-500', ring: 'ring-blue-100', section: 'sales-reps' as SalesRepsSection },
              { label: t('sr.admin.stats.todays_visits'), value: stats?.visitsToday ?? 0, Icon: MapPin, accent: 'bg-violet-500', ring: 'ring-violet-100', section: 'visits' as SalesRepsSection },
              { label: t('sr.admin.stats.todays_orders'), value: stats?.ordersToday ?? 0, Icon: ShoppingCart, accent: 'bg-emerald-500', ring: 'ring-emerald-100', section: 'payments' as SalesRepsSection },
              { label: t('sr.admin.stats.unpaid'), value: stats?.unpaidInvoices ?? 0, Icon: AlertTriangle, accent: (stats?.unpaidInvoices ?? 0) > 0 ? 'bg-rose-500' : 'bg-slate-300', ring: 'ring-rose-100', section: 'payments' as SalesRepsSection },
            ] as const).map((card, i) => {
              const Icon = card.Icon
              return (
                <button
                  key={i}
                  onClick={() => onNavigate(card.section)}
                  className={cn(
                    'bg-white rounded-2xl p-4 text-start shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 ring-1 ring-gray-100',
                    isRTL && 'text-right'
                  )}
                >
                  <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center mb-3 ring-4', card.accent, card.ring)}>
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-gray-900 leading-none tabular-nums">{card.value}</span>
                    {'hint' in card && card.hint && <span className="text-sm text-gray-400 font-medium">{card.hint}</span>}
                  </div>
                  <p className="text-[11px] font-semibold text-gray-500 mt-1.5 truncate">{card.label}</p>
                </button>
              )
            })}
          </div>
        )}

        {/* ── Alert ── */}
        {!loading && (stats?.unpaidInvoices ?? 0) > 0 && (
          <button
            onClick={() => onNavigate('payments')}
            className={cn(
              'w-full flex items-center gap-3 bg-gradient-to-r from-rose-500 to-pink-600 rounded-2xl px-4 py-3 hover:opacity-90 transition-opacity shadow-md shadow-rose-200',
              isRTL ? 'flex-row-reverse text-right' : 'text-left'
            )}
          >
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-4 w-4 text-white" />
            </div>
            <p className="flex-1 text-sm font-bold text-white min-w-0">
              {t('sr.admin.stats.unpaid_alert').replace('{count}', String(stats?.unpaidInvoices ?? 0))}
            </p>
            <ArrowRight className={cn('h-4 w-4 text-white/70 flex-shrink-0', isRTL && 'rotate-180')} />
          </button>
        )}

        {/* ── Nav Sections ── */}
        {([
          {
            titleKey: 'sr.admin.nav.section_people',
            cards: [
              { id: 'sales-reps', labelKey: 'sr.admin.nav.card_reps', descKey: 'sr.admin.nav.card_reps_desc', Icon: UserCheck, color: 'bg-blue-500' },
              { id: 'customers', labelKey: 'sr.admin.nav.customers', descKey: 'sr.admin.nav.card_customers_desc', Icon: Users, color: 'bg-emerald-500' },
              { id: 'customer-groups', labelKey: 'sr.admin.nav.customer_groups', descKey: 'sr.admin.nav.card_customer_groups_desc', Icon: Layers, color: 'bg-emerald-600' },
            ],
          },
          {
            titleKey: 'sr.admin.nav.section_field_ops',
            cards: [
              { id: 'todays-schedule', labelKey: 'sr.admin.nav.todays_schedule', descKey: 'sr.admin.nav.card_schedule_desc', Icon: Calendar, color: 'bg-violet-500' },
              { id: 'visits', labelKey: 'sr.admin.nav.card_visits', descKey: 'sr.admin.nav.card_visits_desc', Icon: MapPin, color: 'bg-rose-500' },
            ],
          },
          {
            titleKey: 'sr.admin.nav.section_route_planning',
            cards: [
              { id: 'route-plans', labelKey: 'sr.admin.nav.route_plans', descKey: 'sr.admin.nav.card_route_plans_desc', Icon: Route, color: 'bg-cyan-500' },
              { id: 'route-map', labelKey: 'sr.admin.nav.route_map', descKey: 'sr.admin.nav.card_route_map_desc', Icon: Map, color: 'bg-teal-500' },
              { id: 'stops', labelKey: 'sr.admin.nav.stops', descKey: 'sr.admin.nav.card_stops_desc', Icon: MapPin, color: 'bg-amber-500' },
              { id: 'route-analytics', labelKey: 'sr.admin.nav.card_analytics', descKey: 'sr.admin.nav.card_analytics_desc', Icon: BarChart3, color: 'bg-orange-500' },
            ],
          },
          {
            titleKey: 'sr.admin.nav.section_ops_finance',
            cards: [
              { id: 'inventory', labelKey: 'sr.admin.nav.inventory', descKey: 'sr.admin.nav.card_inventory_desc', Icon: Package, color: 'bg-amber-500' },
              { id: 'stock-requests', labelKey: 'sr.admin.nav.stock_requests', descKey: 'sr.admin.nav.card_stock_requests_desc', Icon: ArrowLeftRight, color: 'bg-violet-500' },
              { id: 'delivery-notes', labelKey: 'sr.admin.nav.delivery_notes', descKey: 'sr.admin.nav.card_delivery_notes_desc', Icon: Truck, color: 'bg-sky-500' },
              { id: 'payments', labelKey: 'sr.admin.nav.payments', descKey: 'sr.admin.nav.card_payments_desc', Icon: CreditCard, color: 'bg-green-500' },
              { id: 'wallets', labelKey: 'sr.admin.nav.wallets', descKey: 'sr.admin.nav.card_wallets_desc', Icon: Wallet, color: 'bg-emerald-500' },
              { id: 'commission', labelKey: 'sr.admin.nav.commission', descKey: 'sr.admin.nav.card_commission_desc', Icon: Percent, color: 'bg-rose-500' },
              { id: 'reports', labelKey: 'sr.admin.nav.reports', descKey: 'sr.admin.nav.card_reports_desc', Icon: FileBarChart, color: 'bg-indigo-500' },
            ],
          },
        ] as const).map((section, sIdx) => (
          <div key={sIdx} className="space-y-2">
            {/* Label row */}
            <div className={cn('flex items-center gap-2.5', isRTL && 'flex-row-reverse')}>
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
                {t(section.titleKey)}
              </span>
              <div className="flex-1 h-px bg-gray-200/80" />
            </div>

            {/* Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
              {section.cards.map(card => {
                const Icon = card.Icon
                return (
                  <button
                    key={card.id}
                    onClick={() => onNavigate(card.id as SalesRepsSection)}
                    className={cn(
                      'group bg-white rounded-2xl p-3.5 transition-all duration-150 shadow-sm ring-1 ring-gray-100 hover:ring-gray-200 hover:shadow-lg',
                      isRTL ? 'text-right' : 'text-left'
                    )}
                  >
                    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-2.5', card.color)}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <p className="text-[12px] font-bold text-gray-900 leading-snug">
                      {t(card.labelKey)}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5 leading-snug line-clamp-2">
                      {t(card.descKey)}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        <div className="pb-4" />
      </div>
    </div>
  )
}
