import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, Send, Users, Clock, MapPin, DollarSign, Building, FileText,
  Settings, Home,
  // per-item icons (added for sidebar visual scanning)
  Megaphone, UserCircle, Inbox, CalendarDays, Gavel, UserPlus, Package,
  Timer, CalendarClock, CalendarRange, Settings2, Fingerprint, BellRing,
  Receipt, Building2, ShieldCheck, UsersRound, Network, UserCog, BarChart3,
  Upload, Gauge, Contact, FileSignature, ClipboardList, PieChart, Store, ScrollText,
} from 'lucide-react'
import type { ComponentType } from 'react'

/**
 * Single source of truth for the Jisr-style HR shell (icon rail + top bar).
 *
 * - SHELL_PREFIXES: routes that mount the new <HrShell>. Grows one slice at a
 *   time; everything else keeps its legacy per-page Header/Sidebar until migrated.
 * - RAIL_SECTIONS: the 8 Jisr-style clusters. Every HR module/route is reachable
 *   in ≤2 clicks (section icon → item). `match(pathname, moduleParam)` decides
 *   the active highlight — dedicated routes compare pathname; `/hr?module=X`
 *   surfaces compare the `module` query param (pathname stays `/hr`).
 * - TOPBAR_ACTIONS: a seam. Feature phases push widgets here (e.g. the approvals
 *   inbox bell) without editing the topbar.
 */

export interface RailItem {
  id: string
  labelKey: string
  href: string
  /** pathname is query-less (Next usePathname); moduleParam is ?module= value. */
  match: (pathname: string, moduleParam: string | null) => boolean
  /** Small leading icon shown beside the item label to speed visual scanning. */
  icon?: LucideIcon
  /** Who sees this item. 'all' = every authenticated user (self-service);
   *  undefined/'hr' = HR/managers only. Drives the reduced rail for plain employees (F11). */
  visibility?: 'all' | 'hr'
  /** Needs a linked Employee record to be usable (e.g. self-service profile).
   *  Hidden for users without one — Company Admins/operators who never onboarded
   *  as an employee — so they don't land on a "no employee record" dead-end. */
  requiresEmployee?: boolean
}

export interface RailSection {
  id: string
  labelKey: string
  icon: LucideIcon
  items: RailItem[]
}

// ── Which routes get the new shell (Part A: unified across ALL HR pages) ──
// NOTE: '/hr' does NOT match '/hr-managers' (matchesShell requires exact or
// '/hr/…'), so '/hr-managers' is listed explicitly. '/employee' covers
// /employee/[id] and /employee/new but NOT '/employee-details'/'/employee-report'
// (those need '/employee/' — the hyphen breaks the prefix), so they're listed too.
export const SHELL_PREFIXES: string[] = [
  '/hr', '/hr-managers', '/requests', '/org-chart', '/me',
  '/employees', '/employee', '/employee-details', '/employee-report',
  '/attendance', '/auto-attendance', '/biometric', '/punch-sheet', '/branches', '/payroll',
  '/shift-management', '/location-tracking', '/radius-alerts', '/team', '/shifts',
]

