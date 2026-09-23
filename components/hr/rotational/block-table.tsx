'use client'

import { Plus, Trash2 } from 'lucide-react'
import { emptyBlock, type RotationalBlock } from './types'

const INPUT = 'h-9 w-full rounded border border-[var(--apex-border)] bg-white px-2 text-[13px] text-slate-800 outline-none focus:border-[var(--apex-blue)]'
const SELECT = `${INPUT} appearance-none`

/**
 * «فترات الدورة» — the Apex-style ordered block list: each block is one
 * shift with an editable «عدد أيام الدوام» (work_days) and «عدد أيام
 * العطلة» (rest_days), mirroring Apex's ChangefulTimeGroupsMaster per-shift
 * `workDaysNumber`/`weekendNumber` ngModel inputs (see
 * tamken3-audit/rotational-gap.md §A/B). The cycle's day-position ranges are
 * implicit — block 1 works `work_days` days then rests `rest_days` days,
 * block 2 continues from there, etc — expanded into the stored
 * `Rotational Shift Interval` rows server-side
 * (base_meena.api.hr_rotational_shifts.blocks_to_intervals) on save. Both
 * counts are ALWAYS-editable number inputs — this replaces the old
 * from-day/to-day interval table where «عدد أيام العطلة» was a read-only
 * aggregate the HR user couldn't type into.
 */
export function BlockTable({
  blocks, shiftTypes, onChange,
}: {
  blocks: RotationalBlock[]
  shiftTypes: string[]
  onChange: (next: RotationalBlock[]) => void
}) {
  const update = (i: number, patch: Partial<RotationalBlock>) => {
    onChange(blocks.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }
  const remove = (i: number) => onChange(blocks.filter((_, idx) => idx !== i))
  const add = () => onChange([...blocks, emptyBlock()])

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

      {blocks.length === 0 ? (
        <p className="p-4 text-[13px] text-slate-500 bg-white">لا توجد فترات بعد — اضغط «إضافة فترة»</p>
      ) : (
        <div className="overflow-x-auto bg-white">
          <table className="w-full text-[13px] text-right min-w-[560px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="px-3 py-2 font-bold w-10">#</th>
                <th className="px-3 py-2 font-bold">الوردية</th>
                <th className="px-3 py-2 font-bold w-32">عدد أيام الدوام</th>
                <th className="px-3 py-2 font-bold w-32">عدد أيام العطلة</th>
                <th className="px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {blocks.map((row, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                  <td className="px-3 py-2">
                    <select
                      value={row.shift_type}
                      onChange={(e) => update(i, { shift_type: e.target.value })}
                      aria-label={`الوردية — فترة ${i + 1}`}
                      className={SELECT}
                    >
                      <option value="">اختر الوردية</option>
                      {shiftTypes.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      value={row.work_days}
                      onChange={(e) => update(i, { work_days: e.target.value === '' ? '' : Number(e.target.value) })}
                      placeholder="عدد أيام الدوام"
                      aria-label={`عدد أيام الدوام — فترة ${i + 1}`}
                      className={INPUT}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      value={row.rest_days}
                      onChange={(e) => update(i, { rest_days: e.target.value === '' ? '' : Number(e.target.value) })}
                      placeholder="عدد أيام العطلة"
                      aria-label={`عدد أيام العطلة — فترة ${i + 1}`}
                      className={INPUT}
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
