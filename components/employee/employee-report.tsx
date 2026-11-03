'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Printer, Loader2, RefreshCw, ChevronDown,
  User, X, CheckCircle2, XCircle, TrendingUp, TrendingDown, AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { useI18n } from '@/lib/i18n'
import { printOnePage, onePagePrintCss } from '@/lib/print-fit'
import { translateDepartment } from '@/lib/enums'
import { frappeClient, Employee } from '@/lib/api-client'
import { useAuth } from '@/lib/auth-context'
import { frappeImageUrl, cn } from '@/lib/utils'
import { getStatusClass } from '@/lib/status-config'

// ─────────────────────────── types ───────────────────────────

interface BranchOption {
  name: string
  branch: string
  company: string
}

interface TableRow {
  employeeId: string
  employeeName: string
  branch: string
  workedDays: number
  absentDays: number
}

interface AbsenceDay {
  date: string
  status: string
  reason: string | null
}

interface FinancialAdjustment {
  component: string
  amount: number
  type: 'Earning' | 'Deduction'
}

interface DetailData {
  employee: Employee
  salary: string | null
  totalPresent: number
  absenceDays: AbsenceDay[]
  bonuses: FinancialAdjustment[]
  deductions: FinancialAdjustment[]
}

// ─────────────────────────── date helpers ───────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0]
}
function firstOfMonthStr() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
}

// ─────────────────────────── attendance computation ───────────────────────────

