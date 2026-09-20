import type { ReactNode } from 'react'
import { fmtDate, fmtDateTime } from '@/lib/hr-format'

/**
 * Apex table wrapper — white card, radius 15px, shadow `rgba(0,0,0,.15) 0 8px 16px`,
 * overflow hidden, margin-top 8px. The actual row/cell rules live in the
 * `.apex-table` CSS class (app/globals.css) applied to the `<table>` inside.
 */
export function ApexTableCard({ children }: { children: ReactNode }) {
  return (
    <div
      className="mt-2 overflow-hidden bg-white"
      style={{ borderRadius: 15, boxShadow: 'rgba(0,0,0,.15) 0 8px 16px' }}
    >
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/

/**
 * Minimal cell formatter for bespoke Apex table pages that don't go through
 * GenericListPage/FieldDef (holiday-days-page.tsx and friends): renders
 * `dd/mm/yyyy` (`dd/mm/yyyy HH:mm` for a datetime) for a date/datetime value
 * or an ISO-looking string, else the value unchanged. Pass `type` when it's
 * known ('date'/'datetime'); otherwise an ISO-looking string is
 * auto-detected — same rule GenericListPage's own cell renderer uses (B10).
 */
export function formatCell(value: unknown, type?: 'date' | 'datetime'): string {
  if (value === null || value === undefined || value === '') return ''
  if (type === 'date') return fmtDate(value as any)
  if (type === 'datetime') return fmtDateTime(value as any)
  if (typeof value === 'string') {
    if (ISO_DATE.test(value)) return fmtDate(value)
    if (ISO_DATETIME.test(value)) return fmtDateTime(value)
  }
  return String(value)
}
