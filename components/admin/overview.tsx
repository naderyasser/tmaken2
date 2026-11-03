'use client'

import { useState, useEffect, useCallback } from 'react'
import { frappeClient, DockModuleDisplay } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
    Users,
    ShoppingCart,
    Truck,
    Package,
    Calculator,
    Factory,
    FolderKanban,
    Headphones,
    Globe,
    ClipboardCheck,
    Building2,
    Monitor,
    Settings,
    ArrowRight,
    ArrowLeft,
    TrendingUp,
    LayoutGrid,
    Loader2,
    CheckCircle,
    Clock,
    AlertTriangle,
    Users2,
} from 'lucide-react'

// Module definitions with icons and colors
const SYSTEM_MODULES = [
    { id: 'hr', labelAr: 'الموارد البشرية', labelEn: 'Human Resources', icon: Users, color: '#2563eb', bgLight: 'bg-blue-50', textColor: 'text-blue-600', status: 'active' as const, descAr: 'إدارة الموظفين، الحضور، الإجازات، الرواتب', descEn: 'Employees, Attendance, Leaves, Payroll', link: '/hr' },
    { id: 'sales', labelAr: 'المبيعات', labelEn: 'Sales', icon: ShoppingCart, color: '#16a34a', bgLight: 'bg-green-50', textColor: 'text-green-600', status: 'active' as const, descAr: 'العملاء، أوامر البيع، الفواتير، الخصومات', descEn: 'Customers, Sales Orders, Invoices, Discounts', link: '/admin/sales' },
    { id: 'sales-reps', labelAr: 'المناديب ونقاط البيع', labelEn: 'Sales Reps & POS', icon: Users2, color: '#7c3aed', bgLight: 'bg-violet-50', textColor: 'text-violet-600', status: 'active' as const, descAr: 'المناديب، الزيارات، خطط المسارات', descEn: 'Representatives, Visits, Route Plans', link: '/sales-reps' },
    { id: 'purchasing', labelAr: 'المشتريات', labelEn: 'Purchasing', icon: Truck, color: '#059669', bgLight: 'bg-emerald-50', textColor: 'text-emerald-600', status: 'active' as const, descAr: 'الموردين، أوامر الشراء، الاستلام، الفواتير', descEn: 'Suppliers, Purchase Orders, Receipts, Invoices', link: '/purchases' },
    { id: 'inventory', labelAr: 'المخزون', labelEn: 'Inventory', icon: Package, color: '#ea580c', bgLight: 'bg-orange-50', textColor: 'text-orange-600', status: 'active' as const, descAr: 'المستودعات، طلبات النقل، المرتجعات، حركات المخزون', descEn: 'Warehouses, Transfers, Returns, Stock Movements', link: '/inventory' },
    { id: 'accounting', labelAr: 'المحاسبة', labelEn: 'Accounting', icon: Calculator, color: '#9333ea', bgLight: 'bg-purple-50', textColor: 'text-purple-600', status: 'planned' as const, descAr: 'دفتر الأستاذ، القيود المحاسبية', descEn: 'General Ledger, Journal Entries', link: null },
    { id: 'manufacturing', labelAr: 'التصنيع', labelEn: 'Manufacturing', icon: Factory, color: '#dc2626', bgLight: 'bg-red-50', textColor: 'text-red-600', status: 'planned' as const, descAr: 'أوامر التصنيع، قوائم المواد', descEn: 'Work Orders, Bill of Materials', link: null },
    { id: 'projects', labelAr: 'المشاريع', labelEn: 'Projects', icon: FolderKanban, color: '#0d9488', bgLight: 'bg-teal-50', textColor: 'text-teal-600', status: 'planned' as const, descAr: 'المشاريع، المهام، تتبع الوقت', descEn: 'Projects, Tasks, Time Tracking', link: null },
    { id: 'support', labelAr: 'الدعم الفني', labelEn: 'Support', icon: Headphones, color: '#db2777', bgLight: 'bg-pink-50', textColor: 'text-pink-600', status: 'planned' as const, descAr: 'التذاكر، العقود، الضمان', descEn: 'Issues, Contracts, Warranty', link: null },
    { id: 'website', labelAr: 'الموقع', labelEn: 'Website', icon: Globe, color: '#0891b2', bgLight: 'bg-cyan-50', textColor: 'text-cyan-600', status: 'planned' as const, descAr: 'صفحات الويب، المدونة', descEn: 'Web Pages, Blog', link: null },
    { id: 'quality', labelAr: 'الجودة', labelEn: 'Quality', icon: ClipboardCheck, color: '#4f46e5', bgLight: 'bg-indigo-50', textColor: 'text-indigo-600', status: 'planned' as const, descAr: 'فحص الجودة، عدم المطابقة', descEn: 'Quality Inspection, Non Conformance', link: null },
    { id: 'assets', labelAr: 'الأصول', labelEn: 'Assets', icon: Building2, color: '#475569', bgLight: 'bg-slate-50', textColor: 'text-slate-600', status: 'planned' as const, descAr: 'الأصول الثابتة، الصيانة', descEn: 'Fixed Assets, Maintenance', link: null },
    { id: 'pos', labelAr: 'نقاط البيع', labelEn: 'Point of Sale', icon: Monitor, color: '#e11d48', bgLight: 'bg-rose-50', textColor: 'text-rose-600', status: 'planned' as const, descAr: 'نقطة البيع، فواتير POS', descEn: 'POS Terminal, POS Invoices', link: null },
    { id: 'settings', labelAr: 'الإعدادات', labelEn: 'Settings', icon: Settings, color: '#6366f1', bgLight: 'bg-violet-50', textColor: 'text-violet-600', status: 'active' as const, descAr: 'إعدادات الدوك، الدومين، اللغة', descEn: 'Dock Config, Domain, Language', link: null },
]

