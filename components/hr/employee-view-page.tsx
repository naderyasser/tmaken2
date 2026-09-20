'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, User, X } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { frappeImageUrl } from '@/lib/utils'
import { fmtDate } from '@/lib/hr-format'
import { ApexTableCard } from '@/components/hr/apex/table-card'

/**
 * «عرض موظف» (M7, Apex `hr/EmployeeDetails`) — read-only profile page reached
 * from the employees list «⋮ عرض» row-menu (see generic-list-page.tsx). Not a
 * form: no inputs, no save. Mirrors `apex-employee-form.tsx` field-for-field
 * (same sections/labels) so the two stay in lockstep, plus the Apex vacations
 * table (Leave Application rows for this employee).
 */

type F = Record<string, any>

const STATUS_LABEL: Record<string, string> = { Active: 'نشط', Inactive: 'غير نشط', Suspended: 'موقوف', Left: 'منتهي' }

interface LeaveRow {
  name: string
  leave_type: string
  from_date: string
  to_date: string
  total_leave_days: number
  description?: string
}

const Row = ({ label, value }: { label: string; value?: React.ReactNode }) => (
  <div className="space-y-1">
    <p className="text-[13px] text-slate-500">{label}</p>
    <p className="min-h-[20px] text-[14px] font-medium text-slate-800">
      {value === undefined || value === null || value === '' ? '—' : value}
    </p>
  </div>
)

const grid = 'grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 px-4'

