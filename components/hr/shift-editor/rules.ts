/**
 * Client mirror of base_meena's shift_rules.py — same checks, same exact
 * Arabic messages, run before save_day/apply_day_to_all so the dialog can
 * show a validation failure instantly instead of round-tripping to the
 * server for it. First failing check wins, V0 through V9 in that order
 * (see the API CONTRACT's VALIDATION table); a backend rejection still goes
 * through the same alert, just with whatever message the server sent.
 */

import { MAX_WINDOWS, type DayWindow } from './types'
import { hhmmToMinutes, isValidHHMM, isValidTimeOrEmpty } from '../apex/time-input'

const TIME_FIELDS = ['start_in', 'check_in', 'end_in', 'start_out', 'check_out', 'end_out'] as const

const MSG = {
  orderNotContiguous: 'يجب تفعيل الورديات بالترتيب',
  tooManyWindows: 'الحد الأقصى أربع ورديات في اليوم',
  missingTime: (n: number) => `يجب إدخال جميع أوقات الوردية ${n}`,
  badTimeFormat: 'صيغة الوقت غير صحيحة، استخدم نظام 24 ساعة مثل 13:00',
  badGrace: 'قيمة الدقائق غير صحيحة',
  tooManyExtended: 'غير مسموح بأكثر من ورديه ممتدة',
  extendedNotLast: 'الوردية الممتدة يجب أن تكون آخر وردية في اليوم',
  checkOutNotAfterCheckIn: 'وقت الحضور يجب ان يكون أقل من وقت الإنصراف',
  spanTooLong: (n: number) => `مدة الوردية ${n} يجب أن تكون أقل من 24 ساعة`,
  lateGraceOverflow: (n: number) => `لا يمكن أن يتجاوز التأخير المسموح${n} نهاية الحضور${n}`,
  earlyGraceOverflow: (n: number) => `لا يمكن أن يتجاوز الانصراف المبكر${n} بداية الانصراف${n}`,
  crossWindowOverlap: (k: number) => `لا يمكن أن يكون بداية الحضور${k + 1} أقل من نهاية الانصراف${k}`,
  totalTooLong: 'إجمالي ساعات الورديات يجب أن يكون أقل من 24 ساعة',
  openHoursRequired: 'يجب إدخال ساعات العمل',
  dayEndRequired: 'يجب إدخال وقت انتهاء اليوم',
} as const

/** D7's ordering walk, one message per pair, in walk order. */
const PAIR_MESSAGE: ((n: number) => string)[] = [
  (n) => `لا يمكن أن يكون الحضور${n} أقل من بداية الحضور${n}`,
  (n) => `لا يمكن أن يكون نهاية الحضور${n} أقل من الحضور${n}`,
  (n) => `لا يمكن أن يكون بداية الانصراف${n} أقل من نهاية الحضور${n}`,
  (n) => `لا يمكن أن يكون الإنصراف${n} أقل من بداية الانصراف${n}`,
  (n) => `لا يمكن أن يكون نهاية الانصراف${n} أقل من الإنصراف${n}`,
]

function toMin(v: string): number {
  return hhmmToMinutes(v) ?? 0
}

/**
 * Validates one Normal day's enabled رويدات (already the enabled-only,
 * window_no-reassigned rows the dialog is about to save — but every check is
 * self-contained, so an arbitrary/malformed array is also caught rather than
 * assumed pre-compacted). `null` = the day is savable as-is.
 */
