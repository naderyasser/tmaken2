'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
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
        open_hours: data.open_hours ?? null,
        windows: (data.windows || []).map((w: any): DayWindow => ({
          calendar_type: w.calendar_type || 'Year',
          day: w.day,
          window_no: Number(w.window_no) || 1,
          start_in: fmtTime(w.start_in),
          late_allowance_min: w.late_allowance_min ?? '',
          end_in: fmtTime(w.end_in),
          start_out: fmtTime(w.start_out),
          early_out_min: w.early_out_min ?? '',
          end_out: fmtTime(w.end_out),
          extended: !!w.extended,
        })),
      })
    } catch (e: any) {
      toast({ title: 'تعذّر تحميل الدوام', description: e?.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [shiftId, toast])
  useEffect(() => { load() }, [load])

  const toApiWindows = (windows: DayWindow[]) => windows.map((w) => ({
    window_no: w.window_no,
    start_in: w.start_in || null,
    late_allowance_min: Number(w.late_allowance_min || 0),
    end_in: w.end_in || null,
    start_out: w.start_out || null,
    early_out_min: Number(w.early_out_min || 0),
    end_out: w.end_out || null,
    extended: w.extended ? 1 : 0,
  }))

  const saveDay = async (payload: DaySavePayload) => {
    if (!editingDay) return
    setSaving(true)
    try {
      await frappeClient.call('base_meena.api.hr_shifts.save_day', {
        name: shiftId,
        calendar_type: tab,
        day: editingDay,
        weekly_off: payload.weeklyOff ? 1 : 0,
        windows: toApiWindows(payload.windows),
        open_hours: shift.kind === 'Open' ? payload.openHours : undefined,
      })
      toast({ title: 'تم الحفظ' })
      setEditingDay(null)
      await load()
    } catch (e: any) {
      // e?.message carries the backend's Arabic validation text verbatim
      // (see base_meena.api.hr_shifts._validate_windows).
      toast({ title: 'فشل الحفظ', description: e?.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const applyToAll = async (payload: DaySavePayload) => {
    if (!editingDay) return
    setSaving(true)
    try {
      await frappeClient.call('base_meena.api.hr_shifts.save_day', {
        name: shiftId,
        calendar_type: tab,
        day: editingDay,
        weekly_off: payload.weeklyOff ? 1 : 0,
        windows: toApiWindows(payload.windows),
        open_hours: shift.kind === 'Open' ? payload.openHours : undefined,
      })
      await frappeClient.call('base_meena.api.hr_shifts.apply_day_to_all', {
        name: shiftId, calendar_type: tab, day: editingDay,
      })
      toast({ title: 'تم التطبيق على كل الأيام' })
      setEditingDay(null)
      await load()
    } catch (e: any) {
      toast({ title: 'فشل الحفظ', description: e?.message, variant: 'destructive' })
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

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-[var(--apex-blue)]" /></div>
      ) : shift.kind === 'Rotational' ? (
        <div className="bg-white rounded-[15px] shadow-[0_8px_16px_rgba(0,0,0,.15)] p-10 text-center">
          <p className="text-[15px] text-slate-700 mb-4">
            هذا الدوام من نوع «ورديات متغيرة» — يُدار من صفحة دوام ورديات المصنع المتغير.
          </p>
          <Link
            href="/rotational-shifts"
            className="inline-flex items-center gap-1.5 h-[40px] px-4 rounded bg-[var(--apex-blue)] text-white text-[14px] hover:bg-[var(--apex-blue-hover)]"
          >
            <ArrowLeft className="h-4 w-4" />
            الانتقال إلى دوام ورديات المصنع المتغير
          </Link>
        </div>
      ) : (
        <>
          {shift.kind === 'Normal' && (
            <div className="flex items-center justify-center border-b border-slate-200 mb-4">
              {(['Year', 'Ramadan'] as CalendarType[]).map((ct) => (
                <button
                  key={ct}
                  type="button"
                  onClick={() => setTab(ct)}
                  className={cn(
                    'relative px-6 h-[46px] text-[15px] font-bold transition-colors',
                    tab === ct ? 'text-[var(--apex-green)]' : 'text-slate-500 hover:text-slate-700',
                  )}
                >
                  {ct === 'Year' ? 'أيام السنة' : 'أيام رمضان'}
                  {tab === ct && <span className="absolute bottom-0 right-0 left-0 h-[2px] bg-[var(--apex-green)]" />}
                </button>
              ))}
            </div>
          )}

          <DayTable
            kind={shift.kind}
            calendarType={tab}
            windows={shift.windows}
            openHours={shift.open_hours}
            onEditDay={(day) => setEditingDay(day)}
          />

          <DayDialog
            open={!!editingDay}
            onOpenChange={(o) => { if (!o) setEditingDay(null) }}
            kind={shift.kind}
            dayLabel={dayLabel}
            initialWindows={editingDay ? windowsForDay(shift.windows, tab, editingDay) : []}
            initialOpenHours={shift.open_hours}
            saving={saving}
            onSaveDay={saveDay}
            onApplyToAll={applyToAll}
          />
        </>
      )}
    </div>
  )
}
