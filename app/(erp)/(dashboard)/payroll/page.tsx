'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { useCompany } from '@/hooks/use-company'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SalaryStructureAssignment } from '@/components/payroll/salary-structure-assignment'
import { AdditionalSalaryList } from '@/components/payroll/additional-salary'
import { SalaryStatistics } from '@/components/payroll/salary-statistics'
import { SmartDeductions } from '@/components/payroll/smart-deductions'
import { PayrollProcessing } from '@/components/payroll/payroll-processing'
import { SalarySlips } from '@/components/payroll/salary-slips'
import { PenaltyPolicyManager } from '@/components/payroll/penalty-policy-manager'
import { AttendancePipeline } from '@/components/payroll/attendance-pipeline'
import { Building, ShieldAlert } from 'lucide-react'

function PayrollContent() {
  const { t, isRTL } = useI18n()
  const [activeTab, setActiveTab] = useState('fixed')
  const { company: activeCompany } = useCompany()

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">{t('nav.payroll')}</h1>
        {activeCompany && (
          <div className="flex items-center gap-2 bg-accent border border-border rounded-lg px-3 py-2">
            <Building className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">{t('settings.company')}:</span>
            <span className="text-sm text-primary">{activeCompany}</span>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="pipeline">{isRTL ? 'الحضور ← الرواتب' : 'Attendance → Payroll'}</TabsTrigger>
          <TabsTrigger value="processing">{t('pay.process.tab_title')}</TabsTrigger>
          <TabsTrigger value="slips">{t('pay.slips.tab_title')}</TabsTrigger>
          <TabsTrigger value="fixed">{t('pay.ssa.title')}</TabsTrigger>
          <TabsTrigger value="variable">{t('pay.add.title')}</TabsTrigger>
          <TabsTrigger value="deductions">{t('pay.ded.title')}</TabsTrigger>
          <TabsTrigger value="policy">{t('pay.policy.tab_title')}</TabsTrigger>
          <TabsTrigger value="stats">{t('pay.stats.title')}</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline"><AttendancePipeline /></TabsContent>
        <TabsContent value="processing"><PayrollProcessing /></TabsContent>
        <TabsContent value="slips"><SalarySlips /></TabsContent>
        <TabsContent value="fixed"><SalaryStructureAssignment /></TabsContent>
        <TabsContent value="variable"><AdditionalSalaryList /></TabsContent>
        <TabsContent value="deductions"><SmartDeductions /></TabsContent>
        <TabsContent value="policy"><PenaltyPolicyManager /></TabsContent>
        <TabsContent value="stats"><SalaryStatistics /></TabsContent>
      </Tabs>
    </div>
  )
}

export default function PayrollPage() {
  // HrShell/HrGuard already enforced auth + base HR access. Payroll additionally
  // requires HR Manager — keep that stricter gate here.
  const router = useRouter()
  const { isRTL } = useI18n()
  const { isHRManager } = useAuth()

  if (!isHRManager) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">{isRTL ? 'غير مصرح' : 'Unauthorized'}</h2>
          <p className="text-muted-foreground mb-4">{isRTL ? 'صلاحية مدير الموارد البشرية مطلوبة' : 'HR Manager access required'}</p>
          <button onClick={() => router.push('/hr')} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90">
            {isRTL ? 'العودة' : 'Back'}
          </button>
        </div>
      </div>
    )
  }

  return <PayrollContent />
}
