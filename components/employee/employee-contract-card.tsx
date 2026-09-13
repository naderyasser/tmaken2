'use client'

/**
 * Employee Contract Card — read-only summary of an employee's latest Employment
 * Contract, with a "Preview / Print" action that renders the full bilingual
 * contract document (lib/hr/contract-document.ts).
 *
 * Self-contained & site-aware: fetches via the (previously unused) get_contracts API
 * plus the Employee/Company records for the parties clause. Renders NOTHING when the
 * Employment Contract feature is absent on the tenant, the user lacks HR access, or the
 * employee has no contract — so it can be dropped onto any employee detail page safely.
 *
 * Display-only. Money via formatSAR, dates Hijri-first via dualDate. Never mutates data.
 */

import React, { useEffect, useState } from 'react'
import { Printer, FileText, AlertCircle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { formatSAR, dualDate } from '@/lib/format'
import { COUNTRY_AR } from '@/lib/country-names-ar'
import { printContract, type ContractDocData } from '@/lib/hr/contract-document'

interface ContractRecord {
  name?: string
  employee_name?: string
  company?: string
  designation?: string
  skill_level?: string
  contract_type?: string
  contract_start_date?: string
  contract_end_date?: string
  auto_renew?: number
  renewal_term_months?: number
  probation_period_months?: number
  work_location?: string
  work_days?: string
  weekly_rest_day?: string
  working_hours_per_day?: number
  basic_salary?: number
  housing_allowance?: number
  transport_allowance?: number
  other_allowance?: number
  gosi_deduction?: number
  salary_payment_day?: number
  annual_leave_days?: number
  notice_period_days?: number
  clause_confidentiality?: number
  clause_non_compete?: number
  non_compete_duration?: number
  non_compete_scope?: string
  clause_ip?: number
  clause_mobility?: number
  clause_remote_work?: number
  clause_training?: number
  training_commitment?: string
  status?: string
  signed_on?: string
}

const L = {
  ar: {
    title: 'عقد العمل',
    none: '', // unused (card hides)
    type: 'نوع العقد',
    term: 'المدة',
    net: 'صافي الراتب الشهري',
    signed: 'تاريخ التوقيع',
    status: 'الحالة',
    preview: 'معاينة / طباعة العقد',
    note: 'سجل داخلي استرشادي — لا يُغني عن العقد الموثّق في قِوى ولا عن المراجعة القانونية.',
    more: (n: number) => `يوجد ${n} عقود — يُعرض الأحدث.`,
    open: 'مفتوح المدة',
    ctPermanent: 'غير محدد المدة', ctFixed: 'محدد المدة', ctProbation: 'تحت التجربة', ctPart: 'دوام جزئي',
    stDraft: 'مسودة', stActive: 'نشط', stExpired: 'منتهٍ', stTerminated: 'مُنهى',
    idType: 'نوع الهوية', idNumber: 'رقم الهوية', idValidity: 'صلاحية الهوية',
    idNational: 'هوية وطنية', idIqama: 'إقامة',
  },
  en: {
    title: 'Employment Contract',
    none: '',
    type: 'Contract Type',
    term: 'Term',
    net: 'Net Monthly Salary',
    signed: 'Signed On',
    status: 'Status',
    preview: 'Preview / Print Contract',
    note: 'Internal advisory record — does not replace the Qiwa-authenticated contract nor legal review.',
    more: (n: number) => `${n} contracts — showing the latest.`,
    open: 'Open-ended',
    ctPermanent: 'Indefinite term', ctFixed: 'Fixed term', ctProbation: 'Probation', ctPart: 'Part-time',
    stDraft: 'Draft', stActive: 'Active', stExpired: 'Expired', stTerminated: 'Terminated',
    idType: 'ID Type', idNumber: 'ID Number', idValidity: 'ID Validity',
    idNational: 'National ID', idIqama: 'Iqama',
  },
}

const STATUS_CLASS: Record<string, string> = {
  Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Draft: 'bg-muted text-muted-foreground border-border',
  Expired: 'bg-amber-50 text-amber-700 border-amber-200',
  Terminated: 'bg-rose-50 text-rose-700 border-rose-200',
}

export function EmployeeContractCard({ employeeId }: { employeeId: string }) {
  const { isRTL } = useI18n()
  const t = isRTL ? L.ar : L.en
  const [loading, setLoading] = useState(true)
  const [contract, setContract] = useState<ContractRecord | null>(null)
  const [count, setCount] = useState(0)
  const [docData, setDocData] = useState<ContractDocData | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const resp = await frappeClient.call('base_meena.employment_contract_api.get_contracts', { employee: employeeId })
        const list: ContractRecord[] = (resp as { message?: ContractRecord[] })?.message || []
        if (cancelled) return
        if (!list.length) { setLoading(false); return }
        const c = list[0]
        setContract(c)
        setCount(list.length)

        // Fetch parties data (Employee + Company) for the document — best-effort.
        let emp: Record<string, unknown> = {}
        let co: Record<string, unknown> = {}
        try {
          emp = (await frappeClient.getList<Record<string, unknown>>('Employee', {
            filters: [['name', '=', employeeId]],
            fields: ['employee_name', 'company', 'gender', 'custom_national_id', 'custom_id_type', 'custom_id_issue_date', 'custom_id_expiry_date', 'custom_nationality', 'current_address', 'permanent_address', 'custom_home_address'],
            limit_page_length: 1,
          }))[0] || {}
        } catch { /* parties optional */ }
        const companyName = (c.company || emp.company) as string | undefined
        if (companyName) {
          try {
            co = (await frappeClient.getList<Record<string, unknown>>('Company', {
              filters: [['name', '=', companyName]],
              fields: ['company_name', 'registration_details', 'tax_id'],
              limit_page_length: 1,
            }))[0] || {}
          } catch { /* CR optional */ }
        }
        if (cancelled) return

        const nat = emp.custom_nationality as string | undefined
        setDocData({
          companyName: (co.company_name as string) || companyName,
          companyCR: (co.registration_details as string) || (co.tax_id as string) || undefined,
          employeeName: c.employee_name || (emp.employee_name as string),
          nationality: nat ? (COUNTRY_AR[nat] || nat) : undefined,
          idType: emp.custom_id_type as string | undefined,
          idNumber: emp.custom_national_id as string | undefined,
          idIssue: emp.custom_id_issue_date as string | undefined,
          idExpiry: emp.custom_id_expiry_date as string | undefined,
          employeeAddress: (emp.current_address as string) || (emp.custom_home_address as string) || undefined,
          gender: emp.gender as string | undefined,
          contractType: c.contract_type,
          startDate: c.contract_start_date,
          endDate: c.contract_end_date,
          autoRenew: !!c.auto_renew,
          renewalTermMonths: c.renewal_term_months,
          designation: c.designation,
          skillLevel: c.skill_level,
          probationMonths: c.probation_period_months,
          workLocation: c.work_location,
          workDays: c.work_days,
          weeklyRestDay: c.weekly_rest_day,
          workingHours: c.working_hours_per_day,
          basicSalary: c.basic_salary,
          housing: c.housing_allowance,
          transport: c.transport_allowance,
          other: c.other_allowance,
          gosi: c.gosi_deduction,
          salaryPaymentDay: c.salary_payment_day,
          annualLeaveDays: c.annual_leave_days,
          noticeDays: c.notice_period_days,
          confidentiality: !!c.clause_confidentiality,
          nonCompete: !!c.clause_non_compete,
          nonCompeteDuration: c.non_compete_duration,
          nonCompeteScope: c.non_compete_scope,
          ip: !!c.clause_ip,
          mobility: !!c.clause_mobility,
          remoteWork: !!c.clause_remote_work,
          training: !!c.clause_training,
          trainingDetails: c.training_commitment,
          contractId: c.name,
          signedOn: c.signed_on,
        })
      } catch {
        // Feature absent / no HR access / error → hide the card entirely (site-aware).
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [employeeId])

  // Hide entirely while loading nothing useful, or when there is no contract.
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    )
  }
  if (!contract) return null

  const typeLabel = ({ Permanent: t.ctPermanent, 'Fixed Term': t.ctFixed, Probation: t.ctProbation, 'Part-time': t.ctPart } as Record<string, string>)[contract.contract_type || ''] || contract.contract_type || '—'
  const statusLabel = ({ Draft: t.stDraft, Active: t.stActive, Expired: t.stExpired, Terminated: t.stTerminated } as Record<string, string>)[contract.status || ''] || contract.status || '—'
  const gross = (contract.basic_salary || 0) + (contract.housing_allowance || 0) + (contract.transport_allowance || 0) + (contract.other_allowance || 0)
  const net = Math.max(0, gross - (contract.gosi_deduction || 0))
  const term = contract.contract_start_date
    ? `${dualDate(contract.contract_start_date)}${contract.contract_end_date ? ' — ' + dualDate(contract.contract_end_date) : ' — ' + t.open}`
    : '—'
  // ID fields (fetched into docData) surfaced on the card; calm em-dash when empty.
  const dash = '—'
  const hasId = !!(docData && (docData.idType || docData.idNumber || docData.idIssue || docData.idExpiry))
  const idTypeLabel = (({ 'National ID': t.idNational, Iqama: t.idIqama } as Record<string, string>)[docData?.idType || ''] || docData?.idType || dash)
  const idValidity = `${docData?.idIssue ? dualDate(docData.idIssue) : dash} — ${docData?.idExpiry ? dualDate(docData.idExpiry) : dash}`

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-primary" />
          {t.title}
        </CardTitle>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_CLASS[contract.status || ''] || STATUS_CLASS.Draft}`}>
          {statusLabel}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        {count > 1 && <p className="text-xs text-muted-foreground">{t.more(count)}</p>}
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div className="flex justify-between gap-2 border-b border-border/60 pb-1">
            <dt className="text-muted-foreground">{t.type}</dt><dd className="font-medium">{typeLabel}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-border/60 pb-1">
            <dt className="text-muted-foreground">{t.net}</dt><dd className="font-medium text-primary">{formatSAR(net)}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-border/60 pb-1 sm:col-span-2">
            <dt className="text-muted-foreground">{t.term}</dt><dd className="font-medium">{term}</dd>
          </div>
          {contract.signed_on && (
            <div className="flex justify-between gap-2 border-b border-border/60 pb-1">
              <dt className="text-muted-foreground">{t.signed}</dt><dd className="font-medium">{dualDate(contract.signed_on)}</dd>
            </div>
          )}
          {hasId && (
            <>
              <div className="flex justify-between gap-2 border-b border-border/60 pb-1">
                <dt className="text-muted-foreground">{t.idType}</dt><dd className="font-medium">{idTypeLabel}</dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-border/60 pb-1">
                <dt className="text-muted-foreground">{t.idNumber}</dt><dd className="font-medium" dir="ltr">{docData?.idNumber || dash}</dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-border/60 pb-1 sm:col-span-2">
                <dt className="text-muted-foreground">{t.idValidity}</dt><dd className="font-medium">{idValidity}</dd>
              </div>
            </>
          )}
        </dl>
        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-muted-foreground flex items-start gap-1 flex-1">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-primary" />
            {t.note}
          </p>
          <Button type="button" variant="outline" size="sm" className="gap-2 flex-shrink-0" disabled={!docData} onClick={() => docData && printContract(docData)}>
            <Printer className="h-4 w-4" />
            {t.preview}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
