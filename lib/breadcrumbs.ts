'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n'

export interface BreadcrumbItem {
  label: string
  href?: string
}

/**
 * Derives a breadcrumb trail from the current URL.
 * Returns an empty array on home / auth / utility pages.
 * The last item is always the current page (no href).
 */
export function useBreadcrumbs(): BreadcrumbItem[] {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { t, isRTL } = useI18n()
  const module = searchParams.get('module') ?? ''

  if (!pathname || ['/', '/login', '/setup-wizard', '/test-api'].includes(pathname)) {
    return []
  }

  const hrRoot: BreadcrumbItem = { label: isRTL ? 'الموارد البشرية' : 'HR', href: '/hr' }

  // ── /hr  (with optional ?module=) ──────────────────────────────────────────
  if (pathname === '/hr') {
    if (!module) return [{ label: isRTL ? 'الموارد البشرية' : 'HR' }]
    const moduleLabels: Record<string, string> = {
      dashboard: t('nav.dashboard'),
      employees: t('nav.employees'),
      'new-employee': t('emp.add'),
      attendance: t('nav.attendance'),
      'attendance-report': t('nav.attendance_report'),
      'employee-report': t('nav.employee_report'),
      leaves: t('nav.leaves'),
      salaries: t('nav.payroll'),
      expenses: t('nav.expenses'),
      shifts: t('nav.shifts'),
      'shift-management': t('nav.shift_management'),
      'location-tracking': t('nav.location_tracking'),
      'radius-alerts': t('nav.radius_alerts'),
      'leave-setup': t('nav.leave_setup'),
      'hr-settings': t('nav.settings'),
      settings: t('nav.settings'),
      team: t('nav.team'),
      custody: t('nav.custody'),
      biometric: t('nav.biometric'),
      // ── New sidebar modules ──
      jobs: t('nav.jobs'),
      'unregistered-employees': t('nav.unregistered_employees'),
      projects: t('nav.projects'),
      tasks: t('nav.tasks'),
      'location-groups': t('nav.location_groups'),
      'employee-groups': t('nav.employee_groups'),
      nationality: t('nav.nationality'),
      'official-holidays': t('nav.official_holidays'),
      'leave-types': t('nav.leave_types'),
      'add-leave': t('nav.add_leave'),
      'add-permission': t('nav.add_permission'),
      'cancel-transactions': t('nav.cancel_transactions'),
      'user-transactions': t('nav.user_transactions'),
      'ramadan-schedule': t('nav.ramadan_schedule'),
      'attendance-settings': t('nav.attendance_settings'),
      'requests-settings': t('nav.requests_settings'),
      'company-data': t('nav.company_data'),
      'subscription-info': t('nav.subscription_info'),
    }
    const label = moduleLabels[module]
    if (!label) return [{ label: isRTL ? 'الموارد البشرية' : 'HR' }]
    return [hrRoot, { label }]
  }

  // ── Dynamic employee routes ────────────────────────────────────────────────
  if (pathname.startsWith('/employee/')) {
    const segment = pathname.replace('/employee/', '')
    const isNew = segment === 'new'
    return [
      hrRoot,
      { label: t('nav.employees'), href: '/employees' },
      { label: isNew ? t('emp.add') : (isRTL ? 'ملف الموظف' : 'Employee Profile') },
    ]
  }
  if (pathname.startsWith('/employee-details/')) {
    return [
      hrRoot,
      { label: t('nav.employees'), href: '/employees' },
      { label: isRTL ? 'تفاصيل الموظف' : 'Employee Details' },
    ]
  }

  // ── Direct HR sub-routes ───────────────────────────────────────────────────
  const hrRoutes: Record<string, string> = {
    '/employees': t('nav.employees'),
    '/attendance': t('nav.attendance'),
    '/payroll': t('nav.payroll'),
    '/hr-settings': t('nav.settings'),
    '/hr-managers': t('nav.hr_managers'),
    '/shift-management': t('nav.shift_management'),
    '/location-tracking': t('nav.location_tracking'),
    '/radius-alerts': t('nav.radius_alerts'),
    '/biometric': t('nav.biometric'),
    '/employee-report': t('nav.employee_report'),
  }
  if (hrRoutes[pathname]) return [hrRoot, { label: hrRoutes[pathname] }]

  // ── Cashier ────────────────────────────────────────────────────────────────
  const cashierRoot: BreadcrumbItem = { label: isRTL ? 'المبيعات' : 'Sales', href: '/cashier' }
  if (pathname === '/cashier') return [{ label: isRTL ? 'المبيعات' : 'Sales' }]
  const cashierRoutes: Record<string, string> = {
    '/cashier/checkout': isRTL ? 'الدفع' : 'Checkout',
    '/cashier/close': isRTL ? 'إغلاق الجلسة' : 'Close Session',
    '/cashier/history': isRTL ? 'السجل' : 'History',
    '/cashier/reports': isRTL ? 'التقارير' : 'Reports',
    '/cashier/returns': isRTL ? 'المرتجعات' : 'Returns',
    '/cashier/settings': t('nav.settings'),
  }
  if (cashierRoutes[pathname]) return [cashierRoot, { label: cashierRoutes[pathname] }]

  // ── Admin ──────────────────────────────────────────────────────────────────
  const adminRoot: BreadcrumbItem = { label: isRTL ? 'الإدارة' : 'Admin', href: '/admin' }
  if (pathname === '/admin') return [{ label: isRTL ? 'الإدارة' : 'Admin' }]
  if (pathname === '/admin/sales') return [adminRoot, { label: isRTL ? 'المبيعات' : 'Sales' }]

  // ── Sales reps ─────────────────────────────────────────────────────────────
  const salesRoot: BreadcrumbItem = { label: isRTL ? 'المبيعات' : 'Sales', href: '/sales-reps' }
  if (pathname === '/sales-reps') return [{ label: isRTL ? 'المبيعات' : 'Sales' }]
  if (pathname === '/sales-rep') return [salesRoot, { label: isRTL ? 'مندوب المبيعات' : 'Sales Rep' }]
  if (pathname.startsWith('/sales-rep/')) {
    const repRoot: BreadcrumbItem = {
      label: isRTL ? 'مندوب المبيعات' : 'Sales Rep',
      href: '/sales-rep',
    }
    const repRoutes: Record<string, string> = {
      '/sales-rep/invoice': isRTL ? 'الفاتورة' : 'Invoice',
      '/sales-rep/customer-inventory': isRTL ? 'مخزون العميل' : 'Customer Inventory',
      '/sales-rep/inventory-records': isRTL ? 'سجلات المخزون' : 'Inventory Records',
      '/sales-rep/new-order': isRTL ? 'طلب جديد' : 'New Order',
      '/sales-rep/payments': isRTL ? 'المدفوعات' : 'Payments',
      '/sales-rep/profile': isRTL ? 'الملف الشخصي' : 'Profile',
      '/sales-rep/route-plan': isRTL ? 'خطة المسار' : 'Route Plan',
      '/sales-rep/samples': isRTL ? 'العينات' : 'Samples',
      '/sales-rep/stock-requests': isRTL ? 'طلبات المخزون' : 'Stock Requests',
      '/sales-rep/wallet': isRTL ? 'المحفظة' : 'Wallet',
      '/sales-rep/commission': isRTL ? 'عمولاتي' : 'My Commission',
      '/sales-rep/my-map': isRTL ? 'خريطتي' : 'My Map',
      '/sales-rep/order-history': isRTL ? 'سجل الطلبات' : 'Order History',
    }
    const label = repRoutes[pathname]
    if (label) return [salesRoot, repRoot, { label }]
  }

  // ── Standalone ─────────────────────────────────────────────────────────────
  if (pathname === '/inventory') return [{ label: t('nav.inventory') }]
  if (pathname === '/purchases') return [{ label: t('nav.purchases') }]
  if (pathname === '/profile') return [{ label: isRTL ? 'الملف الشخصي' : 'Profile' }]

  return []
}
