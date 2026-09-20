/** Shared shapes for the Apex-style shift list + editor
 *  (components/hr/shift-list-page.tsx, components/hr/shift-editor-page.tsx +
 *  the parts under this folder). Mirrors base_meena.api.hr_shifts / the
 *  `Shift Day Window` child doctype field for field.
 *
 *  Column-mapping note (day dialog / G10): the live Apex reference shows 8
 *  time-ish columns per وردية row (بداية الحضور · حضور · التأخير المسموح ·
 *  نهاية الحضور · بداية الانصراف · الانصراف المبكر · إنصراف · نهاية الانصراف).
 *  The migrated `Shift Day Window` schema only carries 6 of those as real
 *  fields — start_in/end_in/start_out/end_out (whose Arabic names, per
 *  hr_shifts._validate_windows' own message text, ARE «بداية الحضور» /
 *  «نهاية الحضور» / «بداية الانصراف» / «نهاية الانصراف») plus the two grace
 *  minutes. «حضور»/«إنصراف» have no backing column in this batch's schema
 *  (no migration was made — see the batch brief), so this editor renders
 *  the 6 fields that ARE real, under Apex's own labels for them, and drops
 *  the two that aren't backed by storage rather than fabricate inputs that
 *  would silently discard whatever the user types into them. */

export type ShiftKind = 'Open' | 'Normal' | 'Rotational'
export type CalendarType = 'Year' | 'Ramadan'

export interface DayWindow {
  calendar_type: CalendarType
  day: string
  window_no: number
  start_in: string
  late_allowance_min: number | ''
  end_in: string
  start_out: string
  early_out_min: number | ''
  end_out: string
  extended: boolean
}

/** Full base_meena.api.hr_shifts.get_shift response shape. */
export interface ShiftData {
  name: string | null
  arabic_name: string
  latin_name: string
  kind: ShiftKind
  open_hours: number | string | null
  windows: DayWindow[]
}

export const EMPTY_SHIFT_DATA: ShiftData = {
  name: null, arabic_name: '', latin_name: '', kind: 'Normal', open_hours: null, windows: [],
}

/** «نوع الدوام» radio (Apex G9) — دوام عادي / دوام مفتوح / ورديات متغيرة. */
export const KIND_OPTIONS: { value: ShiftKind; label: string }[] = [
  { value: 'Normal', label: 'دوام عادي' },
  { value: 'Open', label: 'دوام مفتوح' },
  { value: 'Rotational', label: 'ورديات متغيرة' },
]

export const KIND_LABELS: Record<string, string> = {
  Normal: 'دوام عادي', Open: 'دوام مفتوح', Rotational: 'ورديات متغيرة',
}

/** السبت…الجمعة, Saturday first — same order/labels as generic-list-page.tsx's VALUE_AR. */
export const DAYS: { value: string; label: string }[] = [
  { value: 'Saturday', label: 'السبت' },
  { value: 'Sunday', label: 'الأحد' },
  { value: 'Monday', label: 'الاثنين' },
  { value: 'Tuesday', label: 'الثلاثاء' },
  { value: 'Wednesday', label: 'الأربعاء' },
  { value: 'Thursday', label: 'الخميس' },
  { value: 'Friday', label: 'الجمعة' },
]

export const WINDOW_ORDINAL = ['الوردية الاولي', 'الوردية الثانية', 'الوردية الثالثة', 'الوردية الرابعة']
export const MAX_WINDOWS = 4

export const emptyWindow = (calendar_type: CalendarType, day: string, window_no: number): DayWindow => ({
  calendar_type, day, window_no,
  start_in: '', late_allowance_min: '', end_in: '',
  start_out: '', early_out_min: '', end_out: '',
  extended: false,
})

/** This day's windows (already filtered to one calendar_type), sorted by window_no. */
export function windowsForDay(windows: DayWindow[], calendarType: CalendarType, day: string): DayWindow[] {
  return windows
    .filter((w) => w.calendar_type === calendarType && w.day === day)
    .sort((a, b) => a.window_no - b.window_no)
}

function toMinutes(t: string): number | null {
  if (!t) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(t)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/** Total worked minutes for one day's windows — sum of (end_out − start_in)
 *  per window (matches the Apex reference's «إجمالي الساعات», e.g. a single
 *  09:00→17:00 window shows 08:00). */
export function dayTotalMinutes(dayWindows: DayWindow[]): number {
  let total = 0
  for (const w of dayWindows) {
    const start = toMinutes(w.start_in)
    const end = toMinutes(w.end_out)
    if (start !== null && end !== null && end > start) total += end - start
  }
  return total
}

/** Minutes → 'HH:MM', Latin digits, e.g. 480 → '08:00'. */
export function fmtHoursMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
