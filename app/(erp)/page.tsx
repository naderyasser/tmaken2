'use client'

import { useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, type UserModuleAccess } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import { LoginPage } from '@/components/login-page'
import { FINGERPRINT_HOME } from '@/components/hr-shell/routes'
import { Toaster } from '@/components/ui/toaster'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Header } from '@/components/header'
import {
  Users, Shield, ArrowRight, ArrowLeft,
  Lock, Users2, Boxes, Truck, ShoppingCart, Calculator, ClipboardList, Building2, UserCog, KeyRound
} from 'lucide-react'

interface SystemModule {
  id: keyof UserModuleAccess
  labelEn: string
  labelAr: string
  descEn: string
  descAr: string
  icon: React.ReactNode
  color: string
  bgLight: string
  bgGradient: string
  borderColor: string
  href: string
  /** Given the module ids this tenant has, true when the module is reachable from
   *  inside another one and so should not spend a card of its own. */
  hiddenWhen?: (availableModules: string[]) => boolean
}

const SYSTEM_MODULES: SystemModule[] = [
  {
    id: 'hr',
    labelEn: 'Human Resources',
    labelAr: 'الموارد البشرية',
    descEn: 'Employees, Attendance, Leaves, Payroll, Shifts',
    descAr: 'الموظفين، الحضور، الإجازات، الرواتب، الورديات',
    icon: <Users className="h-7 w-7" />,
    color: 'text-blue-600',
    bgLight: 'bg-blue-50',
    bgGradient: 'from-blue-500 to-blue-700',
    borderColor: 'border-blue-200 hover:border-blue-400',
    href: '/hr',
  },
  {
    id: 'salesReps',
    labelEn: 'Sales Reps & POS',
    labelAr: 'المناديب ونقاط البيع',
    descEn: 'Representatives, Visits, Route Plans, Analytics',
    descAr: 'المناديب، الزيارات، خطط المسارات، التحليلات',
    icon: <Users2 className="h-7 w-7" />,
    color: 'text-violet-600',
    bgLight: 'bg-violet-50',
    bgGradient: 'from-violet-500 to-violet-700',
    borderColor: 'border-violet-200 hover:border-violet-400',
    href: '/sales-reps',
  },
  // Folded into the Sales screen (see session-header) — but only where Sales exists.
  // A stock-only tenant has no other door in, so there it keeps its own card.
  {
    id: 'inventory',
    hiddenWhen: (available) => available.includes('cashier'),
    labelEn: 'Inventory Management',
    labelAr: 'إدارة المخزون',
    descEn: 'Warehouses, Transfers, Returns, Stock Movements',
    descAr: 'المستودعات، النقل، المرتجعات، حركات المخزون',
    icon: <Boxes className="h-7 w-7" />,
    color: 'text-orange-600',
    bgLight: 'bg-orange-50',
    bgGradient: 'from-orange-500 to-amber-600',
    borderColor: 'border-orange-200 hover:border-orange-400',
    href: '/inventory',
  },
  {
    id: 'purchases',
    labelEn: 'Purchases',
    labelAr: 'المشتريات',
    descEn: 'Suppliers, Purchase Orders, Receipts, Invoices',
    descAr: 'الموردين، أوامر الشراء، الاستلام، الفواتير',
    icon: <Truck className="h-7 w-7" />,
    color: 'text-emerald-600',
    bgLight: 'bg-emerald-50',
    bgGradient: 'from-emerald-500 to-emerald-700',
    borderColor: 'border-emerald-200 hover:border-emerald-400',
    href: '/purchases',
  },
  {
    id: 'cashier',
    labelEn: 'Sales',
    labelAr: 'المبيعات',
    descEn: 'POS Sessions, Sales, Payments, Reports',
    descAr: 'جلسات البيع، المبيعات، المدفوعات، التقارير',
    icon: <ShoppingCart className="h-7 w-7" />,
    color: 'text-green-600',
    bgLight: 'bg-green-50',
    bgGradient: 'from-green-500 to-emerald-600',
    borderColor: 'border-green-200 hover:border-green-400',
    href: '/cashier',
  },
  {
    id: 'admin',
    labelEn: 'System Administration',
    labelAr: 'إدارة النظام',
    descEn: 'Modules, Users, Settings, Domains',
    descAr: 'الموديولات، المستخدمين، الإعدادات، النطاقات',
    icon: <Shield className="h-7 w-7" />,
    color: 'text-indigo-600',
    bgLight: 'bg-indigo-50',
    bgGradient: 'from-indigo-500 to-indigo-700',
    borderColor: 'border-indigo-200 hover:border-indigo-400',
    href: '/admin',
  },
  {
    id: 'accounting',
    labelEn: 'Accounting',
    labelAr: 'المحاسبة',
    descEn: 'Chart of Accounts, Journal Entries, Trial Balance, Reports',
    descAr: 'شجرة الحسابات، قيود اليومية، ميزان المراجعة، التقارير',
    icon: <Calculator className="h-7 w-7" />,
    color: 'text-indigo-600',
    bgLight: 'bg-indigo-50',
    bgGradient: 'from-indigo-500 to-violet-600',
    borderColor: 'border-indigo-200 hover:border-indigo-400',
    href: '/accounting',
  },
  {
    id: 'tasks',
    labelEn: 'Workflow Tasks',
    labelAr: 'المهام التلقائية',
    descEn: 'Cross-module task automation, Kanban board, Timeline',
    descAr: 'أتمتة المهام بين الأقسام، لوحة كانبان، الجدول الزمني',
    icon: <ClipboardList className="h-7 w-7" />,
    color: 'text-teal-600',
    bgLight: 'bg-teal-50',
    bgGradient: 'from-teal-500 to-cyan-600',
    borderColor: 'border-teal-200 hover:border-teal-400',
    href: '/tasks',
  },
  {
    id: 'realEstate',
    labelEn: 'Real Estate Marketplace',
    labelAr: 'متجر العقارات',
    descEn: 'Listings, Advertisers, REGA Compliance, Promotions',
    descAr: 'الإعلانات، المعلنون، الامتثال للهيئة، الترقيات',
    icon: <Building2 className="h-7 w-7" />,
    color: 'text-emerald-700',
    bgLight: 'bg-emerald-50',
    bgGradient: 'from-emerald-600 to-green-800',
    borderColor: 'border-emerald-200 hover:border-emerald-400',
    href: '/real-estate',
  },
  {
    id: 'rentals',
    labelEn: 'Rentals (Meena)',
    labelAr: 'إدارة الإيجارات — مينا',
    descEn: 'Property management: contracts, tenants, invoices, collections',
    descAr: 'إدارة العقارات: العقود، المستأجرين، الفواتير، التحصيل',
    icon: <KeyRound className="h-7 w-7" />,
    color: 'text-amber-700',
    bgLight: 'bg-amber-50',
    bgGradient: 'from-amber-600 to-orange-800',
    borderColor: 'border-amber-200 hover:border-amber-400',
    href: '/rentals',
  },
  {
    // Native mirror of the rentals system INSIDE the platform (experiment).
    // Same gating id as the egarsys launcher card above; keys use href.
    id: 'rentals',
    labelEn: 'Rentals — Native (Beta)',
    labelAr: 'إدارة الإيجارات — المنصة (تجريبي)',
    descEn: 'The rentals data living natively in the platform: contracts, invoices, properties',
    descAr: 'بيانات الإيجارات داخل المنصة: العقود، الفواتير، العقارات، الملاك',
    icon: <Building2 className="h-7 w-7" />,
    color: 'text-teal-700',
    bgLight: 'bg-teal-50',
    bgGradient: 'from-teal-600 to-emerald-800',
    borderColor: 'border-teal-200 hover:border-teal-400',
    href: '/rentals-native',
  },
]

