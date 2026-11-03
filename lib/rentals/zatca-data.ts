// Mirror-backed READ-ONLY adapter for the ported egarsys ZATCA section
// («الفوترة الإلكترونية»). egarsys drives that screen off its EGS-unit /
// onboarding tables (CSR → compliance CSID → production CSID → active) and the
// per-invoice ZATCA submission status. The Frappe mirror was NEVER onboarded to
// ZATCA — there is no EGS-unit/certificate data here — so the only ZATCA state
// that exists is whatever `zatca_status` / `zatca_icv` / `zatca_uuid` was copied
// onto the `Rental Invoice` rows. This adapter reads THAT and rolls it up into a
// small summary the section shows. It performs NO onboarding, NO CSR, NO
// government call, and NO writes — a single getList over Rental Invoice.
//
// Mirror-fidelity rule (same as invoices-data.ts): naive mirror datetimes
// ("YYYY-MM-DD HH:MM:SS", no zone) are anchored to UTC (append Z) so any
// "last submitted" timestamp matches egarsys's UTC server in any browser TZ.

import { frappeClient } from '@/lib/api-client'

/** Frappe DateTime → UTC-anchored ISO string (guards null/unparsable). */
function isoDate(v: string | null | undefined): string | null {
  if (!v) return null
  const s = String(v).replace(' ', 'T')
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z')
  return isNaN(d.getTime()) ? null : d.toISOString()
}

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0)

// Only the ZATCA-relevant columns — no joins, no financial/tenant data needed.
const ZATCA_FIELDS = [
  'name',
  'zatca_status',
  'zatca_icv',
  'zatca_uuid',
  'zatca_invoice_type',
  'zatca_document_type',
  'zatca_submitted_at',
] as const

type ZatcaInvoiceRow = {
  name: string
  zatca_status?: string | null
  zatca_icv?: number | null
  zatca_uuid?: string | null
  zatca_invoice_type?: string | null
  zatca_document_type?: string | null
  zatca_submitted_at?: string | null
}

/** Coarse buckets the section's summary cards render, mirroring the invoice
 *  detail badge semantics in invoices.tsx (cleared/reported = accepted;
 *  rejected/failed/error = rejected; everything else = awaiting submission). */
export interface ZatcaStatusSummary {
  /** Total Rental Invoice rows scanned. */
  total: number
  /** zatca_status = 'cleared' (standard / تفويض — مصادقة). */
  cleared: number
  /** zatca_status = 'reported' (simplified / إبلاغ). */
  reported: number
  /** null / '' / 'draft' / 'not_submitted' / 'pending' — never sent yet. */
  pending: number
  /** 'rejected' / 'failed' / 'error' — a submission failed. */
  failed: number
  /** Rows carrying a real cleared/reported chain identifier (zatca_icv > 0). */
  withIcv: number
  /** Rows carrying a ZATCA UUID (assigned once submitted). */
  withUuid: number
  /** Most recent zatca_submitted_at across all rows (UTC-anchored ISO), or null. */
  lastSubmittedAt: string | null
  /** Raw per-status tally (null/'' folded into 'not_submitted') for a detail row. */
  byStatus: Record<string, number>
}

const FAILED = new Set(['rejected', 'failed', 'error'])
const ACCEPTED = new Set(['cleared', 'reported'])

/** Roll up every Rental Invoice's ZATCA status into the summary the section shows.
 *  READ-ONLY — one getList, no writes, no ZATCA/government call. */
export async function getZatcaStatusSummary(): Promise<ZatcaStatusSummary> {
  const rows = await frappeClient.getList<ZatcaInvoiceRow>('Rental Invoice', {
    fields: ZATCA_FIELDS as unknown as string[],
    limit_page_length: 0,
  })

  const summary: ZatcaStatusSummary = {
    total: rows.length,
    cleared: 0,
    reported: 0,
    pending: 0,
    failed: 0,
    withIcv: 0,
    withUuid: 0,
    lastSubmittedAt: null,
    byStatus: {},
  }

  let lastMs = -Infinity
  for (const r of rows) {
    const raw = (r.zatca_status || '').toString().trim().toLowerCase()
    const status = raw || 'not_submitted'
    summary.byStatus[status] = (summary.byStatus[status] || 0) + 1

    if (status === 'cleared') summary.cleared++
    else if (status === 'reported') summary.reported++
    else if (FAILED.has(status)) summary.failed++
    else summary.pending++

    if (num(r.zatca_icv) > 0) summary.withIcv++
    if (r.zatca_uuid) summary.withUuid++

    const iso = isoDate(r.zatca_submitted_at)
    if (iso) {
      const ms = new Date(iso).getTime()
      if (ms > lastMs) {
        lastMs = ms
        summary.lastSubmittedAt = iso
      }
    }
  }

  return summary
}

export { ACCEPTED as ZATCA_ACCEPTED_STATUSES, FAILED as ZATCA_FAILED_STATUSES }
