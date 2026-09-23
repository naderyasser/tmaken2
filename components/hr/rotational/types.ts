/** Shared shapes for the Apex-style rotational shift group screens
 *  (components/hr/rotational-shifts-page.tsx,
 *  components/hr/rotational-shift-editor-page.tsx + the parts under this
 *  folder). Mirrors base_meena.api.hr_rotational_shifts.
 *
 *  The editor works in ordered "blocks" — {shift_type, work_days,
 *  rest_days} — one per Apex `ChangefulTimeGroupsMaster` shift entry
 *  (`workDaysNumber`/`weekendNumber`, see tamken3-audit/rotational-gap.md
 *  §A/B), NOT the raw `Rotational Shift Interval` day_from/day_to rows —
 *  those are expanded/reconstructed server-side
 *  (hr_rotational_shifts.blocks_to_intervals / intervals_to_blocks) so
 *  storage never changes. cycle_days/days_off are server-computed sums,
 *  read-only in the UI. */

export interface RotationalBlock {
  shift_type: string
  /** «عدد أيام الدوام» for this block — editable number input. */
  work_days: number | ''
  /** «عدد أيام العطلة» for this block — editable number input (the bug this
   *  rework fixes: it used to be a read-only aggregate, un-typeable). */
  rest_days: number | ''
}

/** One row of `list_groups` — `/rotational-shifts`. */
export interface RotationalGroupListRow {
  name: string
  group_name: string
  start_date: string | null
  cycle_days: number | null
  days_off: number | null
  shifts_count: number
  employees_count: number
}

export interface RotationalGroupForm {
  name?: string
  group_name: string
  start_date: string
  /** Read-only, server-computed — display only, never sent back on save. */
  cycle_days: number | ''
  days_off: number | ''
  blocks: RotationalBlock[]
}

/** One row of `get_group_employees` — a `Shift Schedule Assignment`. */
export interface RotationalEmployeeRow {
  name: string
  employee: string
  employee_name: string
  create_shifts_after?: string
  shift_status?: string
}

export const EMPTY_ROTATIONAL_FORM: RotationalGroupForm = {
  group_name: '',
  start_date: '',
  cycle_days: '',
  days_off: '',
  blocks: [],
}

export const emptyBlock = (): RotationalBlock => ({
  shift_type: '', work_days: '', rest_days: '',
})