export function validateNormalDay(rows: DayWindow[]): string | null {
  const sorted = [...rows].sort((a, b) => a.window_no - b.window_no)
  const n = sorted.length
  if (n === 0) return null

  // V0 — contiguity first, then the 4-window cap (shift_rules._check_window_count's order)
  for (let i = 0; i < n; i++) {
    if (sorted[i].window_no !== i + 1) return MSG.orderNotContiguous
  }
  if (n > MAX_WINDOWS) return MSG.tooManyWindows

  // V1 — every row's six time fields, blank-only, one pass over the whole
  // day before any row's V2 is even attempted (shift_rules._check_all_times_present).
  for (let i = 0; i < n; i++) {
    const w = sorted[i]
    for (const f of TIME_FIELDS) {
      if (!w[f]) return MSG.missingTime(i + 1)
    }
  }

  // V2 — every row's six time fields, format — a second full pass, now that
  // none of them are blank (shift_rules._parse_all_times).
  for (let i = 0; i < n; i++) {
    const w = sorted[i]
    for (const f of TIME_FIELDS) {
      if (!isValidTimeOrEmpty(w[f])) return MSG.badTimeFormat
    }
  }

  // V3 — every row's two grace fields, a third full pass (shift_rules._parse_all_graces).
  // Empty is 0 per D6, never invalid; a typed-but-unparseable HH:MM reaches
  // here as NaN — see DurationInput — and is a V2, not a V3.
  for (let i = 0; i < n; i++) {
    const w = sorted[i]
    for (const f of ['late_allowance_min', 'early_out_min'] as const) {
      const v = w[f]
      if (Number.isNaN(v)) return MSG.badTimeFormat
      if (v !== '' && (!Number.isInteger(v) || v < 0)) return MSG.badGrace
    }
  }

  // V4 — once V1/V2/V3 are clean for the whole day, exactly where
  // shift_rules._check_extended_position runs (ahead of any row's V5/V6/V7).
  const extendedNos = sorted.filter((w) => w.extended).map((w) => w.window_no)
  if (extendedNos.length > 1) return MSG.tooManyExtended
  if (extendedNos.length === 1 && extendedNos[0] !== n) return MSG.extendedNotLast

  // V5/V6/V7 — each row resolved in row order, mirroring
  // shift_rules._resolve_parsed_window as validate_day calls it per window.
  const perWindow: { checkIn: number; checkOut: number; endOut: number }[] = []
  for (let i = 0; i < n; i++) {
    const w = sorted[i]
    const num = i + 1

    // The D7 walk (start_in→check_in→end_in→start_out→check_out→end_out),
    // resolving the one allowed midnight rollover on an extended وردية.
    const raw = TIME_FIELDS.map((f) => toMin(w[f]))
    const resolved: number[] = [raw[0]]
    let carry = 0
    let rolled = false
    for (let idx = 1; idx < 6; idx++) {
      let cur = raw[idx] + carry
      if (cur < resolved[idx - 1]) {
        if (!w.extended || rolled) return PAIR_MESSAGE[idx - 1](num)
        carry += 1440
        cur = raw[idx] + carry
        rolled = true
      }
      resolved.push(cur)
    }
    const [rStartIn, rCheckIn, rEndIn, rStartOut, rCheckOut, rEndOut] = resolved

    if (rCheckOut <= rCheckIn) return MSG.checkOutNotAfterCheckIn
    if (rEndOut - rStartIn >= 1440) return MSG.spanTooLong(num)

    const lateMin = w.late_allowance_min === '' ? 0 : w.late_allowance_min
    const earlyMin = w.early_out_min === '' ? 0 : w.early_out_min
    if (rCheckIn + lateMin > rEndIn) return MSG.lateGraceOverflow(num)
    if (rCheckOut - earlyMin < rStartOut) return MSG.earlyGraceOverflow(num)

    perWindow.push({ checkIn: rCheckIn, checkOut: rCheckOut, endOut: rEndOut })
  }

  // V8
  for (let i = 0; i < n - 1; i++) {
    if (toMin(sorted[i + 1].start_in) < perWindow[i].endOut) return MSG.crossWindowOverlap(i + 1)
  }

  // V9
  const total = perWindow.reduce((sum, w) => sum + (w.checkOut - w.checkIn), 0)
  if (total >= 1440) return MSG.totalTooLong

  return null
}

export interface OpenDayInput {
  required_minutes: number | ''
  extends_next_day: boolean
  day_end_time: string
}

/** Validates one Open working day. `null` = savable as-is. */
export function validateOpenDay(day: OpenDayInput): string | null {
  const required = day.required_minutes
  // A typed-but-unparseable HH:MM (see DurationInput) reaches here as NaN.
  if (Number.isNaN(required)) return MSG.badTimeFormat
  if (required === '' || !Number.isInteger(required) || required <= 0) return MSG.openHoursRequired
  if (day.extends_next_day) {
    if (!day.day_end_time) return MSG.dayEndRequired
    if (!isValidHHMM(day.day_end_time)) return MSG.badTimeFormat
  }
  return null
}
