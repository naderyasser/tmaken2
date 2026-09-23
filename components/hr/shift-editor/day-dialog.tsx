'use client'

import { useEffect, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { DurationInput, TimeInput24 } from '@/components/hr/apex/time-input'
import { WindowFields } from './window-fields'
import { validateNormalDay, validateOpenDay } from './rules'
import {
  MAX_WINDOWS, WINDOW_ORDINAL, emptyWindow,
  type CalendarType, type DayWindow, type ShiftKind,
} from './types'

export interface DaySavePayload {
  weeklyOff: boolean
  /** Enabled rows only, window_no reassigned 1..n in row order. Normal only. */
  windows: DayWindow[]
  /** Open only, and only when !weeklyOff. */
  openDay: { required_minutes: number; extends_next_day: boolean; day_end_time: string | null } | null
}

const TH = 'border border-[#0056b3] bg-[#f2f2f2] px-2 py-2 text-center font-bold text-[14px] text-slate-700 whitespace-nowrap'
const RADIO = 'flex items-center gap-1.5 text-[14.4px] font-bold text-slate-700 cursor-pointer'

/**
 * Apex day dialog (G10) — opened from a row's pencil in the read-only day
 * table. «السبت» / «الأحد» / … title, no ✕ (Esc / backdrop close it). Built
 * directly on @radix-ui/react-dialog — ApexDialog's own frame (fixed 960/480
 * width, ✕ at the corner, one primary button) doesn't fit this dialog's
 * size/footer, so this keeps only ApexDialog's overlay.
 *
 * Two bodies depending on the shift's kind (Rotational never reaches this —
 * it keeps its own link-out page):
 *   Normal — the 4-وردية / 11-column table (rows 2-4 gated by D7's
 *            previous-row-enabled-and-not-extended rule).
 *   Open   — required hours + «يمتد لليوم التالي» (+ «وقت انتهاء اليوم» once ticked).
 * Both share the «عطله إسبوعية» row above the body and both buttons below it.
 */
export function DayDialog({
  open, onOpenChange, kind, calendarType, day, dayLabel, initialWindows, saving,
  onSaveDay, onApplyToAll,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: ShiftKind
  calendarType: CalendarType
  day: string
  dayLabel: string
  initialWindows: DayWindow[]
  saving: boolean
  onSaveDay: (payload: DaySavePayload) => void | Promise<void>
  onApplyToAll: (payload: DaySavePayload) => void | Promise<void>
}) {
  const [weeklyOff, setWeeklyOff] = useState(false)
  const [slots, setSlots] = useState<(DayWindow | null)[]>([null, null, null, null])
  const [openRow, setOpenRow] = useState<DayWindow>(() => emptyWindow(calendarType, day, 1))
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setErrorMsg(null)
    setWeeklyOff(initialWindows.length === 0)
    if (kind === 'Open') {
      setOpenRow(initialWindows[0] ? { ...initialWindows[0] } : emptyWindow(calendarType, day, 1))
      return
    }
    const next: (DayWindow | null)[] = [null, null, null, null]
    initialWindows.forEach((w, i) => { if (i < MAX_WINDOWS) next[i] = w })
    if (!next[0]) next[0] = emptyWindow(calendarType, day, 1)
    setSlots(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind, day, calendarType])

  useEffect(() => {
    if (!errorMsg) return
    const t = setTimeout(() => setErrorMsg(null), 3000)
    return () => clearTimeout(t)
  }, [errorMsg])

  const allDisabled = saving || weeklyOff

  const canEnableRow = (i: number): boolean => {
    if (i === 0) return true
    const prev = slots[i - 1]
    return !!prev && !prev.extended
  }
  const isLastEnabledRow = (i: number): boolean => !!slots[i] && (i === MAX_WINDOWS - 1 || !slots[i + 1])

  const setSlot = (i: number, patch: Partial<DayWindow>) => {
    setSlots((prev) => prev.map((s, idx) => (idx === i && s ? { ...s, ...patch } : s)))
  }
  const toggleSlot = (i: number, on: boolean) => {
    setSlots((prev) => {
      if (!on) return prev.map((s, idx) => (idx >= i ? null : s))
      if (i > 0 && (!prev[i - 1] || prev[i - 1]!.extended)) return prev
      const next = [...prev]
      next[i] = emptyWindow(calendarType, day, i + 1)
      return next
    })
  }

  const guardedRun = async (fn: () => void | Promise<void>) => {
    try {
      await fn()
    } catch (e: any) {
      setErrorMsg(e?.message || 'حدث خطأ غير متوقع')
    }
  }

  const runAction = (action: (payload: DaySavePayload) => void | Promise<void>) => {
    setErrorMsg(null)
    if (weeklyOff) {
      void guardedRun(() => action({ weeklyOff: true, windows: [], openDay: null }))
      return
    }
    if (kind === 'Open') {
      const msg = validateOpenDay({
        required_minutes: openRow.required_minutes,
        extends_next_day: openRow.extends_next_day,
        day_end_time: openRow.day_end_time,
      })
      if (msg) { setErrorMsg(msg); return }
      const openDay = {
        required_minutes: Number(openRow.required_minutes || 0),
        extends_next_day: openRow.extends_next_day,
        day_end_time: openRow.extends_next_day ? (openRow.day_end_time || null) : null,
      }
      void guardedRun(() => action({ weeklyOff: false, windows: [], openDay }))
      return
    }
    const windows = slots.filter((s): s is DayWindow => !!s).map((w, i) => ({ ...w, window_no: i + 1 }))
    const msg = validateNormalDay(windows)
    if (msg) { setErrorMsg(msg); return }
    void guardedRun(() => action({ weeklyOff: false, windows, openDay: null }))
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          dir="rtl"
          className={cn(
            'theme-hr fixed left-1/2 top-1/2 z-50 min-w-[310px] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 max-h-[90vh] overflow-y-auto bg-white text-[var(--apex-text)] shadow-lg outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            kind === 'Open' ? 'max-w-[40vw]' : 'max-w-[80vw]',
          )}
          style={{ borderRadius: 10 }}
        >
          <div className="px-6 pb-6">
            {errorMsg && (
              <div
                role="alert"
                className="mt-4 px-3 py-2 text-[13.5px]"
                style={{ background: '#f8d7da', color: '#721c24', border: '1px solid #f5c6cb', borderRadius: 4 }}
              >
                {errorMsg}
              </div>
            )}

            <DialogPrimitive.Title className="mt-4 text-center text-[20px] leading-8 font-bold text-[var(--apex-text)]">
              {dayLabel}
            </DialogPrimitive.Title>

            <div className="my-4 flex items-center justify-center gap-[4%]">
              <span className="text-[16px] font-bold text-slate-700">عطله إسبوعية</span>
              <label className={RADIO}>
                <input type="radio" name={`weekly_off_${day}`} checked={weeklyOff} disabled={saving} onChange={() => setWeeklyOff(true)} />
                نعم
              </label>
              <label className={RADIO}>
                <input type="radio" name={`weekly_off_${day}`} checked={!weeklyOff} disabled={saving} onChange={() => setWeeklyOff(false)} />
                لا
              </label>
            </div>

            {kind === 'Open' ? (
              <>
                <div className="my-4 flex flex-wrap items-center justify-center gap-[8%]">
                  <label className="flex items-center gap-2 text-[14.4px] font-bold text-slate-700">
                    <DurationInput
                      value={openRow.required_minutes}
                      disabled={allDisabled}
                      ariaLabel="ساعات العمل"
                      onChange={(v) => setOpenRow((r) => ({ ...r, required_minutes: v }))}
                    />
                    الساعات
                  </label>
                  <label className="flex w-[30%] items-center justify-center gap-[24%] text-[16px] font-bold text-slate-700 cursor-pointer">
                    يمتد لليوم التالي
                    <Checkbox
                      checked={openRow.extends_next_day}
                      disabled={allDisabled}
                      onCheckedChange={(v) => setOpenRow((r) => ({ ...r, extends_next_day: !!v }))}
                      aria-label="يمتد لليوم التالي"
                    />
                  </label>
                </div>
                {openRow.extends_next_day && (
                  <div className="mb-4 flex items-center justify-center">
                    <label className="flex items-center gap-2 text-[14.4px] font-bold text-slate-700">
                      <TimeInput24
                        value={openRow.day_end_time}
                        disabled={allDisabled}
                        ariaLabel="وقت انتهاء اليوم"
                        onChange={(v) => setOpenRow((r) => ({ ...r, day_end_time: v }))}
                      />
                      وقت انتهاء اليوم
                    </label>
                  </div>
                )}
              </>
            ) : (
              <div className="overflow-x-auto text-center" style={{ maxWidth: '100%' }}>
                <table className="inline-table border-collapse text-[13px]" style={{ margin: '0 2rem', width: 'auto' }}>
                  <thead>
                    <tr>
                      <th className={TH} style={{ width: '2%' }} />
                      <th className={TH} style={{ width: '7%' }}>الوردية</th>
                      <th className={TH}>بداية الحضور</th>
                      <th className={TH}>حضور</th>
                      <th className={TH}>التأخير المسموح</th>
                      <th className={TH}>نهاية الحضور</th>
                      <th className={TH}>بداية الانصراف</th>
                      <th className={TH}>الانصراف المبكر</th>
                      <th className={TH}>إنصراف</th>
                      <th className={TH}>نهاية الانصراف</th>
                      <th className={TH}>شفت ممتد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {WINDOW_ORDINAL.map((ordinal, i) => (
                      <WindowFields
                        key={i}
                        ordinal={ordinal}
                        value={slots[i] || emptyWindow(calendarType, day, i + 1)}
                        enabled={!!slots[i] || i === 0}
                        canEnable={canEnableRow(i)}
                        isLastEnabled={isLastEnabledRow(i)}
                        onToggleEnabled={i === 0 ? undefined : (on) => toggleSlot(i, on)}
                        onChange={(patch) => setSlot(i, patch)}
                        disabled={allDisabled}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-end gap-[3%] p-8" dir="rtl">
              <button
                type="button"
                disabled={saving}
                onClick={() => runAction(onApplyToAll)}
                style={{ padding: '6px 12px', borderRadius: 4 }}
                className="text-[16px] text-white bg-[var(--apex-navy)] hover:opacity-90 disabled:opacity-60"
              >
                تطبيق علي كل الايام
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => runAction(onSaveDay)}
                style={{ padding: '6px 12px', borderRadius: 4 }}
                className="flex items-center gap-2 text-[16px] text-white bg-[var(--apex-green)] hover:opacity-90 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                تعديل
              </button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
