import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, Users, Clock, Settings, Home,
  UserCircle, Building2, CalendarDays, Briefcase, FolderKanban,
  ClipboardList, MapPin, UsersRound, Globe, Umbrella, FileText,
  Plus, FileMinus, RotateCcw, Send, BarChart3, ShieldCheck,
  UserCog, Activity, Cpu, SlidersHorizontal, MailOpen, Building,
  CreditCard, Moon, Fingerprint, Upload, UserX, CheckSquare,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { HR_REPORTS, REPORT_MODULE_PREFIX } from '@/lib/hr-reports'

/**
 * HR Shell Navigation — exact match to the Apex ERP screenshot.
 *
 * 5 Sections (matching the sidebar in the screenshot exactly):
 *  1. لوحة التحكم  (Dashboard)
 *  2. البيانات الاساسية  (Basic Data — 12 items)
 *  3. الحضور والانصراف  (Attendance — 6 items)
 *  4. المستخدمين  (Users — 3 items)
 *  5. الاعدادات  (Settings — 8 items)
 */

export interface RailItem {
  id: string
  labelKey: string
  /** literal label (used for the report pages, which are not in the i18n table) */
  label?: string
  href: string
  match: (pathname: string, moduleParam: string | null) => boolean
  icon?: LucideIcon
  visibility?: 'all' | 'hr'
  requiresEmployee?: boolean
  /** nested group (Apex «التقارير» under الحضور والانصراف) */
  children?: RailItem[]
}

export interface RailSection {
  id: string
  labelKey: string
  icon: LucideIcon
  items: RailItem[]
}

// ── Which routes get the new shell ──────────────────────────────────────────
export const SHELL_PREFIXES: string[] = [
  '/hr', '/hr-managers', '/requests', '/org-chart', '/me',
  '/employees', '/employee', '/employee-details', '/employee-report',
  '/attendance', '/auto-attendance', '/biometric', '/punch-sheet', '/branches', '/payroll',
  '/shift-management', '/rotational-shifts', '/location-groups', '/location-tracking', '/radius-alerts', '/team', '/shifts',
]

