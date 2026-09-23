/** Shared shapes for the Apex-style shift list + editor
 *  (components/hr/shift-list-page.tsx, components/hr/shift-editor-page.tsx +
 *  the parts under this folder). Mirrors base_meena.api.hr_shifts.get_shift's
 *  response — one unified row shape for both شفت kinds: a Normal day carries
 *  the eight وردية times + grace + extended; an Open day is exactly one row
 *  (window_no 1) carrying required_minutes / extends_next_day / day_end_time
 *  instead. See ./rules.ts for the validation this shape feeds. */

export type ShiftKind = 'Open' | 'Normal' | 'Rotational'
export type CalendarType = 'Year' | 'Ramadan'

export interface DayWindow {
  calendar_type: CalendarType
  day: string
  window_no: number
  // Normal-only — the 8 times + grace + extension of one وردية.
  start_in: string
  check_in: string
  late_allowance_min: number | ''
  end_in: string
  start_out: string
  early_out_min: number | ''
  check_out: string
  end_out: string
  extended: boolean
  // Open-only — one row per working day.
  required_minutes: number | ''
  extends_next_day: boolean
  day_end_time: string
}

/** Full base_meena.api.hr_shifts.get_shift response shape. */
export interface ShiftData {
  name: string | null
  arabic_name: string
  latin_name: string
  kind: ShiftKind
  windows: DayWindow[]
}

export const EMPTY_SHIFT_DATA: ShiftData = {
  name: null, arabic_name: '', latin_name: '', kind: 'Normal', windows: [],
}

/** «نوع الدوام» radio (Apex G9) — دوام عادي / دوام مفتوح / دوام متغير. */
export const KIND_OPTIONS: { value: ShiftKind; label: string }[] = [
  { value: 'Normal', label: 'دوام عادي' },
  { value: 'Open', label: 'دوام مفتوح' },
  { value: 'Rotational', label: 'دوام متغير' },
]

export const KIND_LABELS: Record<string, string> = {
  Normal: 'دوام عادي', Open: 'دوام مفتوح', Rotational: 'دوام متغير',
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
  start_in: '', check_in: '', late_allowance_min: '', end_in: '',
  start_out: '', early_out_min: '', check_out: '', end_out: '',
  extended: false,
  required_minutes: '', extends_next_day: false, day_end_time: '',
})

/** This day's rows (already filtered to one calendar_type), sorted by
 *  window_no — 0..4 rows for Normal, 0..1 for Open. */
export function windowsForDay(windows: DayWindow[], calendarType: CalendarType, day: string): DayWindow[] {
  return windows
    .filter((w) => w.calendar_type === calendarType && w.day === day)
    .sort((a, b) => a.window_no - b.window_no)
}

function toMinutes(t: string): number | null {
  if (!t) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(t)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/** Total worked minutes for one Normal day — sum of (check_out − check_in)
 *  per وردية (the OFFICIAL times, not the device-open start_in/end_out —
 *  see the API CONTRACT's D1/business-rules note). An extended وردية whose
 *  check_out clock time is at/before its check_in wraps past midnight
 *  (+24h) before subtracting, matching the Apex reference's «إجمالي الساعات». */
export function dayTotalMinutes(dayWindows: DayWindow[]): number {
  let total = 0
  for (const w of dayWindows) {
    const start = toMinutes(w.check_in)
    let end = toMinutes(w.check_out)
    if (start === null || end === null) continue
    if (w.extended && end <= start) end += 24 * 60
    if (end > start) total += end - start
  }
  return total
}
