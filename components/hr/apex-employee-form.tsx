'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, ChevronUp, Loader2, Plus, X, Image as ImageIcon } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useCompanySafe } from '@/hooks/use-company'
import { useToast } from '@/hooks/use-toast'
import { cn, frappeImageUrl } from '@/lib/utils'

/**
 * «اضافة موظف / تعديل موظف» — the Apex full-page employee form, field for field:
 *   تعريف الموظف · معلومات الموظف · معلومات شخصية · إعدادات إحتساب الإضافي
 * Backed by the Employee doctype (+ the custom_* fields created for this copy).
 */

type F = Record<string, any>

const FIELD = 'w-full h-[44px] rounded border border-[#ced4da] bg-white px-3 text-[14px] text-slate-800 outline-none focus:border-[#2960b6] placeholder:text-slate-400'

const STATUS = [['Active', 'نشط'], ['Inactive', 'غير نشط'], ['Suspended', 'موقوف'], ['Left', 'منتهي']]

interface Opts { designations: string[]; branches: string[]; shifts: string[]; departments: string[]; groups: string[]; projects: string[]; employees: { name: string; employee_name: string }[]; countries: string[] }
const EMPTY: Opts = { designations: [], branches: [], shifts: [], departments: [], groups: [], projects: [], employees: [], countries: [] }

const REQUIRED = ['employee_number', 'status', 'employee_name', 'custom_branch_access', 'branch', 'default_shift', 'custom_attendance_method']

