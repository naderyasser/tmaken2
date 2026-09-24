'use client'

/**
 * «تعديل مجموعة دوام» intervals editor (owner's spec §3, THE core new
 * screen, `/shift-management/<id>/groups/<groupId>`) — replaces the old
 * standalone rotational-shift-editor-page.tsx's shift_type-picking block
 * list. Each block's times are now typed INLINE, same table/gating as the
 * normal-shift day dialog (day-dialog.tsx) — see interval-block.tsx. Backed
 * by base_meena.api.hr_rotational_shifts.get_intervals/save_intervals; the
 * backend materialises each block's times onto a hidden internal Shift Type
 * automatically, this page never has to know about that.
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { fmtTime } from '@/lib/hr-format'
import { validateNormalDay } from '@/components/hr/shift-editor/rules'
import type { CalendarType, DayWindow } from '@/components/hr/shift-editor/types'
import { IntervalBlock } from '@/components/hr/rotational/interval-block'
import { EmployeesSection } from '@/components/hr/rotational/employees-section'
import { emptyIntervalBlock, type RotationalIntervalBlock } from '@/components/hr/rotational/types'

type Tab = CalendarType // 'Year' | 'Ramadan'

/** One backend block ({shift_type, work_days, rest_days, rows}) → our local
 *  {work_days, rest_days, slots} shape — rows[i] placed at index
 *  window_no-1 (clamped), the rest left `null`. `calendar_type`/`day` on
 *  each row are an implementation artifact (always "Year"/"Saturday") —
 *  ignored, always rewritten to that same placeholder on the way back out. */
function hydrateBlock(b: any): RotationalIntervalBlock {
  const slots: (DayWindow | null)[] = [null, null, null, null]
  for (const r of (b?.rows || [])) {
    const idx = Math.min(Math.max(Number(r.window_no) - 1, 0), 3)
    slots[idx] = {
      calendar_type: 'Year',
      day: 'Saturday',
      window_no: idx + 1,
      start_in: fmtTime(r.start_in),
      check_in: fmtTime(r.check_in),
      late_allowance_min: r.late_allowance_min ?? '',
      end_in: fmtTime(r.end_in),
      start_out: fmtTime(r.start_out),
      early_out_min: r.early_out_min ?? '',
      check_out: fmtTime(r.check_out),
      end_out: fmtTime(r.end_out),
      extended: !!r.extended,
      required_minutes: '',
      extends_next_day: false,
      day_end_time: '',
    }
  }
  return {
    work_days: b?.work_days === '' || b?.work_days == null ? '' : Number(b.work_days),
    rest_days: b?.rest_days === '' || b?.rest_days == null ? '' : Number(b.rest_days),
    slots,
  }
}

const toApiWindows = (windows: DayWindow[]) => windows.map((w) => ({
  window_no: w.window_no,
  start_in: w.start_in || null,
  check_in: w.check_in || null,
  late_allowance_min: Number(w.late_allowance_min || 0),
  end_in: w.end_in || null,
  start_out: w.start_out || null,
  early_out_min: Number(w.early_out_min || 0),
  check_out: w.check_out || null,
  end_out: w.end_out || null,
  extended: !!w.extended,
}))

/** Validates + serializes one tab's blocks. `payload` is `null` when any
 *  block failed validation (per-block message lands in `errors[i]`). */
function buildTabPayload(blocks: RotationalIntervalBlock[]): { errors: (string | null)[]; payload: any[] | null } {
  const errors: (string | null)[] = blocks.map(() => null)
  let ok = true
  const payload = blocks.map((b, i) => {
    const workDays = Number(b.work_days || 0)
    const restDays = Number(b.rest_days || 0)
    if (workDays > 0) {
      const enabled = b.slots.filter((s): s is DayWindow => !!s)
      if (enabled.length === 0) {
        errors[i] = `فترة ${i + 1}: يجب تفعيل الوردية الاولي على الأقل`
        ok = false
        return null
      }
      const windows = enabled.map((w, idx) => ({ ...w, window_no: idx + 1 }))
      const msg = validateNormalDay(windows)
      if (msg) {
        errors[i] = `فترة ${i + 1}: ${msg}`
        ok = false
        return null
      }
      return { work_days: workDays, rest_days: restDays, rows: toApiWindows(windows) }
    }
    return { work_days: workDays, rest_days: restDays, rows: [] }
  })
  return { errors, payload: ok ? payload : null }
}

