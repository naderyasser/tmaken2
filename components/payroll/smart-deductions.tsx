'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale/ar'
import { enUS } from 'date-fns/locale/en-US'
import { Plus, Trash2, DollarSign, Clock, AlertCircle, AlertTriangle, CalendarIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { formatDateShort, formatSAR } from '@/lib/format'
import { useCompany } from '@/hooks/use-company'
import { frappeClient } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import { Card, CardContent } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'

const PENALTY_MULTIPLIERS = [
  { value: '1', labelEn: '1x - Standard', labelAr: '1x - عادي' },
  { value: '1.5', labelEn: '1.5x - Moderate', labelAr: '1.5x - متوسط' },
  { value: '2', labelEn: '2x - High', labelAr: '2x - مرتفع' },
  { value: '3', labelEn: '3x - Maximum', labelAr: '3x - أقصى' },
]

const DEDUCTION_REASONS = [
  { value: 'Delay', labelEn: 'Delay', labelAr: 'تأخير' },
  { value: 'Absence', labelEn: 'Absence', labelAr: 'غياب' },
  { value: 'Disciplinary', labelEn: 'Disciplinary', labelAr: 'تأديبي' },
  { value: 'Unauthorized Leave', labelEn: 'Unauthorized Leave', labelAr: 'إجازة غير مصرح بها' },
  { value: 'Damage', labelEn: 'Property Damage', labelAr: 'تلف ممتلكات' },
  { value: 'Other', labelEn: 'Other', labelAr: 'أخرى' },
]

const OCCURRENCE_LABELS = [
  { labelEn: '1st time', labelAr: 'أول مرة' },
  { labelEn: '2nd time', labelAr: 'ثاني مرة' },
  { labelEn: '3rd time', labelAr: 'ثالث مرة' },
  { labelEn: '4th time', labelAr: 'رابع مرة' },
]

/** add_comment stores rich text; the table wants the sentence back. */
const stripHtml = (html?: string) => (html ? html.replace(/<[^>]*>/g, '').trim() || undefined : undefined)

const VIOLATION_LABELS: Record<string, { labelEn: string; labelAr: string }> = {
  delay_15: { labelEn: 'Delay up to 15 minutes', labelAr: 'تأخير حتى 15 دقيقة' },
  delay_15_30: { labelEn: 'Delay 15 to 30 minutes', labelAr: 'تأخير من 15 إلى 30 دقيقة' },
  delay_30_60: { labelEn: 'Delay 30 to 60 minutes', labelAr: 'تأخير من 30 إلى 60 دقيقة' },
  delay_60_plus: { labelEn: 'Delay over 60 minutes', labelAr: 'تأخير أكثر من 60 دقيقة' },
  leave_early_15: { labelEn: 'Leave early up to 15 min', labelAr: 'ترك العمل مبكراً حتى 15 دقيقة' },
  leave_early_15_30: { labelEn: 'Leave early 15-30 min', labelAr: 'ترك العمل مبكراً 15-30 دقيقة' },
  leave_early_30_60: { labelEn: 'Leave early 30-60 min', labelAr: 'ترك العمل مبكراً 30-60 دقيقة' },
  absence_half: { labelEn: 'Half-day absence', labelAr: 'غياب نصف يوم' },
  absence_full: { labelEn: 'Full-day absence', labelAr: 'غياب يوم كامل' },
}

interface PolicyRule {
  violation_type: string
  minutes_from: number
  minutes_to: number
  occurrences: { index: number; penalty_type: string; penalty_value: number }[]
}

interface PolicyData {
  policy_name: string | null
  company: string
  effective_from: string | null
  is_default?: boolean
  rules: PolicyRule[]
  message?: string
}

const formSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('manual'),
    employee: z.string().min(1, 'Employee is required'),
    reason: z.string().min(1, 'Reason is required'),
    hourlyRate: z.coerce.number().positive().min(0.01),
    hours: z.coerce.number().positive().min(0.5),
    multiplier: z.string().min(1),
    payroll_date: z.string().min(1),
  }),
  z.object({
    mode: z.literal('matrix'),
    employee: z.string().min(1, 'Employee is required'),
    violationType: z.string().min(1, 'Violation type is required'),
    occurrence: z.string().min(1, 'Occurrence is required'),
    payroll_date: z.string().min(1),
  }),
])

