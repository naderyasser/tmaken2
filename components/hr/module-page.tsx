'use client'

import { Construction } from 'lucide-react'
import { getModuleConfig } from '@/lib/hr-modules'
import { useCompanySafe } from '@/hooks/use-company'
import { GenericListPage } from '@/components/hr/generic-list-page'
import { GenericSettingsPage } from '@/components/hr/generic-settings-page'
import { CancelTransactionsPage } from '@/components/hr/cancel-transactions-page'
import { AttendanceSettingsPage } from '@/components/hr/attendance-settings-page'
import { GeneralSettingsPage } from '@/components/hr/general-settings-page'
import { SubscriptionPage } from '@/components/hr/subscription-page'
import { CompanyLogoPanel } from '@/components/hr/company-logo-panel'
import { RequestsSettingsPage } from '@/components/hr/requests-settings-page'
import { HolidayDaysPage } from '@/components/hr/holiday-days-page'
import { LocationsPage } from '@/components/hr/locations-page'
import { EmployeeGroupMembersPage } from '@/components/hr/employee-group-members-page'
import { UsersPage } from '@/components/hr/users-page'
import { PermissionsListPage } from '@/components/hr/permissions-list-page'
import { UserHistoryPage } from '@/components/hr/user-history-page'

/**
 * Renders the page for one HR sidebar module id. Bespoke screens are matched
 * first, then the config-driven generic list/settings pages.
 */
export function ModulePage({ moduleId }: { moduleId: string }) {
  const { company } = useCompanySafe()

  if (moduleId === 'cancel-transactions') return <CancelTransactionsPage />
  if (moduleId === 'attendance-settings') return <AttendanceSettingsPage />
  if (moduleId === 'settings') return <GeneralSettingsPage />
  if (moduleId === 'subscription-info') return <SubscriptionPage />
  if (moduleId === 'requests-settings') return <RequestsSettingsPage />
  if (moduleId === 'holiday-days') return <HolidayDaysPage />
  if (moduleId === 'locations') return <LocationsPage />
  if (moduleId === 'employee-group-members') return <EmployeeGroupMembersPage />
  // «المستخدمين» section (5.16-5.18) — bespoke Apex-shaped pages, also reached
  // directly at /team and /hr-managers (see those route files).
  if (moduleId === 'users') return <UsersPage />
  if (moduleId === 'permissions') return <PermissionsListPage />
  if (moduleId === 'user-transactions') return <UserHistoryPage />

  const config = getModuleConfig(moduleId)
  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground p-8">
        <Construction className="h-10 w-10" />
        <p className="text-lg font-semibold">هذه الصفحة قيد التطوير</p>
      </div>
    )
  }

  if (config.kind === 'settings') {
    const recordName = moduleId === 'company-data' ? (company ?? undefined) : undefined
    const isCompanyData = moduleId === 'company-data'
    return (
      <GenericSettingsPage
        config={config}
        recordName={recordName}
        // S9 + 5.25: Apex breadcrumb text is «الاعدادات / بيانات الشركة», not the
        // generic «الموارد البشرية / …» trail useBreadcrumbs() derives from the URL.
        breadcrumbOverride={isCompanyData ? ['الاعدادات', 'بيانات الشركة'] : undefined}
        // 5.25: action bar sits above the logo placeholder, not the reverse.
        extra={isCompanyData ? <CompanyLogoPanel company={recordName} /> : undefined}
        fullWidthFields={isCompanyData ? ['email', 'custom_address_ar', 'custom_address_en'] : undefined}
      />
    )
  }

  return <GenericListPage config={config} />
}