export function matchesShell(pathname: string): boolean {
  // Exact or nested only.
  return SHELL_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

// Shell routes that get the chrome but NOT the HR-user gate — surfaces for
// Company Admins / self-service, where the page enforces its own (non-HR) access.
export const SHELL_NON_HR_PREFIXES: string[] = ['/team', '/requests', '/me', '/shifts']

/** Whether a shell route should enforce the base HR-user gate (HrGuard requireHR). */
export function shellRequiresHR(pathname: string): boolean {
  return !SHELL_NON_HR_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

// ── match helpers ──
/** `/hr?module=<mod>` surface. */
const mod = (m: string) => (p: string, q: string | null) => p === '/hr' && q === m
/** Dedicated route(s): active on the exact path or any nested path. */
const route = (...paths: string[]) => (p: string) =>
  paths.some((x) => p === x || p.startsWith(x + '/'))

export const RAIL_SECTIONS: RailSection[] = [
  {
    id: 'home',
    labelKey: 'nav.home',
    icon: LayoutDashboard,
    items: [
      { id: 'my-home', labelKey: 'nav.my_home', href: '/me', match: (p) => p === '/me', visibility: 'all', icon: Gauge },
      { id: 'dashboard', labelKey: 'nav.dashboard', href: '/hr', match: (p, q) => p === '/hr' && !q, icon: LayoutDashboard },
      { id: 'announcements', labelKey: 'nav.announcements', href: '/hr?module=announcements', match: mod('announcements'), icon: Megaphone },
      { id: 'my-profile', labelKey: 'nav.my_profile', href: '/profile', match: (p) => p === '/profile', visibility: 'all', requiresEmployee: true, icon: UserCircle },
    ],
  },
  {
    id: 'requests',
    labelKey: 'nav.requests_approvals',
    icon: Send,
    items: [
      { id: 'requests-hub', labelKey: 'nav.requests_hub', href: '/requests', match: (p) => p === '/requests', visibility: 'all', icon: Inbox },
      { id: 'requests', labelKey: 'nav.requests', href: '/hr?module=requests', match: mod('requests'), icon: Send },
      { id: 'leaves', labelKey: 'nav.leaves', href: '/hr?module=leaves', match: mod('leaves'), icon: CalendarDays },
      { id: 'discipline', labelKey: 'nav.discipline', href: '/hr?module=discipline', match: mod('discipline'), icon: Gavel },
    ],
  },
  {
    id: 'employees',
    labelKey: 'nav.employees',
    icon: Users,
    items: [
      {
        id: 'employees',
        labelKey: 'nav.employees',
        href: '/employees',
        // list + detail routes light up this item; '/employee-report' does NOT (Reports).
        match: (p) => p === '/employees' || p.startsWith('/employee/') || p.startsWith('/employee-details/'),
        // Distinct from the section header (Users) so the directory item reads apart from its group.
        icon: Contact,
      },
      { id: 'onboarding', labelKey: 'nav.onboarding', href: '/hr?module=onboarding', match: mod('onboarding'), icon: UserPlus },
      { id: 'contracts', labelKey: 'nav.contracts', href: '/hr?module=contracts', match: mod('contracts'), icon: FileSignature },
      { id: 'custody', labelKey: 'nav.custody', href: '/hr?module=custody', match: mod('custody'), icon: Package },
    ],
  },
  {
    id: 'attendance',
    labelKey: 'nav.attendance_time',
    icon: Clock,
    items: [
      { id: 'attendance', labelKey: 'nav.attendance', href: '/attendance', match: route('/attendance'), icon: Clock },
      { id: 'auto-attendance', labelKey: 'nav.auto_attendance', href: '/auto-attendance', match: route('/auto-attendance'), icon: Timer },
      { id: 'shift-management', labelKey: 'nav.shift_management', href: '/shift-management', match: route('/shift-management'), icon: CalendarClock },
      { id: 'shift-marketplace', labelKey: 'nav.shift_marketplace', href: '/shifts/marketplace', match: route('/shifts/marketplace'), visibility: 'all', icon: Store },
      { id: 'shift-calendar', labelKey: 'nav.shift_calendar', href: '/hr?module=shift-calendar', match: mod('shift-calendar'), icon: CalendarRange },
      { id: 'leave-setup', labelKey: 'nav.leave_setup', href: '/hr?module=leave-setup', match: mod('leave-setup'), icon: Settings2 },
    ],
  },
  {
    id: 'field',
    labelKey: 'nav.field_devices',
    icon: MapPin,
    items: [
      { id: 'biometric', labelKey: 'nav.biometric', href: '/biometric', match: route('/biometric'), icon: Fingerprint },
      { id: 'punch-sheet', labelKey: 'nav.punch_sheet', href: '/punch-sheet', match: route('/punch-sheet'), icon: Upload },
      { id: 'location-tracking', labelKey: 'nav.location_tracking', href: '/hr?module=location-tracking', match: mod('location-tracking'), icon: MapPin },
      { id: 'radius-alerts', labelKey: 'nav.radius_alerts', href: '/hr?module=radius-alerts', match: mod('radius-alerts'), icon: BellRing },
    ],
  },
  {
    id: 'payroll',
    labelKey: 'nav.payroll',
    icon: DollarSign,
    items: [
      { id: 'payroll', labelKey: 'nav.payroll', href: '/payroll', match: route('/payroll'), icon: DollarSign },
      { id: 'expenses', labelKey: 'nav.expenses', href: '/hr?module=expenses', match: mod('expenses'), icon: Receipt },
    ],
  },
  {
    id: 'organization',
    labelKey: 'nav.organization',
    icon: Building,
    items: [
      { id: 'branches', labelKey: 'nav.branches', href: '/branches', match: route('/branches'), icon: Building2 },
      { id: 'hr-managers', labelKey: 'nav.permissions', href: '/hr-managers', match: route('/hr-managers'), icon: ShieldCheck },
      { id: 'hr-team', labelKey: 'nav.hr_team', href: '/hr?module=team', match: mod('team'), icon: UsersRound },
      { id: 'org-chart', labelKey: 'nav.org_chart', href: '/org-chart', match: route('/org-chart'), icon: Network },
      { id: 'company-users', labelKey: 'nav.company_users', href: '/team', match: (p) => p === '/team', icon: UserCog },
    ],
  },
  {
    id: 'reports',
    labelKey: 'nav.reports',
    icon: FileText,
    items: [
      { id: 'attendance-report', labelKey: 'nav.attendance_report', href: '/hr?module=attendance-report', match: mod('attendance-report'), icon: BarChart3 },
      { id: 'employee-report', labelKey: 'nav.employee_report', href: '/employee-report', match: route('/employee-report'), icon: ClipboardList },
      { id: 'analytics', labelKey: 'nav.analytics', href: '/hr/analytics', match: route('/hr/analytics'), icon: PieChart },
      { id: 'compliance', labelKey: 'nav.compliance', href: '/hr/compliance', match: route('/hr/compliance'), icon: ShieldCheck },
      { id: 'data-import', labelKey: 'nav.data_import', href: '/hr/import', match: route('/hr/import'), icon: Upload },
    ],
  },
]

/**
 * The ONLY HR nav items a "fingerprint-only" tenant (hr_fingerprint_only flag)
 * may see — a trimmed biometric/attendance plan. Everything else HR (payroll,
 * leaves, requests, discipline, onboarding, contracts, custody, shifts, org, …) is
 * hidden from the rail AND blocked at the route by the shell guard. Ids reference
 * RailItem.id in RAIL_SECTIONS above.
 */
/**
 * Landing route for the biometric/attendance-only package ("تمكين حضور"). Login
 * for a hr_fingerprint_only tenant lands here (skipping the module hub), and the
 * shell's route guard bounces any out-of-bundle HR URL here. Must be one of the
 * FINGERPRINT_RAIL_ITEM_IDS routes below.
 */
export const FINGERPRINT_HOME = '/attendance'

export const FINGERPRINT_RAIL_ITEM_IDS: ReadonlySet<string> = new Set([
  'my-home',           // /me
  'my-profile',        // /profile
  'employees',         // /employees (+ /employee/…, /employee-details/…)
  'attendance',        // /attendance
  'auto-attendance',   // /auto-attendance
  'biometric',         // /biometric
  'attendance-report', // /hr?module=attendance-report
])

/**
 * True when the current location is one of the fingerprint-only bundle routes.
 * Reuses the same RailItem.match fns as FINGERPRINT_RAIL_ITEM_IDS, so employee
 * detail sub-routes (/employee/[id], /employee-details/…) and nested attendance/
 * biometric paths all resolve. `/hr?module=attendance-report` is allowed via the
 * moduleParam; bare `/hr` (dashboard) and every other HR route are NOT. The shell
 * guard uses this to keep a fingerprint tenant on allowed routes and redirect away
 * from everything else.
 */
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

export const BOTTOM_ITEMS: BottomItem[] = [
  { id: 'settings', labelKey: 'nav.settings', href: '/hr?module=settings', icon: Settings, match: mod('settings') },
  { id: 'back-home', labelKey: 'guard.back_home', href: '/', icon: Home },
]

/** Seam: feature phases push widgets (e.g. the approvals bell) into the topbar. */
export const TOPBAR_ACTIONS: ComponentType[] = []

/** True if any item across all sections is active for this location. */
export function isItemActive(item: RailItem, pathname: string, moduleParam: string | null): boolean {
  return item.match(pathname, moduleParam)
}

/**
 * Rail sections for the current user. Plain employees (not HR, not a manager) get
 * the REDUCED self-service rail — only `visibility:'all'` items (My Home / My
 * Requests / My Profile), and sections with no visible items are dropped. HR and
 * managers see everything (F11 / F14).
 *
 * `hasEmployee` gates items flagged `requiresEmployee` (e.g. My Profile): a user
 * with no linked Employee record — a Company Admin/operator who never onboarded —
 * would otherwise be offered a link that dead-ends on a "no employee record"
 * error, so it's dropped for them regardless of role. */
export function visibleRailSections(opts: { isEmployee: boolean; hasEmployee: boolean; hrFingerprintOnly?: boolean }): RailSection[] {
  const gateEmployee = (items: RailItem[]) =>
    opts.hasEmployee ? items : items.filter((i) => !i.requiresEmployee)

  // Fingerprint-only plan: trim to the biometric/attendance bundle regardless of
  // role. Only FINGERPRINT_RAIL_ITEM_IDS survive; empty sections drop. Driven by the
  // orthogonal hr_fingerprint_only flag — it ONLY trims the HR nav; every other
  // module the tenant has stays fully available.
  if (opts.hrFingerprintOnly === true) {
    return RAIL_SECTIONS
      .map((s) => ({ ...s, items: gateEmployee(s.items.filter((i) => FINGERPRINT_RAIL_ITEM_IDS.has(i.id))) }))
      .filter((s) => s.items.length > 0)
  }

  if (!opts.isEmployee) {
    return RAIL_SECTIONS
      .map((s) => ({ ...s, items: gateEmployee(s.items) }))
      .filter((s) => s.items.length > 0)
  }
  return RAIL_SECTIONS
    .map((s) => ({ ...s, items: gateEmployee(s.items.filter((i) => i.visibility === 'all')) }))
    .filter((s) => s.items.length > 0)
}
