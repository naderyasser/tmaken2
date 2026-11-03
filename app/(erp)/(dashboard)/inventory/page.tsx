'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useBrand } from '@/hooks/use-brand'
import { useI18n, I18nProvider } from '@/lib/i18n'
import { LoginPage } from '@/components/login-page'
import { Toaster } from '@/components/ui/toaster'
import { InventoryManagement } from '@/components/inventory/inventory-management'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import {
    Home,
    LogOut,
    Shield,
    Boxes,
    Warehouse,
    Database,
    ArrowRightLeft,
    RotateCcw,
    ClipboardList,
    LayoutDashboard,
    ShoppingBag,
    Scale,
    ChevronLeft,
    ChevronRight,
    PackageCheck,
    FileSpreadsheet,
} from 'lucide-react'

import { Users, ShoppingCart } from 'lucide-react'
import { ModuleTeamManager, INVENTORY_TEAM_CONFIG } from '@/components/module-team-manager'
import { StockRequestsAdmin } from '@/components/sales/stock-requests-admin'
import { PurchaseRequestsView } from '@/components/inventory/purchase-requests-view'
import { InvoiceConverter } from '@/components/inventory/invoice-converter'

type InventorySection = 'dashboard' | 'warehouses' | 'products' | 'inventory' | 'convert' | 'transfers' | 'restock-requests' | 'purchase-requests' | 'returns' | 'audit' | 'reconciliation' | 'team'

const inventorySections = [
    { id: 'dashboard' as InventorySection, labelAr: 'نظرة عامة', labelEn: 'Dashboard', icon: LayoutDashboard, color: 'text-orange-600' },
    { id: 'warehouses' as InventorySection, labelAr: 'المستودعات', labelEn: 'Warehouses', icon: Warehouse, color: 'text-blue-600' },
    { id: 'products' as InventorySection, labelAr: 'المنتجات', labelEn: 'Products', icon: ShoppingBag, color: 'text-pink-600' },
    { id: 'inventory' as InventorySection, labelAr: 'المخزون الحي', labelEn: 'Live Inventory', icon: Database, color: 'text-emerald-600' },
    { id: 'convert' as InventorySection, labelAr: 'تحويل الفواتير', labelEn: 'Invoice Converter', icon: FileSpreadsheet, color: 'text-indigo-600' },
    { id: 'transfers' as InventorySection, labelAr: 'طلبات النقل', labelEn: 'Transfers', icon: ArrowRightLeft, color: 'text-amber-600' },
    { id: 'restock-requests' as InventorySection, labelAr: 'طلبات التزويد', labelEn: 'Restock Requests', icon: PackageCheck, color: 'text-cyan-600' },
    { id: 'purchase-requests' as InventorySection, labelAr: 'طلبات الشراء', labelEn: 'Purchase Requests', icon: ShoppingCart, color: 'text-indigo-600' },
    { id: 'returns' as InventorySection, labelAr: 'المرتجعات', labelEn: 'Returns', icon: RotateCcw, color: 'text-purple-600' },
    { id: 'audit' as InventorySection, labelAr: 'سجل الحركات', labelEn: 'Audit Log', icon: ClipboardList, color: 'text-gray-600' },
    { id: 'reconciliation' as InventorySection, labelAr: 'تسوية الجرد', labelEn: 'Reconciliation', icon: Scale, color: 'text-teal-600' },
    { id: 'team' as InventorySection, labelAr: 'فريق المخزون', labelEn: 'Team', icon: Users, color: 'text-cyan-600' },
]

