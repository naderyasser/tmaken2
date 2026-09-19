'use client'

import { useState, lazy, Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import type { ModuleType } from '@/components/sidebar'
import { PublicHrDashboard } from '@/components/hr-dashboard-public'
import { EmployeeProfile } from '@/components/employee/employee-profile'
import { LeaveList } from '@/components/leave/leave-list'
import { ExpenseList } from '@/components/expense-list'

// Lazy load heavy components
const LeaveSetupList = lazy(() => import('@/components/leave/leave-setup-list').then(m => ({ default: m.LeaveSetupList })))
const HRSettingsList = lazy(() => import('@/components/hr-settings-list').then(m => ({ default: m.HRSettingsList })))
const LocationTrackingPage = lazy(() => import('@/app/(erp)/(dashboard)/location-tracking/page'))
const RadiusAlertsPage = lazy(() => import('@/app/(erp)/(dashboard)/radius-alerts/page'))
const ModuleTeamManager = lazy(() => import('@/components/module-team-manager').then(m => ({ default: m.ModuleTeamManager })))
const AttendanceReport = lazy(() => import('@/components/attendance/attendance-report').then(m => ({ default: m.AttendanceReport })))
const CustodyList = lazy(() => import('@/components/custody/custody-list').then(m => ({ default: m.CustodyList })))
const ContractList = lazy(() => import('@/components/contract/contract-list').then(m => ({ default: m.ContractList })))
const RequestPicker = lazy(() => import('@/components/requests/request-picker').then(m => ({ default: m.RequestPicker })))
const DisciplineHub = lazy(() => import('@/components/discipline/discipline-hub').then(m => ({ default: m.DisciplineHub })))
const OnboardingReview = lazy(() => import('@/components/onboarding/onboarding-review').then(m => ({ default: m.OnboardingReview })))
const ShiftCalendar = lazy(() => import('@/components/calendar/shift-calendar').then(m => ({ default: m.ShiftCalendar })))
const AnnouncementsBoard = lazy(() => import('@/components/announcements/announcements-board').then(m => ({ default: m.AnnouncementsBoard })))
const ModulePage = lazy(() => import('@/components/hr/module-page').then(m => ({ default: m.ModulePage })))
import { HR_TEAM_CONFIG } from '@/components/module-team-manager'
import { getReportConfig } from '@/lib/hr-reports'
const MovementsPageLazy = lazy(() => import('@/components/hr/movements-page').then(m => ({ default: m.MovementsPage })))
const RequestsTabsLazy = lazy(() => import('@/components/hr/requests-tabs-page').then(m => ({ default: m.RequestsTabsPage })))
const ReportPage = lazy(() => import('@/components/hr/report-page').then(m => ({ default: m.ReportPage })))

// ── All valid module slugs (existing + new sidebar modules) ──────────────────
const VALID_MODULES: ModuleType[] = [
  // Existing
  'dashboard', 'announcements', 'requests', 'discipline', 'onboarding',
  'employees', 'new-employee', 'attendance', 'attendance-report', 'leaves',
  'salaries', 'expenses', 'shifts', 'shift-management', 'shift-calendar',
  'location-tracking', 'radius-alerts', 'leave-setup', 'settings', 'hr-settings',
  'team', 'custody', 'contracts',
  // ── New sidebar modules ──
  'jobs', 'unregistered-employees', 'projects', 'tasks',
  'location-groups', 'employee-groups', 'nationality', 'official-holidays', 'leave-types',
  'add-leave', 'add-permission', 'cancel-transactions',
  'user-transactions', 'ramadan-schedule', 'attendance-settings',
  'requests-settings', 'company-data', 'subscription-info', 'locations',
]

// Content-shaped skeleton shown while a module's chunk + first data load
function ModuleLoader() {
  return (
    <div className="space-y-4 p-8" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">جاري التحميل…</span>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80" />
      <div className="grid grid-cols-2 gap-4 pt-2 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}

/** Lazy-loads one of the config-driven HR module pages (list / settings / bespoke). */
function Module({ id }: { id: string }) {
  return (
    <Suspense fallback={<ModuleLoader />}>
      <ModulePage moduleId={id} />
    </Suspense>
  )
}

function HRContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeModule, setActiveModule] = useState<ModuleType>('dashboard')
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null)

  // Sync activeModule with URL param
  useEffect(() => {
    const module = searchParams.get('module')
    // Canonical redirect: shifts → /shift-management
    if (module === 'shifts' || module === 'shift-management') {
      router.replace('/shift-management')
      return
    }
    // Canonical redirect: salaries → /payroll
    if (module === 'salaries') {
      router.replace('/payroll')
      return
    }
    if (module && (VALID_MODULES.includes(module as ModuleType) || getReportConfig(module))) {
      setActiveModule(module as ModuleType)
    } else if (!searchParams.get('module')) {
      setActiveModule('dashboard')
    }
  }, [searchParams, router])

  const handleModuleChange = (module: ModuleType) => {
    if (module === 'salaries') { router.push('/payroll'); return }
    if (module === 'shifts' || module === 'shift-management') { router.push('/shift-management'); return }
    setActiveModule(module)
    if (module === 'dashboard') {
      router.replace('/hr', { scroll: false })
    } else {
      router.replace(`/hr?module=${module}`, { scroll: false })
    }
  }

  return (
    <>
      {/* ── لوحة التحكم ── */}
      {activeModule === 'dashboard' && <PublicHrDashboard />}

      {/* ── البيانات الاساسية ── */}
      {activeModule === 'employees' && <Module id="employees" />}
      {activeModule === 'new-employee' && (
        <EmployeeProfile onBack={() => handleModuleChange('employees')} />
      )}
      {activeModule === 'jobs' && <Module id="jobs" />}
      {activeModule === 'unregistered-employees' && <Module id="unregistered-employees" />}
      {activeModule === 'projects' && <Module id="projects" />}
      {activeModule === 'tasks' && <Module id="tasks" />}
      {activeModule === 'location-groups' && <Module id="location-groups" />}
      {activeModule === 'employee-groups' && <Module id="employee-groups" />}
      {activeModule === 'nationality' && <Module id="nationality" />}
      {activeModule === 'official-holidays' && <Module id="official-holidays" />}
      {activeModule === 'leave-types' && <Module id="leave-types" />}

      {/* ── الحضور والانصراف ── */}
      {activeModule === 'attendance' && (
        <Suspense fallback={<ModuleLoader />}><MovementsPageLazy /></Suspense>
      )}
      {getReportConfig(activeModule) && (
        <Suspense fallback={<ModuleLoader />}>
          <ReportPage config={getReportConfig(activeModule)!} />
        </Suspense>
      )}
      {activeModule === 'attendance-report' && (
        <Suspense fallback={<ModuleLoader />}>
          <div className="p-4 sm:p-6 lg:p-8">
            <AttendanceReport />
          </div>
        </Suspense>
      )}
      {activeModule === 'add-leave' && <Module id="add-leave" />}
      {activeModule === 'add-permission' && <Module id="add-permission" />}
      {activeModule === 'cancel-transactions' && <Module id="cancel-transactions" />}
      {activeModule === 'leaves' && (
        <div className="p-4 sm:p-6 lg:p-8">
          <LeaveList />
        </div>
      )}
      {activeModule === 'requests' && (
        <Suspense fallback={<ModuleLoader />}>
          <RequestsTabsLazy />
        </Suspense>
      )}
      {activeModule === 'discipline' && (
        <Suspense fallback={<ModuleLoader />}>
          <DisciplineHub />
        </Suspense>
      )}
      {activeModule === 'onboarding' && (
        <Suspense fallback={<ModuleLoader />}>
          <OnboardingReview />
        </Suspense>
      )}
      {activeModule === 'shift-calendar' && (
        <Suspense fallback={<ModuleLoader />}>
          <ShiftCalendar />
        </Suspense>
      )}
      {activeModule === 'announcements' && (
        <Suspense fallback={<ModuleLoader />}>
          <AnnouncementsBoard />
        </Suspense>
      )}
      {activeModule === 'expenses' && (
        <div className="p-4 sm:p-6 lg:p-8">
          <ExpenseList />
        </div>
      )}
      {activeModule === 'leave-setup' && (
        <Suspense fallback={<ModuleLoader />}>
          <LeaveSetupList />
        </Suspense>
      )}
      {activeModule === 'location-tracking' && (
        <Suspense fallback={<ModuleLoader />}>
          <LocationTrackingPage />
        </Suspense>
      )}
      {activeModule === 'radius-alerts' && (
        <Suspense fallback={<ModuleLoader />}>
          <RadiusAlertsPage />
        </Suspense>
      )}

      {/* ── المستخدمين ── */}
      {activeModule === 'team' && (
        <Suspense fallback={<ModuleLoader />}>
          <ModuleTeamManager config={HR_TEAM_CONFIG} />
        </Suspense>
      )}
      {activeModule === 'user-transactions' && <Module id="user-transactions" />}
      {activeModule === 'locations' && <Module id="locations" />}

      {/* ── الاعدادات ── */}
      {activeModule === 'settings' && <Module id="settings" />}
      {activeModule === 'ramadan-schedule' && <Module id="ramadan-schedule" />}
      {activeModule === 'attendance-settings' && <Module id="attendance-settings" />}
      {activeModule === 'requests-settings' && <Module id="requests-settings" />}
      {activeModule === 'company-data' && <Module id="company-data" />}
      {activeModule === 'subscription-info' && <Module id="subscription-info" />}

      {/* ── Existing modules kept ── */}
      {activeModule === 'custody' && (
        <Suspense fallback={<ModuleLoader />}>
          <div className="p-4 sm:p-6 lg:p-8">
            <CustodyList />
          </div>
        </Suspense>
      )}
      {activeModule === 'contracts' && (
        <Suspense fallback={<ModuleLoader />}>
          <div className="p-4 sm:p-6 lg:p-8">
            <ContractList />
          </div>
        </Suspense>
      )}
    </>
  )
}

export default function HRPage() {
  return (
    <Suspense fallback={<ModuleLoader />}>
      <HRContent />
    </Suspense>
  )
}
