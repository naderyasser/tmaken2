/**
 * Fingerprint punch import + monthly punch sheet.
 *
 * Backs the screen an HR officer uses to replace a hand-maintained attendance
 * subscription: upload the Excel the terminals export, review what it would
 * write, import it, then read the month back as a per-day grid.
 *
 * Routes through frappeApiUrl (dev proxy / prod direct — see api-client.ts).
 */

import { frappeApiUrl } from './api-client'
import { callMethod } from './api'
import { csrfFetch } from './csrf'

const NS = 'base_meena.biometric_management'

export interface PunchPeriod {
  label: string
  start: string
  end: string
}

export interface PunchSheetRules {
  periods: PunchPeriod[]
  grace_minutes: number
  ot_grace_minutes: number
  /** False until the employer confirms how overtime is counted — surface it. */
  ot_confirmed: boolean
}

export interface PunchImportSummary {
  filename?: string
  dry_run: boolean
  file: {
    header_row: number
    columns: Record<string, number>
    date_order: 'day' | 'month' | null
    time_order: 'day' | 'month' | null
    total_rows: number
    parsed: number
    skipped: Array<{ row: number; reason: string }>
    skipped_count: number
    ambiguous_date_order: boolean
  }
  range: { from: string | null; to: string | null }
  totals: {
    punches: number
    new: number
    duplicate: number
    employees_matched: number
    employees_unmatched: number
    unmatched_punches: number
  }
  employees: Array<{
    employee: string
    employee_name: string | null
    branch: string | null
    punches: number
    new: number
    duplicate: number
    first_day: string | null
    last_day: string | null
  }>
  unmatched: Array<{
    national_id: string
    employee_no: string
    alt_code: string
    employee_name: string
    reason: string
    punches: number
    first_row: number
  }>
  result?: {
    created: number
    skipped_duplicates: number
    failed: number
    errors: Array<{ row: number; employee: string; error: string }>
    device_id: string
    skip_auto_attendance: number
  }
}

export interface PunchSheetDay {
  date: string
  day_name: string
  periods: Array<{
    in: string | null
    out: string | null
    late_minutes: number
    early_minutes: number
    overtime_minutes: number
    incomplete: boolean
  }>
  extra_punches: string[]
  late_minutes: number
  early_minutes: number
  overtime_minutes: number
  total_late_minutes: number
  attended: boolean
  punch_count: number
}

export interface PunchSheetEmployee {
  employee: string
  employee_name: string | null
  national_id: string | null
  branch: string | null
  department: string | null
  status: string | null
  days: PunchSheetDay[]
  totals: {
    attended_days: number
    late_minutes: number
    early_minutes: number
    overtime_minutes: number
    incomplete_days: number
    punches: number
    total_late_minutes: number
  }
}

export interface PunchSheet {
  month: string
  from?: string
  to?: string
  rules: PunchSheetRules
  periods: PunchPeriod[]
  employees: PunchSheetEmployee[]
}

/** Upload the raw terminal export and return its Frappe file_url. */
export async function uploadPunchFile(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file, file.name)
  form.append('is_private', '1')

  const res = await csrfFetch(frappeApiUrl('/api/method/upload_file'), {
    method: 'POST',
    credentials: 'include',
    body: form,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.exception || `Upload failed: ${res.status}`)
  }
  const data = await res.json()
  const url = data?.message?.file_url
  if (!url) throw new Error('Upload succeeded but returned no file_url')
  return url
}

/** Dry run: what the file would write, and who it could not match. */
export async function previewPunchImport(fileUrl: string): Promise<PunchImportSummary> {
  const res = await callMethod(`${NS}.punch_import.preview_punch_import`, { file_url: fileUrl })
  return res.message
}

export async function runPunchImport(fileUrl: string): Promise<PunchImportSummary> {
  const res = await callMethod(`${NS}.punch_import.run_punch_import`, { file_url: fileUrl })
  return res.message
}

export async function getPunchSheet(
  month: string,
  filters: { employee?: string; branch?: string; department?: string; company?: string } = {},
): Promise<PunchSheet> {
  const res = await callMethod(`${NS}.punch_sheet.get_monthly_punch_sheet`, { month, ...filters })
  return res.message
}

export async function getPunchSheetRules(): Promise<PunchSheetRules> {
  const res = await callMethod(`${NS}.punch_sheet.get_punch_sheet_rules`, {})
  return res.message
}

export async function savePunchSheetRules(rules: PunchSheetRules): Promise<PunchSheetRules> {
  const res = await callMethod(`${NS}.punch_sheet.save_punch_sheet_rules`, {
    rules: JSON.stringify(rules),
  })
  return res.message
}

/** Download URLs — GET endpoints that stream a file, so the browser handles them. */
export function punchSheetXlsxUrl(
  month: string,
  filters: { employee?: string; branch?: string; department?: string } = {},
): string {
  const params = new URLSearchParams({ month })
  Object.entries(filters).forEach(([k, v]) => v && params.set(k, v))
  return frappeApiUrl(`/api/method/${NS}.punch_sheet.export_punch_sheet_xlsx?${params}`)
}

export function punchSheetPdfUrl(month: string, employee: string): string {
  const params = new URLSearchParams({ month, employee })
  return frappeApiUrl(`/api/method/${NS}.punch_sheet.export_punch_sheet_pdf?${params}`)
}
