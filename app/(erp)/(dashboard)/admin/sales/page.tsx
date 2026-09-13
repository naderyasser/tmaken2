/**
 * Sales Admin Module - Main Page
 * Hub page with sidebar navigation for all sales sub-modules
 */

'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import { LoginPage } from '@/components/login-page'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import {
  LayoutDashboard, Users, ShoppingCart, FileText, Receipt,
  Percent, Package, Truck, Wallet,
  Undo2, ChevronLeft, ChevronRight, Home, LogOut, ArrowLeft, ArrowRight,
} from 'lucide-react'

// Sales sub-page components
import { SalesDashboard } from '@/components/sales/sales-dashboard'
import { CustomersList } from '@/components/sales/customers-list'
import { SalesOrdersList } from '@/components/sales/sales-orders-list'
import { QuotationsList } from '@/components/sales/quotations-list'
import { SalesInvoicesList } from '@/components/sales/sales-invoices-list'
import { DiscountManagement } from '@/components/sales/discount-management'
import { InventoryManagement } from '@/components/sales/inventory-management'
import { ProductReturnsList } from '@/components/sales/product-returns-list'
import { DeliveryNotesList } from '@/components/sales/delivery-notes-list'
import { WalletManagement } from '@/components/sales/wallet-management'
import { Toaster } from '@/components/ui/toaster'

export type SalesSection =
  | 'dashboard' | 'customers' | 'sales-orders' | 'quotations' | 'invoices'
  | 'delivery-notes' | 'discounts' | 'inventory' | 'returns' | 'wallets'

interface SalesNavItem {
  id: SalesSection
  labelEn: string
  labelAr: string
  icon: React.ReactNode
  color: string
}

interface SalesNavSection {
  titleEn: string
  titleAr: string
  items: SalesNavItem[]
}

const salesNavSections: SalesNavSection[] = [
  {
    titleEn: '', titleAr: '',
    items: [
      { id: 'dashboard', labelEn: 'Dashboard', labelAr: 'لوحة التحكم', icon: <LayoutDashboard className="h-4 w-4" />, color: 'text-blue-600' },
    ],
  },
  {
    titleEn: 'Sales Pipeline', titleAr: 'خط المبيعات',
    items: [
      { id: 'customers', labelEn: 'Customers', labelAr: 'العملاء', icon: <Users className="h-4 w-4" />, color: 'text-emerald-600' },
      { id: 'quotations', labelEn: 'Quotations', labelAr: 'عروض الأسعار', icon: <FileText className="h-4 w-4" />, color: 'text-amber-600' },
      { id: 'sales-orders', labelEn: 'Sales Orders', labelAr: 'أوامر البيع', icon: <ShoppingCart className="h-4 w-4" />, color: 'text-indigo-600' },
      { id: 'invoices', labelEn: 'Invoices', labelAr: 'الفواتير', icon: <Receipt className="h-4 w-4" />, color: 'text-purple-600' },
      { id: 'delivery-notes', labelEn: 'Delivery Notes', labelAr: 'إذون التسليم', icon: <Truck className="h-4 w-4" />, color: 'text-cyan-600' },
    ],
  },
  {
    titleEn: 'Operations', titleAr: 'العمليات',
    items: [
      { id: 'discounts', labelEn: 'Discounts', labelAr: 'الخصومات', icon: <Percent className="h-4 w-4" />, color: 'text-pink-600' },
      { id: 'inventory', labelEn: 'Inventory', labelAr: 'المخزون', icon: <Package className="h-4 w-4" />, color: 'text-teal-600' },
      { id: 'returns', labelEn: 'Returns', labelAr: 'المرتجعات', icon: <Undo2 className="h-4 w-4" />, color: 'text-red-600' },
      { id: 'wallets', labelEn: 'Wallets', labelAr: 'المحافظ', icon: <Wallet className="h-4 w-4" />, color: 'text-emerald-600' },
    ],
  },
]

export default function SalesAdminPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-[3px] border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SalesAdminPageContent />
    </Suspense>
  )
}

