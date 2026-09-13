// Ported verbatim from egarsys src/lib/invoice-totals.ts.
// Pure, unit-tested aggregation for the invoices-page totals.
//
// ZATCA-compliance-sensitive: refund/credit notes and cancelled (voided) invoices MUST be
// excluded from the base totals and surfaced separately, so the base reconciles to the real
// sum of valid invoices. Computed over EXACTLY the rows passed in (the filtered/visible list),
// so the on-screen totals always reconcile with the displayed rows.

export interface InvoiceTotalsInput {
  documentType?: string | null
  status?: string | null
  totalValue?: number | null
  vatAmount?: number | null
}

export interface InvoiceTotals {
  baseExVat: number // الإجمالي قبل الضريبة — valid invoices only
  baseVat: number // إجمالي الضريبة
  baseGrand: number // الإجمالي الكلي (= baseExVat + baseVat)
  refunds: number // إجمالي الفواتير المستردة/الدائنة — credit notes only
  baseCount: number
  refundsCount: number
}

const num = (v: number | null | undefined): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : 0

/**
 * Partition invoice rows into base totals vs refunds.
 * - Base (before-VAT / VAT / grand): documentType 'invoice' AND status !== 'cancelled'.
 * - Refunds: credit notes (documentType 'credit_note') that aren't themselves cancelled.
 * - Cancelled rows are voided and excluded from EVERYTHING (a cancelled invoice is represented
 *   by its credit note in the refunds field — so there is no double counting).
 * - Debit notes (increases) are not base invoices nor refunds and are excluded from both.
 */
export function computeInvoiceTotals(invoices: InvoiceTotalsInput[]): InvoiceTotals {
  let baseExVat = 0
  let baseVat = 0
  let baseGrand = 0
  let refunds = 0
  let baseCount = 0
  let refundsCount = 0

  for (const inv of invoices || []) {
    if (inv?.status === 'cancelled') continue // voided — excluded from all totals
    const docType = inv?.documentType || 'invoice'
    const total = num(inv?.totalValue)
    const vat = num(inv?.vatAmount)

    if (docType === 'credit_note') {
      refunds += total
      refundsCount++
      continue
    }
    if (docType === 'debit_note') continue // increase note — not part of base totals or refunds

    // documentType 'invoice' (default)
    baseGrand += total
    baseVat += vat
    baseExVat += total - vat
    baseCount++
  }

  return { baseExVat, baseVat, baseGrand, refunds, baseCount, refundsCount }
}
