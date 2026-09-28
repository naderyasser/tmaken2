'use client'

/**
 * Apex «اضافة اذن» — «نوع الاذن» (مؤقت / يوم كامل) and, for مؤقت, the
 * per-shift table (الوردية · الحضور · الانصراف · شفت ممتد). Rows 2-4 are
 * switched on by their own checkbox, each only once the row above is on.
 *
 * Writes into the dialog form: custom_permission_type, custom_shift_times
 * (JSON [{attend, leave, extended}] of the enabled rows) and from_time/to_time
 * (Permission Request's required span — the permitted window; reports read the
 * per-shift times, see hr_reports._permissions).
 */

export type ShiftTime = { attend: string; leave: string; extended: boolean }

const SHIFT_NAMES = ['الوردية الاولي', 'الوردية الثانية', 'الوردية الثالثة', 'الوردية الرابعة']
const EMPTY: ShiftTime = { attend: '', leave: '', extended: false }
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

function parseTimes(raw: unknown): ShiftTime[] {
  try {
    const list = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw
    return Array.isArray(list) ? list.map((t) => ({ ...EMPTY, ...t })) : []
  } catch {
    return []
  }
}

/** Form values for the chosen type + rows (also used to seed a new form). */
export function permissionPayload(type: string, rows: ShiftTime[]) {
  if (type === 'يوم كامل') {
    return { custom_permission_type: type, custom_shift_times: '[]', from_time: '00:00', to_time: '23:59' }
  }
  const filled = rows.filter((r) => r.attend || r.leave)
  const last = filled[filled.length - 1]
  const from = filled[0]?.attend || '00:00'
  let to = last?.leave || '23:59'
  if (last?.extended || to <= from) to = '23:59' // the span only has to be positive; reports use the rows
  return { custom_permission_type: type, custom_shift_times: JSON.stringify(rows), from_time: from, to_time: to }
}

/** Error text, or null when the permission is complete. */
export function validatePermission(form: Record<string, any>): string | null {
  if (form.custom_permission_type !== 'مؤقت') return null
  const rows = parseTimes(form.custom_shift_times)
  if (!rows.some((r) => r.attend || r.leave)) return 'أدخل وقت الحضور أو الانصراف لوردية واحدة على الأقل'
  for (const r of rows) {
    for (const t of [r.attend, r.leave]) if (t && !HHMM.test(t)) return 'صيغة الوقت HH:mm (مثال 09:30)'
  }
  return null
}

export function PermissionTypeField({ form, set }: { form: Record<string, any>; set: (values: Record<string, any>) => void }) {
  if (!form.employee || !form.permission_date) return null
  const type = form.custom_permission_type || 'مؤقت'
  const saved = parseTimes(form.custom_shift_times)
  const rows: ShiftTime[] = saved.length ? saved : [{ ...EMPTY }]
  const commit = (nextType: string, nextRows: ShiftTime[]) => set(permissionPayload(nextType, nextRows))
  const setRow = (i: number, patch: Partial<ShiftTime>) => commit(type, rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const toggleRow = (i: number, on: boolean) =>
    commit(type, on ? [...rows, { ...EMPTY }] : rows.slice(0, i))

  return (
    <div className="space-y-3">
      <div>
        <span className="block text-[13px] text-slate-600 mb-1.5">نوع الاذن</span>
        <div className="flex items-center gap-6" role="radiogroup" aria-label="نوع الاذن">
          {['مؤقت', 'يوم كامل'].map((t) => (
            <label key={t} className="flex items-center gap-2 text-[14px] cursor-pointer">
              <input
                type="radio"
                name="permission-type"
                checked={type === t}
                onChange={() => commit(t, rows)}
                className="h-4 w-4 accent-[var(--apex-blue)]"
              />
              {t}
            </label>
          ))}
        </div>
      </div>
      {type === 'مؤقت' && (
        <div className="overflow-x-auto rounded border border-slate-200">
          <table className="w-full text-[13px] text-center">
            <thead className="bg-[var(--apex-thead)] text-[var(--apex-text)]">
              <tr className="h-10">
                <th className="w-10" />
                <th className="px-2 font-bold">الوردية</th>
                <th className="px-2 font-bold">الحضور</th>
                <th className="px-2 font-bold">الانصراف</th>
                <th className="px-2 font-bold">شفت ممتد</th>
              </tr>
            </thead>
            <tbody>
              {SHIFT_NAMES.map((name, i) => {
                const on = i < rows.length
                const r = rows[i] ?? EMPTY
                return (
                  <tr key={name} className="border-t border-slate-100 h-11">
                    <td>
                      {i > 0 && (
                        <input
                          type="checkbox"
                          aria-label={`تفعيل ${name}`}
                          checked={on}
                          disabled={i > rows.length}
                          onChange={(e) => toggleRow(i, e.target.checked)}
                          className="h-4 w-4 accent-[var(--apex-blue)] disabled:opacity-40"
                        />
                      )}
                    </td>
                    <td className="px-2 whitespace-nowrap">{name}</td>
                    {(['attend', 'leave'] as const).map((k) => (
                      <td key={k} className="px-2">
                        <input
                          type="text"
                          dir="ltr"
                          inputMode="numeric"
                          maxLength={5}
                          placeholder="HH:mm"
                          aria-label={`${name} ${k === 'attend' ? 'الحضور' : 'الانصراف'}`}
                          value={r[k]}
                          disabled={!on}
                          onChange={(e) => {
                            let v = e.target.value.replace(/[^\d:]/g, '')
                            if (/^\d{3,4}$/.test(v)) v = `${v.slice(0, 2)}:${v.slice(2)}`
                            setRow(i, { [k]: v })
                          }}
                          className="h-9 w-24 rounded border border-slate-300 px-2 text-center outline-none focus:border-[var(--apex-blue)] disabled:bg-slate-50"
                        />
                      </td>
                    ))}
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`${name} شفت ممتد`}
                        checked={r.extended}
                        disabled={!on}
                        onChange={(e) => setRow(i, { extended: e.target.checked })}
                        className="h-4 w-4 accent-[var(--apex-blue)] disabled:opacity-40"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
