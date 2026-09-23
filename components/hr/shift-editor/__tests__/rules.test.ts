import {
  formatTypingValue, normalizeTimeInput, isValidHHMM, isValidTimeOrEmpty, minutesToHHMM, hhmmToMinutes,
} from '@/components/hr/apex/time-input'
import { validateNormalDay, validateOpenDay } from '@/components/hr/shift-editor/rules'
import { emptyWindow, type DayWindow } from '@/components/hr/shift-editor/types'

function win(overrides: Partial<DayWindow> = {}, window_no = 1): DayWindow {
  return {
    ...emptyWindow('Year', 'Saturday', window_no),
    start_in: '05:00', check_in: '09:00', late_allowance_min: 10, end_in: '10:00',
    start_out: '16:00', early_out_min: 10, check_out: '17:00', end_out: '23:00',
    extended: false,
    ...overrides,
  }
}

describe('formatTypingValue (mask while typing)', () => {
  it('keeps digits only and inserts : once a 3rd digit exists', () => {
    expect(formatTypingValue('1')).toBe('1')
    expect(formatTypingValue('13')).toBe('13')
    expect(formatTypingValue('130')).toBe('13:0')
    expect(formatTypingValue('1300')).toBe('13:00')
  })

  it('strips non-digit characters (paste, existing colon)', () => {
    expect(formatTypingValue('a1b3')).toBe('13')
    expect(formatTypingValue('13:0')).toBe('13:0')
  })

  it('caps at 4 digits', () => {
    expect(formatTypingValue('130059')).toBe('13:00')
  })
})

describe('normalizeTimeInput (on blur)', () => {
  it('empty / no digits -> empty', () => {
    expect(normalizeTimeInput('')).toBe('')
    expect(normalizeTimeInput('_')).toBe('')
  })

  it('groups 1..4 digits per the D5/spec table', () => {
    expect(normalizeTimeInput('5')).toBe('05:00')
    expect(normalizeTimeInput('13')).toBe('13:00')
    expect(normalizeTimeInput('930')).toBe('09:30')
    expect(normalizeTimeInput('1730')).toBe('17:30')
  })

  it('shapes but does not clamp an out-of-range result', () => {
    expect(normalizeTimeInput('99')).toBe('99:00')
  })
})

describe('isValidHHMM / isValidTimeOrEmpty', () => {
  it('accepts exactly 00:00–23:59', () => {
    expect(isValidHHMM('00:00')).toBe(true)
    expect(isValidHHMM('23:59')).toBe(true)
    expect(isValidHHMM('24:00')).toBe(false)
    expect(isValidHHMM('13:60')).toBe(false)
    expect(isValidHHMM('9:00')).toBe(false)
    expect(isValidHHMM('')).toBe(false)
  })

  it('isValidTimeOrEmpty also accepts empty', () => {
    expect(isValidTimeOrEmpty('')).toBe(true)
    expect(isValidTimeOrEmpty('13:00')).toBe(true)
    expect(isValidTimeOrEmpty('25:00')).toBe(false)
  })
})

describe('minutesToHHMM / hhmmToMinutes (DurationInput round-trip)', () => {
  it('round-trips D5\'s own example (00:10 <-> 10)', () => {
    expect(minutesToHHMM(10)).toBe('00:10')
    expect(hhmmToMinutes('00:10')).toBe(10)
  })

  it('handles a full-hour duration', () => {
    expect(minutesToHHMM(65)).toBe('01:05')
    expect(hhmmToMinutes('01:05')).toBe(65)
    expect(minutesToHHMM(1439)).toBe('23:59')
  })

  it('returns null for an unparsable value', () => {
    expect(hhmmToMinutes('')).toBeNull()
    expect(hhmmToMinutes('abc')).toBeNull()
  })
})

