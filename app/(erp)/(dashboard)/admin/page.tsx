'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import { useCompanySafe } from '@/hooks/use-company'
import { LoginPage } from '@/components/login-page'
import { Toaster } from '@/components/ui/toaster'
import { AdminDockConfig } from '@/components/admin/dock-config'
import { AdminOverview } from '@/components/admin/overview'
import { AdminSystemSettings } from '@/components/admin/system-settings'
import { AdminDomainSettings } from '@/components/admin/domain-settings'
import { AdminUsersManagement } from '@/components/admin/users-management'
import { AdminRolePermissions } from '@/components/admin/admin-role-permissions'
import { AdminCompanyManagement } from '@/components/admin/company-management'
import { ZatcaSettingsPage } from '@/components/admin/zatca-settings'
import { ZatcaDashboardPage } from '@/components/admin/zatca-dashboard'
import { AdminCashierSettings } from '@/components/admin/cashier-settings'
import { Header } from '@/components/header'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { ModuleTeamManager, ADMIN_TEAM_CONFIG } from '@/components/module-team-manager'
import { HRManagersPanel } from '@/app/(erp)/(dashboard)/hr-managers/page'
import {
    LayoutGrid,
    Settings,
    Globe,
    Shield,
    ChevronLeft,
    ChevronRight,
    Home,
    Users,
    Sliders,
    Database,
    LogOut,
    UserCog,
    UserPlus,
    Building2,
    FileCheck2,
    BarChart3,
    ShieldCheck,
    ShoppingCart,
} from 'lucide-react'

type AdminSection = 'overview' | 'dock-config' | 'system-settings' | 'domain-settings' | 'users-management' | 'role-permissions' | 'admin-team' | 'hr-managers' | 'company-management' | 'zatca-settings' | 'zatca-dashboard' | 'cashier-settings'

const adminSections = [
    { id: 'overview' as AdminSection, labelAr: 'نظرة عامة', labelEn: 'Overview', icon: Home, color: 'text-blue-600' },
    { id: 'company-management' as AdminSection, labelAr: 'إدارة الشركات', labelEn: 'Companies', icon: Building2, color: 'text-emerald-600' },
    { id: 'dock-config' as AdminSection, labelAr: 'إدارة الموديولات', labelEn: 'Module Manager', icon: LayoutGrid, color: 'text-indigo-600' },
    { id: 'users-management' as AdminSection, labelAr: 'إدارة المستخدمين', labelEn: 'Users', icon: UserCog, color: 'text-blue-600' },
    { id: 'admin-team' as AdminSection, labelAr: 'مديرو النظام', labelEn: 'Admins', icon: UserPlus, color: 'text-violet-600' },
    { id: 'hr-managers' as AdminSection, labelAr: 'مدراء الموارد البشرية', labelEn: 'HR Managers', icon: ShieldCheck, color: 'text-green-600' },
    { id: 'role-permissions' as AdminSection, labelAr: 'الصلاحيات', labelEn: 'Permissions', icon: Shield, color: 'text-amber-600' },
    { id: 'zatca-settings' as AdminSection, labelAr: 'إعدادات زاتكا', labelEn: 'ZATCA Settings', icon: FileCheck2, color: 'text-green-600' },
    { id: 'zatca-dashboard' as AdminSection, labelAr: 'لوحة زاتكا', labelEn: 'ZATCA Dashboard', icon: BarChart3, color: 'text-green-600' },
    { id: 'cashier-settings' as AdminSection, labelAr: 'إعدادات المبيعات', labelEn: 'Sales Settings', icon: ShoppingCart, color: 'text-blue-600' },
    { id: 'system-settings' as AdminSection, labelAr: 'إعدادات النظام', labelEn: 'System Settings', icon: Sliders, color: 'text-gray-600' },
    { id: 'domain-settings' as AdminSection, labelAr: 'الدومين والمواقع', labelEn: 'Domains & Sites', icon: Globe, color: 'text-cyan-600' },
]

