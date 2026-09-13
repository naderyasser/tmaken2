'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { EmployeeProfile } from '@/components/employee/employee-profile'
import { Profile360 } from '@/components/employee/profile-360/profile-360'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import { ShieldAlert } from 'lucide-react'

function EmployeeProfileContent({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { isHRManager } = useAuth()
  const { t, isRTL } = useI18n()
  const isNewEmployee = params.id === 'new'

  // HrShell/HrGuard already enforced auth + base HR access. Creating a NEW
  // employee additionally requires HR Manager — keep that stricter gate.
  if (isNewEmployee && !isHRManager) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">{t('guard.unauthorized')}</h2>
          <p className="text-muted-foreground mb-4">{t('guard.hr_manager_required')}</p>
          <button onClick={() => router.push('/employees')} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90">
            {t('guard.back_home')}
          </button>
        </div>
      </div>
    )
  }

  const handleBack = () => router.push('/employees')
  const employeeId = params.id !== 'new' ? params.id : undefined

  // Existing employee → 360° tabbed profile (hosts the sectioned form under the
  // Data tab). New employee → the plain sectioned form (no 360° data yet).
  return employeeId
    ? <Profile360 employeeId={employeeId} onBack={handleBack} />
    : <EmployeeProfile onBack={handleBack} employeeId={employeeId} />

}

export default function EmployeeProfilePage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise)
  return <EmployeeProfileContent params={params} />
}
