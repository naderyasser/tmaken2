'use client'

/**
 * F4 — 360° tabbed employee profile. Tabs: Overview / Data / Salary & Financials
 * / Attendance / Leaves / Documents / Custody / Violations. The existing
 * single-page sectioned form is hosted UNCHANGED under the Data tab. Financial &
 * leave figures are DISPLAY-ONLY (calculations disabled pending HR sign-off).
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  User, Database, Wallet, CalendarClock, CalendarDays, FileWarning, Package, ShieldAlert,
  ArrowLeft, ArrowRight, AlertTriangle, ExternalLink, Loader2, ShieldCheck,
} from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { translateEnum } from '@/lib/enums'
import { SegmentedControl, EmptyState } from '@/components/shared'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getStatusClass } from '@/lib/status-config'
import { formatDateShort, formatSAR } from '@/lib/format'
import { EmployeeProfile } from '@/components/employee/employee-profile'
import { EmployeeAvatar } from '@/components/employee/employee-avatar'
import { FeaturePermissionsTab } from '@/components/employee/profile-360/feature-permissions-tab'

type Emp = { name: string; employee_name?: string; designation?: string; branch?: string; department?: string; status?: string; image?: string; gender?: string; date_of_joining?: string }

const SEV_CLASS: Record<string, string> = { expired: 'bg-red-100 text-red-700', critical: 'bg-amber-100 text-amber-700', warning: 'bg-blue-100 text-blue-700' }

function Chip({ status }: { status?: string | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStatusClass(status)}`}>{status}</span>
}
function Row({ label, value }: { label: string; value: ReactNode }) {
  return <div className="flex items-start justify-between gap-4 py-1.5"><span className="text-muted-foreground">{label}</span><span className="text-end font-medium text-foreground">{value}</span></div>
}
function CalcDisabledBanner({ text }: { text: string }) {
  return <div className="mb-4 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning"><AlertTriangle className="h-4 w-4 shrink-0" />{text}</div>
}

export function Profile360({ employeeId, onBack }: { employeeId: string; onBack: () => void }) {
  const { isRTL } = useI18n()
  const tx = (en: string, ar: string) => (isRTL ? ar : en)
  const [tab, setTab] = useState('overview')
  const [emp, setEmp] = useState<Emp | null>(null)
  const [org, setOrg] = useState<any>(null)
  const [fin, setFin] = useState<any>(null)
  const [leave, setLeave] = useState<any>(null)
  const [docs, setDocs] = useState<any[]>([])
  const [violations, setViolations] = useState<any[]>([])
  const [busy, setBusy] = useState<Record<string, boolean>>({})

  const call = useCallback(async (key: string, method: string, args: any, set: (v: any) => void) => {
    setBusy((b) => ({ ...b, [key]: true }))
    try { const r: any = await frappeClient.call(method, args); set(r?.message) } catch { /* */ }
    finally { setBusy((b) => ({ ...b, [key]: false })) }
  }, [])

  useEffect(() => {
    frappeClient.getEmployees({ fields: ['name', 'employee_name', 'designation', 'branch', 'department', 'status', 'image', 'gender', 'date_of_joining'], filters: [['Employee', 'name', '=', employeeId]] as any, limit_page_length: 1 })
      .then((l: any) => setEmp(l?.[0] || { name: employeeId })).catch(() => setEmp({ name: employeeId }))
    call('org', 'base_meena.api.org_chart.get_employee_org_context', { employee: employeeId }, setOrg)
    call('docs', 'base_meena.api.document_expiry.get_expiring_documents', { employee: employeeId, days_ahead: 3650 }, (m) => setDocs(Array.isArray(m) ? m : []))
  }, [employeeId, call])

  // lazy-load per tab
  useEffect(() => {
    if (tab === 'salary' && !fin) call('fin', 'base_meena.api.payroll_summary.get_employee_financials', { employee: employeeId }, setFin)
    if (tab === 'leaves' && !leave) call('leave', 'base_meena.api.leave_summary.get_employee_leave', { employee: employeeId }, setLeave)
    if (tab === 'violations' && violations.length === 0) call('viol', 'base_meena.penalty_management.violations_api.get_violations', { view: 'all', employee: employeeId }, (m) => setViolations(Array.isArray(m) ? m : []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const TABS = useMemo(() => [
    { id: 'overview', label: tx('Overview', 'نظرة عامة'), icon: User },
    { id: 'data', label: tx('Data', 'البيانات'), icon: Database },
    { id: 'salary', label: tx('Salary & Financials', 'الراتب والماليات'), icon: Wallet },
    { id: 'attendance', label: tx('Attendance', 'الحضور'), icon: CalendarClock },
    { id: 'leaves', label: tx('Leaves', 'الإجازات'), icon: CalendarDays },
    { id: 'documents', label: tx('Documents', 'الوثائق'), icon: FileWarning },
    { id: 'custody', label: tx('Custody', 'العُهد'), icon: Package },
    { id: 'violations', label: tx('Violations', 'المخالفات'), icon: ShieldAlert },
    { id: 'permissions', label: tx('Permissions', 'الصلاحيات'), icon: ShieldCheck },
  ], [isRTL])

  const Back = isRTL ? ArrowRight : ArrowLeft

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        {/* Header card */}
        <Card className="mb-4 flex flex-wrap items-center gap-4 p-4 shadow-card sm:p-5">
          <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent" aria-label={tx('Back', 'رجوع')}><Back className="h-5 w-5" /></button>
          <EmployeeAvatar image={emp?.image} gender={emp?.gender} name={emp?.employee_name} className="h-14 w-14 border border-border" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">{emp?.employee_name || employeeId}</h1>
              <Chip status={emp?.status} />
            </div>
            <p className="text-sm text-muted-foreground">{[emp?.designation, emp?.branch].filter(Boolean).join(' · ') || '—'}</p>
          </div>
          <div className="flex flex-col items-end text-xs text-muted-foreground">
            {org?.length_of_service_days != null && <span>{tx('Service', 'مدة الخدمة')}: {Math.floor(org.length_of_service_days / 365)}{tx('y', 'س')} {Math.floor((org.length_of_service_days % 365) / 30)}{tx('m', 'ش')}</span>}
            {org?.manager && <span>{tx('Manager', 'المدير')}: {typeof org.manager === 'string' ? org.manager : (org.manager.employee_name || org.manager.name)}</span>}
          </div>
        </Card>

        <div className="mb-4"><SegmentedControl options={TABS} value={tab} onChange={setTab} /></div>

        {/* Panels */}
        {tab === 'overview' && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4 shadow-card">
              <h3 className="mb-3 text-sm font-semibold text-foreground">{tx('Team', 'الفريق')}</h3>
              <Row label={tx('Manager', 'المدير')} value={(org?.manager ? (typeof org.manager === 'string' ? org.manager : (org.manager.employee_name || org.manager.name)) : '—')} />
              <Row label={tx('Direct reports', 'المرؤوسون')} value={(org?.direct_reports?.length ?? 0)} />
            </Card>
            <Card className="p-4 shadow-card">
              <h3 className="mb-3 text-sm font-semibold text-foreground">{tx('Document alerts', 'تنبيهات الوثائق')}</h3>
              {docs.filter((d) => d.severity && d.days_left <= 90).length === 0 ? (
                <p className="text-sm text-muted-foreground">{tx('No documents expiring soon', 'لا وثائق قريبة الانتهاء')}</p>
              ) : docs.filter((d) => d.severity && d.days_left <= 90).slice(0, 5).map((d, i) => (
                <div key={i} className="flex items-center justify-between py-1 text-sm">
                  <span>{d.doc_type}</span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${SEV_CLASS[d.severity] || ''}`}>{d.expiry_date ? formatDateShort(d.expiry_date) : d.severity}</span>
                </div>
              ))}
            </Card>
          </div>
        )}

        {tab === 'data' && <div className="-mx-4 md:-mx-6"><EmployeeProfile employeeId={employeeId} onBack={onBack} /></div>}

        {tab === 'salary' && (
          <Card className="p-4 shadow-card sm:p-5">
            {/* Only warn when nothing is actually computed. With real slip-derived
                amounts on screen, "calculations are disabled" contradicts what the
                user is looking at; with no payroll data it still explains the blanks. */}
            {!busy.fin && !((fin?.salary_components || []).some((c: any) => Number(c?.amount) > 0)) && (
              <CalcDisabledBanner text={tx('Read-only — payroll calculations are disabled pending HR sign-off', 'للعرض فقط — حسابات الرواتب معطّلة بانتظار اعتماد الموارد البشرية')} />
            )}
            {busy.fin ? <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-muted-foreground" /> : fin ? (
              <div className="grid gap-4 md:grid-cols-2">
                <section><h3 className="mb-2 text-sm font-semibold">{tx('GOSI', 'التأمينات')}</h3>
                  <Row label={tx('Registered wage', 'الأجر المسجّل')} value={fin.gosi?.registered_wage ? formatSAR(fin.gosi.registered_wage) : '—'} />
                  <Row label={tx('Employee', 'الموظف')} value={fin.gosi?.employee_rate || '9%'} />
                  <Row label={tx('Employer', 'صاحب العمل')} value={fin.gosi?.employer_rate || '11%'} />
                </section>
                <section><h3 className="mb-2 text-sm font-semibold">{tx('Bank', 'البنك')}</h3>
                  <Row label={tx('IBAN', 'الآيبان')} value={fin.bank?.iban || '—'} />
                  <Row label={tx('Bank', 'البنك')} value={fin.bank?.bank_name || '—'} />
                </section>
                <section className="md:col-span-2"><h3 className="mb-2 text-sm font-semibold">{tx('Salary components', 'مكوّنات الراتب')}</h3>
                  {(fin.salary_components || []).length === 0 ? <p className="text-sm text-muted-foreground">—</p> :
                    (fin.salary_components || []).map((c: any, i: number) => <Row key={i} label={c.salary_component || c.component} value={c.amount ? formatSAR(c.amount) : '—'} />)}
                </section>
              </div>
            ) : <EmptyState title={tx('No financial data', 'لا توجد بيانات مالية')} />}
          </Card>
        )}

        {tab === 'leaves' && (
          <Card className="p-4 shadow-card sm:p-5">
            <CalcDisabledBanner text={tx('Sick-leave deductions are disabled pending HR sign-off', 'خصومات الإجازات المرضية معطّلة بانتظار اعتماد الموارد البشرية')} />
            {busy.leave ? <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-muted-foreground" /> : leave ? (
              <div className="space-y-4">
                <section><h3 className="mb-2 text-sm font-semibold">{tx('Balances', 'الأرصدة')}</h3>
                  {(leave.balances || []).length === 0 ? <p className="text-sm text-muted-foreground">{tx('No allocations', 'لا توجد مخصصات')}</p> :
                    (leave.balances || []).map((b: any, i: number) => <Row key={i} label={translateEnum('leaveType', b.leave_type, isRTL ? 'ar' : 'en')} value={`${b.balance ?? 0} / ${b.allocated ?? 0}`} />)}
                </section>
                <section><h3 className="mb-2 text-sm font-semibold">{tx('Sick-leave policy', 'سياسة الإجازة المرضية')}</h3>
                  <div className="flex flex-wrap gap-2">{(leave.sick_leave_policy?.tiers || []).map((tr: any, i: number) => (
                    <span key={i} className="rounded-lg bg-muted px-3 py-1.5 text-sm">{tr.days} {tx('days', 'يوم')} @ {tr.pct}%</span>
                  ))}</div>
                </section>
              </div>
            ) : <EmptyState title={tx('No leave data', 'لا توجد بيانات إجازات')} />}
          </Card>
        )}

        {tab === 'documents' && (
          <Card className="p-4 shadow-card sm:p-5">
            <h3 className="mb-3 text-sm font-semibold">{tx('Documents & expiry', 'الوثائق والانتهاء')}</h3>
            {docs.length === 0 ? <EmptyState title={tx('No documents on file', 'لا توجد وثائق')} /> : docs.map((d, i) => (
              <div key={i} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
                <span className="font-medium">{d.doc_type}{d.number ? ` · ${d.number}` : ''}</span>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${SEV_CLASS[d.severity] || 'bg-muted text-muted-foreground'}`}>{d.expiry_date ? formatDateShort(d.expiry_date) : '—'}</span>
              </div>
            ))}
          </Card>
        )}

        {tab === 'violations' && (
          <Card className="p-4 shadow-card sm:p-5">
            <h3 className="mb-3 text-sm font-semibold">{tx('Violations', 'المخالفات')}</h3>
            {busy.viol ? <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-muted-foreground" /> : violations.length === 0 ? <EmptyState title={tx('No violations', 'لا توجد مخالفات')} /> : violations.map((v, i) => (
              <div key={i} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
                <span>{v.violation_category || v.violation_type} · {v.violation_date ? formatDateShort(v.violation_date) : '—'}</span>
                <Chip status={v.effective_status} />
              </div>
            ))}
          </Card>
        )}

        {tab === 'permissions' && <FeaturePermissionsTab employeeId={employeeId} />}

        {(tab === 'attendance' || tab === 'custody') && (
          <Card className="p-6 text-center shadow-card">
            <p className="mb-3 text-sm text-muted-foreground">{tab === 'attendance' ? tx('Full attendance is in the Attendance module.', 'سجل الحضور الكامل في وحدة الحضور.') : tx('Custody items are managed in the Custody module.', 'تُدار العُهد في وحدة العُهد.')}</p>
            <Button variant="outline" asChild>
              <Link href={tab === 'attendance' ? '/attendance' : '/hr?module=custody'}><ExternalLink className="me-2 h-4 w-4" />{tx('Open module', 'فتح الوحدة')}</Link>
            </Button>
          </Card>
        )}
      </div>
    </div>
  )
}