export function ApexEmployeeForm({ employeeId }: { employeeId?: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const { company } = useCompanySafe()
  const isNew = !employeeId
  const [f, setF] = useState<F>({ status: 'Active', custom_branch_access: 'فرعه فقط', custom_attendance_method: 'جهاز البصمة', custom_mobile_app: 'لا' })
  const [opts, setOpts] = useState<Opts>(EMPTY)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState({ info: true, personal: true, ot: true })
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? ((e.target as HTMLInputElement).checked ? 1 : 0) : e.target.value }))

  useEffect(() => {
    const list = (dt: string, fields = ['name'], filters?: any) =>
      frappeClient.getList<any>(dt, { fields, filters, order_by: `${fields[fields.length - 1]} asc`, limit_page_length: 0 }).catch(() => [])
    Promise.all([
      list('Designation'), list('Branch'), list('Shift Type'), list('Department', ['name'], [['is_group', '=', 0]]),
      list('Employee Group'), list('Project'), list('Employee', ['name', 'employee_name'], [['status', '=', 'Active']]), list('Country'),
    ]).then(([d, b, s, dep, g, p, e, c]) => setOpts({
      designations: d.map((x: any) => x.name), branches: b.map((x: any) => x.name), shifts: s.map((x: any) => x.name),
      departments: dep.map((x: any) => x.name), groups: g.map((x: any) => x.name), projects: p.map((x: any) => x.name),
      employees: e, countries: c.map((x: any) => x.name),
    }))
  }, [])

  const load = useCallback(async () => {
    if (!employeeId) return
    setLoading(true)
    try {
      const res: any = await frappeClient.get<F>('Employee', employeeId)
      setF(res?.data ?? {})
    } catch (e: any) {
      toast({ title: 'تعذّر تحميل الموظف', description: e?.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [employeeId, toast])
  useEffect(() => { load() }, [load])

  const save = async () => {
    for (const k of REQUIRED) {
      if (!f[k]) { toast({ title: 'حقول مطلوبة', description: 'أكمل الحقول المعلّمة بـ *', variant: 'destructive' }); return }
    }
    setSaving(true)
    try {
      const payload: F = {
        company: f.company || company || undefined,
        employee_number: f.employee_number, status: f.status, employee_name: f.employee_name, first_name: f.employee_name,
        custom_employee_name_en: f.custom_employee_name_en || '', designation: f.designation || '', custom_branch_access: f.custom_branch_access,
        branch: f.branch, default_shift: f.default_shift, department: f.department || '', custom_employee_group: f.custom_employee_group || '',
        custom_section: f.custom_section || '', reports_to: f.reports_to || '', custom_project: f.custom_project || '', custom_task: f.custom_task || '',
        custom_attendance_method: f.custom_attendance_method, custom_mobile_app: f.custom_mobile_app || 'لا',
        custom_nationality: f.custom_nationality || '', custom_national_id: f.custom_national_id || '', custom_religion: f.custom_religion || '',
        date_of_birth: f.date_of_birth || null, cell_number: f.cell_number || '', personal_email: f.personal_email || '', current_address: f.current_address || '',
        custom_ot_deduct_late: f.custom_ot_deduct_late ? 1 : 0, custom_ot_before_shift: f.custom_ot_before_shift ? 1 : 0,
        custom_ot_after_shift: f.custom_ot_after_shift ? 1 : 0, custom_ot_holidays: f.custom_ot_holidays ? 1 : 0,
        custom_checkout_without_punch: f.custom_checkout_without_punch ? 1 : 0,
      }
      if (isNew) {
        payload.gender = f.gender || 'Male'
        payload.date_of_joining = f.date_of_joining || new Date().toISOString().slice(0, 10)
        payload.date_of_birth = f.date_of_birth || '1990-01-01'
        await frappeClient.post('Employee', payload)
        toast({ title: 'تمت إضافة الموظف' })
      } else {
        await frappeClient.put('Employee', employeeId!, payload)
        toast({ title: 'تم الحفظ' })
      }
      router.push('/employees')
    } catch (e: any) {
      toast({ title: 'فشل الحفظ', description: e?.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // plain render helpers (not components) so inputs keep focus across re-renders
  const lbl = (t: string, req?: boolean) => (
    <span className="block text-[13px] text-slate-700 mb-1">{t}{req && <span className="text-red-500"> *</span>}</span>
  )
  const Txt = (k: string, label: string, req?: boolean, type = 'text') => (
    <div>{lbl(label, req)}<input type={type} value={f[k] ?? ''} onChange={set(k)} placeholder={label} className={FIELD} /></div>
  )
  const Sel = (k: string, label: string, items: (string | [string, string])[], req?: boolean) => (
    <div>
      {lbl(label, req)}
      <div className="relative">
        <select value={f[k] ?? ''} onChange={set(k)} className={cn(FIELD, 'appearance-none', !f[k] && 'text-slate-400')}>
          <option value="">{label}</option>
          {items.map((o) => Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
      </div>
    </div>
  )
  const Chk = (k: string, label: string) => (
    <label className="flex items-center gap-3 text-[15px] font-semibold text-slate-800 cursor-pointer py-1">
      <input type="checkbox" checked={!!f[k]} onChange={set(k)} className="h-[18px] w-[18px] accent-[#2960b6]" />
      {label}
    </label>
  )
  const section = (id: keyof typeof open, title: string, children: React.ReactNode) => (
    <div className="mt-8">
      <button type="button" onClick={() => setOpen((o) => ({ ...o, [id]: !o[id] }))}
        className="w-full flex items-center justify-between bg-white rounded px-4 h-[52px] shadow-sm mb-5">
        <span className="text-[18px] font-bold text-[#2960b6]">{title}</span>
        {open[id] ? <ChevronUp className="h-5 w-5 text-[#2960b6]" /> : <ChevronDown className="h-5 w-5 text-[#2960b6]" />}
      </button>
      {open[id] && children}
    </div>
  )
  const grid = 'grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 px-4'

  return (
    <div className="pb-10" dir="rtl">
      {/* action bar */}
      <div className="flex items-center justify-between px-6 h-[62px] bg-[#f4f6f9]">
        <div className="text-[14px] text-slate-700">
          <span className="text-slate-600">البيانات الاساسية</span><span className="mx-2 text-slate-400">/</span>
          <button type="button" onClick={() => router.push('/employees')} className="text-[#2960b6]">الموظفين</button><span className="mx-2 text-slate-400">/</span>
          <span>{isNew ? 'اضافة موظف' : 'تعديل موظف'}</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => router.push('/employees')} className="h-[40px] px-4 rounded bg-[#f95f5f] text-white text-[14px] flex items-center gap-1.5 hover:bg-[#e54a4a]">
            <X className="h-4 w-4" />اغلاق
          </button>
          <button type="button" onClick={save} disabled={saving || loading} className="h-[40px] px-4 rounded bg-[#2eaf7d] text-white text-[14px] flex items-center gap-1.5 hover:bg-[#279568] disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isNew ? <Plus className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {isNew ? 'اضافة' : 'حفظ'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-[#2960b6]" /></div>
      ) : (
        <div className="px-4">
          {/* avatar */}
          <div className="flex justify-center my-4">
            <div className="h-[124px] w-[124px] rounded bg-slate-200 flex items-center justify-center overflow-hidden">
              {f.image ? <img src={frappeImageUrl(f.image)} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-16 w-16 text-slate-500" />}
            </div>
          </div>

          <h2 className="text-[20px] font-bold text-slate-800 px-4 mt-10 mb-5">تعريف الموظف</h2>
          <div className={grid}>
            {Txt('employee_number', 'كود الموظف', true)}
            {Sel('status', 'حالة الموظف', STATUS as [string, string][], true)}
            {Txt('employee_name', 'اسم الموظف بالعربية', true)}
            {Txt('custom_employee_name_en', 'اسم الموظف بالانجليزية')}
            {Sel('designation', 'الوظيفة', opts.designations)}
            {Sel('custom_branch_access', 'صلاحية الموظف بالفروع', ['فرعه فقط', 'كل الفروع'], true)}
          </div>

          {section('info', 'معلومات الموظف', (
            <div className={grid}>
              {Sel('branch', 'الفروع', opts.branches, true)}
              {Sel('default_shift', 'الدوام', opts.shifts, true)}
              {Sel('department', 'الإدارة', opts.departments)}
              {Sel('custom_employee_group', 'المجموعة', opts.groups)}
              {Txt('custom_section', 'القسم')}
              {Sel('reports_to', 'المدير المباشر', opts.employees.map((e) => [e.name, e.employee_name] as [string, string]))}
              {Sel('custom_project', 'المشروع', opts.projects)}
              {Txt('custom_task', 'المهمة')}
              {Sel('custom_attendance_method', 'طريقة الحضور', ['جهاز البصمة', 'تطبيق الجوال', 'الاثنين'], true)}
              {Sel('custom_mobile_app', 'تفعيل تطبيق الجوال', ['لا', 'نعم'])}
            </div>
          ))}

          {section('personal', 'معلومات شخصية', (
            <div className={grid}>
              {Sel('custom_nationality', 'الجنسية', opts.countries)}
              {Txt('custom_national_id', 'رقم الهوية')}
              {Sel('custom_religion', 'الديانة', ['مسلم', 'غير مسلم'])}
              {Txt('date_of_birth', 'عيد الميلاد', false, 'date')}
              {Txt('cell_number', 'رقم الجوال')}
              {Txt('personal_email', 'البريد الالكترونى', false, 'email')}
              <div className="md:col-span-2">{Txt('current_address', 'العنوان')}</div>
            </div>
          ))}

          {section('ot', 'إعدادات إحتساب الإضافي', (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 px-4">
              {Chk('custom_ot_deduct_late', 'خصم التأخير من الوقت الإضافي')}
              {Chk('custom_ot_before_shift', 'حساب الوقت الإضافي قبل الدوام')}
              {Chk('custom_ot_after_shift', 'حساب الوقت الإضافي بعد الدوام')}
              {Chk('custom_ot_holidays', 'إضافة ساعات العمل أيام الأجازات')}
              {Chk('custom_checkout_without_punch', 'تسجيل خروج بدون بصمة')}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
