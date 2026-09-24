'use client'

import { WindowFields } from '@/components/hr/shift-editor/window-fields'
import { MAX_WINDOWS, WINDOW_ORDINAL, emptyWindow, type DayWindow } from '@/components/hr/shift-editor/types'
import type { RotationalIntervalBlock } from './types'

/** Same colors as day-dialog.tsx's own Normal-kind table (already
 *  pixel-verified against Apex) — rgb(33,37,41)/rgb(242,242,242)/
 *  rgb(0,86,179) and #0056b3/#f2f2f2/rgba(0,0,0,.87) are the same colors,
 *  just written differently; reused as-is per the owner's spec §3. */
const TH = 'border border-[#0056b3] bg-[#f2f2f2] px-2 py-2 text-center font-bold text-[14px] whitespace-nowrap'
const TH_STYLE = { color: 'rgba(0,0,0,.87)' }
const NUM_INPUT = 'h-9 w-24 rounded border border-[var(--apex-border)] bg-white px-2 text-center text-[14px] text-slate-800 outline-none focus:border-[var(--apex-blue)] disabled:bg-slate-100 disabled:text-slate-400'

/**
 * One «فترة» block's UI on the intervals page (owner's spec §3) — work/rest
 * day-count inputs + the exact 11-column «وردية» table copied from
 * day-dialog.tsx's Normal body, generalized to operate on `block.slots` via
 * `onChange` instead of a dialog's local `useState`. The D7 gating rules
 * (row 1 always on/un-checkboxed, rows 2-4 need their previous row
 * enabled-and-not-extended, «شفت ممتد» only on the last enabled row) are the
 * same as day-dialog.tsx's canEnableRow/isLastEnabledRow/toggleSlot/setSlot,
 * just re-homed per-block here.
 */
export function IntervalBlock({
  block, index, onChange, errorMsg, disabled,
}: {
  block: RotationalIntervalBlock
  index: number
  onChange: (next: RotationalIntervalBlock) => void
  errorMsg?: string | null
  disabled?: boolean
}) {
  const slots = block.slots

  const canEnableRow = (i: number): boolean => {
    if (i === 0) return true
    const prev = slots[i - 1]
    return !!prev && !prev.extended
  }
  const isLastEnabledRow = (i: number): boolean => !!slots[i] && (i === MAX_WINDOWS - 1 || !slots[i + 1])

  const setSlot = (i: number, patch: Partial<DayWindow>) => {
    onChange({ ...block, slots: slots.map((s, idx) => (idx === i && s ? { ...s, ...patch } : s)) })
  }
  const toggleSlot = (i: number, on: boolean) => {
    if (!on) {
      onChange({ ...block, slots: slots.map((s, idx) => (idx >= i ? null : s)) })
      return
    }
    if (i > 0 && (!slots[i - 1] || slots[i - 1]!.extended)) return
    const next = [...slots]
    next[i] = emptyWindow('Year', 'Saturday', i + 1)
    onChange({ ...block, slots: next })
  }

  return (
    <div className="mb-6 rounded border border-slate-200 bg-white p-4">
      {errorMsg && (
        <div
          role="alert"
          className="mb-3 px-3 py-2 text-[13.5px]"
          style={{ background: '#f8d7da', color: '#721c24', border: '1px solid #f5c6cb', borderRadius: 4 }}
        >
          {errorMsg}
        </div>
      )}

      <div className="flex items-center justify-between gap-4 mb-3 flex-wrap" dir="rtl">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-slate-700">عدد أيام الدوام</span>
          <input
            type="number"
            min={0}
            step={1}
            value={block.work_days}
            disabled={disabled}
            onChange={(e) => onChange({ ...block, work_days: e.target.value === '' ? '' : Math.max(0, Math.trunc(Number(e.target.value))) })}
            aria-label={`عدد أيام الدوام — فترة ${index + 1}`}
            className={NUM_INPUT}
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            step={1}
            value={block.rest_days}
            disabled={disabled}
            onChange={(e) => onChange({ ...block, rest_days: e.target.value === '' ? '' : Math.max(0, Math.trunc(Number(e.target.value))) })}
            aria-label={`عدد أيام العطله — فترة ${index + 1}`}
            className={NUM_INPUT}
          />
          {/* Apex's own transcribed spelling for THIS label only — everywhere
              else in the app uses «العطلة» (owner's spec §3, verbatim). */}
          <span className="text-[13px] font-bold text-slate-700">عدد أيام العطله</span>
        </div>
      </div>

      <div className="overflow-x-auto text-center" style={{ maxWidth: '100%' }}>
        <table className="inline-table border-collapse text-[13px]" style={{ margin: '0 2rem', width: 'auto' }}>
          <thead>
            <tr>
              <th className={TH} style={{ width: '2%', ...TH_STYLE }} />
              <th className={TH} style={{ width: '7%', ...TH_STYLE }}>الوردية</th>
              <th className={TH} style={TH_STYLE}>بداية الحضور</th>
              <th className={TH} style={TH_STYLE}>حضور</th>
              <th className={TH} style={TH_STYLE}>التأخير المسموح</th>
              <th className={TH} style={TH_STYLE}>نهاية الحضور</th>
              <th className={TH} style={TH_STYLE}>بداية الانصراف</th>
              <th className={TH} style={TH_STYLE}>الانصراف المبكر</th>
              <th className={TH} style={TH_STYLE}>إنصراف</th>
              <th className={TH} style={TH_STYLE}>نهاية الانصراف</th>
              <th className={TH} style={TH_STYLE}>شفت ممتد</th>
            </tr>
          </thead>
          <tbody>
            {WINDOW_ORDINAL.map((ordinal, i) => (
              <WindowFields
                key={i}
                ordinal={ordinal}
                value={slots[i] || emptyWindow('Year', 'Saturday', i + 1)}
                enabled={!!slots[i] || i === 0}
                canEnable={canEnableRow(i)}
                isLastEnabled={isLastEnabledRow(i)}
                onToggleEnabled={i === 0 ? undefined : (on) => toggleSlot(i, on)}
                onChange={(patch) => setSlot(i, patch)}
                disabled={disabled}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
