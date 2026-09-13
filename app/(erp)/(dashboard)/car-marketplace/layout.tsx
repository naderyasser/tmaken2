'use client'

import { ReactNode, Suspense } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import { Header } from '@/components/header'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Inbox, HandCoins, Boxes, Lock } from 'lucide-react'

/** Thin oxide-red accent matching the cars storefront brand. */
function CarsAccent() {
  return (
    <div
      aria-hidden
      className="h-1 w-full"
      style={{
        backgroundImage:
          'repeating-linear-gradient(135deg, #B25E54 0, #B25E54 6px, transparent 6px, transparent 12px)',
        opacity: 0.5,
      }}
    />
  )
}

function SubNav() {
  const { isRTL } = useI18n()
  const pathname = usePathname()
  const router = useRouter()
  const nav = [
    { href: '/car-marketplace', labelAr: 'لوحة التحكم', labelEn: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/car-marketplace/leads', labelAr: 'طلبات العملاء', labelEn: 'Leads', icon: Inbox },
    { href: '/car-marketplace/sell-requests', labelAr: 'طلبات بيع السيارات', labelEn: 'Sell Requests', icon: HandCoins },
    { href: '/car-marketplace/inventory', labelAr: 'إدارة المعروضات', labelEn: 'Inventory Control', icon: Boxes },
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
              active ? 'bg-[#8E4338] text-white' : 'text-gray-600 hover:bg-red-50',
            )}
          >
            <Icon className="h-4 w-4" />
            {isRTL ? item.labelAr : item.labelEn}
          </button>
        )
      })}
    </nav>
  )
}

export default function CarMarketplaceLayout({ children }: { children: ReactNode }) {
  const { moduleAccess, isLoading, isAuthenticated } = useAuth()
  const { isRTL } = useI18n()

  if (!isLoading && isAuthenticated && !moduleAccess.carMarketplace) {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'}>
        <Suspense fallback={<div className="h-16" />}>
          <Header />
        </Suspense>
        <div className="mx-auto mt-20 max-w-md rounded-2xl border-2 border-gray-100 p-8 text-center">
          <Lock className="mx-auto mb-3 h-8 w-8 text-gray-400" />
          <p className="text-gray-600">
            {isRTL ? 'ليس لديك صلاحية الوصول إلى سوق السيارات' : 'You do not have access to the Car Marketplace'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50/30">
      <Suspense fallback={<div className="h-16" />}>
        <Header />
        <CarsAccent />
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SubNav />
          <main className="pb-16">{children}</main>
        </div>
      </Suspense>
    </div>
  )
}