function ModuleHub() {
  const { isAuthenticated, isLoading, user, moduleAccess, availableModules, isCompanyAdmin, hrFingerprintOnly, hideAdminCards, logout } = useAuth()
  const { isRTL, t, lang, setLang } = useI18n()
  const router = useRouter()

  // What the hub would actually paint. Computed above the guards below so the
  // single-destination effect can depend on it.
  const showTeamCard = isCompanyAdmin && !hideAdminCards
  const isCardless = useCallback(
    (m: SystemModule) => (m.hiddenWhen?.(availableModules) ?? false) || (hideAdminCards && m.id === 'admin'),
    [availableModules, hideAdminCards],
  )
  const accessibleModules = useMemo(
    () => SYSTEM_MODULES.filter(m => moduleAccess[m.id] && !isCardless(m)),
    [moduleAccess, isCardless],
  )
  // Locked = present on this tenant but the user lacks the role. Modules that aren't
  // available at all (app not installed / feature off) are hidden entirely, not locked.
  const lockedModules = useMemo(
    () => SYSTEM_MODULES.filter(m => !moduleAccess[m.id] && !isCardless(m) && availableModules.includes(m.id)),
    [moduleAccess, availableModules, isCardless],
  )

  // True when HR is the tenant's whole business grant -- i.e. this really is the
  // attendance package (hudoor, demo-hr-fp) rather than a full tenant that happens
  // to run HR in fingerprint mode. `admin` and `tasks` are infrastructure grants
  // present on nearly every tenant, so they don't count as a second module.
  const hrIsOnlyBusinessModule = useMemo(() => {
    const business = availableModules.filter(m => m !== 'admin' && m !== 'tasks')
    return business.length === 1 && business[0] === 'hr'
  }, [availableModules])

  // Where login lands. Null means "paint the hub".
  //
  // `hr_fingerprint_only` must NOT decide this on its own. base_meena.api.permission
  // is explicit that the flag is orthogonal to the module grant -- it trims the HR
  // nav and nothing else -- but this used to redirect on the flag alone, which
  // skipped the hub for any tenant that also had cashier/inventory/purchases and
  // trapped them inside /attendance with no route to their other modules.
  const soleDestination = useMemo(() => {
    // The attendance package skips the hub outright, even for an admin who would
    // otherwise see a team card -- that is the behaviour those tenants shipped with.
    if (hrFingerprintOnly && hrIsOnlyBusinessModule) return FINGERPRINT_HOME
    if (accessibleModules.length === 1 && !showTeamCard && lockedModules.length === 0) {
      return accessibleModules[0].href
    }
    return null
  }, [hrFingerprintOnly, hrIsOnlyBusinessModule, accessibleModules, showTeamCard, lockedModules])

  useEffect(() => {
    if (!isLoading && isAuthenticated && soleDestination) {
      router.replace(soleDestination)
    }
  }, [isLoading, isAuthenticated, soleDestination, router])

  if (isLoading || (isAuthenticated && soleDestination)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Image src="/logo.jpeg" alt="Tamkeen" width={56} height={56} priority className="rounded-2xl mx-auto mb-4 animate-pulse shadow-lg" />
          <div className="w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  // If user only has access to one module, go directly there
  // (Uncomment below if you want auto-redirect for single-module users)
  // if (accessibleModules.length === 1) { router.replace(accessibleModules[0].href); return null }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <Header />

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Welcome */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isRTL ? `مرحباً، ${user?.full_name || ''}` : `Welcome, ${user?.full_name || ''}`}
          </h1>
          <p className="text-gray-500">
            {isRTL ? 'اختر النظام الذي تريد العمل عليه' : 'Choose the system you want to work on'}
          </p>
        </div>

        {/* Users & Team — company self-service user management (Company Admin / admin only).
            Rendered separately from module cards since it's gated by role, not module access. */}
        {showTeamCard && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
            <button
              onClick={() => router.push('/team')}
              className={cn(
                'group relative bg-white rounded-2xl border-2 p-6 text-start transition-all duration-200',
                'hover:shadow-lg hover:shadow-gray-200/50 hover:-translate-y-0.5',
                'border-sky-200 hover:border-sky-400'
              )}
            >
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 bg-sky-50">
                <span className="text-sky-600"><UserCog className="h-7 w-7" /></span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                {isRTL ? 'المستخدمون والفريق' : 'Users & Team'}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {isRTL ? 'إنشاء مستخدمي الشركة وتحديد صلاحياتهم' : 'Create company users and set their access'}
              </p>
              <div className={cn(
                'absolute top-6 flex items-center gap-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity',
                'text-sky-600',
                isRTL ? 'left-6' : 'right-6'
              )}>
                {isRTL ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              </div>
            </button>
          </div>
        )}

        {/* Accessible Modules */}
        {accessibleModules.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
            {accessibleModules.map((mod) => (
              <button
                key={mod.href}
                onClick={() => router.push(mod.href)}
                className={cn(
                  'group relative bg-white rounded-2xl border-2 p-6 text-start transition-all duration-200',
                  'hover:shadow-lg hover:shadow-gray-200/50 hover:-translate-y-0.5',
                  mod.borderColor
                )}
              >
                {/* Icon */}
                <div className={cn('w-14 h-14 rounded-xl flex items-center justify-center mb-4', mod.bgLight)}>
                  <span className={mod.color}>{mod.icon}</span>
                </div>

                {/* Text */}
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  {isRTL ? mod.labelAr : mod.labelEn}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {isRTL ? mod.descAr : mod.descEn}
                </p>

                {/* Arrow */}
                <div className={cn(
                  'absolute top-6 flex items-center gap-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity',
                  mod.color,
                  isRTL ? 'left-6' : 'right-6'
                )}>
                  {isRTL ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Locked Modules */}
        {lockedModules.length > 0 && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                <Lock className="h-3 w-3" />
                {isRTL ? 'غير متاح لك' : 'Not available to you'}
              </span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {lockedModules.map((mod) => (
                <div
                  key={mod.id}
                  className="relative bg-gray-50/50 rounded-2xl border-2 border-gray-100 p-6 opacity-50 cursor-not-allowed"
                >
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 bg-gray-100">
                    <span className="text-gray-400">{mod.icon}</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-400 mb-1">
                    {isRTL ? mod.labelAr : mod.labelEn}
                  </h3>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    {isRTL ? mod.descAr : mod.descEn}
                  </p>
                  <Lock className={cn('absolute top-6 h-4 w-4 text-gray-300', isRTL ? 'left-6' : 'right-6')} />
                </div>
              ))}
            </div>
          </>
        )}

        {/* Footer hint */}
        <p className="text-center text-xs text-gray-400 mt-12">
          {isRTL ? 'لا ترى النظام الذي تحتاجه؟ تواصل مع مدير النظام لتفعيل الصلاحيات.' : "Don't see a system you need? Contact your system administrator for access."}
        </p>
      </div>
      <Toaster />
    </div>
  )
}

export default function Home() {
  return <ModuleHub />
}