describe('validateNormalDay', () => {
  it('accepts a single well-formed وردية', () => {
    expect(validateNormalDay([win()])).toBeNull()
  })

  it('accepts an empty day (weekly off)', () => {
    expect(validateNormalDay([])).toBeNull()
  })

  it('V0 — more than 4 enabled windows', () => {
    const rows = [1, 2, 3, 4, 5].map((n) => win({}, n))
    expect(validateNormalDay(rows)).toBe('الحد الأقصى أربع ورديات في اليوم')
  })

  it('V0 — non-contiguous window_no', () => {
    const rows = [win({}, 1), win({}, 3)]
    expect(validateNormalDay(rows)).toBe('يجب تفعيل الورديات بالترتيب')
  })

  it('V1 — a missing time in an enabled row', () => {
    expect(validateNormalDay([win({ check_in: '' })])).toBe('يجب إدخال جميع أوقات الوردية 1')
  })

  it('V2 — an out-of-range time', () => {
    expect(validateNormalDay([win({ check_in: '25:00' })]))
      .toBe('صيغة الوقت غير صحيحة، استخدم نظام 24 ساعة مثل 13:00')
  })

  it('V3 — negative or non-integer grace', () => {
    expect(validateNormalDay([win({ late_allowance_min: -5 })])).toBe('قيمة الدقائق غير صحيحة')
    expect(validateNormalDay([win({ early_out_min: 1.5 })])).toBe('قيمة الدقائق غير صحيحة')
  })

  it('a typed-but-unparseable grace (NaN, from DurationInput) is V2, not V3', () => {
    expect(validateNormalDay([win({ late_allowance_min: NaN })]))
      .toBe('صيغة الوقت غير صحيحة، استخدم نظام 24 ساعة مثل 13:00')
  })

  it('V1 is a pass over every row before any row\'s V2: a missing time in row 2 outranks a malformed time in row 1', () => {
    const rows = [win({ end_in: '99:00' }, 1), win({ check_in: '' }, 2)]
    expect(validateNormalDay(rows)).toBe('يجب إدخال جميع أوقات الوردية 2')
  })

  it('within one row, field order decides V1 vs V2 — a missing check_in outranks a later malformed end_in', () => {
    expect(validateNormalDay([win({ check_in: '', end_in: '99:00' })])).toBe('يجب إدخال جميع أوقات الوردية 1')
  })

  it('V1 (blank-only) outranks V2 (format) even within one row: a missing start_out outranks a malformed start_in', () => {
    expect(validateNormalDay([win({ start_in: '99:00', start_out: '' })]))
      .toBe('يجب إدخال جميع أوقات الوردية 1')
  })

  it('V1 outranks a well-formed ordering problem (V5) in an earlier row', () => {
    const rows = [win({ check_in: '04:00' }, 1), win({ check_in: '' }, 2)]
    expect(validateNormalDay(rows)).toBe('يجب إدخال جميع أوقات الوردية 2')
  })

  it('V1 outranks V4 (too-many-extended): a blank field anywhere wins over two extended rows', () => {
    const rows = [win({ extended: true, end_out: '' }, 1), win({ extended: true }, 2)]
    expect(validateNormalDay(rows)).toBe('يجب إدخال جميع أوقات الوردية 1')
  })

  it('V3 outranks V4: a bad grace in row 1 wins over two extended rows', () => {
    const rows = [win({ extended: true, late_allowance_min: -5 }, 1), win({ extended: true }, 2)]
    expect(validateNormalDay(rows)).toBe('قيمة الدقائق غير صحيحة')
  })

  it('D6 — an empty grace is treated as 0, not an error', () => {
    expect(validateNormalDay([win({ late_allowance_min: '', early_out_min: '' })])).toBeNull()
  })

  it('V4 — more than one extended وردية', () => {
    const rows = [
      win({ end_out: '14:00', extended: true }, 1),
      win({ start_in: '15:00', check_in: '15:30', end_in: '16:00', start_out: '20:00', check_out: '21:00', end_out: '22:00', extended: true }, 2),
    ]
    expect(validateNormalDay(rows)).toBe('غير مسموح بأكثر من ورديه ممتدة')
  })

  it('V4 — extended row is not the last', () => {
    const rows = [
      win({ end_out: '14:00', extended: true }, 1),
      win({ start_in: '15:00', check_in: '15:30', end_in: '16:00', start_out: '20:00', check_out: '21:00', end_out: '22:00', extended: false }, 2),
    ]
    expect(validateNormalDay(rows)).toBe('الوردية الممتدة يجب أن تكون آخر وردية في اليوم')
  })

  it('V5 — check_in < start_in', () => {
    expect(validateNormalDay([win({ start_in: '09:00', check_in: '08:00' })]))
      .toBe('لا يمكن أن يكون الحضور1 أقل من بداية الحضور1')
  })

  it('V5 — end_in < check_in', () => {
    expect(validateNormalDay([win({ check_in: '09:00', end_in: '08:30' })]))
      .toBe('لا يمكن أن يكون نهاية الحضور1 أقل من الحضور1')
  })

  it('V5 — start_out < end_in', () => {
    expect(validateNormalDay([win({ end_in: '10:00', start_out: '09:00' })]))
      .toBe('لا يمكن أن يكون بداية الانصراف1 أقل من نهاية الحضور1')
  })

  it('V5 — check_out < start_out', () => {
    expect(validateNormalDay([win({ start_out: '16:00', check_out: '15:00' })]))
      .toBe('لا يمكن أن يكون الإنصراف1 أقل من بداية الانصراف1')
  })

  it('V5 — end_out < check_out', () => {
    expect(validateNormalDay([win({ check_out: '17:00', end_out: '16:30' })]))
      .toBe('لا يمكن أن يكون نهاية الانصراف1 أقل من الإنصراف1')
  })

  it('V5 — check_out must be strictly after check_in even when every pairwise step is only equal', () => {
    const rows = [win({
      start_in: '08:00', check_in: '09:00', end_in: '09:00', start_out: '09:00', check_out: '09:00', end_out: '10:00',
    })]
    expect(validateNormalDay(rows)).toBe('وقت الحضور يجب ان يكون أقل من وقت الإنصراف')
  })

  it('V6 — an extended وردية spanning 24h or more', () => {
    const rows = [win({
      start_in: '05:00', check_in: '09:00', late_allowance_min: 0, end_in: '10:00',
      start_out: '16:00', early_out_min: 0, check_out: '17:00', end_out: '06:00', extended: true,
    })]
    expect(validateNormalDay(rows)).toBe('مدة الوردية 1 يجب أن تكون أقل من 24 ساعة')
  })

  it('V7 — late grace pushes past نهاية الحضور', () => {
    const rows = [win({ late_allowance_min: 70 })]
    expect(validateNormalDay(rows)).toBe('لا يمكن أن يتجاوز التأخير المسموح1 نهاية الحضور1')
  })

  it('V7 — early grace pushes before بداية الانصراف', () => {
    const rows = [win({ late_allowance_min: 0, early_out_min: 70 })]
    expect(validateNormalDay(rows)).toBe('لا يمكن أن يتجاوز الانصراف المبكر1 بداية الانصراف1')
  })

  it('V8 — window 2 opens before window 1 officially closes', () => {
    const rows = [
      win({ end_out: '18:00' }, 1),
      win({
        start_in: '17:30', check_in: '18:00', end_in: '18:30', start_out: '20:00', check_out: '21:00', end_out: '22:00',
      }, 2),
    ]
    expect(validateNormalDay(rows)).toBe('لا يمكن أن يكون بداية الحضور2 أقل من نهاية الانصراف1')
  })

  it('V9 — total worked time across windows reaches 24h even though each وردية individually stays under it', () => {
    const rows = [
      win({
        start_in: '00:00', check_in: '00:00', late_allowance_min: 0, end_in: '01:40',
        start_out: '01:40', early_out_min: 0, check_out: '11:40', end_out: '11:50', extended: false,
      }, 1),
      win({
        start_in: '11:50', check_in: '11:50', late_allowance_min: 0, end_in: '12:30',
        start_out: '12:30', early_out_min: 0, check_out: '01:40', end_out: '03:20', extended: true,
      }, 2),
    ]
    expect(validateNormalDay(rows)).toBe('إجمالي ساعات الورديات يجب أن يكون أقل من 24 ساعة')
  })
})