/** For the summary table: count worked vs absent working days. */
function computeSummary(
  records: { attendance_date: string; status: string }[],
  from: string,
  to: string,
): { workedDays: number; absentDays: number } {
  const today = todayStr()
  const effectiveTo = to > today ? today : to
  const presentSet = new Set(
    records
      .filter(r => r.status === 'Present' || r.status === 'Work From Home')
      .map(r => r.attendance_date),
  )
  let workedDays = 0
  let absentDays = 0
  const cursor = new Date(from)
  const end = new Date(effectiveTo)
  while (cursor <= end) {
    const day = cursor.getDay()
    // Saudi weekend: Friday (5) + Saturday (6); also skip if date is in holidays
    const dateStr = cursor.toISOString().split('T')[0]
    const isWeekend = day === 5 || day === 6
    if (!isWeekend) {
      presentSet.has(dateStr) ? workedDays++ : absentDays++
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return { workedDays, absentDays }
}

/** For the detail modal: build the explicit list of non-present working days. */
function buildAbsenceDays(
  records: { attendance_date: string; status: string; leave_type?: string }[],
  from: string,
  to: string,
): { totalPresent: number; absenceDays: AbsenceDay[] } {
  const today = todayStr()
  const effectiveTo = to > today ? today : to
  const attMap = new Map(records.map(r => [r.attendance_date, r]))
  let totalPresent = 0
  const absenceDays: AbsenceDay[] = []
  const cursor = new Date(from)
  const end = new Date(effectiveTo)
  while (cursor <= end) {
    const day = cursor.getDay()
    // Saudi weekend: Friday (5) + Saturday (6)
    const isWeekend = day === 5 || day === 6
    if (!isWeekend) {
      const ds = cursor.toISOString().split('T')[0]
      const rec = attMap.get(ds)
      const isPresent = rec?.status === 'Present' || rec?.status === 'Work From Home'
      if (isPresent) {
        totalPresent++
      } else {
        absenceDays.push({
          date: ds,
          status: rec ? rec.status : 'No Record',
          reason: rec?.leave_type ?? null,
        })
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return { totalPresent, absenceDays }
}

// ─────────────────────────── shared UI helpers ───────────────────────────


function ImageWithFallback({ src, alt }: { src: string; alt: string }) {
  const [errored, setErrored] = useState(false)
  if (!src || errored) return <User className="h-10 w-10 text-muted-foreground/70" />
  return (
    <img src={src} alt={alt} className="w-full h-full object-cover"
      onError={() => setErrored(true)} />
  )
}

function InfoRow({ label, value, alwaysShow }: { label: string; value?: string | null; alwaysShow?: boolean }) {
  if (!value && !alwaysShow) return null
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-border/60 last:border-0">
      <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-foreground">{value || '—'}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 pt-4 px-5">
        <CardTitle className="text-sm font-semibold text-foreground/90">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4">{children}</CardContent>
    </Card>
  )
}

// ─────────────────────────── detail card (modal content) ───────────────────────────

function EmployeeDetailCard({
  data, fromDate, toDate, t,
  onIssueWarnings, issuingWarnings, canIssueWarnings,
}: {
  data: DetailData
  fromDate: string
  toDate: string
  t: (k: string) => string
  onIssueWarnings?: () => Promise<void>
  issuingWarnings?: boolean
  canIssueWarnings?: boolean
}) {
  const { employee, salary, totalPresent, absenceDays, bonuses, deductions } = data
  const hasAdjustments = bonuses.length > 0 || deductions.length > 0
  const locale = t('dir') === 'rtl' ? 'ar' : 'en'

  return (
    <div className="space-y-5">
      {/* ── Header: photo + name ── */}
      <div className="flex items-center gap-5 pb-4 border-b border-border">
        <div className="h-20 w-20 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0 border border-border">
          <ImageWithFallback src={frappeImageUrl(employee.image)} alt={employee.employee_name} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-foreground truncate">{employee.employee_name}</h2>
          <p className="text-sm text-muted-foreground">
            {employee.designation || ''}
            {employee.designation && employee.department ? ' · ' : ''}
            {translateDepartment(employee.department, locale)}
          </p>
          {employee.status && (
            <span className={`inline-block mt-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full ${getStatusClass(employee.status)}`}>
              {employee.status}
            </span>
          )}
        </div>
      </div>

      {/* ── Info sections ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Section title={t('erp.personal_info')}>
          <InfoRow label={t('erp.employee_id')} value={employee.employee_number || employee.name} />
          <InfoRow label={t('erp.full_name')} value={employee.employee_name} />
          <InfoRow label={t('erp.date_of_birth')} value={employee.date_of_birth} />
          <InfoRow label={t('erp.gender')} value={employee.gender} />
          <InfoRow label={t('erp.national_id')} value={employee.custom_national_id} />
          <InfoRow label={t('erp.id_type')} value={employee.custom_id_type} />
        </Section>

        <Section title={t('erp.job_info')}>
          <InfoRow label={t('erp.department')} value={translateDepartment(employee.department, locale)} />
          <InfoRow label={t('erp.designation')} value={employee.designation} />
          <InfoRow label={t('erp.company')} value={employee.company} />
          <InfoRow label={t('erp.branch')} value={employee.branch} />
          <InfoRow label={t('erp.date_of_joining')} value={employee.date_of_joining} alwaysShow />
          <InfoRow label={t('erp.employment_mode')} value={employee.custom_employment_mode} />
          <InfoRow label={t('erp.shift')} value={employee.default_shift} />
          <InfoRow label={t('erp.reports_to')} value={employee.reports_to} />
        </Section>

        <div className="space-y-4">
          <Section title={t('erp.contact_info')}>
            <InfoRow label={t('erp.company_email')} value={employee.company_email} />
            <InfoRow label={t('erp.personal_email')} value={employee.personal_email} />
            <InfoRow label={t('erp.phone')} value={employee.cell_number} />
          </Section>
          <Section title={t('erp.compensation')}>
            <InfoRow label={t('erp.salary')} value={salary} alwaysShow />
          </Section>
        </div>
      </div>

      {/* ── Attendance & Payroll Summary ── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground/90">
            {t('erp.attendance_payroll_summary')}
          </CardTitle>
          <span className="text-[11px] text-muted-foreground/70">{fromDate} — {toDate}</span>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-5">

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className={cn('flex items-center gap-4 p-4 rounded-xl border',
              totalPresent > 0 ? 'bg-green-50 border-green-100' : 'bg-muted/40 border-border')}>
              <CheckCircle2 className={cn('h-9 w-9 shrink-0', totalPresent > 0 ? 'text-green-500' : 'text-muted-foreground/70')} />
              <div>
                <p className={cn('text-3xl font-bold', totalPresent > 0 ? 'text-green-700' : 'text-muted-foreground')}>
                  {totalPresent}
                </p>
                <p className={cn('text-xs font-medium', totalPresent > 0 ? 'text-green-600' : 'text-muted-foreground/70')}>
                  {t('erp.total_attended')}
                </p>
              </div>
            </div>
            <div className={cn('flex items-center gap-4 p-4 rounded-xl border',
              absenceDays.length > 0 ? 'bg-red-50 border-red-100' : 'bg-muted/40 border-border')}>
              <XCircle className={cn('h-9 w-9 shrink-0', absenceDays.length > 0 ? 'text-red-400' : 'text-muted-foreground/70')} />
              <div>
                <p className={cn('text-3xl font-bold', absenceDays.length > 0 ? 'text-red-600' : 'text-muted-foreground')}>
                  {absenceDays.length}
                </p>
                <p className={cn('text-xs font-medium', absenceDays.length > 0 ? 'text-red-500' : 'text-muted-foreground/70')}>
                  {t('erp.absence_days')}
                </p>
              </div>
            </div>
          </div>

          {/* Absence table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-foreground/90 flex items-center gap-1.5">
                <XCircle className="h-4 w-4 text-red-400" />
                {t('erp.absence_days')}
                {absenceDays.length > 0 && (
                  <span className="text-xs bg-red-100 text-red-600 rounded-full px-2 py-0.5 font-medium">
                    {absenceDays.length}
                  </span>
                )}
              </h4>
              {canIssueWarnings && absenceDays.some(d => !d.reason) && onIssueWarnings && (
                <Button
                  size="sm"
                  variant="outline"
                  className="no-print gap-1.5 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400"
                  onClick={onIssueWarnings}
                  disabled={issuingWarnings}
                >
                  {issuingWarnings
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <AlertTriangle className="h-3.5 w-3.5" />}
                  {issuingWarnings ? t('erp.issuing_warnings') : t('erp.issue_warnings')}
                </Button>
              )}
            </div>
            {absenceDays.length > 0 ? (
              <div className="overflow-x-auto print:overflow-visible rounded-lg border border-border/60">
                <table className="w-full text-sm table-fixed">
                  <thead>
                    <tr className="bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      <th className="px-3 py-2 text-start">{t('erp.absence_date')}</th>
                      <th className="px-3 py-2 text-start">{t('erp.absence_status')}</th>
                      <th className="px-3 py-2 text-start w-32 max-w-[120px] print:w-24 print:max-w-[100px]">{t('erp.absence_reason')}</th>
                      <th className="px-3 py-2 text-start w-24 max-w-[90px] print:w-20 print:max-w-[80px]">{t('erp.absence_warning')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {absenceDays.map((day, idx) => (
                      <tr key={day.date} className={idx % 2 === 0 ? 'bg-card' : 'bg-muted/30'}>
                        <td className="px-3 py-2 font-medium text-foreground/90">{day.date}</td>
                        <td className="px-3 py-2">
                          <span className={cn(
                            'text-xs font-medium px-2 py-0.5 rounded-full',
                            day.status === 'Absent' ? 'bg-red-100 text-red-700' :
                            day.status === 'On Leave' ? 'bg-accent text-primary' :
                            day.status === 'Half Day' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-muted text-muted-foreground',
                          )}>
                            {day.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground w-32 max-w-[120px] print:w-24 print:max-w-[100px] break-words whitespace-normal text-wrap print:text-xs">{day.reason || '—'}</td>
                        <td className="px-3 py-2 w-24 max-w-[90px] print:w-20 print:max-w-[80px]">
                          {!day.reason ? (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 print:bg-transparent print:text-amber-800 print:border print:border-amber-400">
                              {t('erp.absence_warning_issued')}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/70">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/70 py-2">{t('erp.no_absences')}</p>
            )}
          </div>

          {/* Financial adjustments */}
          <div>
            <h4 className="text-sm font-semibold text-foreground/90 mb-3">{t('erp.financial_adjustments')}</h4>
            {hasAdjustments ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-green-100 bg-green-50/50 p-3">
                  <p className="text-xs font-semibold text-green-700 flex items-center gap-1 mb-2">
                    <TrendingUp className="h-3.5 w-3.5" />{t('erp.bonuses')}
                  </p>
                  {bonuses.length > 0 ? bonuses.map((b, i) => (
                    <div key={i} className="flex justify-between py-1 border-b border-green-100 last:border-0 text-sm">
                      <span className="text-foreground/90 truncate">{b.component}</span>
                      <span className="text-green-600 font-semibold shrink-0 ml-2">+{Number(b.amount).toLocaleString()}</span>
                    </div>
                  )) : <p className="text-xs text-muted-foreground/70">—</p>}
                </div>
                <div className="rounded-xl border border-red-100 bg-red-50/50 p-3">
                  <p className="text-xs font-semibold text-red-600 flex items-center gap-1 mb-2">
                    <TrendingDown className="h-3.5 w-3.5" />{t('erp.deductions')}
                  </p>
                  {deductions.length > 0 ? deductions.map((d, i) => (
                    <div key={i} className="flex justify-between py-1 border-b border-red-100 last:border-0 text-sm">
                      <span className="text-foreground/90 truncate">{d.component}</span>
                      <span className="text-red-600 font-semibold shrink-0 ml-2">-{Number(d.amount).toLocaleString()}</span>
                    </div>
                  )) : <p className="text-xs text-muted-foreground/70">—</p>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/70">{t('erp.no_adjustments')}</p>
            )}
          </div>

        </CardContent>
      </Card>
    </div>
  )
}

// ─────────────────────────── table skeleton ───────────────────────────

function TableSkeleton() {
  return (
    <tbody>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-b border-border/60">
          <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
        </tr>
      ))}
    </tbody>
  )
}

// ─────────────────────────── main component ───────────────────────────

export function EmployeeReport() {
  const { t, isRTL } = useI18n()
  const { toast } = useToast()
  const { isHRManager, user } = useAuth()

  // ── Table state ──
  const [fromDate, setFromDate] = useState(firstOfMonthStr)
  const [toDate, setToDate] = useState(todayStr)
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [rows, setRows] = useState<TableRow[]>([])
  const [loadingBranches, setLoadingBranches] = useState(true)
  const [loadingTable, setLoadingTable] = useState(false)
  // ── Detail modal state ──
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailData, setDetailData] = useState<DetailData | null>(null)
  // ── Warning state ──
  const [issuingWarnings, setIssuingWarnings] = useState(false)

  // Ref for modal content — used to capture HTML for dedicated print window
  const modalContentRef = useRef<HTMLDivElement>(null)

  // Keep dates accessible in print handler without stale closure
  const fromRef = useRef(fromDate)
  const toRef = useRef(toDate)
  useEffect(() => { fromRef.current = fromDate }, [fromDate])
  useEffect(() => { toRef.current = toDate }, [toDate])

  // ── Load branches on mount ──
  const loadBranches = useCallback(async () => {
    setLoadingBranches(true)
    try {
      const res = await frappeClient.getBranches({ limit_page_length: 0 })
      setBranches(res.data ?? [])
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('erp.load_fail')
      toast({ title: t('error'), description: msg, variant: 'destructive' })
    } finally {
      setLoadingBranches(false)
    }
  }, [toast, t])

  useEffect(() => { loadBranches() }, [loadBranches])

  // ── Generate summary table ──
  const generate = useCallback(async () => {
    setLoadingTable(true)
    setRows([])
    try {
      const employeeFilters: any[] = [['Employee', 'status', '=', 'Active']]
      if (selectedBranch) employeeFilters.push(['Employee', 'branch', '=', selectedBranch])

      const employees = await frappeClient.getEmployees({
        fields: ['name', 'employee_name', 'branch'],
        filters: employeeFilters,
        order_by: 'employee_name asc',
        limit_page_length: 0,
      })

      if (employees.length === 0) { setRows([]); return }

      const employeeIds = employees.map(e => e.name)
      const attendanceRecs = await frappeClient.getAttendance({
        fields: ['employee', 'attendance_date', 'status'],
        filters: [
          ['Attendance', 'employee', 'in', employeeIds] as any,
          ['Attendance', 'attendance_date', '>=', fromDate],
          ['Attendance', 'attendance_date', '<=', toDate],
          ['Attendance', 'docstatus', '=', 1],
        ],
        limit_page_length: 0,
      })

      const attMap = new Map<string, { attendance_date: string; status: string }[]>()
      attendanceRecs.forEach(r => {
        if (!attMap.has(r.employee)) attMap.set(r.employee, [])
        attMap.get(r.employee)!.push(r)
      })

      setRows(employees.map(emp => {
        const { workedDays, absentDays } = computeSummary(attMap.get(emp.name) ?? [], fromDate, toDate)
        return { employeeId: emp.name, employeeName: emp.employee_name, branch: emp.branch ?? '—', workedDays, absentDays }
      }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('erp.load_fail')
      toast({ title: t('error'), description: msg, variant: 'destructive' })
    } finally {
      setLoadingTable(false)
    }
  }, [selectedBranch, fromDate, toDate, toast, t])

  useEffect(() => { generate() }, [generate])

  // ── Open detail modal for a specific employee ──
  const openDetail = useCallback(async (employeeId: string) => {
    setDetailData(null)
    setDetailLoading(true)
    setDetailOpen(true)

    const from = fromRef.current
    const to = toRef.current

    try {
      const [employee, assignments, attendanceRecs, additionalRecs] = await Promise.all([
        frappeClient.getEmployee(employeeId),
        frappeClient.getSalaryStructureAssignments({
          filters: [
            ['Salary Structure Assignment', 'employee', '=', employeeId],
            ['Salary Structure Assignment', 'docstatus', '=', 1],
          ],
          fields: ['base'],
          order_by: 'from_date desc',
          limit_page_length: 1,
        }),
        frappeClient.getAttendance({
          fields: ['attendance_date', 'status', 'leave_type'],
          filters: [
            ['Attendance', 'employee', '=', employeeId],
            ['Attendance', 'attendance_date', '>=', from],
            ['Attendance', 'attendance_date', '<=', to],
            ['Attendance', 'docstatus', '=', 1],
          ],
          order_by: 'attendance_date asc',
          limit_page_length: 500,
        }),
        frappeClient.getAdditionalSalaries({
          fields: ['salary_component', 'type', 'amount'],
          filters: [
            ['Additional Salary', 'employee', '=', employeeId],
            ['Additional Salary', 'payroll_date', '>=', from],
            ['Additional Salary', 'payroll_date', '<=', to],
            ['Additional Salary', 'docstatus', '=', 1],
          ],
          limit_page_length: 500,
        }),
      ])

      if (!employee) throw new Error('Employee not found')

      const base = assignments?.[0]?.base
      const salary = base != null ? Number(base).toLocaleString() : null

      const { totalPresent, absenceDays } = buildAbsenceDays(attendanceRecs, from, to)

      const adjustments: FinancialAdjustment[] = additionalRecs.map((r: any) => ({
        component: r.salary_component,
        amount: r.amount,
        type: r.type as 'Earning' | 'Deduction',
      }))

      setDetailData({
        employee,
        salary,
        totalPresent,
        absenceDays,
        bonuses: adjustments.filter(a => a.type === 'Earning'),
        deductions: adjustments.filter(a => a.type === 'Deduction'),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('erp.load_fail')
      toast({ title: t('error'), description: msg, variant: 'destructive' })
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }, [toast, t])

  // ── Modal print: open a dedicated window with only the employee card ──
  const handleModalPrint = () => {
    if (!modalContentRef.current) return

    // Collect all compiled stylesheets (Tailwind, shadcn, etc.)
    const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map(l => l.outerHTML).join('\n')
    const styleTags = Array.from(document.querySelectorAll('style'))
      .map(s => `<style>${s.innerHTML}</style>`).join('\n')

    // Sanitize content: strip <script> tags, event handlers, and dangerous attributes
    const rawContent = modalContentRef.current.innerHTML
    const parser = new DOMParser()
    const parsed = parser.parseFromString(rawContent, 'text/html')
    parsed.querySelectorAll('script, iframe, object, embed, link[rel="import"]').forEach(el => el.remove())
    parsed.querySelectorAll('*').forEach(el => {
      for (const attr of Array.from(el.attributes)) {
        // Remove event handlers and dangerous attributes
        if (attr.name.startsWith('on') || attr.name === 'srcdoc' || attr.name === 'formaction') {
          el.removeAttribute(attr.name)
        }
        // Remove javascript: URLs in href/src/action
        if (['href', 'src', 'action', 'data'].includes(attr.name)) {
          const val = (attr.value || '').trim().toLowerCase()
          if (val.startsWith('javascript:') || val.startsWith('data:text/html')) {
            el.removeAttribute(attr.name)
          }
        }
      }
      // Remove style expressions (IE-specific but belt-and-suspenders)
      if (el.getAttribute('style')?.includes('expression(')) {
        el.removeAttribute('style')
      }
    })
    const safeContent = parsed.body.innerHTML

    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) return

    printWindow.document.write(`<!DOCTYPE html>
<html dir="${document.documentElement.dir}" lang="${document.documentElement.lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${styleLinks}
  ${styleTags}
  <style>
    /* Reset the main-page print rules that hide everything via .erp-print-area */
    body { padding: 12mm; background: white; margin: 0; }
    body * { visibility: visible !important; overflow: visible !important; }
    .no-print { display: none !important; }
    @media print {
      body { padding: 12mm; margin: 0; }
      body * { visibility: visible !important; overflow: visible !important; }
      .no-print { display: none !important; }
      * { position: static !important; }
    }
  </style>
</head>
<body>${safeContent}</body>
</html>`)
    printWindow.document.close()
    printWindow.addEventListener('load', () => {
      printWindow.focus()
      printWindow.print()
      printWindow.close()
    })
  }

  // ── Issue daily absence warnings ──
  const handleIssueWarnings = useCallback(async () => {
    if (!detailData) return
    const { employee, absenceDays } = detailData

    // Only days with no leave reason (no record / absent without justification)
    const unexcused = absenceDays.filter(d => !d.reason)
    if (unexcused.length === 0) {
      toast({ title: t('erp.no_unexcused'), description: t('erp.no_unexcused_desc') })
      return
    }

    setIssuingWarnings(true)
    try {
      const forUser = user?.email ?? ''
      const dates = unexcused.map(d => d.date)

      const result = await frappeClient.issueAbsenceWarnings(
        employee.name,
        employee.employee_name,
        dates,
        forUser,
      )

      const issued = result.issued ?? 0
      const skipped = result.skipped ?? 0
      const pwaSent = result.pwa_sent ?? 0
      const noUser = result.no_user ?? false

      toast({
        title: t('erp.warnings_issued'),
        description: t('erp.warnings_issued_desc')
          .replace('{issued}', String(issued))
          .replace('{skipped}', String(skipped)),
      })

      if (pwaSent > 0) {
        toast({ description: t('erp.notif_sent_to_employee').replace('{sent}', String(pwaSent)) })
      }
      if (noUser) {
        toast({ title: t('erp.notif_no_user'), variant: 'destructive' })
      }

      // Refresh detail data to reflect the updated state
      openDetail(employee.name)
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('erp.load_fail')
      toast({ title: t('error'), description: msg, variant: 'destructive' })
    } finally {
      setIssuingWarnings(false)
    }
  }, [detailData, user, toast, t, openDetail])

  // ── Table print ──
  // Any number of employees must come out as a single sheet, so measure and
  // scale the table to the page instead of letting it spill over.
  const printAreaRef = useRef<HTMLDivElement>(null)
  const handleTablePrint = () => {
    printOnePage(printAreaRef.current, { marginMm: 12 })
  }

  const selectedBranchInfo = branches.find(b => b.name === selectedBranch)
  const headerTitle = selectedBranchInfo
    ? [selectedBranchInfo.company, selectedBranchInfo.branch].filter(Boolean).join(' — ') || null
    : null

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ── Table print styles ── */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .erp-print-page,
          .erp-print-page * { visibility: visible !important; }
          .erp-print-page {
            position: absolute !important;
            top: 0 !important;
            inset-inline-start: 0 !important;
          }
          .erp-print-area { padding: 0 !important; }
          .no-print { display: none !important; }
        }
        ${onePagePrintCss('.erp-print-page', '.erp-print-area', 'portrait', 12, isRTL)}
      `}</style>

      {/* ── Toolbar ── */}
      <div className="no-print mb-6 space-y-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-foreground">{t('erp.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('erp.subtitle_table')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">{t('erp.from_date')}</label>
            <input type="date" aria-label={isRTL ? "من تاريخ" : "From date"} value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="text-sm border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">{t('erp.to_date')}</label>
            <input type="date" aria-label={isRTL ? "إلى تاريخ" : "To date"} value={toDate} onChange={e => setToDate(e.target.value)}
              className="text-sm border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="relative">
            {loadingBranches ? <Skeleton className="h-9 w-48" /> : (
              <div className="relative">
                <select aria-label={t('erp.all_branches')} value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
                  className="appearance-none text-sm border border-border rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-ring bg-card min-w-[180px]">
                  <option value="">{t('erp.all_branches')}</option>
                  {branches.map(b => <option key={b.name} value={b.name}>{b.branch}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
              </div>
            )}
          </div>
          <Button onClick={generate} disabled={loadingTable} className="gap-2">
            {loadingTable && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('erp.generate')}
          </Button>
          <Button variant="outline" size="icon" onClick={loadBranches} disabled={loadingBranches} title="Refresh branches">
            <RefreshCw className={cn('h-4 w-4', loadingBranches && 'animate-spin')} />
          </Button>
          <Button onClick={handleTablePrint} variant="outline"
            disabled={loadingTable || rows.length === 0} className="gap-2">
            <Printer className="h-4 w-4" />{t('erp.print')}
          </Button>
        </div>
      </div>

      {/* ── Printable table area ── */}
      <div className="erp-print-page"><div className="erp-print-area" ref={printAreaRef}>
        {headerTitle && (
          <div className="mb-5 text-center">
            <h2 className="text-xl font-bold text-foreground">{headerTitle}</h2>
            <p className="text-xs text-muted-foreground/70 mt-0.5">{fromDate} — {toDate}</p>
          </div>
        )}
        <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-3 text-start">{t('erp.employee_name_col')}</th>
                <th className="px-4 py-3 text-start">{t('erp.branch')}</th>
                <th className="px-4 py-3 text-start">{t('erp.attendance_summary')}</th>
              </tr>
            </thead>
            {loadingTable ? <TableSkeleton /> : rows.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-sm text-muted-foreground/70">{t('erp.no_data')}</td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={row.employeeId}
                    onClick={() => openDetail(row.employeeId)}
                    className={cn(
                      'border-b border-border/60 last:border-0 transition-colors cursor-pointer',
                      idx % 2 === 0 ? 'bg-card' : 'bg-gray-50/40',
                      'hover:bg-blue-50/60',
                    )}
                  >
                    <td className="px-4 py-3 font-medium text-primary underline-offset-2 hover:underline">
                      {row.employeeName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.branch}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 flex-wrap">
                        <span className="text-green-700 font-medium">
                          {t('erp.worked_days').replace('{n}', String(row.workedDays))}
                        </span>
                        <span className="text-muted-foreground/40">·</span>
                        <span className={cn('font-medium', row.absentDays > 0 ? 'text-red-600' : 'text-muted-foreground/70')}>
                          {t('erp.absent_days_label').replace('{n}', String(row.absentDays))}
                        </span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
        {!loadingTable && rows.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground/70 text-end no-print">
            {rows.length} {rows.length === 1 ? 'employee' : 'employees'} — {t('erp.click_row_hint')}
          </p>
        )}
      </div></div>

      {/* ── Detail Modal ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl w-full p-0 gap-0 overflow-hidden">
          {/* Modal toolbar (no-print) */}
          <div className="no-print flex items-center justify-between px-6 py-4 border-b border-border bg-card">
            <DialogTitle className="text-base font-semibold text-foreground">
              {detailData?.employee.employee_name ?? '...'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleModalPrint}
                disabled={detailLoading || !detailData}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Printer className="h-4 w-4" />
                {t('erp.print')}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setDetailOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Modal body */}
          <ScrollArea className="max-h-[80vh]">
            <div ref={modalContentRef} className="px-6 py-5">
              {detailLoading ? (
                <div className="space-y-4 py-8">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-20 w-20 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <Skeleton className="h-40" />
                    <Skeleton className="h-40" />
                    <Skeleton className="h-40" />
                  </div>
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : detailData ? (
                <EmployeeDetailCard
                  data={detailData}
                  fromDate={fromDate}
                  toDate={toDate}
                  t={t}
                  canIssueWarnings={isHRManager}
                  onIssueWarnings={handleIssueWarnings}
                  issuingWarnings={issuingWarnings}
                />
              ) : null}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}
