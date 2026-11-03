const HIJRI_EPOCH_JD = 1948439

const HIJRI_MONTH_NAMES = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الثاني',
  'جمادى الأولى', 'جمادى الآخرة', 'رجب',
  'شعبان', 'رمضان', 'شوال',
  'ذو القعدة', 'ذو الحجة',
]

export interface HijriParts {
  year: number
  month: number
  day: number
}

function gregorianToJD(date: Date): number {
  let y = date.getUTCFullYear()
  let m = date.getUTCMonth() + 1
  const d = date.getUTCDate()
  if (m <= 2) { y--; m += 12 }
  const a = Math.floor(y / 100)
  const b = 2 - a + Math.floor(a / 4)
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524
}

function jdToGregorian(jd: number): Date {
  const z = Math.floor(jd + 0.5)
  const a = Math.floor((z - 1867216.25) / 36524.25)
  const b = z + 1 + a - Math.floor(a / 4)
  const c = b + 1524
  const d = Math.floor((c - 122.1) / 365.25)
  const e = Math.floor(365.25 * d)
  const f = Math.floor((c - e) / 30.6001)
  const day = Math.floor(c - e - Math.floor(30.6001 * f) + 0.5)
  let month = f - 1 - 12 * Math.floor(f / 14)
  let year = d - 4715 - Math.floor((7 + month) / 10)
  return new Date(Date.UTC(year, month - 1, day))
}

function daysInHijriYear(year: number): number {
  return ((11 * year + 14) % 30) < 11 ? 355 : 354
}

function daysBeforeHijriYear(year: number): number {
  let days = 0
  for (let y = 1; y < year; y++) {
    days += daysInHijriYear(y)
  }
  return days
}

// ── Umm al-Qura via ICU ──────────────────────────────────────────────────────
// The conversions below MUST follow the official Saudi Umm al-Qura calendar:
// the old arithmetic 30-year-cycle tables drifted ±1 day from it (client
// report: 2026-01-20 must read ١ شعبان ١٤٤٧, the tables said ٢). ICU ships the
// official Umm al-Qura data (≈1300–1500 AH), far beyond the app's 2020–2035
// range. The tabular helpers above remain ONLY as a first guess for the
// inverse conversion, corrected by round-tripping through ICU.

const umalqura = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
})

export function gregorianToHijri(date: Date): HijriParts {
  try {
    if (isNaN(date.getTime())) return { year: 0, month: 0, day: 0 }
    const parts = umalqura.formatToParts(date)
    const num = (t: string) => parseInt(parts.find((p) => p.type === t)?.value || '0', 10)
    const year = num('year')
    const month = num('month')
    const day = num('day')
    if (!year || !month || !day) return { year: 0, month: 0, day: 0 }
    return { year, month, day }
  } catch {
    return { year: 0, month: 0, day: 0 }
  }
}

export function hijriToGregorian(year: number, month: number, day: number): Date | null {
  try {
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > 30) return null
    // Tabular estimate (±2 days of Umm al-Qura), then scan the neighbourhood
    // until ICU round-trips to exactly the requested Hijri date.
    let days = daysBeforeHijriYear(year)
    const mlen = [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29]
    for (let i = 0; i < month - 1; i++) days += mlen[i]
    days += Math.min(day, 30) - 1
    const base = jdToGregorian(HIJRI_EPOCH_JD + days)
    for (let off = -4; off <= 4; off++) {
      const cand = new Date(base.getTime() + off * 86400000)
      const h = gregorianToHijri(cand)
      if (h.year === year && h.month === month && h.day === day) return cand
    }
    return null // the date doesn't exist (e.g. 30th of a 29-day month)
  } catch {
    return null
  }
}

export function hijriMonthLength(year: number, month: number): number {
  try {
    return hijriToGregorian(year, month, 30) ? 30 : 29
  } catch {
    return 29
  }
}

export function hijriMonthName(month: number): string {
  return HIJRI_MONTH_NAMES[month - 1] || ''
}

export function setHijriDate(year: number, month: number, day: number): Date | null {
  return hijriToGregorian(year, month, day)
}

export function addHijriMonths(date: Date, months: number): Date {
  try {
    const h = gregorianToHijri(date)
    if (h.year === 0) return date
    let totalMonths = (h.year - 1) * 12 + h.month + months
    if (totalMonths < 1) return date
    const newYear = Math.floor((totalMonths - 1) / 12) + 1
    const newMonth = ((totalMonths - 1) % 12) + 1
    let newDay = h.day
    const maxDay = hijriMonthLength(newYear, newMonth)
    if (newDay > maxDay) newDay = maxDay
    const result = hijriToGregorian(newYear, newMonth, newDay)
    return result || date
  } catch {
    return date
  }
}

export function hijriMonthDiff(start: Date, end: Date): number {
  try {
    const h1 = gregorianToHijri(start)
    const h2 = gregorianToHijri(end)
    if (h1.year === 0 || h2.year === 0) return 1
    let diff = (h2.year - h1.year) * 12 + (h2.month - h1.month)
    if (h2.day > h1.day) diff++
    return diff < 1 ? 1 : diff
  } catch {
    return 1
  }
}

export function subtractOneDay(date: Date, calType: 'gregorian' | 'hijri'): Date {
  try {
    if (calType === 'hijri') {
      const h = gregorianToHijri(date)
      if (h.year === 0) {
        const fallback = new Date(date)
        fallback.setDate(fallback.getDate() - 1)
        return fallback
      }
      let newDay = h.day - 1
      let newMonth = h.month
      let newYear = h.year
      if (newDay < 1) {
        newMonth--
        if (newMonth < 1) {
          newYear--
          newMonth = 12
        }
        newDay = hijriMonthLength(newYear, newMonth)
      }
      const result = hijriToGregorian(newYear, newMonth, newDay)
      return result || new Date(date.getTime() - 86400000)
    }
    const result = new Date(date)
    result.setDate(result.getDate() - 1)
    return result
  } catch {
    const fallback = new Date(date)
    fallback.setDate(fallback.getDate() - 1)
    return fallback
  }
}
