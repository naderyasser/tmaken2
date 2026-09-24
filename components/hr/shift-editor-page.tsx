'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { fmtTime } from '@/lib/hr-format'
import { DayTable } from '@/components/hr/shift-editor/day-table'
import { DayDialog, type DaySavePayload } from '@/components/hr/shift-editor/day-dialog'
import { DAYS, EMPTY_SHIFT_DATA, windowsForDay, type CalendarType, type DayWindow, type ShiftData } from '@/components/hr/shift-editor/types'

/**
 * Apex shift editor (`hr/shiftslist/:ShiftType/:shiftId` in the reference) —
 * a read-only 7-row day table (DayTable) + a per-day dialog (DayDialog) for
 * edits, backed by base_meena.api.hr_shifts (get_shift / save_day /
 * apply_day_to_all). Name/kind are no longer edited here — that moved to
 * the small list-page dialog (see shift-list-page.tsx, save_shift_meta).
 */
export function ShiftEditorPage({ shiftId }: { shiftId: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const [shift, setShift] = useState<ShiftData>(EMPTY_SHIFT_DATA)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<CalendarType>('Year')
  const [editingDay, setEditingDay] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await frappeClient.call('base_meena.api.hr_shifts.get_shift', { name: shiftId })
      const data = res?.message ?? {}
      setShift({
        name: data.name ?? null,
        arabic_name: data.arabic_name || '',
        latin_name: data.latin_name || '',
        kind: data.kind || 'Normal',
        windows: (data.windows || []).map((w: any): DayWindow => ({
          calendar_type: w.calendar_type || 'Year',
          day: w.day,
          window_no: Number(w.window_no) || 1,
          start_in: fmtTime(w.start_in),
          check_in: fmtTime(w.check_in),
          late_allowance_min: w.late_allowance_min ?? '',
          end_in: fmtTime(w.end_in),
          start_out: fmtTime(w.start_out),
          early_out_min: w.early_out_min ?? '',
          check_out: fmtTime(w.check_out),
          end_out: fmtTime(w.end_out),
          extended: !!w.extended,
          required_minutes: w.required_minutes ?? '',
          extends_next_day: !!w.extends_next_day,
          day_end_time: fmtTime(w.day_end_time),
        })),
      })
    } catch (e: any) {
      toast({ title: 'تعذّر تحميل الدوام', description: e?.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [shiftId, toast])
  useEffect(() => { load() }, [load])

  // A Rotational shift has no day-by-day editor of its own anymore — it
  // lives inside its groups list now (owner's spec §1). Redirect the instant
  // we know the kind, so clicking a Rotational shift's name in the list
  // feels like it opens straight into its groups, not a dead-end page.
  useEffect(() => {
    if (!loading && shift.kind === 'Rotational') {
      router.replace(`/shift-management/${encodeURIComponent(shiftId)}/groups`)
    }
  }, [loading, shift.kind, shiftId, router])

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

  // save_day itself — shared by "تعديل" and the first half of "تطبيق علي كل
  // الايام". Deliberately doesn't catch: DayDialog's own handler awaits this
  // and routes a rejection's `.message` into its in-dialog alert instead of
  // a toast (backend validation errors must land there, not as a toast).
  const callSaveDay = (payload: DaySavePayload) => frappeClient.call('base_meena.api.hr_shifts.save_day', {
    name: shiftId,
    calendar_type: tab,
    day: editingDay,
    weekly_off: payload.weeklyOff ? 1 : 0,
    windows: shift.kind === 'Normal' && !payload.weeklyOff ? toApiWindows(payload.windows) : undefined,
    open_day: shift.kind === 'Open' && !payload.weeklyOff ? payload.openDay : undefined,
  })

  const saveDay = async (payload: DaySavePayload) => {
    if (!editingDay) return
    setSaving(true)
    try {
      await callSaveDay(payload)
      toast({ title: 'تم الحفظ' })
      setEditingDay(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const applyToAll = async (payload: DaySavePayload) => {
    if (!editingDay) return
    setSaving(true)
    try {
      await callSaveDay(payload)
      await frappeClient.call('base_meena.api.hr_shifts.apply_day_to_all', {
        name: shiftId, calendar_type: tab, day: editingDay,
      })
      toast({ title: 'تم التطبيق على كل الأيام' })
      setEditingDay(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const dayLabel = DAYS.find((d) => d.value === editingDay)?.label || ''

  return (
    <div className="pb-10 px-4 pt-2" dir="rtl">
      {/* breadcrumb — Apex S9: «البيانات الاساسية / أوقات العمل / <shift name>» */}
      <div className="text-[14px] mb-4">
        <span className="text-slate-600">البيانات الاساسية</span>
        <span className="mx-2 text-slate-400">/</span>
        <button type="button" onClick={() => router.push('/shift-management')} className="text-[var(--apex-link)] hover:underline">
          أوقات العمل
        </button>
        <span className="mx-2 text-slate-400">/</span>
        <span className="text-slate-800 font-bold">{shift.arabic_name || '…'}</span>
      </div>

      {loading || shift.kind === 'Rotational' ? (
        <div className="py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-[var(--apex-blue)]" /></div>
      ) : (
        <>
          <div className="flex items-center justify-center border-b border-slate-200 mb-4">
            {(['Year', 'Ramadan'] as CalendarType[]).map((ct) => {
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

          <DayTable
            kind={shift.kind}
            calendarType={tab}
            windows={shift.windows}
            onEditDay={(day) => setEditingDay(day)}
          />

          <DayDialog
            open={!!editingDay}
            onOpenChange={(o) => { if (!o) setEditingDay(null) }}
            kind={shift.kind}
            calendarType={tab}
            day={editingDay || ''}
            dayLabel={dayLabel}
            initialWindows={editingDay ? windowsForDay(shift.windows, tab, editingDay) : []}
            saving={saving}
            onSaveDay={saveDay}
            onApplyToAll={applyToAll}
          />
        </>
      )}
    </div>
  )
}
