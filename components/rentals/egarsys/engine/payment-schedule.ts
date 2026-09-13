import { gregorianToHijri, hijriToGregorian, hijriMonthLength, type HijriParts } from './hijri'

export interface PaymentRow {
  no: number
  rentValue: number
  vat: number
  totalValue: number
  dueDateAD: string  // "YYYY-MM-DD"
  dueDateAH: string  // "YYYY/MM/DD" Hijri
}

// Add months in PURE Hijri space (no Gregorian round-trip). The day-of-month is
// preserved, clamped down only when the target Hijri month is shorter.
function addHijriMonthsParts(year: number, month: number, day: number, monthsToAdd: number): HijriParts {
  const totalMonths = year * 12 + (month - 1) + monthsToAdd
  const newYear = Math.floor(totalMonths / 12)
  const newMonth = (totalMonths % 12) + 1
  const maxDay = hijriMonthLength(newYear, newMonth)
  return { year: newYear, month: newMonth, day: Math.min(day, maxDay) }
}

export function adToHijriStr(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const parts = dateStr.split('-')
    if (parts.length !== 3) return ''
    const d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]))
    if (isNaN(d.getTime())) return ''
    const h = gregorianToHijri(d)
    if (!h.year) return ''
    return `${h.year}/${String(h.month).padStart(2, '0')}/${String(h.day).padStart(2, '0')}`
  } catch {
    return ''
  }
}

function dateToADStr(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function frequencyToPaymentsPerYear(paymentFrequency: string): number {
  if (paymentFrequency === 'monthly') return 12
  if (paymentFrequency === 'quarterly') return 4
  if (paymentFrequency === 'biannual' || paymentFrequency === 'semi_annual') return 2
  return 1 // annual
}

export function installmentsToFrequency(installmentsPerYear: string | number): string {
  const n = Number(installmentsPerYear)
  if (n === 12) return 'monthly'
  if (n === 4) return 'quarterly'
  if (n === 2) return 'biannual'
  return 'annual'
}

export function generatePaymentSchedule({
  startDate,
  endDate,
  rentAmount,
  paymentFrequency,
  vatPercent = 15,
}: {
  startDate: Date
  endDate: Date
  rentAmount: number
  paymentFrequency: string
  vatPercent?: number
}): PaymentRow[] {
  const paymentsPerYear = frequencyToPaymentsPerYear(paymentFrequency)
  const intervalMonths = 12 / paymentsPerYear

  // Convert the start date to Hijri ONCE; all due dates are computed from here
  // in Hijri space so they never drift through the Gregorian calendar.
  const startH = gregorianToHijri(startDate)
  const endH   = gregorianToHijri(endDate)

  // Row count = number of installments spanning the Hijri month range, inclusive
  // of both endpoints. e.g. 1448/01 → 1449/01 quarterly = 13 months → 5 rows.
  const totalHijriMonths =
    (endH.year * 12 + endH.month) - (startH.year * 12 + startH.month) + 1
  const totalRows = Math.max(1, Math.ceil(totalHijriMonths / intervalMonths))

  const paymentAmount = rentAmount / paymentsPerYear
  const vatAmount     = paymentAmount * (vatPercent / 100)
  const totalAmount   = paymentAmount + vatAmount

  const rows: PaymentRow[] = []
  for (let i = 0; i < totalRows; i++) {
    // Due date computed directly in Hijri parts — preserves the start day-of-month
    const due = addHijriMonthsParts(startH.year, startH.month, startH.day, i * intervalMonths)
    const dueDateAH = `${due.year}/${String(due.month).padStart(2, '0')}/${String(due.day).padStart(2, '0')}`
    // Convert back to Gregorian only for the AD column (single conversion, no round-trip)
    const gregorian = hijriToGregorian(due.year, due.month, due.day)
    const dueDateAD = gregorian ? dateToADStr(gregorian) : ''
    rows.push({
      no: i + 1,
      rentValue:  Math.round(paymentAmount * 100) / 100,
      vat:        Math.round(vatAmount     * 100) / 100,
      totalValue: Math.round(totalAmount   * 100) / 100,
      dueDateAD,
      dueDateAH,
    })
  }
  return rows
}
