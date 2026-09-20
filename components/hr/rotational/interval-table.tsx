'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { emptyInterval, type RotationalInterval } from './types'

const INPUT = 'h-9 w-full rounded border border-[var(--apex-border)] bg-white px-2 text-[13px] text-slate-800 outline-none focus:border-[var(--apex-blue)]'
const SELECT = `${INPUT} appearance-none`

/**
 * «من يوم / إلى يوم / الوردية / راحة» — the rotation cycle's day-range
 * intervals. Coverage/overlap validation is enforced server-side on save
 * (base_meena.api.hr_rotational_shifts._validate_intervals); this table just
 * lets the rows be edited/added/removed freely.
 */
export function IntervalTable({
  intervals, shiftTypes, onChange,
}: {
  intervals: RotationalInterval[]
  shiftTypes: string[]
  onChange: (next: RotationalInterval[]) => void
}) {
  const update = (i: number, patch: Partial<RotationalInterval>) => {
    onChange(intervals.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }
  const remove = (i: number) => onChange(intervals.filter((_, idx) => idx !== i))
  const add = () => onChange([...intervals, emptyInterval()])

  return (
    <div className="rounded border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between bg-[var(--apex-thead)] px-3 h-10">
        <span className="text-[13px] font-bold text-[var(--apex-text)]">فترات الدورة</span>
        <button
          type="button"
          onClick={add}
          className="h-7 px-2 rounded bg-[var(--apex-green)] text-white text-[12px] flex items-center gap-1 hover:bg-[var(--apex-green-dark)]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={3} />
          إضافة فترة
        </button>
      </div>

      {intervals.length === 0 ? (
        <p className="p-4 text-[13px] text-slate-500 bg-white">لا توجد فترات بعد — اضغط «إضافة فترة»</p>
      ) : (
        <div className="overflow-x-auto bg-white">
          <table className="w-full text-[13px] text-right min-w-[560px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="px-3 py-2 font-bold w-24">من يوم</th>
                <th className="px-3 py-2 font-bold w-24">إلى يوم</th>
                <th className="px-3 py-2 font-bold">الوردية</th>
                <th className="px-3 py-2 font-bold w-20 text-center">راحة</th>
                <th className="px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {intervals.map((row, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      value={row.day_from}
                      onChange={(e) => update(i, { day_from: e.target.value === '' ? '' : Number(e.target.value) })}
                      aria-label={`من يوم — فترة ${i + 1}`}
                      className={INPUT}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      value={row.day_to}
                      onChange={(e) => update(i, { day_to: e.target.value === '' ? '' : Number(e.target.value) })}
                      aria-label={`إلى يوم — فترة ${i + 1}`}
                      className={INPUT}
                    />
                  </td>
                  <td className="px-3 py-2">
                    {row.is_off ? (
                      <span className="text-slate-400">— راحة —</span>
                    ) : (
                      <select
                        value={row.shift_type}
                        onChange={(e) => update(i, { shift_type: e.target.value })}
                        aria-label={`الوردية — فترة ${i + 1}`}
                        className={SELECT}
                      >
                        <option value="">اختر الوردية</option>
                        {shiftTypes.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Checkbox
                      checked={row.is_off}
                      onCheckedChange={(v) => update(i, { is_off: !!v, shift_type: v ? '' : row.shift_type })}
                      aria-label={`راحة — فترة ${i + 1}`}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button type="button" onClick={() => remove(i)} aria-label={`حذف فترة ${i + 1}`} className="text-slate-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
