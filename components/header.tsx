import { Search, Bell, User, UserCircle, ChevronDown, Menu, Globe, LogOut, Settings as SettingsIcon, Shield, Building2, ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Home, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { useAuth, useAuthSafe } from '@/lib/auth-context'
import { useCompanySafe } from '@/hooks/use-company'
import { useBrand } from '@/hooks/use-brand'
import { frappeImageUrl } from '@/lib/utils'
import { frappeClient, type Employee } from '@/lib/api-client'
import { rankEmployees } from '@/lib/employee-search'
import { NotificationsPanel } from '@/components/notifications-panel'
import { useToast } from '@/hooks/use-toast'
import { useState, useEffect, useRef, Fragment } from 'react'
import { useBreadcrumbs } from '@/lib/breadcrumbs'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

interface HeaderProps {
  onToggleSidebar?: () => void
  sidebarExpanded?: boolean
  showHomeButton?: boolean
}

export function Header({ onToggleSidebar, sidebarExpanded, showHomeButton }: HeaderProps) {
  const { t, lang, setLang, isRTL } = useI18n()
  const { user, logout: authLogout, isHRUser } = useAuthSafe()
  const { company: activeCompany, isAdmin, allCompanies, userCompany, switchCompany } = useCompanySafe()
  const router = useRouter()
  const pathname = usePathname()
  const isHome = pathname === '/' || pathname === ''
  const { toast } = useToast()
  const crumbs = useBreadcrumbs()

  // Smart back: navigate to the nearest ancestor that has an href, else browser back
  const handleBack = () => {
    const parentCrumb = [...crumbs.slice(0, -1)].reverse().find(c => c.href)
    if (parentCrumb?.href) router.push(parentCrumb.href)
    else router.back()
  }
  const brand = useBrand()  // per-tenant lockup; falls back to the platform brand
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [employeeResults, setEmployeeResults] = useState<Employee[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Search modules and pages
  const searchItems = [
    { title: t('nav.dashboard'), path: '/', keywords: ['dashboard', 'لوحة', 'رئيسي'] },
    { title: t('nav.employees'), path: '/employees', keywords: ['employees', 'موظفين', 'عمال'] },
    { title: t('nav.attendance'), path: '/attendance', keywords: ['attendance', 'حضور', 'غياب'] },
    { title: t('nav.leaves'), path: '/leaves', keywords: ['leaves', 'إجازات', 'عطل'] },
    { title: t('nav.payroll'), path: '/payroll', keywords: ['payroll', 'رواتب', 'مرتبات'] },
    { title: t('nav.settings'), path: '/?module=settings', keywords: ['settings', 'إعدادات', 'ضبط'] },
    { title: t('nav.shift_management'), path: '/shift-management', keywords: ['shifts', 'شفتات', 'ورديات'] },
    { title: t('nav.location_tracking'), path: '/location-tracking', keywords: ['location', 'موقع', 'تتبع'] },
    { title: t('nav.radius_alerts'), path: '/radius-alerts', keywords: ['alerts', 'تنبيهات', 'إشعارات'] },
    { title: t('nav.inventory'), path: '/inventory', keywords: ['inventory', 'مخزون', 'stock', 'مستودع'] },
    { title: t('nav.purchases'), path: '/purchases', keywords: ['purchases', 'purchasing', 'مشتريات', 'موردين', 'suppliers'] },
    { title: t('nav.biometric'), path: '/biometric', keywords: ['biometric', 'fingerprint', 'بصمة', 'zkteco', 'أجهزة', 'devices'] },
  ]

  // Module/page matches — instant local filter, live from the FIRST character.
  useEffect(() => {
    const query = searchQuery.trim().toLowerCase()
    if (query.length < 1) {
      setSearchResults([])
      setShowResults(false)
      return
    }
    const results = searchItems.filter(item =>
      item.title.toLowerCase().includes(query) ||
      item.keywords.some(keyword => keyword.toLowerCase().includes(query))
    ).slice(0, 4)
    setSearchResults(results)
    setShowResults(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

  // Employee matches — comprehensive server search (name/ID/phone/national-ID/
  // email/plate…), live from the first character, debounced ~300ms, HR-only.
  // Ranked so exact > starts-with > contains, then capped to the top 8.
  useEffect(() => {
    const query = searchQuery.trim()
    if (query.length < 1 || !isHRUser) {
      setEmployeeResults([])
      setSearchLoading(false)
      return
    }
    setSearchLoading(true)
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const rows = await frappeClient.searchEmployees(query)
        if (!cancelled) setEmployeeResults(rankEmployees(rows, query).slice(0, 8))
      } catch (err) {
        if (!cancelled) setEmployeeResults([])
      } finally {
        if (!cancelled) setSearchLoading(false)
      }
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [searchQuery, isHRUser])

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    try {
      await authLogout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Force-clear cookies client-side as a safety net
      document.cookie = 'sid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
      document.cookie = 'user_id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
      document.cookie = 'system_user=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
      document.cookie = 'user_image=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
      document.cookie = 'full_name=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
      toast({
        title: t('header.logout_success_title'),
        description: t('header.logout_success_desc'),
      })
      router.push('/login')
    }
  }

  return (
    <header className="border-b border-gray-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="h-16 px-4 md:px-6 flex items-center justify-between gap-3">
      {/* Left: Back + Logo + Toggle */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="h-9 w-9 text-gray-500 hover:bg-gray-100 rounded-lg lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        {!isHome && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            title={t('nav.back')}
            className="h-9 w-9 text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            {isRTL ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
          </Button>
        )}
        {showHomeButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/')}
            title={t('header.home')}
            className="h-9 w-9 text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            <Home className="h-5 w-5" />
          </Button>
        )}
        <div className="flex items-center gap-2.5">
          <Image
            src={brand.logo || '/logo.jpeg'}
            alt={brand.appName || 'Tamkeen'}
            width={36}
            height={36}
            className="rounded-lg object-cover"
          />
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold text-gray-900 leading-tight">{brand.appName || t('app.name')}</h1>
            <p className="text-[10px] text-gray-400 leading-tight">{brand.tagline || t('app.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Center: Global Search */}
      <div className="flex-1 flex justify-center px-4 max-w-xl mx-auto">
        <div className="w-full" ref={searchRef}>
          <div className="relative flex items-center">
            <Search className={`absolute ${isRTL ? 'right-3.5' : 'left-3.5'} h-4 w-4 text-gray-400`} />
            <input
              type="text"
              placeholder={t('header.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.trim().length >= 1 && setShowResults(true)}
              className={`w-full h-10 ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} rounded-xl bg-gray-50 text-gray-900 placeholder-gray-400 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-sm transition-all`}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
            <kbd className={`absolute ${isRTL ? 'left-3' : 'right-3'} hidden md:inline-flex h-5 items-center gap-1 rounded border border-gray-200 bg-white px-1.5 text-[10px] font-medium text-gray-400`}>
              ⌘K
            </kbd>

            {/* Search Results Dropdown — live employee suggestions + modules */}
            {showResults && (searchLoading || employeeResults.length > 0 || searchResults.length > 0) && (
              <div className={`absolute top-full mt-2 ${isRTL ? 'right-0' : 'left-0'} w-full bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-[100] max-h-96 overflow-y-auto`}>
                {/* Employees */}
                {(searchLoading || employeeResults.length > 0) && (
                  <>
                    <div className="px-4 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      {t('header.employees')}
                    </div>
                    {searchLoading && employeeResults.length === 0 && (
                      <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        {t('header.searching')}
                      </div>
                    )}
                    {employeeResults.map((emp) => (
                      <Link
                        key={emp.name}
                        href={`/employee/${encodeURIComponent(emp.name)}`}
                        onClick={() => { setShowResults(false); setSearchQuery('') }}
                        className="block px-4 py-2 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {emp.image ? (
                            <Image src={frappeImageUrl(emp.image)} alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                              <UserCircle className="h-5 w-5 text-blue-400" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{emp.employee_name}</p>
                            <p className="text-xs text-gray-400 truncate">
                              {emp.name}
                              {emp.designation ? ` · ${emp.designation}` : ''}
                              {emp.cell_number ? ` · ${emp.cell_number}` : ''}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                    {searchResults.length > 0 && <div className="my-1 border-t border-gray-100" />}
                  </>
                )}

                {/* Modules / pages */}
                {searchResults.length > 0 && (
                  <>
                    <div className="px-4 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      {t('header.modules')}
                    </div>
                    {searchResults.map((result, index) => (
                      <Link
                        key={index}
                        href={result.path}
                        onClick={() => { setShowResults(false); setSearchQuery('') }}
                        className="block px-4 py-2.5 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Search className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">{result.title}</span>
                        </div>
                      </Link>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Company Switcher, Language, Notifications & User */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Company Switcher (Admin only) */}
        {isAdmin && allCompanies.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-9 px-2.5 rounded-lg text-gray-500 hover:bg-gray-100 flex items-center gap-1.5"
              >
                <Building2 className="h-[18px] w-[18px]" />
                <span className="text-xs font-medium hidden sm:inline max-w-[100px] truncate">
                  {activeCompany || t('header.all_companies')}
                </span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 max-h-72 overflow-y-auto">
              <DropdownMenuLabel>{t('header.switch_company')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {allCompanies.map((c) => (
                <DropdownMenuItem
                  key={c}
                  onClick={() => switchCompany(c)}
                  className={activeCompany === c ? 'bg-blue-50 text-blue-700 font-medium' : ''}
                >
                  <Building2 className="mr-2 h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{c}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Language Toggle — globe icon only (label lives in tooltip/aria) */}
        <Button
          variant="ghost"
          onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
          title={t('lang.switch')}
          aria-label={t('lang.switch')}
          className="h-9 w-9 p-0 rounded-lg text-gray-500 hover:bg-gray-100 flex items-center justify-center"
        >
          <Globe className="h-[18px] w-[18px]" />
        </Button>

        {/* Notifications Panel */}
        <NotificationsPanel />

        <div className="w-px h-6 bg-gray-200 mx-1 hidden sm:block" />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-9 px-2.5 rounded-lg flex items-center gap-2 text-gray-700 hover:bg-gray-100"
            >
              {user?.user_image ? (
                <img src={frappeImageUrl(user.user_image)} alt="" className="w-7 h-7 rounded-lg object-cover" />
              ) : (
                <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-semibold shadow-sm">
                  {user?.full_name?.charAt(0)?.toUpperCase() || 'A'}
                </div>
              )}
              <span className="hidden sm:inline text-sm font-medium">{user?.full_name || t('header.admin')}</span>
              {activeCompany && (
                <span className="hidden md:inline-flex text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium items-center gap-1 max-w-[120px] truncate" title={activeCompany}>
                  <Building2 className="h-3 w-3 flex-shrink-0" />
                  {activeCompany}
                </span>
              )}
              {isAdmin && (
                <span className="hidden md:inline-flex text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium items-center gap-1">
                  <Shield className="h-3 w-3" />
                  {t('header.admin')}
                </span>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span>{user?.full_name || t('header.my_account')}</span>
              <span className="text-xs font-normal text-gray-500">{user?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile" className="flex items-center cursor-pointer">
                <UserCircle className="mr-2 h-4 w-4" />
                <span>{t('ssp.my_profile')}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/hr-settings" className="flex items-center cursor-pointer">
                <SettingsIcon className="mr-2 h-4 w-4" />
                <span>{t('header.hr_settings')}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/hr-managers" className="flex items-center cursor-pointer">
                <Shield className="mr-2 h-4 w-4" />
                <span>{t('header.permissions')}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>{t('header.logout')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      </div>

      {/* Breadcrumb trail — only when 2+ levels deep */}
      {crumbs.length > 1 && (
        <div className={`h-9 px-4 md:px-6 border-t border-gray-100 bg-gray-50/60 flex items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Breadcrumb>
            <BreadcrumbList>
              {crumbs.map((crumb, idx) => {
                const isLast = idx === crumbs.length - 1
                return (
                  <Fragment key={idx}>
                    {idx > 0 && (
                      <BreadcrumbSeparator>
                        {isRTL ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </BreadcrumbSeparator>
                    )}
                    <BreadcrumbItem>
                      {isLast ? (
                        <BreadcrumbPage className="text-xs font-medium text-gray-700">{crumb.label}</BreadcrumbPage>
                      ) : crumb.href ? (
                        <BreadcrumbLink asChild className="text-xs text-gray-400 hover:text-gray-600">
                          <Link href={crumb.href}>{crumb.label}</Link>
                        </BreadcrumbLink>
                      ) : (
                        <span className="text-xs text-gray-400">{crumb.label}</span>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      )}
    </header>
  )
}
