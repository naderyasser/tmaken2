'use client'

/**
 * Sets a unique, dynamic document.title per HR route (and per ?module= surface) so
 * browser tabs, history, and screen readers get a meaningful name instead of the one
 * static "تمكين" title on every page. Mounted once from the (dashboard) layout.
 */

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n'

const BASE = 'تمكين'

// key = pathname, or `/hr?module=<module>` for the module switcher → [English, Arabic]
const TITLES: Record<string, [string, string]> = {
  '/hr': ['Dashboard', 'الرئيسية'],
  '/hr?module=announcements': ['Announcements', 'التعاميم'],
  '/hr?module=requests': ['Requests', 'الطلبات'],
  '/hr?module=discipline': ['Discipline', 'الانضباط'],
  '/hr?module=onboarding': ['Onboarding', 'التعيين'],
  '/hr?module=employees': ['Employees', 'الموظفون'],
  '/hr?module=attendance': ['Attendance', 'الحضور'],
  '/hr?module=attendance-report': ['Attendance Report', 'تقرير الحضور'],
  '/hr?module=leaves': ['Leaves', 'الإجازات'],
  '/hr?module=expenses': ['Expenses', 'المصروفات'],
  '/hr?module=shift-calendar': ['Shift Calendar', 'تقويم المناوبات'],
  '/hr?module=location-tracking': ['Location Tracking', 'تتبع المواقع'],
  '/hr?module=radius-alerts': ['Radius Alerts', 'تنبيهات النطاق'],
  '/hr?module=leave-setup': ['Leave Setup', 'إعداد الإجازات'],
  '/hr?module=settings': ['HR Settings', 'الإعدادات'],
  '/hr?module=team': ['HR Team', 'فريق الموارد البشرية'],
  '/hr?module=custody': ['Custody', 'العهد'],
  '/hr?module=contracts': ['Contracts', 'العقود'],
  '/hr/analytics': ['Analytics', 'مركز التحليلات'],
  '/hr/import': ['Data Import', 'استيراد البيانات'],
  '/employees': ['Employees', 'الموظفون'],
  '/employee/new': ['New Employee', 'موظف جديد'],
  '/employee-report': ['Employee Report', 'تقرير الموظفين'],
  '/attendance': ['Attendance', 'الحضور'],
  '/auto-attendance': ['Auto Attendance', 'الحضور التلقائي'],
  '/shift-management': ['Shift Management', 'إدارة المناوبات'],
  '/payroll': ['Payroll', 'المرتبات'],
  '/branches': ['Branches', 'الفروع'],
  '/biometric': ['Biometric', 'البصمة'],
  '/hr-managers': ['Permissions', 'الصلاحيات'],
  '/org-chart': ['Org Chart', 'الهيكل التنظيمي'],
  '/team': ['Company Users', 'مستخدمو الشركة'],
  '/requests': ['Requests', 'الطلبات'],
  '/me': ['My Home', 'رئيسيتي'],
  '/profile': ['My Profile', 'ملفي'],
  '/tasks': ['Tasks', 'المهام'],
}

function resolve(pathname: string, module: string | null, isRTL: boolean): string {
  const keys = module ? [`/hr?module=${module}`, pathname] : [pathname]
  for (const k of keys) {
    const t = TITLES[k]
    if (t) return isRTL ? t[1] : t[0]
  }
  // /employee/<id> and other dynamic detail routes
  if (/^\/employee(-details)?\//.test(pathname)) return isRTL ? 'ملف الموظف' : 'Employee Profile'
  return ''
}

export function DynamicTitle() {
  const pathname = usePathname() || ''
  const searchParams = useSearchParams()
  const { isRTL } = useI18n()

  useEffect(() => {
    const label = resolve(pathname, searchParams.get('module'), isRTL)
    document.title = label
      ? `${label} — ${BASE}`
      : isRTL ? `${BASE} — الموارد البشرية` : `${BASE} — Human Resources`
  }, [pathname, searchParams, isRTL])

  return null
}
