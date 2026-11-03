// ────────────────────── Types ──────────────────────

export interface CheckinDetail {
  name: string
  time: string | null
  log_type: 'IN' | 'OUT'
  latitude: number | null
  longitude: number | null
  photo_image: string | null
  checkin_method: string | null
  biometric_verified: number
  biometric_type: string | null
}

// ────────────────────── Core time utilities ──────────────────────

/** Safely parse a datetime string (space or T separated) to epoch ms. Returns NaN on failure. */
export function parseTime(str: string | null): number {
  if (!str) return NaN
  const t = new Date(str.replace(' ', 'T')).getTime()
  return isNaN(t) ? NaN : t
}

/** Sort checkin punches chronologically (earliest → latest). AM before PM asserted by numeric ts. */
export function sortCheckinsChronologically(checkins: CheckinDetail[]): CheckinDetail[] {
  return [...checkins]
    .filter(c => c.time)
    .sort((a, b) => {
      const ta = parseTime(a.time!)
      const tb = parseTime(b.time!)
      if (isNaN(ta) || isNaN(tb)) return 0
      return ta - tb
    })
}

/** Format a datetime to 12-hour Arabic: "08:02 ص" / "04:07 م" */
export function formatTimeArabic(dateTimeStr: string | null): string {
  if (!dateTimeStr) return '—'
  try {
    const d = new Date(dateTimeStr.replace(' ', 'T'))
    const h = d.getHours()
    const m = String(d.getMinutes()).padStart(2, '0')
    const period = h >= 12 ? 'م' : 'ص'
    const h12 = h % 12 || 12
    return `${h12}:${m} ${period}`
  } catch {
    return dateTimeStr
  }
}

// ────────────────────── Hours calculation ──────────────────────

/** Single IN→OUT pair duration in hours. Returns 0 if incomplete. */
export function calculateWorkHoursFromPair(inTime: string | null, outTime: string | null): number {
  if (!inTime || !outTime) return 0
  const tIn = parseTime(inTime)
  const tOut = parseTime(outTime)
  if (isNaN(tIn) || isNaN(tOut)) return 0
  const minutes = (tOut - tIn) / 60000
  return minutes > 0 ? Math.round(minutes / 60 * 100) / 100 : 0
}

/**
 * Calculate total working hours from a full day of punches.
 * Iterates chronological IN→OUT pairs; automatically subtracts break intervals
 * (time between an OUT and the next IN).
 * Ignores unpaired IN (open end) — does NOT return NaN.
 *
 * Example:
 *   08:00 IN → 12:00 OUT  = 4h
 *   12:30 IN → 16:00 OUT  = 3.5h
 *   Total = 7.5h (30 min break excluded)
 */
export function calculateWorkHoursFromCheckins(checkins: CheckinDetail[]): number {
  if (!checkins || !checkins.length) return 0
  const sorted = sortCheckinsChronologically(checkins)
  let totalMinutes = 0
  let lastInTime: number | null = null
  for (const c of sorted) {
    const t = parseTime(c.time!)
    if (isNaN(t)) continue
    if (c.log_type === 'IN') {
      lastInTime = t
    } else if (c.log_type === 'OUT' && lastInTime !== null) {
      totalMinutes += (t - lastInTime) / 60000
      lastInTime = null
    }
  }
  return Math.round(totalMinutes / 60 * 100) / 100
}

// ────────────────────── Punch completeness ──────────────────────

/** True if there's at least one IN punch but zero OUT punches. */
export function hasMissingOutPunch(checkins: CheckinDetail[]): boolean {
  if (!checkins || checkins.length === 0) return false
  const hasIn = checkins.some(c => c.log_type === 'IN' && c.time)
  const hasOut = checkins.some(c => c.log_type === 'OUT' && c.time)
  return hasIn && !hasOut
}

/** Check if a date string (YYYY-MM-DD) is today. */
export function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10)
}

/** Live hours from a given in-time to the current system clock. */
export function calculateLiveHours(lastInTime: string): number {
  const tIn = parseTime(lastInTime)
  if (isNaN(tIn)) return 0
  const now = Date.now()
  const minutes = (now - tIn) / 60000
  return minutes > 0 ? Math.round(minutes / 60 * 100) / 100 : 0
}

// ────────────────────── Formatting helpers ──────────────────────

export function formatGenderArabic(gender: string | null): string {
  if (!gender) return ''
  const map: Record<string, string> = { 'Male': 'ذكر', 'Female': 'أنثى', 'Other': 'آخر' }
  return map[gender] || gender
}

export function formatWorkingHours(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${h}h ${m}m`
}

export function getArabicDayName(dateStr: string): string {
  const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
  try {
    return days[new Date(dateStr + 'T00:00:00').getDay()]
  } catch {
    return ''
  }
}

export function formatDateArabic(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  } catch {
    return dateStr
  }
}

/** Today as YYYY-MM-DD */
export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// ────────────────────── CSV Export ──────────────────────

/** Triggers a CSV file download with UTF-8 BOM for Arabic MS Excel compatibility. */
export function exportToCSV(
  headers: string[],
  rows: string[][],
  filename: string,
): void {
  const bom = '\ufeff'
  const csvRows = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))]
  const csv = bom + csvRows.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