type FormValues = z.infer<typeof formSchema>

interface DeductionRecord {
  name: string
  employee: string
  employee_name?: string
  salary_component: string
  amount: number
  payroll_date: string
  /** Not a field on Additional Salary — carried as a document comment. */
  reason?: string
}

interface EmployeeOption {
  name: string
  employee_name: string
  company?: string
}

export function SmartDeductions() {
  const { t, isRTL } = useI18n()
  const { toast } = useToast()
  const { company: activeCompany } = useCompany()
  const { user } = useAuth()
  const [deductions, setDeductions] = useState<DeductionRecord[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [employeeData, setEmployeeData] = useState<{
    baseSalary: number
    shiftHours: number
    loading: boolean
    error: string | null
  }>({ baseSalary: 0, shiftHours: 8, loading: false, error: null })
  const [policyData, setPolicyData] = useState<PolicyData | null>(null)
  const [policyLoading, setPolicyLoading] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      mode: 'manual' as const,
      employee: '',
      reason: '',
      hourlyRate: 0,
      hours: 0,
      multiplier: '1',
      payroll_date: new Date().toISOString().split('T')[0],
    } as any,
  })

  const watchedMode = form.watch('mode')
  const watchedEmployee = form.watch('employee')
  const watchedViolationType = watchedMode === 'matrix' ? form.watch('violationType') : undefined
  const watchedOccurrence = watchedMode === 'matrix' ? form.watch('occurrence') : undefined

  useEffect(() => { load() }, [activeCompany])

  const load = async () => {
    setLoading(true)
    try {
      const employeeFilters: any[] = activeCompany
        ? [['Employee', 'company', '=', activeCompany]]
        : []
      // The employee picker is company-scoped; without the same filter the list
      // showed other companies' deductions on a multi-company tenant.
      const deductionFilters: any[] = [
        ['Additional Salary', 'type', '=', 'Deduction'],
        ['Additional Salary', 'docstatus', '!=', 2],
      ]
      if (activeCompany) deductionFilters.push(['Additional Salary', 'company', '=', activeCompany])
      const [dedList, empList] = await Promise.all([
        frappeClient.getAdditionalSalaries({
          fields: ['name', 'employee', 'employee_name', 'salary_component', 'amount', 'payroll_date', 'docstatus'],
          filters: deductionFilters,
          order_by: 'payroll_date desc',
          limit_page_length: 200,
        }),
        frappeClient.getEmployees({
          fields: ['name', 'employee_name', 'company'],
          filters: employeeFilters.length ? employeeFilters : undefined,
          limit_page_length: 500,
        }),
      ])
      const rows = dedList as DeductionRecord[]
      setEmployees(empList)
      setDeductions(await withReasons(rows))
    } catch {
      toast({ title: t('pay.ded.load_fail'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  /**
   * One query pulls the reason comments back for a whole page of rows. It goes
   * through an HR-gated endpoint because /api/resource/Comment is denied to
   * HR Manager and HR User, which would leave the column permanently empty for
   * exactly the people who use this tab.
   */
  const withReasons = async (rows: DeductionRecord[]): Promise<DeductionRecord[]> => {
    const names = rows.map(r => r.name)
    if (!names.length) return rows
    try {
      const resp = await frappeClient.call<Record<string, string>>(
        'base_meena.additional_salary_api.get_deduction_reasons',
        { names: JSON.stringify(names) },
      )
      const reasons = ((resp as any)?.message ?? resp) as Record<string, string>
      return rows.map(r => ({ ...r, reason: stripHtml(reasons?.[r.name]) }))
    } catch {
      // The reason is annotation, not payroll data — a failure here must not
      // blank out the deductions themselves.
      return rows
    }
  }

  const fetchPenaltyPolicy = useCallback(async (company: string) => {
    setPolicyLoading(true)
    try {
      const resp = await frappeClient.call<PolicyData>(
        'base_meena.api.get_active_penalty_policy',
        { company }
      )
      const data = (resp as any).message ?? resp
      setPolicyData(data)
      return data
    } catch {
      toast({ title: t('pay.ded.policy_load_fail'), variant: 'destructive' })
      setPolicyData(null)
      return null
    } finally {
      setPolicyLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (watchedMode === 'matrix' && activeCompany) {
      fetchPenaltyPolicy(activeCompany)
    }
  }, [watchedMode, activeCompany, fetchPenaltyPolicy])

  const policyViolations = useMemo(() => {
    if (!policyData?.rules?.length) return []
    const seen = new Set<string>()
    return policyData.rules
      .map(r => r.violation_type)
      .filter(v => {
        if (seen.has(v)) return false
        seen.add(v)
        return true
      })
  }, [policyData])

  const fetchEmployeeSalaryData = useCallback(async (employeeId: string) => {
    if (!employeeId) {
      setEmployeeData({ baseSalary: 0, shiftHours: 8, loading: false, error: null })
      return
    }
    setEmployeeData(prev => ({ ...prev, loading: true, error: null }))
    try {
      const [assignments, employeeDoc] = await Promise.all([
        frappeClient.getSalaryStructureAssignments({
          fields: ['name', 'employee', 'base', 'salary_structure'],
          filters: [
            ['Salary Structure Assignment', 'employee', '=', employeeId],
            ['Salary Structure Assignment', 'docstatus', '=', 1],
          ],
          order_by: 'from_date desc',
          limit_page_length: 1,
        }),
        frappeClient.get('Employee', employeeId, {
          fields: ['name', 'default_shift'],
        }),
      ])

      const baseSalary = assignments?.[0]?.base || 0

      let shiftHours = 8
      const defaultShift = employeeDoc?.data?.default_shift as string | undefined
      if (defaultShift) {
        try {
          const shiftDoc = await frappeClient.get('Shift Type', defaultShift, {
            fields: ['start_time', 'end_time'],
          })
          const start = shiftDoc?.data?.start_time
          const end = shiftDoc?.data?.end_time
          if (start && end) {
            const [sh, sm] = start.split(':').map(Number)
            const [eh, em] = end.split(':').map(Number)
            let hours = eh - sh + (em - sm) / 60
            if (hours <= 0) hours += 24
            shiftHours = hours
          }
        } catch {}
      }

      if (!baseSalary) {
        setEmployeeData({ baseSalary: 0, shiftHours, loading: false, error: t('pay.ded.no_base_salary') })
        return
      }

      const computedRate = Math.round((baseSalary / 30 / shiftHours) * 100) / 100
      if (watchedMode === 'manual' || !watchedMode) {
        try { form.setValue('hourlyRate', computedRate, { shouldValidate: true }) } catch {}
      }
      setEmployeeData({ baseSalary, shiftHours, loading: false, error: null })
    } catch {
      setEmployeeData(prev => ({ ...prev, loading: false, error: t('pay.ded.fetch_fail') }))
    }
  }, [form, t, watchedMode])

  useEffect(() => {
    fetchEmployeeSalaryData(watchedEmployee)
  }, [watchedEmployee, fetchEmployeeSalaryData])

  const dailyWage = useMemo(() => {
    if (!employeeData.baseSalary) return 0
    return Math.round((employeeData.baseSalary / 30) * 100) / 100
  }, [employeeData.baseSalary])

  const matrixDeduction = useMemo(() => {
    if (watchedMode !== 'matrix' || !watchedViolationType || watchedOccurrence === undefined || !policyData?.rules?.length) return null
    const occ = parseInt(watchedOccurrence || '0', 10)
    const rule = policyData.rules.find(r => r.violation_type === watchedViolationType)
    if (!rule) return null
    const occData = rule.occurrences?.[occ]
    if (!occData) return null

    if (occData.penalty_type === 'Warning') {
      return { rate: 0, amount: 0, isWarning: true }
    }

    let amount = 0
    if (occData.penalty_type === 'Fixed Amount') {
      amount = occData.penalty_value
    } else if (occData.penalty_type === 'Percentage of Daily Wage') {
      amount = Math.round(dailyWage * occData.penalty_value / 100 * 100) / 100
    }

    return { rate: occData.penalty_value, amount, isWarning: false }
  }, [watchedMode, watchedViolationType, watchedOccurrence, policyData, dailyWage])

  const totalDeduction = useMemo(() => {
    if (watchedMode === 'matrix') return matrixDeduction?.amount ?? 0
    const hourlyRate = form.watch('hourlyRate') as number
    const hours = form.watch('hours') as number
    const multiplier = form.watch('multiplier') as string
    if (!hours || !multiplier || !hourlyRate) return 0
    return hours * parseFloat(multiplier) * hourlyRate
  }, [watchedMode, matrixDeduction, form.watch('hours'), form.watch('multiplier'), form.watch('hourlyRate')])

  const findOrCreateDeductionComponent = async (): Promise<string> => {
    const components = await frappeClient.getSalaryComponents({
      fields: ['name', 'type'],
      filters: [['Salary Component', 'type', '=', 'Deduction']],
      limit_page_length: 50,
    })

    const penalty = components.find(
      (c: any) => c.name.toLowerCase().includes('penalty') || c.name.includes('خصم') || c.name.includes('جزاء')
    )
    if (penalty) return penalty.name

    // No "any deduction component will do" fallback: it booked penalties onto
    // whatever came first — GOSI, income tax, a loan repayment — and the money
    // then showed up under that line on the payslip.
    const compName = 'Penalty Deduction'
    await frappeClient.createSalaryComponent({
      salary_component: compName,
      salary_component_abbr: 'PD',
      type: 'Deduction',
    })
    return compName
  }

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true)
    try {
      const selectedEmployee = employees.find(e => e.name === values.employee)
      const effectiveCompany = selectedEmployee?.company || activeCompany || ''

      let currency = 'SAR'
      try {
        const cRes = await frappeClient.get('Company', effectiveCompany, { fields: ['default_currency'] })
        currency = cRes.data?.default_currency || 'SAR'
      } catch {}

      const componentName = await findOrCreateDeductionComponent()
      let totalAmount: number
      let reasonLabelForPayload: string

      if (values.mode === 'matrix') {
        const occIdx = parseInt(values.occurrence, 10)
        const rule = policyData?.rules?.find(r => r.violation_type === values.violationType)
        const occData = rule?.occurrences?.[occIdx]

        if (occData?.penalty_type === 'Fixed Amount') {
          totalAmount = occData.penalty_value
        } else if (occData?.penalty_type === 'Percentage of Daily Wage') {
          totalAmount = Math.round(dailyWage * occData.penalty_value / 100 * 100) / 100
        } else {
          totalAmount = 0
        }

        const vl = VIOLATION_LABELS[values.violationType]
        const ol = OCCURRENCE_LABELS[occIdx]
        const v = vl ? (isRTL ? vl.labelAr : vl.labelEn) : values.violationType
        const o = ol ? (isRTL ? ol.labelAr : ol.labelEn) : ''
        reasonLabelForPayload = o ? `${v} — ${o}` : v
      } else {
        totalAmount = Math.round((values.hours * parseFloat(values.multiplier) * values.hourlyRate) * 100) / 100
        reasonLabelForPayload = `${reasonLabel(values.reason)} · ${values.hours}h × ${values.multiplier}`
      }

      const payload: Record<string, any> = {
        employee: values.employee,
        salary_component: componentName,
        type: 'Deduction',
        amount: totalAmount,
        payroll_date: values.payroll_date,
        company: effectiveCompany,
        currency,
        overwrite_salary_structure_amount: 0,
      }

      const result = await frappeClient.createAdditionalSalary(payload)

      // A draft Additional Salary never reaches a salary slip, so a swallowed
      // submit reports a deduction that will never actually be deducted.
      if (result?.name) {
        const docRes = await frappeClient.get('Additional Salary', result.name)
        if (!docRes.data) throw new Error(`Additional Salary ${result.name} not found`)
        await frappeClient.call('frappe.client.submit', {
          doc: { ...docRes.data, doctype: 'Additional Salary' },
        })
      }

      // Metadata only, and the deduction itself is already submitted at this point,
      // so a failed comment must not fail the operation — just log it.
      if (result?.name && reasonLabelForPayload) {
        try {
          await frappeClient.call('frappe.desk.form.utils.add_comment', {
            reference_doctype: 'Additional Salary',
            reference_name: result.name,
            content: reasonLabelForPayload,
            comment_email: user?.email || '',
            comment_by: user?.full_name || user?.email || '',
          })
        } catch (commentErr) {
          console.warn('Could not record the deduction reason:', commentErr)
        }
      }

      toast({ title: t('pay.ded.created') })
      setDialogOpen(false)
      form.reset()
      setEmployeeData({ baseSalary: 0, shiftHours: 8, loading: false, error: null })
      load()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast({ title: t('pay.ded.create_fail'), description: message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async (name: string) => {
    try {
      try { await frappeClient.call('frappe.client.cancel', { doctype: 'Additional Salary', name }) } catch {}
      await frappeClient.deleteAdditionalSalary(name)
      toast({ title: t('pay.ded.deleted') })
      load()
    } catch (error) {
      toast({ title: t('pay.ded.delete_fail'), description: String(error), variant: 'destructive' })
    }
  }

  const openDialog = () => {
    form.reset({
      mode: 'manual',
      employee: '',
      reason: '',
      hourlyRate: 0,
      hours: 0,
      multiplier: '1',
      payroll_date: new Date().toISOString().split('T')[0],
    } as any)
    setEmployeeData({ baseSalary: 0, shiftHours: 8, loading: false, error: null })
    setPolicyData(null)
    setDialogOpen(true)
  }

  const formatCurrency = (value: number) => formatSAR(value, 2)


  const formatPercent = (value: number) => `${value}%`

  const multiplierLabel = (m: string) => {
    const entry = PENALTY_MULTIPLIERS.find(p => p.value === m)
    return isRTL ? entry?.labelAr : entry?.labelEn
  }

  const reasonLabel = (r: string) => {
    const entry = DEDUCTION_REASONS.find(d => d.value === r)
    if (entry) return isRTL ? entry.labelAr : entry.labelEn
    const vioLabel = VIOLATION_LABELS[r]
    if (vioLabel) return isRTL ? vioLabel.labelAr : vioLabel.labelEn
    return r
  }

  const violationLabel = (key: string) => {
    const entry = VIOLATION_LABELS[key]
    return entry ? (isRTL ? entry.labelAr : entry.labelEn) : key
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t('pay.ded.title')}</h2>
        <Button onClick={openDialog} size="sm">
          <Plus className="h-4 w-4 mr-1" /> {t('pay.ded.add')}
        </Button>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('pay.add.employee')}</TableHead>
              <TableHead>{t('pay.ded.reason')}</TableHead>
              <TableHead>{t('pay.add.component')}</TableHead>
              <TableHead>{t('pay.ded.total_amount')}</TableHead>
              <TableHead>{t('pay.add.date')}</TableHead>
              <TableHead className="text-right">{t('pay.comp.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : deductions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t('pay.ded.empty')}</TableCell>
              </TableRow>
            ) : (
              deductions.map((d) => (
                <TableRow key={d.name}>
                  <TableCell className="font-medium">{d.employee_name || d.employee}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{d.reason ? reasonLabel(d.reason) : '—'}</TableCell>
                  <TableCell><Badge variant="outline">{d.salary_component}</Badge></TableCell>
                  <TableCell className="font-semibold text-red-600 tabular-nums">-{formatCurrency(d.amount)}</TableCell>
                  <TableCell className="tabular-nums">{formatDateShort(d.payroll_date) || '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button aria-label={t('pay.ded.delete')} variant="ghost" size="sm" onClick={() => setPendingDelete(d.name)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) form.reset() }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('pay.ded.dialog_title')}</DialogTitle>
            <DialogDescription>{t('pay.ded.dialog_desc')}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
              <FormField
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('pay.ded.mode_label')}</FormLabel>
                    <FormControl>
                      <RadioGroup
                        value={field.value}
                        onValueChange={(v) => {
                          field.onChange(v)
                          if (v === 'matrix') {
                            form.setValue('violationType', '')
                            form.setValue('occurrence', '')
                          }
                        }}
                        className="flex gap-6"
                      >
                        <div className={cn(
                          'flex items-center gap-2 px-4 py-3 rounded-lg border transition-colors cursor-pointer',
                          field.value === 'manual'
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-muted hover:border-muted-foreground/30'
                        )}>
                          <RadioGroupItem value="manual" id="mode-manual" />
                          <label htmlFor="mode-manual" className="text-sm font-medium cursor-pointer">
                            {t('pay.ded.mode_manual')}
                          </label>
                        </div>
                        <div className={cn(
                          'flex items-center gap-2 px-4 py-3 rounded-lg border transition-colors cursor-pointer',
                          field.value === 'matrix'
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-muted hover:border-muted-foreground/30'
                        )}>
                          <RadioGroupItem value="matrix" id="mode-matrix" />
                          <label htmlFor="mode-matrix" className="text-sm font-medium cursor-pointer">
                            {t('pay.ded.mode_matrix')}
                          </label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="employee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('pay.add.employee')}</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger aria-label={t('pay.add.select_employee')}><SelectValue placeholder={t('pay.add.select_employee')} /></SelectTrigger>
                        <SelectContent>
                          {employees.map(e => (
                            <SelectItem key={e.name} value={e.name}>{e.employee_name} ({e.name})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchedEmployee && (
                <Card className="bg-blue-50/50 border-primary/20">
                  <CardContent className="p-3 flex items-center gap-6 flex-wrap">
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-muted-foreground">{t('pay.ded.base_salary')}:</span>
                      <span className="font-semibold text-accent-foreground tabular-nums">
                        {employeeData.loading ? '...' : formatCurrency(employeeData.baseSalary)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-muted-foreground">{t('pay.ded.shift_hours')}:</span>
                      <span className="font-semibold text-accent-foreground tabular-nums">
                        {employeeData.loading ? '...' : `${employeeData.shiftHours}h`}
                      </span>
                    </div>
                    {watchedMode === 'matrix' && dailyWage > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="text-muted-foreground">{t('pay.ded.daily_wage')}:</span>
                        <span className="font-semibold text-emerald-700 tabular-nums">
                          {formatCurrency(dailyWage)}
                        </span>
                      </div>
                    )}
                    {employeeData.error && (
                      <div className="flex items-center gap-2 text-sm text-amber-600">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{employeeData.error}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {watchedMode === 'manual' && (
                <>
                  <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('pay.ded.reason')}</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger aria-label={t('pay.ded.select_reason')}><SelectValue placeholder={t('pay.ded.select_reason')} /></SelectTrigger>
                            <SelectContent>
                              {DEDUCTION_REASONS.map(r => (
                                <SelectItem key={r.value} value={r.value}>{isRTL ? r.labelAr : r.labelEn}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="hourlyRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('pay.ded.hourly_rate_editable')}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
                              placeholder="0.00"
                              className={cn(
                                '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                                isRTL ? 'pl-12' : 'pr-12',
                              )}
                            />
                            <span className={cn(
                              'absolute top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none',
                              isRTL ? 'left-3' : 'right-3',
                            )}>/hr</span>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="hours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('pay.ded.hours')}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.5"
                              min="0.5"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
                              placeholder="0.00"
                              className="[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="multiplier"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('pay.ded.multiplier')}</FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger aria-label="1x"><SelectValue placeholder="1x" /></SelectTrigger>
                              <SelectContent>
                                {PENALTY_MULTIPLIERS.map(m => (
                                  <SelectItem key={m.value} value={m.value}>{isRTL ? m.labelAr : m.labelEn}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}

              {watchedMode === 'matrix' && (
                <>
                  {policyLoading ? (
                    <div className="space-y-2 py-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : !policyData?.rules?.length ? (
                    <Card className="border-amber-200 bg-amber-50">
                      <CardContent className="p-4 flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-amber-700">{t('pay.ded.no_policy_title')}</p>
                          <p className="text-xs text-amber-600">{t('pay.ded.no_policy_desc')}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <FormField
                        control={form.control}
                        name="violationType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('pay.ded.violation_type')}</FormLabel>
                            <FormControl>
                              <Select value={field.value} onValueChange={(v) => { field.onChange(v); form.setValue('occurrence', '') }}>
                                <SelectTrigger aria-label={t('pay.ded.select_violation')}><SelectValue placeholder={t('pay.ded.select_violation')} /></SelectTrigger>
                                <SelectContent>
                                  {policyViolations.map(key => (
                                    <SelectItem key={key} value={key}>{violationLabel(key)}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="occurrence"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('pay.ded.occurrence')}</FormLabel>
                            <FormControl>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger aria-label={t('pay.ded.select_occurrence')}><SelectValue placeholder={t('pay.ded.select_occurrence')} /></SelectTrigger>
                                <SelectContent>
                                  {OCCURRENCE_LABELS.map((o, i) => (
                                    <SelectItem key={i} value={String(i)}>{isRTL ? o.labelAr : o.labelEn}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </>
              )}

              <FormField
                control={form.control}
                name="payroll_date"
                render={({ field }) => {
                  const selected = field.value ? new Date(field.value + 'T00:00:00') : undefined
                  return (
                    <FormItem>
                      <FormLabel>{t('pay.add.date')}</FormLabel>
                      <FormControl>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full justify-start font-normal',
                                isRTL ? 'text-right' : 'text-left',
                                !field.value && 'text-muted-foreground',
                              )}
                            >
                              <CalendarIcon className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                              {field.value
                                ? format(new Date(field.value + 'T00:00:00'), 'PPP', { locale: isRTL ? ar : enUS })
                                : t('pay.ded.select_date')}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={selected}
                              onSelect={(d) => {
                                if (d) {
                                  field.onChange(format(d, 'yyyy-MM-dd'))
                                }
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />

              {watchedMode === 'matrix' && matrixDeduction && (
                <>
                  {matrixDeduction.isWarning ? (
                    <Card className="border-amber-300 bg-amber-50 shadow-sm">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                            <div className="space-y-1">
                              <span className="text-sm font-semibold text-amber-700">
                                {t('pay.ded.written_warning')}
                              </span>
                              <p className="text-xs text-amber-600">
                                {t('pay.ded.warning_desc')}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-100 shrink-0">
                            {formatPercent(0)}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-destructive/30 bg-destructive/5 shadow-sm">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between gap-4">
                          <div className="space-y-1">
                            <span className="text-sm font-semibold text-destructive">{t('pay.ded.total_amount')}</span>
                            <p className="text-xs text-muted-foreground">
                              {t('pay.ded.daily_wage')}: {formatCurrency(dailyWage)} × {formatPercent(matrixDeduction.rate)}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-2xl font-bold text-destructive tabular-nums tracking-tight">
                              -{formatCurrency(matrixDeduction.amount)}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {watchedMode === 'manual' && totalDeduction > 0 && (
                <Card className="border-destructive/30 bg-destructive/5 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <span className="text-sm font-semibold text-destructive">{t('pay.ded.total_amount')}</span>
                        <p className="text-xs text-muted-foreground">
                          {form.watch('hours') || 0}h × {multiplierLabel(form.watch('multiplier') || '1')} × {formatCurrency(form.watch('hourlyRate') as number || 0)}/hr
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-2xl font-bold text-destructive tabular-nums tracking-tight">
                          -{formatCurrency(totalDeduction)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
                  {t('pay.add.cancel')}
                </Button>
                <Button type="submit" disabled={submitting || totalDeduction === 0 && (watchedMode !== 'matrix' || !matrixDeduction?.isWarning)}>
                  {submitting ? t('pay.ded.submitting') : t('pay.ded.submit')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t('pay.ded.delete_confirm')}
        onConfirm={() => {
          if (pendingDelete) { remove(pendingDelete); setPendingDelete(null) }
        }}
      />
    </div>
  )
}