interface AdminOverviewProps {
    onNavigate: (section: 'overview' | 'dock-config' | 'system-settings' | 'domain-settings' | 'users-management') => void
}

export function AdminOverview({ onNavigate }: AdminOverviewProps) {
    const { isRTL } = useI18n()
    const [dockModules, setDockModules] = useState<DockModuleDisplay[]>([])
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({ employees: 0, activeModules: 0 })

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            // Load dock modules and employee count in parallel
            const [modules, employees] = await Promise.all([
                frappeClient.getDockModulesForDisplay('desktop'),
                frappeClient.getEmployees({ fields: ['name'], limit_page_length: 0 }).catch(() => []),
            ])
            setDockModules(modules)
            setStats({ employees: employees.length, activeModules: modules.length })
        } catch (error) {
            console.error('Error loading admin data:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadData() }, [loadData])

    const activeCount = SYSTEM_MODULES.filter(m => m.status === 'active').length
    const plannedCount = SYSTEM_MODULES.filter(m => m.status === 'planned').length

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            {/* Welcome Banner */}
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-6 text-white">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-xl font-bold mb-1">{isRTL ? 'لوحة تحكم Meena' : 'Meena Control Panel'}</h2>
                        <p className="text-indigo-200 text-sm">
                            {isRTL
                                ? 'إدارة مركزية لجميع أنظمة الشركة - ربط وتحكم في كل الموديولات من مكان واحد'
                                : 'Centralized management for all company systems - control all modules from one place'
                            }
                        </p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                        <div className="text-center">
                            <p className="text-2xl font-bold">{SYSTEM_MODULES.length}</p>
                            <p className="text-indigo-200 text-xs">{isRTL ? 'نظام' : 'Systems'}</p>
                        </div>
                        <div className="w-px h-10 bg-indigo-400/30" />
                        <div className="text-center">
                            <p className="text-2xl font-bold">{activeCount}</p>
                            <p className="text-indigo-200 text-xs">{isRTL ? 'مفعّل' : 'Active'}</p>
                        </div>
                        <div className="w-px h-10 bg-indigo-400/30" />
                        <div className="text-center">
                            <p className="text-2xl font-bold">{loading ? '-' : stats.employees}</p>
                            <p className="text-indigo-200 text-xs">{isRTL ? 'موظف' : 'Employees'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">{isRTL ? 'أنظمة مفعّلة' : 'Active Systems'}</p>
                        <p className="text-lg font-bold text-gray-900">{activeCount}</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                        <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">{isRTL ? 'قيد التطوير' : 'In Development'}</p>
                        <p className="text-lg font-bold text-gray-900">{plannedCount}</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                        <LayoutGrid className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">{isRTL ? 'موديولات الدوك' : 'Dock Modules'}</p>
                        <p className="text-lg font-bold text-gray-900">{loading ? '-' : stats.activeModules}</p>
                    </div>
                </div>
                <button
                    onClick={() => onNavigate('dock-config')}
                    className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group cursor-pointer text-start"
                >
                    <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center group-hover:bg-indigo-100">
                        <Settings className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="flex-1">
                        <p className="text-xs text-gray-500">{isRTL ? 'إدارة الموديولات' : 'Module Manager'}</p>
                        <p className="text-sm font-semibold text-indigo-600">{isRTL ? 'فتح ←' : 'Open →'}</p>
                    </div>
                </button>
            </div>

            {/* All Systems Grid */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-gray-900">{isRTL ? 'جميع الأنظمة' : 'All Systems'}</h3>
                    <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            {isRTL ? 'مفعّل' : 'Active'}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                            {isRTL ? 'قيد التطوير' : 'Planned'}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    {SYSTEM_MODULES.map((module) => {
                        const Icon = module.icon
                        const isActive = module.status === 'active'
                        return (
                            <div
                                key={module.id}
                                className={cn(
                                    'bg-white rounded-xl border p-4 transition-all relative group',
                                    isActive
                                        ? 'border-gray-200 hover:border-gray-300 hover:shadow-sm cursor-pointer'
                                        : 'border-gray-100 opacity-70'
                                )}
                                onClick={() => {
                                    if (module.link) {
                                        if (module.link.startsWith('/')) {
                                            window.location.href = module.link
                                        } else {
                                            onNavigate(module.link as any)
                                        }
                                    }
                                }}
                            >
                                {/* Status indicator */}
                                <div className={cn(
                                    'absolute top-3 w-2 h-2 rounded-full',
                                    isRTL ? 'left-3' : 'right-3',
                                    isActive ? 'bg-green-500' : 'bg-amber-400'
                                )} />

                                <div className="flex items-start gap-3">
                                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', module.bgLight)}>
                                        <Icon className={cn('h-5 w-5', module.textColor)} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-semibold text-gray-900">{isRTL ? module.labelAr : module.labelEn}</h4>
                                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{isRTL ? module.descAr : module.descEn}</p>
                                        <div className="mt-2">
                                            {isActive ? (
                                                <span className="text-[10px] font-medium bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                                                    {isRTL ? 'مفعّل ✓' : 'Active ✓'}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                                                    {isRTL ? 'قريباً' : 'Coming Soon'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Hover arrow for active modules */}
                                {isActive && module.link && (
                                    <div className={cn(
                                        'absolute bottom-3 opacity-0 group-hover:opacity-100 transition-opacity',
                                        isRTL ? 'left-3' : 'right-3'
                                    )}>
                                        {isRTL ? <ArrowLeft className="h-4 w-4 text-gray-400" /> : <ArrowRight className="h-4 w-4 text-gray-400" />}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Dock Modules Preview */}
            {!loading && dockModules.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-gray-900">{isRTL ? 'موديولات الدوك النشطة' : 'Active Dock Modules'}</h3>
                        <button
                            onClick={() => onNavigate('dock-config')}
                            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                        >
                            {isRTL ? 'إدارة' : 'Manage'}
                            {isRTL ? <ArrowLeft className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
                        </button>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                        {dockModules.slice(0, 8).map((mod) => (
                            <div key={mod.id} className="bg-white rounded-lg border border-gray-100 p-3 flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: mod.bgColor + '20' }}>
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: mod.bgColor }} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold text-gray-800 truncate">{mod.label}</p>
                                    <p className="text-[10px] text-gray-400">{mod.menuItems?.length || 0} {isRTL ? 'عنصر' : 'items'}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