export function RotationalIntervalsPage({ parentShift, groupId }: { parentShift: string; groupId: string }) {
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<Tab>('Year')
  const [groupName, setGroupName] = useState('')
  const [parentShiftName, setParentShiftName] = useState('')

  const [yearBlocks, setYearBlocks] = useState<RotationalIntervalBlock[]>([emptyIntervalBlock()])
  const [ramadanBlocks, setRamadanBlocks] = useState<RotationalIntervalBlock[]>([])
  const [yearErrors, setYearErrors] = useState<(string | null)[]>([null])
  const [ramadanErrors, setRamadanErrors] = useState<(string | null)[]>([])

  const [membersOpen, setMembersOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await frappeClient.call('base_meena.api.hr_rotational_shifts.get_intervals', { name: groupId })
      const data = res?.message ?? {}
      setGroupName(data.group_name || '')
      setParentShiftName(data.parent_shift_name || parentShift)
      const yb = (data.year_blocks || []).map(hydrateBlock)
      const rb = (data.ramadan_blocks || []).map(hydrateBlock)
      const finalYear = yb.length ? yb : [emptyIntervalBlock()]
      setYearBlocks(finalYear)
      setRamadanBlocks(rb)
      setYearErrors(finalYear.map(() => null))
      setRamadanErrors(rb.map(() => null))
    } catch (e: any) {
      toast({ title: 'تعذّر تحميل المجموعة', description: e?.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [groupId, parentShift, toast])
  useEffect(() => { load() }, [load])

  const addBlock = (which: Tab) => {
    if (which === 'Year') { setYearBlocks((p) => [...p, emptyIntervalBlock()]); setYearErrors((p) => [...p, null]) }
    else { setRamadanBlocks((p) => [...p, emptyIntervalBlock()]); setRamadanErrors((p) => [...p, null]) }
  }
  const removeLastBlock = (which: Tab) => {
    if (which === 'Year') { setYearBlocks((p) => p.slice(0, -1)); setYearErrors((p) => p.slice(0, -1)) }
    else { setRamadanBlocks((p) => p.slice(0, -1)); setRamadanErrors((p) => p.slice(0, -1)) }
  }
  const updateBlock = (which: Tab, index: number, next: RotationalIntervalBlock) => {
    if (which === 'Year') setYearBlocks((p) => p.map((b, i) => (i === index ? next : b)))
    else setRamadanBlocks((p) => p.map((b, i) => (i === index ? next : b)))
  }

  const save = async () => {
    const yearResult = buildTabPayload(yearBlocks)
    const ramadanResult = buildTabPayload(ramadanBlocks)
    setYearErrors(yearResult.errors)
    setRamadanErrors(ramadanResult.errors)
    if (!yearResult.payload || !ramadanResult.payload) {
      const currentTabOk = tab === 'Year' ? !!yearResult.payload : !!ramadanResult.payload
      toast({
        title: 'تعذّر الحفظ',
        description: currentTabOk ? 'يوجد خطأ في التبويب الآخر — راجع «أيام السنة» و«أيام رمضان»' : undefined,
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      await frappeClient.call('base_meena.api.hr_rotational_shifts.save_intervals', {
        name: groupId, year_blocks: yearResult.payload, ramadan_blocks: ramadanResult.payload,
      })
      toast({ title: 'تم الحفظ' })
      await load()
    } catch (e: any) {
      toast({ title: 'فشل الحفظ', description: e?.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const blocks = tab === 'Year' ? yearBlocks : ramadanBlocks
  const errors = tab === 'Year' ? yearErrors : ramadanErrors

  return (
    <div className="pb-10 px-4 pt-2" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        {/* breadcrumb — «البيانات الاساسية / أوقات العمل / <parent shift> / <group>» */}
        <div className="text-[14px]">
          <span className="text-slate-600">البيانات الاساسية</span>
          <span className="mx-2 text-slate-400">/</span>
          <button type="button" onClick={() => router.push('/shift-management')} className="text-[var(--apex-link)] hover:underline">
            أوقات العمل
          </button>
          <span className="mx-2 text-slate-400">/</span>
          <button
            type="button"
            onClick={() => router.push(`/shift-management/${encodeURIComponent(parentShift)}/groups`)}
            className="text-[var(--apex-link)] hover:underline"
          >
            {parentShiftName || '…'}
          </button>
          <span className="mx-2 text-slate-400">/</span>
          <span className="text-slate-800 font-bold">{groupName || '…'}</span>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving || loading}
          className="h-[40px] w-[150px] rounded bg-[var(--apex-green)] text-white text-[14px] flex items-center justify-center gap-1.5 hover:bg-[var(--apex-green-dark)] disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          حفظ
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-[var(--apex-blue)]" /></div>
      ) : (
        <>
          <div className="flex items-center justify-center border-b border-slate-200 mb-4">
            {(['Year', 'Ramadan'] as Tab[]).map((ct) => {
              const active = tab === ct
              return (
                <button
                  key={ct}
                  type="button"
                  onClick={() => setTab(ct)}
                  className="relative px-6 h-[46px] transition-colors"
                  style={{ fontSize: '19.2px', fontWeight: 400, color: active ? 'rgb(0,204,0)' : 'rgb(128,128,128)' }}
                >
                  {ct === 'Year' ? 'أيام السنة' : 'أيام رمضان'}
                  <span
                    className="absolute bottom-0 right-0 left-0 h-[2px]"
                    style={{ backgroundColor: active ? 'rgb(0,204,0)' : 'rgb(128,128,128)' }}
                  />
                </button>
              )
            })}
          </div>

          <p className="text-center text-[16px] font-bold text-slate-800 mb-6">{groupName}</p>

          <div>
            {blocks.map((b, i) => (
              <IntervalBlock
                key={i}
                block={b}
                index={i}
                errorMsg={errors[i]}
                disabled={saving}
                onChange={(next) => updateBlock(tab, i, next)}
              />
            ))}
          </div>

          <div className="flex items-center gap-3 mb-10">
            <button
              type="button"
              onClick={() => addBlock(tab)}
              disabled={saving}
              className="h-[38px] px-4 rounded text-white text-[14px] hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: 'rgb(41,96,182)' }}
            >
              إضافة مجموعة مواعيد
            </button>
            {blocks.length > 1 && (
              <button
                type="button"
                onClick={() => removeLastBlock(tab)}
                disabled={saving}
                className="h-[38px] px-4 rounded bg-[var(--apex-red)] text-white text-[14px] hover:bg-[var(--apex-red-dark)] disabled:opacity-60"
              >
                حذف مجموعة مواعيد
              </button>
            )}
          </div>

          {/* Apex has no members section on this page at all — kept only
              because the owner wants the existing employees-section.tsx code
              retained, hidden behind a collapsed-by-default disclosure. */}
          <div className="border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setMembersOpen((v) => !v)}
              className="flex items-center gap-1.5 text-[14px] font-bold text-[var(--apex-blue)] mb-3"
            >
              {membersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {membersOpen ? 'الموظفون (إخفاء)' : 'الموظفون (إظهار)'}
            </button>
            {membersOpen && <EmployeesSection groupId={groupId} />}
          </div>
        </>
      )}
    </div>
  )
}