describe('validateOpenDay', () => {
  it('accepts required hours with no extension', () => {
    expect(validateOpenDay({ required_minutes: 480, extends_next_day: false, day_end_time: '' })).toBeNull()
  })

  it('rejects missing required hours', () => {
    expect(validateOpenDay({ required_minutes: '', extends_next_day: false, day_end_time: '' }))
      .toBe('يجب إدخال ساعات العمل')
  })

  it('a typed-but-unparseable required hours (NaN, from DurationInput) is V2, not "missing"', () => {
    expect(validateOpenDay({ required_minutes: NaN, extends_next_day: false, day_end_time: '' }))
      .toBe('صيغة الوقت غير صحيحة، استخدم نظام 24 ساعة مثل 13:00')
  })

  it('rejects 00:00 required hours', () => {
    expect(validateOpenDay({ required_minutes: 0, extends_next_day: false, day_end_time: '' }))
      .toBe('يجب إدخال ساعات العمل')
  })

  it('rejects an extended day with no day-end time', () => {
    expect(validateOpenDay({ required_minutes: 480, extends_next_day: true, day_end_time: '' }))
      .toBe('يجب إدخال وقت انتهاء اليوم')
  })

  it('rejects a malformed day-end time', () => {
    expect(validateOpenDay({ required_minutes: 480, extends_next_day: true, day_end_time: '25:00' }))
      .toBe('صيغة الوقت غير صحيحة، استخدم نظام 24 ساعة مثل 13:00')
  })

  it('accepts a well-formed extended day', () => {
    expect(validateOpenDay({ required_minutes: 480, extends_next_day: true, day_end_time: '02:00' })).toBeNull()
  })
})
