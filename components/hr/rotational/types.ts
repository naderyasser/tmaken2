/** Shared shapes for the Apex-style rotational shift group screens
 *  (components/hr/rotational-shifts-page.tsx,
 *  components/hr/rotational-shift-editor-page.tsx + the parts under this
 *  folder). Mirrors base_meena.api.hr_rotational_shifts / the
 *  `Rotational Shift Interval` child doctype field for field. */

export interface RotationalInterval {
  day_from: number | ''
  day_to: number | ''
  shift_type: string
  is_off: boolean
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
  cycle_days: number | ''
  intervals: RotationalInterval[]
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
  intervals: [],
}

export const emptyInterval = (): RotationalInterval => ({
  day_from: '', day_to: '', shift_type: '', is_off: false,
})