export function EmployeeViewPage({ employeeId }: { employeeId: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const [f, setF] = useState<F>({})
  const [managerName, setManagerName] = useState('')
  const [loading, setLoading] = useState(true)
  const [leaves, setLeaves] = useState<LeaveRow[] | null>(null)
  const [leavesLoading, setLeavesLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    frappeClient.get<F>('Employee', employeeId)
      .then((res: any) => { if (!cancelled) setF(res?.data ?? {}) })
      .catch((e: any) => { if (!cancelled) toast({ title: 'تعذّر تحميل بيانات الموظف', description: e?.message, variant: 'destructive' }) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [employeeId, toast])

  // Resolve «المدير المباشر» (reports_to is an Employee ID) to a display name.
  useEffect(() => {
    if (!f.reports_to) { setManagerName(''); return }
    let cancelled = false
    frappeClient.get<{ employee_name: string }>('Employee', f.reports_to)
      .then((res: any) => { if (!cancelled) setManagerName(res?.data?.employee_name || f.reports_to) })
      .catch(() => { if (!cancelled) setManagerName(f.reports_to) })
    return () => { cancelled = true }
  }, [f.reports_to])

  useEffect(() => {
    let cancelled = false
    setLeavesLoading(true)
    frappeClient.getList<LeaveRow>('Leave Application', {
      fields: ['name', 'leave_type', 'from_date', 'to_date', 'total_leave_days', 'description'],
      filters: [['employee', '=', employeeId]],
      order_by: 'from_date desc',
      limit_page_length: 0,
    })
      .then((rows) => { if (!cancelled) setLeaves(rows) })
      .catch(() => { if (!cancelled) setLeaves([]) })
      .finally(() => { if (!cancelled) setLeavesLoading(false) })
    return () => { cancelled = true }
  }, [employeeId])

  const commaList = (v?: string) => {
    const items = String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    return items.length ? items.join('، ') : undefined
  }
  const yesNo = (v: any) => (v ? 'نعم' : 'لا')

  return (
    <div className="pb-10" dir="rtl">
      {/* action bar */}
      <div className="flex items-center justify-between px-6 h-[62px] bg-[var(--apex-form-bar-bg)]">
        <div className="text-[14px] text-slate-700">
          <span className="text-slate-600">البيانات الاساسية</span><span className="mx-2 text-slate-400">/</span>
          <button type="button" onClick={() => router.push('/employees')} className="text-[var(--apex-link)]">الموظفين</button><span className="mx-2 text-slate-400">/</span>
          <span>عرض موظف</span>
        </div>
        <button type="button" onClick={() => router.push('/employees')} className="h-[40px] px-4 rounded bg-[var(--apex-red)] text-white text-[14px] flex items-center gap-1.5 hover:bg-[var(--apex-red-dark)]">
          <X className="h-4 w-4" />اغلاق
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-[var(--apex-blue)]" /></div>
      ) : (
        <div className="px-4">
          {/* photo + header (name/code/job/branch/status) */}
          <div className="flex flex-col items-center gap-3 my-6">
            <div className="h-[100px] w-[100px] rounded bg-slate-200 flex items-center justify-center overflow-hidden">
              {f.image ? (
                <img src={frappeImageUrl(f.image)} alt="" className="h-full w-full object-cover" />
              ) : (
                <User className="h-10 w-10 text-slate-500" />
              )}
            </div>
            <div className="text-center">
              <p className="text-[18px] font-bold text-slate-800">{f.employee_name || '—'}</p>
              <p className="text-[13px] text-slate-500 mt-0.5">
                {f.employee_number ? `كود ${f.employee_number}` : ''}
                {f.designation ? ` · ${f.designation}` : ''}
                {f.branch ? ` · ${f.branch}` : ''}
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-[var(--apex-blue)]/10 text-[var(--apex-blue)] text-[12.5px] font-bold px-3 py-1">
              {STATUS_LABEL[f.status] || f.status || '—'}
            </span>
          </div>

          <div className="mt-4">
            <div className="bg-white rounded px-4 h-[52px] shadow-sm mb-5 flex items-center">
              <span className="text-[18px] font-bold text-[var(--apex-blue)]">تعريف الموظف</span>
            </div>
            <div className={grid}>
              <Row label="كود الموظف" value={f.employee_number} />
              <Row label="حالة الموظف" value={STATUS_LABEL[f.status] || f.status} />
              <Row label="اسم الموظف بالعربية" value={f.employee_name} />
              <Row label="اسم الموظف بالانجليزية" value={f.custom_employee_name_en} />
              <Row label="الوظيفة" value={f.designation} />
              <Row label="صلاحية الموظف بالفروع" value={commaList(f.custom_branch_access)} />
            </div>
          </div>

          <div className="mt-8">
            <div className="bg-white rounded px-4 h-[52px] shadow-sm mb-5 flex items-center">
              <span className="text-[18px] font-bold text-[var(--apex-blue)]">معلومات الموظف</span>
            </div>
            <div className={grid}>
              <Row label="الفروع" value={f.branch} />
              <Row label="الدوام" value={f.default_shift} />
              <Row label="الإدارة" value={f.department} />
              <Row label="المجموعة" value={f.custom_employee_group} />
              <Row label="القسم" value={f.custom_section} />
              <Row label="المدير المباشر" value={managerName} />
              <Row label="المشروع" value={f.custom_project} />
              <Row label="المهمة" value={f.custom_task} />
              <Row label="طريقة الحضور" value={commaList(f.custom_attendance_method)} />
              <Row label="رقم الموظف على جهاز البصمة" value={f.attendance_device_id} />
              <Row label="تفعيل تطبيق الجوال" value={f.custom_mobile_app} />
            </div>
          </div>

          <div className="mt-8">
            <div className="bg-white rounded px-4 h-[52px] shadow-sm mb-5 flex items-center">
              <span className="text-[18px] font-bold text-[var(--apex-blue)]">معلومات شخصية</span>
            </div>
            <div className={grid}>
              <Row label="الجنسية" value={f.custom_nationality} />
              <Row label="رقم الهوية" value={f.custom_national_id} />
              <Row label="الديانة" value={f.custom_religion} />
              <Row label="عيد الميلاد" value={fmtDate(f.date_of_birth) || undefined} />
              <Row label="رقم الجوال" value={f.cell_number} />
              <Row label="البريد الالكترونى" value={f.personal_email} />
              <div className="md:col-span-2"><Row label="العنوان" value={f.current_address} /></div>
            </div>
          </div>

          <div className="mt-8">
            <div className="bg-white rounded px-4 h-[52px] shadow-sm mb-5 flex items-center">
              <span className="text-[18px] font-bold text-[var(--apex-blue)]">إعدادات إحتساب الإضافي</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 px-4">
              <Row label="خصم التأخير من الوقت الإضافي" value={yesNo(f.custom_ot_deduct_late)} />
              <Row label="حساب الوقت الإضافي قبل الدوام" value={yesNo(f.custom_ot_before_shift)} />
              <Row label="حساب الوقت الإضافي بعد الدوام" value={yesNo(f.custom_ot_after_shift)} />
              <Row label="إضافة ساعات العمل أيام الأجازات" value={yesNo(f.custom_ot_holidays)} />
              <Row label="تسجيل خروج بدون بصمة" value={yesNo(f.custom_checkout_without_punch)} />
            </div>
          </div>

          {/* vacations table — Apex: كود · اسم الموظف · الفرع · نوع الاجازة · من · إلى · المدة · ملاحظات */}
          <div className="mt-8">
            <div className="bg-white rounded px-4 h-[52px] shadow-sm mb-5 flex items-center">
              <span className="text-[18px] font-bold text-[var(--apex-blue)]">الاجازات</span>
            </div>
            <ApexTableCard>
              <table className="apex-table w-full">
                <thead>
                  <tr>
                    <th>كود</th>
                    <th>اسم الموظف</th>
                    <th>الفرع</th>
                    <th>نوع الاجازة</th>
                    <th>من</th>
                    <th>إلى</th>
                    <th>المدة</th>
                    <th>ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {leavesLoading ? (
                    <tr><td colSpan={8} className="py-10 text-center text-slate-500"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></td></tr>
                  ) : !leaves || leaves.length === 0 ? (
                    <tr><td colSpan={8} className="py-10 text-center text-slate-500">لا يوجد اجازات لهذا الموظف</td></tr>
                  ) : leaves.map((l) => (
                    <tr key={l.name}>
                      <td>{f.employee_number || employeeId}</td>
                      <td>{f.employee_name}</td>
                      <td>{f.branch || '—'}</td>
                      <td>{l.leave_type}</td>
                      <td>{fmtDate(l.from_date)}</td>
                      <td>{fmtDate(l.to_date)}</td>
                      <td>{l.total_leave_days}</td>
                      <td>{l.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ApexTableCard>
          </div>
        </div>
      )}
    </div>
  )
}
