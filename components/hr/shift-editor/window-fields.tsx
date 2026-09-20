'use client'

import { Checkbox } from '@/components/ui/checkbox'
import type { DayWindow } from './types'

const TIME_INPUT = 'h-9 w-full rounded border border-[var(--apex-border)] bg-white px-1.5 text-[12.5px] text-slate-800 outline-none focus:border-[var(--apex-blue)] disabled:bg-slate-100 disabled:text-slate-400'
const NUM_INPUT = TIME_INPUT

/**
 * One «وردية» row inside the Apex day dialog (G10) table — `<tr>` only, the
 * parent renders `<table>`/`<thead>`. Rows 2-4 carry a leading checkbox that
 * enables/disables the row (row 1 is always enabled — `onToggleEnabled`
 * omitted). Column set/order matches Apex's own field labels for the 6
 * `Shift Day Window` columns this schema actually has — see the note in
 * ./types.ts on why «حضور»/«إنصراف» aren't rendered as separate inputs.
 */
export function WindowFields({
  ordinal, value: w, enabled, onToggleEnabled, onChange, disabled,
}: {
  ordinal: string
  value: DayWindow
  enabled: boolean
  onToggleEnabled?: (next: boolean) => void
  onChange: (patch: Partial<DayWindow>) => void
  disabled?: boolean
}) {
  const rowDisabled = disabled || !enabled
  const num = (v: string) => (v === '' ? '' : Number(v))

  return (
    <tr className={rowDisabled && !disabled ? 'opacity-60' : undefined}>
      <td className="px-2 py-1.5 text-center border-b border-slate-100">
        {onToggleEnabled ? (
          <Checkbox
            checked={enabled}
            disabled={disabled}
            onCheckedChange={(v) => onToggleEnabled(!!v)}
            aria-label={`تفعيل ${ordinal}`}
          />
        ) : null}
      </td>
      <td className="px-2 py-1.5 text-[13px] font-bold text-slate-700 whitespace-nowrap border-b border-slate-100">{ordinal}</td>
      <td className="px-2 py-1.5 border-b border-slate-100">
        <input type="time" value={w.start_in} disabled={rowDisabled}
          onChange={(e) => onChange({ start_in: e.target.value })} className={TIME_INPUT} />
      </td>
      <td className="px-2 py-1.5 border-b border-slate-100">
        <input type="number" min={0} value={w.late_allowance_min} disabled={rowDisabled}
          onChange={(e) => onChange({ late_allowance_min: num(e.target.value) })} className={NUM_INPUT} />
      </td>
      <td className="px-2 py-1.5 border-b border-slate-100">
        <input type="time" value={w.end_in} disabled={rowDisabled}
          onChange={(e) => onChange({ end_in: e.target.value })} className={TIME_INPUT} />
      </td>
      <td className="px-2 py-1.5 border-b border-slate-100">
        <input type="time" value={w.start_out} disabled={rowDisabled}
          onChange={(e) => onChange({ start_out: e.target.value })} className={TIME_INPUT} />
      </td>
      <td className="px-2 py-1.5 border-b border-slate-100">
        <input type="number" min={0} value={w.early_out_min} disabled={rowDisabled}
          onChange={(e) => onChange({ early_out_min: num(e.target.value) })} className={NUM_INPUT} />
      </td>
      <td className="px-2 py-1.5 border-b border-slate-100">
        <input type="time" value={w.end_out} disabled={rowDisabled}
          onChange={(e) => onChange({ end_out: e.target.value })} className={TIME_INPUT} />
      </td>
      <td className="px-2 py-1.5 text-center border-b border-slate-100">
        <Checkbox
          checked={w.extended}
          disabled={rowDisabled}
          onCheckedChange={(v) => onChange({ extended: !!v })}
          aria-label={`${ordinal} شفت ممتد`}
        />
      </td>
    </tr>
  )
}