function SalesAdminPageContent() {
  const { isAuthenticated, isLoading, isSalesUser, logout } = useAuth()
  const { isRTL } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeSection, setActiveSection] = useState<SalesSection>('dashboard')

  // Sync section from URL
  useEffect(() => {
    const section = searchParams.get('section') as SalesSection | null
    if (section) setActiveSection(section)
  }, [searchParams])

  const handleSectionChange = (section: SalesSection) => {
    setActiveSection(section)
    router.replace(`/admin/sales?section=${section}`, { scroll: false })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Image src="/logo.jpeg" alt="Tamkeen" width={56} height={56} priority className="rounded-2xl mx-auto mb-4 animate-pulse shadow-lg" />
          <div className="w-8 h-8 border-[3px] border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return <LoginPage />

  if (!isSalesUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{isRTL ? 'غير مصرح' : 'Unauthorized'}</h2>
          <p className="text-gray-500 mb-4">{isRTL ? 'ليس لديك صلاحية الوصول لإدارة المبيعات' : 'You do not have access to Sales Management'}</p>
          <button onClick={() => router.push('/')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            {isRTL ? 'الرئيسية' : 'Go Home'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-[#f8f9fb]" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="h-14 bg-white border-b border-gray-200/80 flex items-center justify-between px-5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Image src="/logo.jpeg" alt="Tamkeen" width={32} height={32} className="rounded-lg" />
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-emerald-600" />
            <h1 className="text-[15px] font-bold text-gray-900">{isRTL ? 'إدارة المبيعات' : 'Sales Management'}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Home className="h-3 w-3" />
            {isRTL ? 'الرئيسية' : 'Home'}
          </button>
          <button
            onClick={() => router.push('/admin')}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            {isRTL ? 'لوحة التحكم' : 'Admin Panel'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className={cn(
          'h-full bg-white flex flex-col w-[220px] flex-shrink-0 border-gray-200/80',
          isRTL ? 'border-l' : 'border-r'
        )}>
          <nav className="flex-1 overflow-y-auto p-2 pt-3 space-y-0.5 scrollbar-thin">
            {salesNavSections.map((section, sIdx) => (
              <div key={sIdx} className={cn(sIdx > 0 && 'mt-3')}>
                {section.titleEn && (
                  <p className={cn(
                    'text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-1.5',
                    isRTL && 'text-right'
                  )}>
                    {isRTL ? section.titleAr : section.titleEn}
                  </p>
                )}
                {section.items.map((item) => {
                  const isActive = activeSection === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSectionChange(item.id)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 relative',
                        isActive ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      )}
                    >
                      {isActive && (
                        <div className={cn(
                          'absolute top-1/2 -translate-y-1/2 w-[3px] h-4 bg-emerald-600 rounded-full',
                          isRTL ? 'right-0' : 'left-0'
                        )} />
                      )}
                      <span className={cn(isActive ? 'text-emerald-600' : item.color)}>{item.icon}</span>
                      <span className={cn('text-[13px]', isActive ? 'font-semibold' : 'font-medium')}>
                        {isRTL ? item.labelAr : item.labelEn}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </nav>

          <div className="border-t border-gray-100 p-2 space-y-0.5">
            <button
              onClick={() => router.push('/')}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            >
              <Home className="h-4 w-4" />
              <span className="text-[13px] font-medium">{isRTL ? 'الرئيسية' : 'Home'}</span>
            </button>
            <button
              onClick={logout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-[13px] font-medium">{isRTL ? 'تسجيل الخروج' : 'Logout'}</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {activeSection === 'dashboard' && <SalesDashboard onNavigate={handleSectionChange} />}
          {activeSection === 'customers' && <CustomersList />}
          {activeSection === 'sales-orders' && <SalesOrdersList />}
          {activeSection === 'quotations' && <QuotationsList />}
          {activeSection === 'invoices' && <SalesInvoicesList />}
          {activeSection === 'delivery-notes' && <DeliveryNotesList />}
          {activeSection === 'discounts' && <DiscountManagement />}
          {activeSection === 'inventory' && <InventoryManagement />}
          {activeSection === 'returns' && <ProductReturnsList />}
          {activeSection === 'wallets' && <WalletManagement />}
        </main>
      </div>
      <Toaster />
    </div>
  )
}
