'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, X } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { fmtDate } from '@/lib/hr-format'
import { BlockTable } from '@/components/hr/rotational/block-table'
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

  // Clear a block's shift_type once the current shift list confirms it no
  // longer exists (e.g. deleted/renamed since this group was last saved) —
  // rotational-gap.md item 7. Only runs once shiftTypes has actually
  // loaded (non-empty), so it never wipes a value during the brief window
  // before that fetch resolves.
  useEffect(() => {
    if (shiftTypes.length === 0) return
    setF((p) => {
      const cleaned = p.blocks.map((b) => (
        b.shift_type && !shiftTypes.includes(b.shift_type) ? { ...b, shift_type: '' } : b
      ))
      return cleaned.some((b, i) => b !== p.blocks[i]) ? { ...p, blocks: cleaned } : p
    })
  }, [shiftTypes])

  const load = useCallback(async () => {
    if (!groupId) {
      // Defensive reset — belt-and-braces against the editor ever showing a
      // previously-opened group's blocks (see rotational-gap.md's stale-data
      // bug 3c). `/new` and `/[id]` are separate route files so React
      // normally remounts this component fresh on navigation, but this
      // keeps «إضافة مجموعة دوام» correct even if that ever changes.
      setF(EMPTY_ROTATIONAL_FORM)
      setSavedId(undefined)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res: any = await frappeClient.call('base_meena.api.hr_rotational_shifts.get_group', { name: groupId })
      const data = res?.message ?? {}
      setF({
        name: data.name || undefined,
        group_name: data.group_name || '',
        start_date: data.start_date ? String(data.start_date).slice(0, 10) : '',
        cycle_days: data.cycle_days === '' || data.cycle_days == null ? '' : Number(data.cycle_days),
        days_off: data.days_off === '' || data.days_off == null ? '' : Number(data.days_off),
        blocks: (data.blocks || []).map((b: any) => ({
          shift_type: b.shift_type || '',
          work_days: b.work_days === '' || b.work_days == null ? '' : Number(b.work_days),
          rest_days: b.rest_days === '' || b.rest_days == null ? '' : Number(b.rest_days),
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

  /** Live «عدد أيام الدوام» / «عدد أيام العطلة» preview from the block list
   *  being edited — both header fields are read-only, server-computed sums
   *  (base_meena.api.hr_rotational_shifts.blocks_to_intervals is the
   *  authority on save); this just keeps the boxes in sync while typing,
   *  like Apex's own live totals. */
  const totals = useMemo(() => {
    let cycleDays = 0, daysOff = 0
    for (const b of f.blocks) {
      const work = b.work_days === '' ? 0 : Number(b.work_days)
      const rest = b.rest_days === '' ? 0 : Number(b.rest_days)
      cycleDays += work + rest
      daysOff += rest
    }
    return { cycleDays, daysOff }
  }, [f.blocks])

  const save = async () => {
    if (!f.group_name.trim()) {
      toast({ title: 'حقول مطلوبة', description: 'إسم مجموعة الدوام مطلوب', variant: 'destructive' })
      return
    }
    if (f.blocks.length === 0) {
      toast({ title: 'حقول مطلوبة', description: 'يجب إضافة فترة واحدة على الأقل', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res: any = await frappeClient.call('base_meena.api.hr_rotational_shifts.save_group', {
        name: f.name,
        group_name: f.group_name.trim(),
        start_date: f.start_date || undefined,
        blocks: f.blocks.map((b) => ({
          shift_type: b.shift_type,
          work_days: Number(b.work_days || 0),
          rest_days: Number(b.rest_days || 0),
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
      // (see base_meena.api.hr_rotational_shifts._validate_blocks).
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
              <span className="block text-[13px] text-slate-700 mb-1">عدد أيام الدوام</span>
              <div className={`${FIELD} flex items-center bg-slate-50 text-slate-500`} aria-label="عدد أيام الدوام (محسوبة تلقائياً من فترات الدورة)">
                {totals.cycleDays}
              </div>
            </div>
            <div>
              <span className="block text-[13px] text-slate-700 mb-1">عدد أيام العطلة</span>
              <div className={`${FIELD} flex items-center bg-slate-50 text-slate-500`} aria-label="عدد أيام العطلة (محسوبة تلقائياً من فترات الدورة)">
                {totals.daysOff}
              </div>
            </div>
          </div>

          <BlockTable
            blocks={f.blocks}
            shiftTypes={shiftTypes}
            onChange={(next) => setF((p) => ({ ...p, blocks: next }))}
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
