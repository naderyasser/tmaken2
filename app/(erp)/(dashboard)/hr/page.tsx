'use client'

import { useState, lazy, Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import type { ModuleType } from '@/components/sidebar'
import { BranchSwitcher } from '@/components/branch/branch-switcher'
import { PublicHrDashboard } from '@/components/hr-dashboard-public'
import { EmployeeProfile } from '@/components/employee/employee-profile'
import { EmployeesList } from '@/components/employee/employees-list'
import { EmployeeCheckinList } from '@/components/employee/employee-checkin-list'
import { LeaveList } from '@/components/leave/leave-list'
import { ExpenseList } from '@/components/expense-list'

// Lazy load heavy components to prevent sidebar lag
// NOTE: the shifts surface was de-duplicated — '/hr?module=shifts' now redirects to the
// canonical standalone '/shift-management' route (see handleModuleChange + the URL effect).
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
import { HR_TEAM_CONFIG } from '@/components/module-team-manager'

const VALID_MODULES: ModuleType[] = [
  'dashboard', 'announcements', 'requests', 'discipline', 'onboarding', 'employees', 'new-employee', 'attendance', 'attendance-report', 'leaves',
  'salaries', 'expenses', 'shifts', 'shift-management', 'shift-calendar', 'location-tracking',
  'radius-alerts', 'leave-setup', 'settings', 'hr-settings', 'team', 'custody', 'contracts'
]

// Content-shaped skeleton (header + KPI cards + table) shown while a module's code
// chunk and first data load — avoids the blank-screen flash on module switches.
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

function HRContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeModule, setActiveModule] = useState<ModuleType>('dashboard')
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null)

  // Sync activeModule with URL param on mount and when searchParams change
  useEffect(() => {
    const module = searchParams.get('module')
    // Shifts de-dupe: the canonical surface is the standalone /shift-management route.
    // Redirect the legacy/duplicate module values there (also kills the old blank
    // '/hr?module=shift-management' dead-state, which had no render branch).
    if (module === 'shifts' || module === 'shift-management') {
      router.replace('/shift-management')
      return
    }
    // Salaries live on the standalone /payroll route; redirect the legacy module
    // value there too (removes the old spinner-only '/hr?module=salaries' dead-state).
    if (module === 'salaries') {
      router.replace('/payroll')
      return
    }
    if (module && VALID_MODULES.includes(module as ModuleType)) {
      setActiveModule(module as ModuleType)
    } else if (!searchParams.get('module')) {
      // Only reset to dashboard if there's truly no module param
      // (i.e. user navigated to /hr with no query string)
      setActiveModule('dashboard')
    }
  }, [searchParams, router])

  // When activeModule changes (e.g. via sidebar click), sync URL
  const handleModuleChange = (module: ModuleType) => {
    if (module === 'salaries') {
      router.push('/payroll')
      return
    }
    // Canonical shift surface is the standalone /shift-management route.
    if (module === 'shifts' || module === 'shift-management') {
      router.push('/shift-management')
      return
    }
    setActiveModule(module)
    if (module === 'dashboard') {
      router.replace('/hr', { scroll: false })
    } else {
      router.replace(`/hr?module=${module}`, { scroll: false })
    }
  }

  // Access guard + chrome (Header/Sidebar → icon rail + topbar) are provided by
  // <HrShell> in app/(erp)/(dashboard)/layout.tsx. This component renders content only.
  return (
    <>
      {/* Branch Switcher — hidden on the public dashboard: the new dashboard is a
          self-contained, guest-accessible mock with dummy data (no backend calls). */}
      {activeModule !== 'dashboard' && (
        <div className="px-8 pt-6 pb-0">
          <BranchSwitcher value={selectedBranch} onChange={setSelectedBranch} />
        </div>
      )}

          {activeModule === 'dashboard' && (
            <PublicHrDashboard />
          )}

          {activeModule === 'employees' && (
            <div className="p-4 sm:p-6 lg:p-8">
              <EmployeesList
                branch={selectedBranch}
                onEmployeeSelect={(emp) => {
                  router.push(`/employee/${encodeURIComponent(emp.name)}`)
                }}
                onAddEmployee={() => {
                  router.push('/employee/new')
                }}
              />
            </div>
          )}

          {activeModule === 'new-employee' && (
            <EmployeeProfile onBack={() => handleModuleChange('employees')} />
          )}

          {activeModule === 'attendance' && (
            <div className="p-4 sm:p-6 lg:p-8">
              <EmployeeCheckinList />
            </div>
          )}

          {activeModule === 'attendance-report' && (
            <Suspense fallback={<ModuleLoader />}>
              <div className="p-4 sm:p-6 lg:p-8">
                <AttendanceReport />
              </div>
            </Suspense>
          )}

          {activeModule === 'leaves' && (
            <div className="p-4 sm:p-6 lg:p-8">
              <LeaveList />
            </div>
          )}

          {activeModule === 'requests' && (
            <Suspense fallback={<ModuleLoader />}>
              <RequestPicker />
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

          {/* 'shifts' / 'shift-management' modules redirect to /shift-management — no inline render. */}

          {activeModule === 'leave-setup' && (
            <Suspense fallback={<ModuleLoader />}>
              <LeaveSetupList />
            </Suspense>
          )}

          {activeModule === 'settings' && (
            <Suspense fallback={<ModuleLoader />}>
              <HRSettingsList />
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

          {activeModule === 'team' && (
            <Suspense fallback={<ModuleLoader />}>
              <ModuleTeamManager config={HR_TEAM_CONFIG} />
            </Suspense>
          )}

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
