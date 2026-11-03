'use client'

import React, { useState, useEffect } from 'react'
import {
  Users,
  UserCheck,
  Calendar,
  Clock,
  Bell,
  Settings,
  Search,
  UserPlus,
  FileText,
  DollarSign,
  Briefcase,
  Star,
  Loader2,
  TrendingUp,
  ArrowRight,
  GraduationCap,
  ArrowRightLeft,
  UserCheck as ShiftIcon,
  Sparkles,
  UserX,
  AlertTriangle,
  Download,
  ShieldAlert,
  ClipboardList,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ModuleType } from '@/components/sidebar'
import { frappeClient, type Employee } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import DashboardIntelligence from '@/components/hr/dashboard-intelligence'
import WorkforceAnalytics from '@/components/hr/workforce-analytics'
import ManagementMetrics from '@/components/hr/management-metrics'
import LeadershipMetrics from '@/components/hr/leadership-metrics'
import PayrollAuditSection from '@/components/hr/payroll-audit'
import RetentionRadarSection from '@/components/hr/retention-radar'
import AnomalyRadarSection from '@/components/hr/anomaly-radar'
import BranchBenchmarksSection from '@/components/hr/branch-benchmarks'
import HiringPlannerSection from '@/components/hr/hiring-planner'
import ShiftPlannerSection from '@/components/hr/shift-planner'
// Owner Delight — Phase B/C/D screens (server-gated by feature flags)
import TrueCostByBranchSection from '@/components/hr/true-cost-branch'
import GovernmentDeadlineCalendarSection from '@/components/hr/compliance-calendar'
import GosiReconciliationSection from '@/components/hr/gosi-reconciliation'
import OvertimeBudgetSection from '@/components/hr/overtime-budget'
import ResidencyRadarSection from '@/components/hr/residency-radar'
import RecognitionWallSection from '@/components/hr/recognition-wall'
import ExpensesByBranchSection from '@/components/hr/expenses-by-branch'
import { useFeatureFlags } from '@/hooks/use-feature-flags'

// --- Interfaces ---
interface DashboardStats {
  totalEmployees: number
  activeEmployees: number
  presentToday: number
  onLeave: number
  absent: number
  missingPunches: number
  loading: boolean
}

interface EmployeeCard {
  name: string
  employee_name: string
  designation: string | null
  image: string | null
  branch: string | null
  department: string | null
  leave_allocated: number
  leave_remaining: number
  latest_salary_slip: string | null
}

interface Violation {
  name: string
  employee_name: string
  violation_label: string
  violation_date: string | null
  penalty_applied: string | null
}

interface ViolationSummary {
  total: number
  late: number
  early_departure: number
  absence: number
}

interface HRDashboardProps {
  onNavigate: (module: ModuleType) => void
}

// --- Quick Actions with navigation mapping ---
const quickActions: Array<{
  id: number
  labelKey: string
  icon: React.ReactNode
  module: ModuleType
  descKey: string
}> = [
    { id: 1, labelKey: 'action.add_employee', icon: <UserPlus className="h-5 w-5" />, module: 'new-employee', descKey: 'action.new_record' },
    { id: 2, labelKey: 'action.leaves', icon: <Calendar className="h-5 w-5" />, module: 'leaves', descKey: 'action.requests' },
    { id: 3, labelKey: 'action.attendance', icon: <Clock className="h-5 w-5" />, module: 'attendance', descKey: 'action.track' },
    { id: 4, labelKey: 'action.payroll', icon: <DollarSign className="h-5 w-5" />, module: 'salaries', descKey: 'action.salaries' },
    { id: 5, labelKey: 'action.expenses', icon: <FileText className="h-5 w-5" />, module: 'expenses', descKey: 'action.claims' },
  ]

// --- Sub-Components ---

