'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, X } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { fmtDate } from '@/lib/hr-format'
import { IntervalTable } from '@/components/hr/rotational/interval-table'
import { EmployeesSection } from '@/components/hr/rotational/employees-section'
import { EMPTY_ROTATIONAL_FORM, type RotationalGroupForm } from '@/components/hr/rotational/types'

const FIELD = 'w-full h-[44px] rounded border border-[var(--apex-border)] bg-white px-3 text-[14px] text-slate-800 outline-none focus:border-[var(--apex-blue)] placeholder:text-slate-400'

/**
 * «إضافة/تعديل مجموعة دوام» — Apex rotational shift group editor
 * (`hr/RotationalShifts/:shiftName/intervals/:groupId` in the reference).
 * Backed by base_meena.api.hr_rotational_shifts (Shift Schedule + the
 * Rotational Shift Interval child table + Shift Schedule Assignment for
 * membership). Same action-bar / field look as shift-editor-page.tsx;
 * colours only via --apex-* variables. See apex-gap-analysis.md §1 M2.
 */
export function RotationalShiftEditorPage({ groupId }: { groupId?: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const isNew = !groupId
  const [f, setF] = useState<RotationalGroupForm>(EMPTY_ROTATIONAL_FORM)
  const [savedId, setSavedId] = useState<string | undefined>(groupId)
  const [shiftTypes, setShiftTypes] = useState<string[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    frappeClient.getList<any>('Shift Type', { fields: ['name'], order_by: 'name asc', limit_page_length: 0 })
      .then((rows) => setShiftTypes(rows.map((r) => r.name)))
      .catch(() => setShiftTypes([]))
  }, [])

  const load = useCallback(async () => {
    if (!groupId) return
    setLoading(true)
    try {
      const res: any = await frappeClient.call('base_meena.api.hr_rotational_shifts.get_group', { name: groupId })
      const data = res?.message ?? {}
      setF({
        name: data.name || undefined,
        group_name: data.group_name || '',
        start_date: data.start_date ? String(data.start_date).slice(0, 10) : '',
        cycle_days: data.cycle_days === '' || data.cycle_days == null ? '' : Number(data.cycle_days),
        intervals: (data.intervals || []).map((iv: any) => ({
          day_from: iv.day_from ?? '',
          day_to: iv.day_to ?? '',
          shift_type: iv.shift_type || '',
          is_off: !!iv.is_off,
        })),
      })
      setSavedId(data.name || groupId)
    } catch (e: any) {
      toast({ title: 'تعذّر تحميل الدوام', description: e?.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [groupId, toast])
  useEffect(() => { load() }, [load])

  /** Live «عدد أيام العطلة» preview — the authoritative value is
   *  recomputed server-side on save from the same intervals. */
  const daysOffPreview = useMemo(
    () => f.intervals.reduce((sum, r) => {
      if (!r.is_off || r.day_from === '' || r.day_to === '') return sum
      const span = Number(r.day_to) - Number(r.day_from) + 1
      return span > 0 ? sum + span : sum
    }, 0),
    [f.intervals],
  )

  const save = async () => {
    if (!f.group_name.trim()) {
      toast({ title: 'حقول مطلوبة', description: 'إسم مجموعة الدوام مطلوب', variant: 'destructive' })
      return
    }
    if (!f.cycle_days || Number(f.cycle_days) < 1) {
      toast({ title: 'حقول مطلوبة', description: 'عدد أيام الدوام مطلوب', variant: 'destructive' })
      return
    }
    if (f.intervals.length === 0) {
      toast({ title: 'حقول مطلوبة', description: 'يجب تغطية كل أيام الدورة', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res: any = await frappeClient.call('base_meena.api.hr_rotational_shifts.save_group', {
        name: f.name,
        group_name: f.group_name.trim(),
        start_date: f.start_date || undefined,
        cycle_days: Number(f.cycle_days),
        intervals: f.intervals.map((r) => ({
          day_from: Number(r.day_from || 0),
          day_to: Number(r.day_to || 0),
          shift_type: r.is_off ? '' : r.shift_type,
          is_off: r.is_off ? 1 : 0,
        })),
      })
      const newName = res?.message?.name
      toast({ title: 'تم الحفظ' })
      if (isNew && newName) {
        setSavedId(newName)
        setF((p) => ({ ...p, name: newName }))
        router.replace(`/rotational-shifts/${encodeURIComponent(newName)}`)
      } else {
        await load()
      }
    } catch (e: any) {
      // e?.message carries the backend's Arabic validation text verbatim
      // (see base_meena.api.hr_rotational_shifts._validate_intervals).
      toast({ title: 'فشل الحفظ', description: e?.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pb-10" dir="rtl">
      {/* action bar — same layout/classes as shift-editor-page.tsx */}
      <div className="flex items-center justify-between px-6 h-[62px] bg-[var(--apex-form-bar-bg)]">
        <div className="text-[14px] text-slate-700">
          <span className="text-slate-600">البيانات الاساسية</span><span className="mx-2 text-slate-400">/</span>
          <button type="button" onClick={() => router.push('/rotational-shifts')} className="text-[var(--apex-blue)]">الدوام المتغير</button><span className="mx-2 text-slate-400">/</span>
          <span>{isNew ? 'إضافة مجموعة دوام' : 'تعديل مجموعة دوام'}</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => router.push('/rotational-shifts')} className="h-[40px] px-4 rounded bg-[var(--apex-red)] text-white text-[14px] flex items-center gap-1.5 hover:bg-[var(--apex-red-dark)]">
            <X className="h-4 w-4" />اغلاق
          </button>
          <button type="button" onClick={save} disabled={saving || loading} className="h-[40px] px-4 rounded bg-[var(--apex-green)] text-white text-[14px] flex items-center gap-1.5 hover:bg-[var(--apex-green-dark)] disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            حفظ
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-[var(--apex-blue)]" /></div>
      ) : (
        <div className="px-4 mt-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            <div>
              <span className="block text-[13px] text-slate-700 mb-1">إسم مجموعة الدوام<span className="text-red-500"> *</span></span>
              <input
                value={f.group_name}
                onChange={(e) => setF((p) => ({ ...p, group_name: e.target.value }))}
                placeholder="إسم مجموعة الدوام"
                aria-label="إسم مجموعة الدوام"
                className={FIELD}
              />
            </div>
            <div>
              <span className="block text-[13px] text-slate-700 mb-1">تاريخ بدء العمل بالدوام</span>
              <input
                type="date"
                value={f.start_date}
                onChange={(e) => setF((p) => ({ ...p, start_date: e.target.value }))}
                aria-label="تاريخ بدء العمل بالدوام"
                className={FIELD}
              />
            </div>
            <div>
              <span className="block text-[13px] text-slate-700 mb-1">عدد أيام الدوام<span className="text-red-500"> *</span></span>
              <input
                type="number"
                min={1}
                value={f.cycle_days}
                onChange={(e) => setF((p) => ({ ...p, cycle_days: e.target.value === '' ? '' : Number(e.target.value) }))}
                placeholder="عدد أيام الدوام"
                aria-label="عدد أيام الدوام"
                className={FIELD}
              />
            </div>
            <div>
              <span className="block text-[13px] text-slate-700 mb-1">عدد أيام العطلة</span>
              <div className={`${FIELD} flex items-center bg-slate-50 text-slate-500`} aria-label="عدد أيام العطلة (محسوبة تلقائياً)">
                {daysOffPreview}
              </div>
            </div>
          </div>

          <IntervalTable
            intervals={f.intervals}
            shiftTypes={shiftTypes}
            onChange={(next) => setF((p) => ({ ...p, intervals: next }))}
          />

          <EmployeesSection groupId={savedId} />

          {!isNew && f.start_date && (
            <p className="text-[12px] text-slate-400">تاريخ بدء الدورة: {fmtDate(f.start_date)}</p>
          )}
        </div>
      )}
    </div>
  )
}
