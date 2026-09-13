'use client'

import { ReactNode, Suspense } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import { Header } from '@/components/header'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Building2, Lock, Flag, Search, MessageCircle, Star, ShieldCheck, Settings, FileText, Inbox } from 'lucide-react'

/** Subtle Najdi/Sadu geometric accent — restrained, within tenant theming. */
function NajdiAccent() {
  return (
    <div
      aria-hidden
      className="h-1 w-full"
      style={{
        backgroundImage:
          'repeating-linear-gradient(135deg, var(--primary-color, #047857) 0, var(--primary-color, #047857) 6px, transparent 6px, transparent 12px)',
        opacity: 0.5,
      }}
    />
  )
}

function SubNav() {
  const { t } = useI18n()
  const { user } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  // Settings is for Manager+Admin (and visible to Moderator as read-only).
  const reRoles = ['Real Estate Manager', 'Real Estate Moderator', 'Administrator', 'System Manager']
  const showSettings = user?.roles?.some((r) => reRoles.includes(r)) ?? false
  const nav = [
    { href: '/real-estate', label: t('re.dashboard'), icon: LayoutDashboard, exact: true },
    { href: '/real-estate/listings', label: t('re.listings'), icon: Building2 },
    { href: '/real-estate/messages', label: t('re.messages'), icon: MessageCircle },
    { href: '/real-estate/promotions', label: t('re.promotions'), icon: Star },
    { href: '/real-estate/property-requests', label: t('re.propertyRequests'), icon: Search },
    { href: '/real-estate/contracts', label: t('re.contractRequests'), icon: FileText },
    { href: '/real-estate/leads', label: t('re.incomingLeads'), icon: Inbox },
    { href: '/real-estate/moderation', label: t('re.moderationReports'), icon: Flag },
    { href: '/real-estate/compliance', label: t('re.compliance'), icon: ShieldCheck },
    ...(showSettings ? [{ href: '/real-estate/settings', label: t('re.settings'), icon: Settings }] : []),
  ]
  return (
    <nav className="flex gap-1 overflow-x-auto py-3">
      {nav.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors',
              active ? 'bg-emerald-700 text-white' : 'text-gray-600 hover:bg-emerald-50',
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}

export default function RealEstateLayout({ children }: { children: ReactNode }) {
  const { moduleAccess, isLoading, isAuthenticated } = useAuth()
  const { isRTL } = useI18n()

  if (!isLoading && isAuthenticated && !moduleAccess.realEstate) {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'}>
        <Suspense fallback={<div className="h-16" />}>
          <Header />
        </Suspense>
        <div className="mx-auto mt-20 max-w-md rounded-2xl border-2 border-gray-100 p-8 text-center">
          <Lock className="mx-auto mb-3 h-8 w-8 text-gray-400" />
          <p className="text-gray-600">
            {isRTL ? 'ليس لديك صلاحية الوصول إلى متجر العقارات' : 'You do not have access to the Real Estate Marketplace'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      <Suspense fallback={<div className="h-16" />}>
        <Header />
        <NajdiAccent />
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SubNav />
          <main className="pb-16">{children}</main>
        </div>
      </Suspense>
    </div>
  )
}