function StatCard({ title, value, icon, iconBg, trend, loading, onClick, alert }: {
  title: string
  value: number | string
  icon: React.ReactNode
  iconBg: string
  trend?: string
  loading: boolean
  onClick?: () => void
  /** Card carries alert semantics (absent, missing punches). When true and the
   *  value is 0, the alert color is muted to neutral so it doesn't draw the eye. */
  alert?: boolean
}) {
  const isZero = value === 0 || value === '0'
  const muted = !!alert && isZero
  return (
    <div
      className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-border transition-all cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[13px] font-medium text-muted-foreground mb-1.5">{title}</p>
          {loading ? (
            <div className="flex items-center gap-2 h-9">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
            </div>
          ) : (
            <>
              <p className={`text-3xl font-bold tracking-tight ${muted ? 'text-muted-foreground/70' : 'text-foreground'}`}>{value}</p>
              {trend && (
                <div className="flex items-center gap-1 text-[11px] text-emerald-600 mt-1.5 font-medium">
                  <TrendingUp className="h-3 w-3" />
                  {trend}
                </div>
              )}
            </>
          )}
        </div>
        <div className={`${muted ? 'bg-muted text-muted-foreground/70' : `${iconBg} text-white`} p-3 rounded-xl flex-shrink-0 group-hover:scale-105 transition-transform shadow-sm`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function QuickActionTile({ label, icon, description, onClick }: {
  label: string; icon: React.ReactNode; description: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="bg-card border border-border/60 rounded-2xl p-4 hover:border-primary/30 hover:shadow-md transition-all flex flex-col items-center gap-2.5 group cursor-pointer w-full"
    >
      <div className="bg-gradient-to-br from-accent to-accent/60 text-primary p-3 rounded-xl group-hover:scale-105 transition-all">
        {icon}
      </div>
      <div className="text-center">
        <p className="text-[13px] font-semibold text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground/70 mt-0.5">{description}</p>
      </div>
    </button>
  )
}

function RecentEmployeeCard({ employee, onClick }: { employee: Employee; onClick: () => void }) {
  const initials = employee.employee_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()

  const statusColors: Record<string, string> = {
    'Active': 'bg-green-100 text-green-700',
    'Inactive': 'bg-muted text-muted-foreground',
    'Suspended': 'bg-orange-100 text-orange-700',
    'Left': 'bg-red-100 text-red-700',
  }

  return (
    <div
      className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-b-0 cursor-pointer hover:bg-accent/50 px-2 rounded-lg transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-white text-xs font-semibold shadow-sm">
          {initials}
        </div>
        <div>
          <p className="text-[13px] font-semibold text-foreground">{employee.employee_name}</p>
          <p className="text-[11px] text-muted-foreground/70">{employee.designation || employee.department || 'No designation'}</p>
        </div>
      </div>
      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusColors[employee.status] || 'bg-muted text-muted-foreground'}`}>
        {employee.status}
      </span>
    </div>
  )
}

/** Quick payslip PDF download (default print format, session-authenticated). */
function buildPayslipUrl(slipName: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/api/method/frappe.utils.print_format.download_pdf?doctype=${encodeURIComponent('Salary Slip')}&name=${encodeURIComponent(slipName)}&no_letterhead=0`
}

/** Per-employee mini-card: designation + available leave balance + quick payslip download. */
function EmployeeMiniCard({ emp, t, onClick }: { emp: EmployeeCard; t: (k: string) => string; onClick: () => void }) {
  const initials = (emp.employee_name || '?').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-b-0 px-2 rounded-lg hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3 min-w-0 cursor-pointer" onClick={onClick}>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-white text-xs font-semibold shadow-sm flex-shrink-0">{initials}</div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground truncate">{emp.employee_name}</p>
          <p className="text-[11px] text-muted-foreground/70 truncate">{emp.designation || emp.department || (isRTLText() ? 'غير محدد' : 'Unassigned')}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className={isRTLText() ? 'text-left' : 'text-right'}>
          <p className="text-[10px] text-muted-foreground/70">{t('dash.leave_remaining')}</p>
          <p className="text-[12px] font-semibold text-foreground/90">{emp.leave_remaining}/{emp.leave_allocated}</p>
        </div>
        {emp.latest_salary_slip ? (
          <a
            href={buildPayslipUrl(emp.latest_salary_slip)}
            target="_blank"
            rel="noopener noreferrer"
            title={t('dash.payslip')}
            aria-label={t('dash.payslip')}
            className="p-1.5 rounded-lg text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors"
          >
            <Download className="h-4 w-4" />
          </a>
        ) : (
          <span className="p-1.5 rounded-lg text-muted-foreground/40" title={t('dash.no_payslip')} aria-label={t('dash.no_payslip')}><Download className="h-4 w-4" /></span>
        )}
      </div>
    </div>
  )
}

function isRTLText() {
  return typeof document !== 'undefined' && document.documentElement.dir === 'rtl'
}

/** One row in the branch-manager discipline-notifications card. */
function DisciplineRow({ v }: { v: Violation }) {
  const isWarning = (v.penalty_applied || '') === 'Warning'
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-b-0 px-2">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-foreground truncate">{v.employee_name}</p>
        <p className="text-[11px] text-muted-foreground/70 truncate">{v.violation_label} · {v.violation_date}</p>
      </div>
      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${isWarning ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
        {v.penalty_applied}
      </span>
    </div>
  )
}

// --- Main Component ---

export function HRDashboard({ onNavigate }: HRDashboardProps) {
  const { t, isRTL } = useI18n()
  const { toast } = useToast()
  const { flags, loaded: flagsLoaded } = useFeatureFlags()
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    activeEmployees: 0,
    presentToday: 0,
    onLeave: 0,
    absent: 0,
    missingPunches: 0,
    loading: true,
  })
  const [cards, setCards] = useState<EmployeeCard[]>([])
  const [violations, setViolations] = useState<Violation[]>([])
  const [vSummary, setVSummary] = useState<ViolationSummary>({ total: 0, late: 0, early_departure: 0, absence: 0 })

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    const today = new Date().toISOString().split('T')[0]
    // Employees + all reads below are branch-scoped server-side: /api/resource via
    // Phase-1 permission_query_conditions, and the custom methods via effective_branches.
    const [empRes, reportRes, cardsRes, violRes] = await Promise.allSettled([
      frappeClient.getEmployees({
        fields: ['name', 'employee_name', 'status', 'department', 'designation', 'date_of_joining', 'image'],
        order_by: 'creation desc',
        limit_page_length: 100,
      }),
      frappeClient.call('base_meena.attendance_report_api.get_attendance_report', { from_date: today, to_date: today }),
      frappeClient.call('base_meena.hr_management.dashboard_api.get_employee_cards', { limit: 8 }),
      frappeClient.call('base_meena.penalty_management.api.get_branch_violations', { days: 7 }),
    ])

    let totalEmployees = 0
    let activeEmployees = 0
    if (empRes.status === 'fulfilled') {
      const employees = empRes.value || []
      totalEmployees = employees.length
      activeEmployees = employees.filter((e: Employee) => e.status === 'Active').length
    }

    let present = 0, onLeave = 0, absent = 0, missingPunches = 0
    if (reportRes.status === 'fulfilled') {
      const s = (reportRes.value?.message?.summary) || {}
      present = s.present || 0
      onLeave = s.on_leave || 0
      absent = s.absent || 0
      missingPunches = s.missing_punches || 0
    }

    setStats({ totalEmployees, activeEmployees, presentToday: present, onLeave, absent, missingPunches, loading: false })

    if (cardsRes.status === 'fulfilled') {
      setCards(cardsRes.value?.message?.employees || [])
    }
    if (violRes.status === 'fulfilled') {
      const v = violRes.value?.message || {}
      setViolations(v.violations || [])
      setVSummary(v.summary || { total: 0, late: 0, early_departure: 0, absence: 0 })
    }

    if (empRes.status === 'rejected') {
      console.error('Failed to load dashboard data:', empRes.reason)
      toast({ title: t('error'), description: t('dash.load_fail'), variant: 'destructive' })
    }
  }

  return (
    <main className="flex-1 overflow-auto">
      <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
        {/* Page Header — friendly greeting */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-foreground">{new Date().getHours() < 12 ? t('dash.greeting_morning') : new Date().getHours() < 18 ? t('dash.greeting_afternoon') : t('dash.greeting_evening')}</h1>
              <span className="text-2xl">👋</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('dash.subtitle')}
            </p>
          </div>
        </div>

        {/* Stats Row — LIVE from backend, branch-scoped */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 mb-8">
          <StatCard
            title={t('dash.total_employees')}
            value={stats.totalEmployees}
            icon={<Users className="h-5 w-5" />}
            iconBg="bg-primary"
            trend={t('dash.from_frappe')}
            loading={stats.loading}
            onClick={() => onNavigate('employees')}
          />
          <StatCard
            title={t('dash.active')}
            value={stats.activeEmployees}
            icon={<UserCheck className="h-5 w-5" />}
            iconBg="bg-emerald-600"
            loading={stats.loading}
            onClick={() => onNavigate('employees')}
          />
          <StatCard
            title={t('dash.present_today')}
            value={stats.presentToday}
            icon={<Clock className="h-5 w-5" />}
            iconBg="bg-violet-600"
            loading={stats.loading}
            onClick={() => onNavigate('attendance')}
          />
          <StatCard
            title={t('dash.absent')}
            value={stats.absent}
            icon={<UserX className="h-5 w-5" />}
            iconBg="bg-rose-600"
            alert
            loading={stats.loading}
            onClick={() => onNavigate('attendance')}
          />
          <StatCard
            title={t('dash.on_leave')}
            value={stats.onLeave}
            icon={<Calendar className="h-5 w-5" />}
            iconBg="bg-amber-500"
            loading={stats.loading}
            onClick={() => onNavigate('leaves')}
          />
          <StatCard
            title={t('dash.missing_punches')}
            value={stats.missingPunches}
            icon={<AlertTriangle className="h-5 w-5" />}
            iconBg="bg-orange-500"
            alert
            loading={stats.loading}
            onClick={() => onNavigate('attendance')}
          />
        </div>

        {/* HR Intelligence — live presence, attendance pulse, at-risk, compliance, insights */}
        <DashboardIntelligence />

        {/* Workforce Analytics — headcount trend, diversity, labor cost, tenure */}
        <WorkforceAnalytics />

        {/* Management Metrics — EWA exposure, document radar, payroll readiness,
            actions due, EOSB & leave liability, absence & lateness cost */}
        <ManagementMetrics />

        {/* Leadership Metrics — Nitaqat simulator, WPS readiness, overtime cost,
            leave & coverage, turnover & retention */}
        <LeadershipMetrics />

        {/* Payroll Pre-flight Audit — fraud/gap/anomaly scan before the pay run */}
        <PayrollAuditSection />

        {/* Retention Radar — transparent, rules-based attrition risk per employee */}
        <RetentionRadarSection />

        {/* Anomaly Radar — attendance & payroll integrity flags (last 30 days) */}
        <AnomalyRadarSection />

        {/* Cross-Branch Benchmarks — branches vs each other & the company average */}
        <BranchBenchmarksSection />

        {/* Hiring & Budget Planner — fully-loaded cost + Nitaqat impact of a hiring plan */}
        <HiringPlannerSection />

        {/* Shift Coverage & Overtime — scheduling gaps + overtime forecast */}
        <ShiftPlannerSection />

        {/* Owner Delight — money, compliance & people sections.
            Gated on the tenant's flags: the server answers a disabled feature with
            417, so rendering these unconditionally cost one failed request each on
            every dashboard load. */}
        {flagsLoaded && flags.true_cost && <TrueCostByBranchSection />}
        {flagsLoaded && flags.iqama_lifecycle && <ResidencyRadarSection />}
        {flagsLoaded && flags.compliance_calendar && <GovernmentDeadlineCalendarSection />}
        {flagsLoaded && flags.overtime_budget && <OvertimeBudgetSection />}
        {flagsLoaded && flags.gosi_reconciliation && <GosiReconciliationSection />}
        {flagsLoaded && flags.expense_claims_lite && <ExpensesByBranchSection />}
        {flagsLoaded && flags.recognition_wall && <RecognitionWallSection />}

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-base font-semibold text-foreground mb-3">{t('dash.quick_actions')}</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {quickActions.map((action) => (
              <QuickActionTile
                key={action.id}
                label={t(action.labelKey)}
                icon={action.icon}
                description={t(action.descKey)}
                onClick={() => onNavigate(action.module)}
              />
            ))}
          </div>
        </div>

        {/* Branch team + discipline */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          {/* Recent employees — mini-cards with leave balance + quick payslip */}
          <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">{t('dash.recent_employees')}</h3>
              <button onClick={() => onNavigate('employees')} className="text-[11px] font-medium text-primary hover:underline">{t('dash.view_all')}</button>
            </div>
            {stats.loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" /></div>
            ) : cards.length === 0 ? (
              <p className="text-[12px] text-muted-foreground/70 py-6 text-center">{t('dash.no_employees')}</p>
            ) : (
              <div>
                {cards.map((emp) => (
                  <EmployeeMiniCard key={emp.name} emp={emp} t={t} onClick={() => onNavigate('employees')} />
                ))}
              </div>
            )}
          </div>

          {/* Discipline notifications — branch-scoped late / early-departure / absence */}
          <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-500" />
                <h3 className="text-sm font-semibold text-foreground">{t('dash.discipline')}</h3>
              </div>
              <span className="text-[10px] text-muted-foreground/70">{t('dash.last_7_days')}</span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700">{t('dash.late')}: {vSummary.late}</span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-700">{t('dash.early_departure')}: {vSummary.early_departure}</span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{t('dash.absence')}: {vSummary.absence}</span>
            </div>
            {stats.loading ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" /></div>
            ) : violations.length === 0 ? (
              <p className="text-[12px] text-muted-foreground/70 py-6 text-center">{t('dash.no_violations')}</p>
            ) : (
              <div className="max-h-64 overflow-auto">
                {violations.slice(0, 8).map((v) => <DisciplineRow key={v.name} v={v} />)}
              </div>
            )}
          </div>
        </div>

        {/* Submit a request — native HRMS forms (interim desk links; Phase 3 adds the unified picker) */}
        <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm mb-5">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{t('dash.submit_request')}</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { labelKey: 'action.attendance_request', href: '/app/attendance-request/new', icon: <Clock className="h-4 w-4" />, color: 'text-violet-600 bg-violet-50' },
              { labelKey: 'action.overtime', href: '/app/overtime-slip/new', icon: <Clock className="h-4 w-4" />, color: 'text-cyan-600 bg-cyan-50' },
              { labelKey: 'action.resignation', href: '/app/employee-separation/new', icon: <FileText className="h-4 w-4" />, color: 'text-rose-600 bg-rose-50' },
            ].map((item) => (
              <a
                key={item.labelKey}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 py-2.5 px-3 rounded-xl border border-border/60 hover:border-primary/30 hover:bg-accent/50 transition-colors group"
              >
                <div className={`p-1.5 rounded-lg ${item.color}`}>{item.icon}</div>
                <span className="text-[13px] font-medium text-foreground/90 group-hover:text-foreground">{t(item.labelKey)}</span>
                <ArrowRight className={`h-3 w-3 text-muted-foreground/40 ${isRTL ? 'mr-auto rotate-180' : 'ml-auto'} opacity-0 group-hover:opacity-100 transition-opacity`} />
              </a>
            ))}
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 gap-5">
          {/* All Modules — everything is READY now */}
          <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">{t('dash.all_modules')}</h3>
              <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{t('dash.all_active')}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { labelKey: 'nav.employees', icon: <Users className="h-4 w-4" />, module: 'employees' as ModuleType, color: 'text-primary bg-accent' },
                { labelKey: 'nav.attendance', icon: <Clock className="h-4 w-4" />, module: 'attendance' as ModuleType, color: 'text-violet-600 bg-violet-50' },
                { labelKey: 'nav.leave_requests', icon: <Calendar className="h-4 w-4" />, module: 'leaves' as ModuleType, color: 'text-amber-600 bg-amber-50' },
                { labelKey: 'nav.payroll', icon: <DollarSign className="h-4 w-4" />, module: 'salaries' as ModuleType, color: 'text-emerald-600 bg-emerald-50' },
                { labelKey: 'nav.expenses', icon: <FileText className="h-4 w-4" />, module: 'expenses' as ModuleType, color: 'text-orange-600 bg-orange-50' },
                { labelKey: 'nav.shifts', icon: <ShiftIcon className="h-4 w-4" />, module: 'shifts' as ModuleType, color: 'text-cyan-600 bg-cyan-50' },
              ].map((item) => (
                <button
                  key={item.labelKey}
                  onClick={() => onNavigate(item.module)}
                  className="flex items-center gap-2.5 py-2.5 px-3 rounded-xl hover:bg-accent/50 transition-colors group"
                >
                  <div className={`p-1.5 rounded-lg ${item.color}`}>{item.icon}</div>
                  <span className="text-[13px] font-medium text-foreground/90 group-hover:text-foreground">{t(item.labelKey)}</span>
                  <ArrowRight className={`h-3 w-3 text-muted-foreground/40 ${isRTL ? 'mr-auto rotate-180' : 'ml-auto'} opacity-0 group-hover:opacity-100 transition-opacity`} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}