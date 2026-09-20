'use client'

import { useEffect, useState } from 'react'
import { ApexDialog } from '@/components/hr/apex/dialog'
import { WindowFields } from './window-fields'
import {
  MAX_WINDOWS, WINDOW_ORDINAL, emptyWindow,
  type DayWindow, type ShiftKind,
} from './types'

export interface DaySavePayload {
  weeklyOff: boolean
  /** Enabled rows only, window_no reassigned 1..n in row order. Empty when weeklyOff. */
  windows: DayWindow[]
  /** Only meaningful for kind === 'Open'. */
  openHours: number
}

const RADIO = 'flex items-center gap-1.5 text-[13.5px] text-slate-700 cursor-pointer'

/**
 * Apex day dialog (G10) — «السبت» / «الأحد» / … title, opened from a row's
 * pencil in the read-only day table. Two shapes depending on the shift's
 * kind:
 *   Normal — «عطله إسبوعية» radio + the 4-وردية table (rows 2-4 gated by a
 *            leading checkbox) + «تعديل» / «تطبيق علي كل الايام».
 *   Open   — a single «ساعات الدوام» number field + «تعديل» only (the value
 *            is shift-wide, so there is nothing to broadcast to other days).
 */
export function DayDialog({
  open, onOpenChange, kind, dayLabel, initialWindows, initialOpenHours, saving,
  onSaveDay, onApplyToAll,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: ShiftKind
  dayLabel: string
  initialWindows: DayWindow[]
  initialOpenHours: number | string | null
  saving: boolean
  onSaveDay: (payload: DaySavePayload) => void | Promise<void>
  onApplyToAll: (payload: DaySavePayload) => void | Promise<void>
}) {
  const [weeklyOff, setWeeklyOff] = useState(false)
  const [slots, setSlots] = useState<(DayWindow | null)[]>([null, null, null, null])
  const [openHours, setOpenHours] = useState<number | ''>('')

  useEffect(() => {
    if (!open) return
    if (kind === 'Open') {
      setOpenHours(initialOpenHours === null || initialOpenHours === undefined ? '' : Number(initialOpenHours))
      return
    }
    setWeeklyOff(initialWindows.length === 0)
    const next: (DayWindow | null)[] = [null, null, null, null]
    initialWindows.forEach((w, i) => { if (i < MAX_WINDOWS) next[i] = w })
    if (!next[0]) next[0] = emptyWindow(initialWindows[0]?.calendar_type || 'Year', initialWindows[0]?.day || '', 1)
    setSlots(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind])

  const buildPayload = (): DaySavePayload => {
    if (weeklyOff) return { weeklyOff: true, windows: [], openHours: Number(openHours || 0) }
    const enabledRows = slots.filter((s): s is DayWindow => !!s)
    const windows = enabledRows.map((w, i) => ({ ...w, window_no: i + 1 }))
    return { weeklyOff: false, windows, openHours: Number(openHours || 0) }
  }

  const setSlot = (i: number, patch: Partial<DayWindow>) => {
    setSlots((prev) => prev.map((s, idx) => (idx === i && s ? { ...s, ...patch } : s)))
  }
  const toggleSlot = (i: number, on: boolean) => {
    setSlots((prev) => prev.map((s, idx) => {
      if (idx !== i) return s
      if (on) return s || emptyWindow(prev[0]?.calendar_type || 'Year', prev[0]?.day || '', i + 1)
      return null
    }))
  }

  const openPayload = (): DaySavePayload => ({ weeklyOff: false, windows: [], openHours: Number(openHours || 0) })

  return (
    <ApexDialog
      open={open}
      onOpenChange={onOpenChange}
      title={dayLabel}
      size="lg"
      primary={{
        label: 'تعديل',
        onClick: () => onSaveDay(kind === 'Open' ? openPayload() : buildPayload()),
        disabled: saving,
        loading: saving,
      }}
      secondary={kind === 'Normal' ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => onApplyToAll(buildPayload())}
          className="h-[42px] px-4 rounded bg-[var(--apex-navy)] text-white text-[14px] font-bold disabled:opacity-60 hover:opacity-90"
        >
          تطبيق علي كل الايام
        </button>
      ) : undefined}
    >
      {kind === 'Open' ? (
        <div className="col-span-2 max-w-xs">
          <span className="block text-[13px] text-slate-700 mb-1">ساعات الدوام</span>
          <input
            type="number"
            min={0}
            step={0.25}
            value={openHours}
            onChange={(e) => setOpenHours(e.target.value === '' ? '' : Number(e.target.value))}
            className="h-[44px] w-full rounded border border-[var(--apex-border)] bg-white px-3 text-[14px] text-slate-800 outline-none focus:border-[var(--apex-blue)]"
          />
        </div>
      ) : (
        <div className="col-span-2 w-full">
          <div className="flex items-center justify-center gap-6 mb-4">
            <span className="text-[13.5px] text-slate-700">عطله إسبوعية</span>
            <label className={RADIO}>
              <input type="radio" name="weekly_off" checked={weeklyOff} onChange={() => setWeeklyOff(true)} />
              نعم
            </label>
            <label className={RADIO}>
              <input type="radio" name="weekly_off" checked={!weeklyOff} onChange={() => setWeeklyOff(false)} />
              لا
            </label>
          </div>

          {!weeklyOff && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[var(--apex-thead)]">
                    <th className="px-2 py-2 border-b border-slate-200" />
                    <th className="px-2 py-2 border-b border-slate-200 text-slate-700 font-bold whitespace-nowrap">الوردية</th>
                    <th className="px-2 py-2 border-b border-slate-200 text-slate-700 font-bold whitespace-nowrap">بداية الحضور</th>
                    <th className="px-2 py-2 border-b border-slate-200 text-slate-700 font-bold whitespace-nowrap">التأخير المسموح</th>
                    <th className="px-2 py-2 border-b border-slate-200 text-slate-700 font-bold whitespace-nowrap">نهاية الحضور</th>
                    <th className="px-2 py-2 border-b border-slate-200 text-slate-700 font-bold whitespace-nowrap">بداية الانصراف</th>
                    <th className="px-2 py-2 border-b border-slate-200 text-slate-700 font-bold whitespace-nowrap">الانصراف المبكر</th>
                    <th className="px-2 py-2 border-b border-slate-200 text-slate-700 font-bold whitespace-nowrap">نهاية الانصراف</th>
                    <th className="px-2 py-2 border-b border-slate-200 text-slate-700 font-bold whitespace-nowrap">شفت ممتد</th>
                  </tr>
                </thead>
                <tbody>
                  {WINDOW_ORDINAL.map((ordinal, i) => {
                    const slot = slots[i]
                    return (
                      <WindowFields
                        key={i}
                        ordinal={ordinal}
                        value={slot || emptyWindow('Year', '', i + 1)}
                        enabled={!!slot || i === 0}
                        onToggleEnabled={i === 0 ? undefined : (on) => toggleSlot(i, on)}
                        onChange={(patch) => setSlot(i, patch)}
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </ApexDialog>
  )
}