export default function AdminPage() {
    const { isAuthenticated, isLoading, isAdmin, logout } = useAuth()
    const { isRTL } = useI18n()
    const { company: activeCompany, allCompanies } = useCompanySafe()
    const router = useRouter()
    const [activeSection, setActiveSection] = useState<AdminSection>('overview')
    const [sidebarExpanded, setSidebarExpanded] = useState(true)

    // Deep-link support: /admin?section=domain-settings opens that section directly.
    // Used by the post-login operator redirect (Domains & Sites). Validated against
    // the known section ids; anything else falls back to the default (overview).
    useEffect(() => {
        if (typeof window === 'undefined') return
        const requested = new URLSearchParams(window.location.search).get('section')
        if (requested && adminSections.some(s => s.id === requested)) {
            setActiveSection(requested as AdminSection)
        }
    }, [])

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <Image src="/logo.jpeg" alt="Tamkeen" width={56} height={56} priority className="rounded-2xl mx-auto mb-4 animate-pulse shadow-lg" />
                    <div className="w-8 h-8 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-gray-400">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
                </div>
            </div>
        )
    }

    if (!isAuthenticated) {
        return <LoginPage />
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center p-8">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Shield className="h-8 w-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">{isRTL ? 'غير مصرح' : 'Unauthorized'}</h2>
                    <p className="text-gray-500 mb-4">{isRTL ? 'تحتاج صلاحية مدير النظام للوصول' : 'System Administrator access required'}</p>
                    <button onClick={() => router.push('/')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                        {isRTL ? 'العودة للرئيسية' : 'Back to Home'}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="flex flex-col h-screen bg-[#f8f9fb]" dir={isRTL ? 'rtl' : 'ltr'}>
                {/* Admin Header */}
                <Header showHomeButton onToggleSidebar={() => setSidebarExpanded(!sidebarExpanded)} sidebarExpanded={sidebarExpanded} />

                <div className="flex flex-1 overflow-hidden">
                    {/* Admin Sidebar */}
                    <aside className={cn(
                        'h-full bg-white flex flex-col flex-shrink-0 border-gray-200/80 transition-all duration-300 ease-in-out relative group/sidebar',
                        isRTL ? 'border-l' : 'border-r',
                        sidebarExpanded ? 'w-[240px]' : 'w-[68px]'
                    )}>
                        {/* Collapse toggle */}
                        <button
                            onClick={() => setSidebarExpanded(!sidebarExpanded)}
                            className={cn(
                                'absolute top-6 z-10 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:shadow-md hover:bg-gray-50 transition-all opacity-0 group-hover/sidebar:opacity-100',
                                isRTL ? '-left-3' : '-right-3'
                            )}
                        >
                            {sidebarExpanded
                                ? (isRTL ? <ChevronRight className="h-3 w-3 text-gray-500" /> : <ChevronLeft className="h-3 w-3 text-gray-500" />)
                                : (isRTL ? <ChevronLeft className="h-3 w-3 text-gray-500" /> : <ChevronRight className="h-3 w-3 text-gray-500" />)
                            }
                        </button>

                        {/* Sections */}
                        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 pt-3 space-y-0.5">
                            {sidebarExpanded && (
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
                                    {isRTL ? 'الأقسام' : 'Sections'}
                                </p>
                            )}
                            {adminSections.map((section) => {
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
                                                ? 'bg-indigo-50 text-indigo-700'
                                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                        )}
                                    >
                                        {isActive && (
                                            <div className={cn(
                                                "absolute top-1/2 -translate-y-1/2 w-[3px] h-4 bg-indigo-600 rounded-full",
                                                isRTL ? "right-0" : "left-0"
                                            )} />
                                        )}
                                        <Icon className={cn('h-[16px] w-[16px] flex-shrink-0', isActive ? 'text-indigo-600' : section.color)} />
                                        {sidebarExpanded && (
                                            <span className={cn('text-[13px]', isActive ? 'font-semibold' : 'font-medium')}>
                                                {isRTL ? section.labelAr : section.labelEn}
                                            </span>
                                        )}
                                        {!sidebarExpanded && (
                                            <div className={cn(
                                                "absolute px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/item:opacity-100 transition-opacity shadow-lg z-50",
                                                isRTL ? "right-full mr-2" : "left-full ml-2"
                                            )}>
                                                {isRTL ? section.labelAr : section.labelEn}
                                            </div>
                                        )}
                                    </button>
                                )
                            })}
                        </nav>

                        {/* Bottom */}
                        <div className="border-t border-gray-100 p-2 space-y-0.5">
                            <button
                                onClick={() => router.push('/')}
                                title={!sidebarExpanded ? (isRTL ? 'الرئيسية' : 'Home') : undefined}
                                className={cn(
                                    'w-full flex items-center gap-2.5 rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors group/item relative',
                                    sidebarExpanded ? 'px-3 py-2' : 'px-0 py-2 justify-center'
                                )}
                            >
                                <Home className="h-4 w-4 flex-shrink-0" />
                                {sidebarExpanded && <span className="text-[13px] font-medium">{isRTL ? 'الرئيسية' : 'Home'}</span>}
                                {!sidebarExpanded && (
                                    <div className={cn(
                                        "absolute px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/item:opacity-100 transition-opacity shadow-lg z-50",
                                        isRTL ? "right-full mr-2" : "left-full ml-2"
                                    )}>
                                        {isRTL ? 'الرئيسية' : 'Home'}
                                    </div>
                                )}
                            </button>
                            <button
                                onClick={logout}
                                title={!sidebarExpanded ? (isRTL ? 'تسجيل الخروج' : 'Logout') : undefined}
                                className={cn(
                                    'w-full flex items-center gap-2.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors group/item relative',
                                    sidebarExpanded ? 'px-3 py-2' : 'px-0 py-2 justify-center'
                                )}
                            >
                                <LogOut className="h-4 w-4 flex-shrink-0" />
                                {sidebarExpanded && <span className="text-[13px] font-medium">{isRTL ? 'تسجيل الخروج' : 'Logout'}</span>}
                                {!sidebarExpanded && (
                                    <div className={cn(
                                        "absolute px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/item:opacity-100 transition-opacity shadow-lg z-50",
                                        isRTL ? "right-full mr-2" : "left-full ml-2"
                                    )}>
                                        {isRTL ? 'تسجيل الخروج' : 'Logout'}
                                    </div>
                                )}
                            </button>
                        </div>
                    </aside>

                    {/* Main Content */}
                    <main className="flex-1 overflow-auto">
                        {activeSection === 'overview' && <AdminOverview onNavigate={setActiveSection} />}
                        {activeSection === 'dock-config' && (
                            <div className="p-6">
                                <AdminDockConfig />
                            </div>
                        )}
                        {activeSection === 'system-settings' && <AdminSystemSettings />}
                        {activeSection === 'domain-settings' && <AdminDomainSettings />}
                        {activeSection === 'users-management' && <AdminUsersManagement />}
                        {activeSection === 'admin-team' && <ModuleTeamManager config={ADMIN_TEAM_CONFIG} />}
                        {activeSection === 'hr-managers' && <HRManagersPanel embedded />}
                        {activeSection === 'role-permissions' && <AdminRolePermissions />}
                        {activeSection === 'company-management' && <AdminCompanyManagement />}
                        {activeSection === 'zatca-settings' && <ZatcaSettingsPage company={activeCompany || undefined} companies={allCompanies} />}
                        {activeSection === 'zatca-dashboard' && <ZatcaDashboardPage company={activeCompany || undefined} />}
                        {activeSection === 'cashier-settings' && <AdminCashierSettings />}
                    </main>
                </div>
            </div>
            <Toaster />
        </>
    )
}
