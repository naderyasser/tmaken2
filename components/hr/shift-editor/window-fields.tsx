'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { DurationInput, TimeInput24 } from '@/components/hr/apex/time-input'
import type { DayWindow } from './types'

const TD = 'border border-[#0056b3] px-2 py-2 text-center align-middle'

/**
 * One «وردية» row inside the Apex day dialog's 11-column table — `<tr>`
 * only, the parent renders `<table>`/`<thead>`. Row 1 is always enabled (no
 * leading checkbox — `onToggleEnabled` omitted); rows 2-4 carry one that
 * enables/disables the row, gated by the previous row (day-dialog.tsx owns
 * that D7 gating, this component only renders what it's told).
 */
export function WindowFields({
  ordinal, value: w, enabled, canEnable, isLastEnabled, onToggleEnabled, onChange, disabled,
}: {
  ordinal: string
  value: DayWindow
  enabled: boolean
  /** Only meaningful when `onToggleEnabled` is set: may this row be turned ON? */
  canEnable?: boolean
  /** May THIS row's «شفت ممتد» be ticked (it's the last enabled row)? */
  isLastEnabled: boolean
  onToggleEnabled?: (next: boolean) => void
  onChange: (patch: Partial<DayWindow>) => void
  disabled?: boolean
}) {
  const rowDisabled = !!disabled || !enabled
  const toggleDisabled = !!disabled || (!enabled && !canEnable)

  return (
    <tr className="hover:bg-[#f5f5f5]">
      <td className={TD} style={{ width: '2%' }}>
        {onToggleEnabled ? (
          <Checkbox
            checked={enabled}
            disabled={toggleDisabled}
            onCheckedChange={(v) => onToggleEnabled(!!v)}
            aria-label={`تفعيل ${ordinal}`}
          />
        ) : null}
      </td>
      <td className={`${TD} font-bold whitespace-nowrap`} style={{ width: '7%' }}>{ordinal}</td>
      <td className={TD}>
        <TimeInput24 value={w.start_in} disabled={rowDisabled} ariaLabel={`بداية الحضور ${ordinal}`}
          onChange={(v) => onChange({ start_in: v })} />
      </td>
      <td className={TD}>
        <TimeInput24 value={w.check_in} disabled={rowDisabled} ariaLabel={`حضور ${ordinal}`}
          onChange={(v) => onChange({ check_in: v })} />
      </td>
      <td className={TD}>
        <DurationInput value={w.late_allowance_min} disabled={rowDisabled} ariaLabel={`التأخير المسموح ${ordinal}`}
          onChange={(v) => onChange({ late_allowance_min: v })} />
      </td>
      <td className={TD}>
        <TimeInput24 value={w.end_in} disabled={rowDisabled} ariaLabel={`نهاية الحضور ${ordinal}`}
          onChange={(v) => onChange({ end_in: v })} />
      </td>
      <td className={TD}>
        <TimeInput24 value={w.start_out} disabled={rowDisabled} ariaLabel={`بداية الانصراف ${ordinal}`}
          onChange={(v) => onChange({ start_out: v })} />
      </td>
      <td className={TD}>
        <DurationInput value={w.early_out_min} disabled={rowDisabled} ariaLabel={`الانصراف المبكر ${ordinal}`}
          onChange={(v) => onChange({ early_out_min: v })} />
      </td>
      <td className={TD}>
        <TimeInput24 value={w.check_out} disabled={rowDisabled} ariaLabel={`إنصراف ${ordinal}`}
          onChange={(v) => onChange({ check_out: v })} />
      </td>
      <td className={TD}>
        <TimeInput24 value={w.end_out} disabled={rowDisabled} ariaLabel={`نهاية الانصراف ${ordinal}`}
          onChange={(v) => onChange({ end_out: v })} />
      </td>
      <td className={TD}>
        <Checkbox
          checked={w.extended}
          disabled={rowDisabled || !isLastEnabled}
          onCheckedChange={(v) => onChange({ extended: !!v })}
          aria-label={`${ordinal} شفت ممتد`}
        />
      </td>
    </tr>
  )
}
