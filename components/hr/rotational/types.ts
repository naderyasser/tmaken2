/** Shared shapes for the Apex-style rotational shift group screens — now
 *  nested under a parent «أوقات العمل» shift instead of a standalone module
 *  (components/hr/rotational/groups-page.tsx,
 *  components/hr/rotational/intervals-page.tsx,
 *  components/hr/rotational/interval-block.tsx +
 *  components/hr/rotational/employees-section.tsx, kept unchanged). Mirrors
 *  base_meena.api.hr_rotational_shifts's new group-belongs-to-a-shift
 *  endpoints (list_shift_groups / get_group_meta / save_group_meta /
 *  get_intervals / save_intervals — owner's spec §1-§3).
 *
 *  A group's «فترات الدورة» blocks now carry their own times INLINE (typed
 *  directly, same shape as the normal-shift day dialog's `DayWindow` rows)
 *  instead of picking an existing Shift Type — see RotationalIntervalBlock
 *  below. The backend materialises each block's times onto a hidden
 *  internal Shift Type automatically; the UI never has to know about that
 *  plumbing (get_intervals/save_intervals hide it entirely). */

import { emptyWindow, type DayWindow } from '@/components/hr/shift-editor/types'

/** One row of `list_shift_groups` — the groups list for ONE parent shift. */
export interface RotationalGroupListRow {
  name: string
  group_name: string
  group_name_en: string
  start_date: string | null
}

/** `get_group_meta`/`get_group_view` shape — the add/edit/view dialog's
 *  identity-only fields (never touches blocks/intervals). */
export interface RotationalGroupMeta {
  name?: string
  group_name: string
  group_name_en: string
  start_date: string
}

export const EMPTY_GROUP_META: RotationalGroupMeta = {
  group_name: '', group_name_en: '', start_date: '',
}

/** One «فترة» block on the intervals page — up to 4 inline «وردية» slots,
 *  same idea as DayDialog's own local `slots` state (day-dialog.tsx), just
 *  owned per-block instead of per-day. `null` = that row disabled. The
 *  backend's `shift_type` field is deliberately NOT part of this shape — an
 *  internal bookkeeping value the UI never shows or sends back (owner's
 *  spec §3). */
export interface RotationalIntervalBlock {
  work_days: number | ''
  rest_days: number | ''
  slots: (DayWindow | null)[]
}

export const emptyIntervalBlock = (): RotationalIntervalBlock => ({
  work_days: '', rest_days: '', slots: [emptyWindow('Year', 'Saturday', 1), null, null, null],
})

/** One row of `get_group_employees` — a `Shift Schedule Assignment`. Reused
 *  as-is by employees-section.tsx (unchanged by this rework). */
export interface RotationalEmployeeRow {
  name: string
  employee: string
  employee_name: string
  create_shifts_after?: string
  shift_status?: string
}