export function matchesShell(pathname: string): boolean {
  return SHELL_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export const SHELL_NON_HR_PREFIXES: string[] = ['/team', '/requests', '/me', '/shifts']

export function shellRequiresHR(pathname: string): boolean {
  return !SHELL_NON_HR_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

// ── match helpers ────────────────────────────────────────────────────────────
const mod = (m: string) => (p: string, q: string | null) => p === '/hr' && q === m
const route = (...paths: string[]) => (p: string) =>
  paths.some((x) => p === x || p.startsWith(x + '/'))

// ── RAIL SECTIONS — exact structure from screenshot ──────────────────────────
export const RAIL_SECTIONS: RailSection[] = [

  // ── 1. لوحة التحكم ──────────────────────────────────────────────────────
  {
    id: 'dashboard',
    labelKey: 'nav.dashboard_section',
    icon: LayoutDashboard,
    items: [
      {
        id: 'dashboard-main',
        labelKey: 'nav.attendance_control_panel',
        href: '/hr',
        match: (p, q) => p === '/hr' && !q,
        icon: LayoutDashboard,
      },
    ],
  },

  // ── 2. البيانات الاساسية (12 items) ─────────────────────────────────────
  {
    id: 'basic-data',
    labelKey: 'nav.basic_data',
    icon: ClipboardList,
    items: [
      {
        id: 'employees',
        labelKey: 'nav.employees',
        href: '/employees',
        match: (p) => p === '/employees' || p.startsWith('/employee/') || p.startsWith('/employee-details/'),
        icon: Users,
      },
      {
        id: 'jobs',
        labelKey: 'nav.jobs',
        href: '/hr?module=jobs',
        match: mod('jobs'),
        icon: Briefcase,
      },
      {
        id: 'branches',
        labelKey: 'nav.branches',
        href: '/branches',
        match: route('/branches'),
        icon: Building2,
      },
      {
        id: 'shift-management',
        labelKey: 'nav.work_times',
        href: '/shift-management',
        match: route('/shift-management'),
        icon: Clock,
      },
      {
        id: 'unregistered-employees',
        labelKey: 'nav.unregistered_employees',
        href: '/hr?module=unregistered-employees',
        match: mod('unregistered-employees'),
        icon: UserX,
      },
      {
        id: 'projects',
        labelKey: 'nav.projects',
        href: '/hr?module=projects',
        match: mod('projects'),
        icon: FolderKanban,
      },
      {
        id: 'tasks',
        labelKey: 'nav.tasks',
        href: '/hr?module=tasks',
        match: mod('tasks'),
        icon: CheckSquare,
      },
      {
        id: 'location-groups',
        labelKey: 'nav.location_groups',
        href: '/hr?module=location-groups',
        match: mod('location-groups'),
        icon: MapPin,
      },
      {
        id: 'employee-groups',
        labelKey: 'nav.employee_groups',
        href: '/hr?module=employee-groups',
        match: mod('employee-groups'),
        icon: UsersRound,
      },
      {
        id: 'nationality',
        labelKey: 'nav.nationality',
        href: '/hr?module=nationality',
        match: mod('nationality'),
        icon: Globe,
      },
      {
        id: 'official-holidays',
        labelKey: 'nav.official_holidays',
        href: '/hr?module=official-holidays',
        match: mod('official-holidays'),
        icon: CalendarDays,
      },
      {
        id: 'leave-types',
        labelKey: 'nav.leave_types',
        href: '/hr?module=leave-types',
        match: mod('leave-types'),
        icon: Umbrella,
      },
    ],
  },

  // ── 3. الحضور والانصراف (6 items) ───────────────────────────────────────
  {
    id: 'attendance',
    labelKey: 'nav.attendance_section',
    icon: Clock,
    items: [
      {
        id: 'add-leave',
        labelKey: 'nav.add_leave',
        href: '/hr?module=add-leave',
        match: mod('add-leave'),
        icon: Plus,
      },
      {
        id: 'add-permission',
        labelKey: 'nav.add_permission',
        href: '/hr?module=add-permission',
        match: mod('add-permission'),
        icon: MailOpen,
      },
      {
        id: 'attendance-transactions',
        labelKey: 'nav.attendance_transactions',
        href: '/attendance',
        match: route('/attendance'),
        icon: Activity,
      },
      {
        id: 'cancel-transactions',
        labelKey: 'nav.cancel_transactions',
        href: '/hr?module=cancel-transactions',
        match: mod('cancel-transactions'),
        icon: RotateCcw,
      },
      {
        id: 'requests',
        labelKey: 'nav.requests_menu',
        href: '/requests',
        match: (p) => p === '/requests',
        icon: Send,
        visibility: 'all',
      },
      {
        id: 'attendance-reports',
        labelKey: 'nav.reports',
        href: `/hr?module=${REPORT_MODULE_PREFIX}${HR_REPORTS[0].slug}`,
        match: (p, q) => p === '/hr' && !!q && q.startsWith(REPORT_MODULE_PREFIX),
        icon: BarChart3,
        children: HR_REPORTS.map((r) => ({
          id: `report-${r.slug}`,
          labelKey: 'nav.reports',
          label: r.title,
          href: `/hr?module=${REPORT_MODULE_PREFIX}${r.slug}`,
          match: mod(`${REPORT_MODULE_PREFIX}${r.slug}`),
        })),
      },
    ],
  },

  // ── 4. المستخدمين (3 items) ──────────────────────────────────────────────
  {
    id: 'users',
    labelKey: 'nav.users_section',
    icon: UserCog,
    items: [
      {
        id: 'company-users',
        labelKey: 'nav.users',
        href: '/team',
        match: (p) => p === '/team',
        icon: Users,
      },
      {
        id: 'permissions',
        labelKey: 'nav.permissions',
        href: '/hr-managers',
        match: route('/hr-managers'),
        icon: ShieldCheck,
      },
      {
        id: 'user-transactions',
        labelKey: 'nav.user_transactions',
        href: '/hr?module=user-transactions',
        match: mod('user-transactions'),
        icon: Activity,
      },
    ],
  },

  // ── 5. الاعدادات (8 items) ───────────────────────────────────────────────
  {
    id: 'settings',
    labelKey: 'nav.settings_section',
    icon: Settings,
    items: [
      {
        id: 'ramadan-schedule',
        labelKey: 'nav.ramadan_schedule',
        href: '/hr?module=ramadan-schedule',
        match: mod('ramadan-schedule'),
        icon: Moon,
      },
      {
        id: 'attendance-settings',
        labelKey: 'nav.attendance_settings',
        href: '/hr?module=attendance-settings',
        match: mod('attendance-settings'),
        icon: SlidersHorizontal,
      },
      {
        id: 'locations',
        labelKey: 'nav.locations',
        href: '/hr?module=locations',
        match: mod('locations'),
        icon: MapPin,
      },
      {
        id: 'devices',
        labelKey: 'nav.devices',
        href: '/biometric',
        match: route('/biometric'),
        icon: Fingerprint,
      },
      {
        id: 'general-settings',
        labelKey: 'nav.general_settings',
        href: '/hr?module=settings',
        match: mod('settings'),
        icon: Settings,
      },
      {
        id: 'requests-settings',
        labelKey: 'nav.requests_settings',
        href: '/hr?module=requests-settings',
        match: mod('requests-settings'),
        icon: MailOpen,
      },
      {
        id: 'company-data',
        labelKey: 'nav.company_data',
        href: '/hr?module=company-data',
        match: mod('company-data'),
        icon: Building,
      },
      {
        id: 'subscription-info',
        labelKey: 'nav.subscription_info',
        href: '/hr?module=subscription-info',
        match: mod('subscription-info'),
        icon: CreditCard,
      },
    ],
  },
]

// ── Fingerprint-only plan ────────────────────────────────────────────────────
export const FINGERPRINT_HOME = '/attendance'

export const FINGERPRINT_RAIL_ITEM_IDS: ReadonlySet<string> = new Set([
  'employees',
  'attendance-transactions',
  'attendance-reports',
  'devices',
])

export function isFingerprintRoute(pathname: string, moduleParam: string | null): boolean {
  return RAIL_SECTIONS.some((s) =>
    s.items.some((i) => FINGERPRINT_RAIL_ITEM_IDS.has(i.id) && i.match(pathname, moduleParam)),
  )
}

export interface BottomItem {
  id: string
  labelKey: string
  href: string
  icon: LucideIcon
  match?: (pathname: string, moduleParam: string | null) => boolean
}

const BOTTOM_ITEMS: BottomItem[] = [
  { id: 'back-home', labelKey: 'guard.back_home', href: '/', icon: Home },
]

/** Seam: feature phases push widgets into the topbar. */
export const TOPBAR_ACTIONS: ComponentType[] = []

export function isItemActive(item: RailItem, pathname: string, moduleParam: string | null): boolean {
  return item.match(pathname, moduleParam)
}

/**
 * Rail sections filtered by user role.
 * HR/admin sees all 5 sections.
 * Plain employees see only items marked visibility:'all'.
 * Fingerprint-only tenants see only FINGERPRINT_RAIL_ITEM_IDS.
 */
function visibleRailSections(opts: {
  isEmployee: boolean
  hasEmployee: boolean
  hrFingerprintOnly?: boolean
}): RailSection[] {
  const gateEmployee = (items: RailItem[]) =>
    opts.hasEmployee ? items : items.filter((i) => !i.requiresEmployee)

  if (opts.hrFingerprintOnly === true) {
    return RAIL_SECTIONS
      .map((s) => ({ ...s, items: gateEmployee(s.items.filter((i) => FINGERPRINT_RAIL_ITEM_IDS.has(i.id))) }))
      .filter((s) => s.items.length > 0)
  }

  if (!opts.isEmployee) {
    // HR / Admin / Manager — all sections, all items
    return RAIL_SECTIONS
      .map((s) => ({ ...s, items: gateEmployee(s.items) }))
      .filter((s) => s.items.length > 0)
  }

  // Plain employee — self-service only (visibility:'all')
  return RAIL_SECTIONS
    .map((s) => ({
      ...s,
      items: gateEmployee(s.items.filter((i) => i.visibility === 'all')),
    }))
    .filter((s) => s.items.length > 0)
}
