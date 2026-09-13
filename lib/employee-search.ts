import type { Employee } from '@/lib/api-client'

const onlyDigits = (s?: string | null) => (s || '').replace(/\D/g, '')

/**
 * Rank employee search hits so the most likely match is on top:
 * exact field match (100) > starts-with (50) > contains (10). Text fields use
 * the lowercased query; phone / national-ID / employee-number are compared with
 * all non-digits stripped so "0501" ranks a "050-1..." number correctly.
 *
 * Extracted from components/header.tsx so the HR shell's GlobalSearch and the
 * legacy Header share one ranking implementation.
 */
export function rankEmployees(rows: Employee[], rawQuery: string): Employee[] {
  const q = rawQuery.trim().toLowerCase()
  const qDigits = onlyDigits(rawQuery)
  const score = (e: Employee): number => {
    const textFields = [
      (e.employee_name || '').toLowerCase(),
      (e.name || '').toLowerCase(),
      (e.employee_number || '').toLowerCase(),
      (e.designation || '').toLowerCase(),
      (e.department || '').toLowerCase(),
    ]
    const numFields = [onlyDigits(e.cell_number), onlyDigits(e.custom_national_id), onlyDigits(e.employee_number)]
    let best = 0
    if (textFields.some(f => f && f === q) || (qDigits && numFields.some(f => f && f === qDigits))) best = Math.max(best, 100)
    if (textFields.some(f => f && f.startsWith(q)) || (qDigits && numFields.some(f => f && f.startsWith(qDigits)))) best = Math.max(best, 50)
    if (textFields.some(f => f && f.includes(q)) || (qDigits && numFields.some(f => f && f.includes(qDigits)))) best = Math.max(best, 10)
    return best
  }
  return [...rows].sort(
    (a, b) => score(b) - score(a) || (a.employee_name || '').localeCompare(b.employee_name || '')
  )
}
