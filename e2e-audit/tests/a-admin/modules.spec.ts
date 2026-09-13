import { test, expect } from '../../helpers/audit'

/**
 * APP A — Admin Dashboard / HR back-office. One test per sidebar surface.
 * Each test: visit → settle → full scan (incl. axe) → walk visible tabs
 * (payroll's 8 tabs, leave-setup, settings, employee segments…) → search probe.
 * Read-only; the context-level mutation blocker guarantees no writes.
 */

interface Mod {
  screen: string
  path: string
  moneyScan?: boolean
}

const MODULES: Mod[] = [
  { screen: 'لوحة التحكم (Dashboard)', path: '/hr' },
  { screen: 'الموظفون (Employees)', path: '/employees' },
  { screen: 'التعيين (Onboarding)', path: '/hr?module=onboarding' },
  { screen: 'عقود العمل (Contracts)', path: '/hr?module=contracts' },
  { screen: 'عهد الموظفين (Custody)', path: '/hr?module=custody' },
  { screen: 'الإجازات (Leaves)', path: '/hr?module=leaves' },
  { screen: 'الانضباط (Discipline)', path: '/hr?module=discipline' },
  { screen: 'الطلبات (Requests)', path: '/hr?module=requests' },
  { screen: 'مركز الطلبات (Requests hub)', path: '/requests' },
  { screen: 'الإعلانات (Announcements)', path: '/hr?module=announcements' },
  { screen: 'الحضور (Attendance)', path: '/attendance' },
  { screen: 'الحضور التلقائي (Auto attendance)', path: '/auto-attendance' },
  { screen: 'إدارة المناوبات (Shift management)', path: '/shift-management' },
  { screen: 'تقويم المناوبات (Shift calendar)', path: '/hr?module=shift-calendar' },
  { screen: 'إعدادات الإجازات (Leave setup)', path: '/hr?module=leave-setup' },
  { screen: 'البصمة (Biometric)', path: '/biometric' },
  { screen: 'تتبع الموقع (Location tracking)', path: '/hr?module=location-tracking' },
  { screen: 'تنبيهات النطاق (Radius alerts)', path: '/hr?module=radius-alerts' },
  { screen: 'المرتبات (Payroll — all tabs)', path: '/payroll', moneyScan: true },
  { screen: 'المصروفات (Expenses)', path: '/hr?module=expenses', moneyScan: true },
  { screen: 'إعدادات الفروع (Branches)', path: '/branches' },
  { screen: 'الصلاحيات (Permissions)', path: '/hr-managers' },
  { screen: 'فريق الموارد البشرية (HR team)', path: '/hr?module=team' },
  { screen: 'الهيكل التنظيمي (Org chart)', path: '/org-chart' },
  { screen: 'مستخدمو الشركة (Company users)', path: '/team' },
  { screen: 'تقرير الحضور (Attendance report)', path: '/hr?module=attendance-report' },
  { screen: 'تقرير الموظفين (Employee report)', path: '/employee-report' },
  { screen: 'التحليلات (Analytics)', path: '/hr/analytics' },
  { screen: 'استيراد البيانات (Data import)', path: '/hr/import' },
  { screen: 'الإعدادات (HR settings)', path: '/hr?module=settings' },
]

for (const mod of MODULES) {
  test(`A › ${mod.screen}`, async ({ audit }) => {
    await audit.visit(mod.path)
    const { hard } = await audit.scan({ app: 'A', screen: mod.screen, path: mod.path, moneyScan: mod.moneyScan, axe: true })
    await audit.walkTabs({ app: 'A', screen: mod.screen, path: mod.path, moneyScan: mod.moneyScan })
    await audit.searchProbe({ app: 'A', screen: mod.screen, path: mod.path })
    expect(
      hard.map((f) => `${f.check}: ${f.details}`),
      `hard failures on ${mod.screen}`,
    ).toEqual([])
  })
}