function InventoryPageContent() {
    const { isAuthenticated, isLoading, moduleAccess, availableModules, logout } = useAuth()
    const { isRTL } = useI18n()
    const router = useRouter()
    const brand = useBrand()
    const [activeSection, setActiveSection] = useState<InventorySection>('dashboard')
    const [sidebarExpanded, setSidebarExpanded] = useState(true)

    // Stock-only tenants (no sales-reps module) get a standalone warehouse system:
    // the sales-rep restock queue disappears and rep/customer traces are hidden
    // inside the views. Sales tenants keep the full UI unchanged.
    const hasSales = availableModules.includes('salesReps')
    const visibleSections = useMemo(
        () => inventorySections.filter((s) => hasSales || s.id !== 'restock-requests'),
        [hasSales]
    )

    // Tab title: brand the inventory system with the tenant's display name
    // (the root layout's static title talks about HR, which is wrong here).
    useEffect(() => {
        const base = isRTL ? 'نظام المخازن' : 'Inventory System'
        document.title = brand.appName ? `${base} — ${brand.appName}` : base
    }, [brand.appName, isRTL])

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <Image src="/logo.jpeg" alt="Tamkeen" width={56} height={56} priority className="rounded-2xl mx-auto mb-4 animate-pulse shadow-lg" />
                    <div className="w-8 h-8 border-[3px] border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-gray-400">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
                </div>
            </div>
        )
    }

    if (!isAuthenticated) {
        return <LoginPage />
    }

    if (!moduleAccess.inventory) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center p-8">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Shield className="h-8 w-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">{isRTL ? 'غير مصرح' : 'Unauthorized'}</h2>
                    <p className="text-gray-500 mb-4">{isRTL ? 'ليس لديك صلاحية الوصول لنظام المخزون' : 'Inventory access required'}</p>
                    <button onClick={() => router.push('/')} className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700">
                        {isRTL ? 'العودة للرئيسية' : 'Back to Home'}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="flex h-screen bg-[#f4f5f7] overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
                {/* Dark Inventory Sidebar */}
                <aside className={cn(
                    'bg-slate-900 h-full flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out relative group/sidebar',
                    sidebarExpanded ? 'w-[240px]' : 'w-[68px]'
                )}>
                    {/* Brand header */}
                    <div className={cn(
                        'flex items-center gap-3 h-14 flex-shrink-0 px-4 bg-gradient-to-br from-orange-500 to-amber-600',
                        !sidebarExpanded && 'justify-center px-0'
                    )}>
                        <Boxes className="h-6 w-6 text-white flex-shrink-0" />
                        {sidebarExpanded && (
                            <div>
                                <p className="text-white font-bold text-sm leading-none">{isRTL ? 'المخزون' : 'Inventory'}</p>
                                <p className="text-orange-200 text-[10px] leading-none mt-0.5">{brand.appName || 'Management'}</p>
                            </div>
                        )}
                    </div>

                    {/* Collapse toggle */}
                    <button
                        onClick={() => setSidebarExpanded(!sidebarExpanded)}
                        className={cn(
                            'absolute top-16 z-10 w-5 h-5 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center shadow-sm hover:bg-slate-700 transition-all opacity-0 group-hover/sidebar:opacity-100',
                            isRTL ? '-left-2.5' : '-right-2.5'
                        )}
                    >
                        {sidebarExpanded
                            ? (isRTL ? <ChevronRight className="h-3 w-3 text-slate-400" /> : <ChevronLeft className="h-3 w-3 text-slate-400" />)
                            : (isRTL ? <ChevronLeft className="h-3 w-3 text-slate-400" /> : <ChevronRight className="h-3 w-3 text-slate-400" />)
                        }
                    </button>

                    <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 pt-3 space-y-0.5">
                        {sidebarExpanded && (
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
                                {isRTL ? 'الأقسام' : 'Sections'}
                            </p>
                        )}
                        {visibleSections.map((section) => {
                            const Icon = section.icon
                            const isActive = activeSection === section.id
                            return (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    title={!sidebarExpanded ? (isRTL ? section.labelAr : section.labelEn) : undefined}
                                    className={cn(
                                        'w-full flex items-center gap-2.5 rounded-lg transition-all duration-150 relative group/item',
                                        sidebarExpanded ? 'px-3 py-2' : 'px-0 py-2 justify-center',
                                        isActive
                                            ? 'bg-orange-500/15 text-orange-400'
                                            : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
                                    )}
                                >
                                    {isActive && (
                                        <div className={cn(
                                            'absolute top-1/2 -translate-y-1/2 w-[3px] h-4 bg-orange-500 rounded-full',
                                            isRTL ? 'right-0' : 'left-0'
                                        )} />
                                    )}
                                    <Icon className={cn('h-[16px] w-[16px] flex-shrink-0', isActive ? 'text-orange-400' : 'text-slate-500')} />
                                    {sidebarExpanded && (
                                        <span className={cn('text-[13px]', isActive ? 'font-semibold' : 'font-medium')}>
                                            {isRTL ? section.labelAr : section.labelEn}
                                        </span>
                                    )}
                                    {!sidebarExpanded && (
                                        <div className={cn(
                                            'absolute px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/item:opacity-100 transition-opacity shadow-lg z-50',
                                            isRTL ? 'right-full mr-2' : 'left-full ml-2'
                                        )}>
                                            {isRTL ? section.labelAr : section.labelEn}
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </nav>

                    {/* Bottom links */}
                    <div className="border-t border-slate-800 p-2 space-y-0.5">
                        <button
                            onClick={() => router.push('/')}
                            title={!sidebarExpanded ? (isRTL ? 'الرئيسية' : 'Home') : undefined}
                            className={cn(
                                'w-full flex items-center gap-2.5 rounded-lg text-slate-400 hover:bg-orange-500/10 hover:text-orange-400 transition-colors group/item relative',
                                sidebarExpanded ? 'px-3 py-2' : 'px-0 py-2 justify-center'
                            )}
                        >
                            <Home className="h-4 w-4 flex-shrink-0" />
                            {sidebarExpanded && <span className="text-[13px] font-medium">{isRTL ? 'الرئيسية' : 'Home'}</span>}
                            {!sidebarExpanded && (
                                <div className={cn(
                                    'absolute px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/item:opacity-100 transition-opacity shadow-lg z-50',
                                    isRTL ? 'right-full mr-2' : 'left-full ml-2'
                                )}>
                                    {isRTL ? 'الرئيسية' : 'Home'}
                                </div>
                            )}
                        </button>
                        <button
                            onClick={logout}
                            title={!sidebarExpanded ? (isRTL ? 'تسجيل الخروج' : 'Logout') : undefined}
                            className={cn(
                                'w-full flex items-center gap-2.5 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors group/item relative',
                                sidebarExpanded ? 'px-3 py-2' : 'px-0 py-2 justify-center'
                            )}
                        >
                            <LogOut className="h-4 w-4 flex-shrink-0" />
                            {sidebarExpanded && <span className="text-[13px] font-medium">{isRTL ? 'تسجيل الخروج' : 'Logout'}</span>}
                            {!sidebarExpanded && (
                                <div className={cn(
                                    'absolute px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/item:opacity-100 transition-opacity shadow-lg z-50',
                                    isRTL ? 'right-full mr-2' : 'left-full ml-2'
                                )}>
                                    {isRTL ? 'تسجيل الخروج' : 'Logout'}
                                </div>
                            )}
                        </button>
                    </div>
                </aside>

                {/* Main column */}
                <div className="flex flex-col flex-1 overflow-hidden">
                    {/* Top bar */}
                    <header className="h-14 bg-white border-b border-gray-100 flex items-center gap-3 px-5 flex-shrink-0">
                        {(() => {
                            const section = visibleSections.find(s => s.id === activeSection)
                            if (!section) return null
                            const Icon = section.icon
                            return (
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <Boxes className="h-4 w-4 text-orange-500" />
                                    <span>{isRTL ? 'المخزون' : 'Inventory'}</span>
                                    <ChevronRight className={cn('h-3.5 w-3.5 text-gray-300', isRTL && 'rotate-180')} />
                                    <Icon className={cn('h-4 w-4', section.color)} />
                                    <span className="font-semibold text-gray-800">{isRTL ? section.labelAr : section.labelEn}</span>
                                </div>
                            )
                        })()}
                    </header>

                    {/* Main Content */}
                    <main className="flex-1 overflow-auto">
                        {activeSection === 'team' ? (
                            <ModuleTeamManager config={INVENTORY_TEAM_CONFIG} />
                        ) : activeSection === 'restock-requests' ? (
                            <div className="p-6"><StockRequestsAdmin /></div>
                        ) : activeSection === 'purchase-requests' ? (
                            <PurchaseRequestsView />
                        ) : activeSection === 'convert' ? (
                            <InvoiceConverter />
                        ) : (
                            <InventoryManagement activeTab={activeSection} onTabChange={(tab) => setActiveSection(tab as InventorySection)} hasSales={hasSales} />
                        )}
                    </main>
                </div>
            </div>
            <Toaster />
        </>
    )
}

export default function InventoryPage() {
    return (
        <I18nProvider>
            <InventoryPageContent />
        </I18nProvider>
    )
}
