// Write layer for the ported egarsys INVOICES section — the mirror-backed
// counterpart of the READ adapter in lib/rentals/invoices-data.ts.
//
// SCOPE (deliberately narrow — see the section-by-section plan):
//   • This layer creates a DRAFT `Rental Invoice` in the isolated Frappe mirror
//     ONLY. It performs NO ZATCA / government submission whatsoever: it never
//     assigns a ZATCA uuid/icv/qr/hash/signed-xml, never sets zatca_status to
//     anything but 'draft', never calls an onboarding/clearance endpoint, and
//     never touches egarsys or its database.
//   • The «إصدار/اعتماد» (clear-to-ZATCA), record-payment, PDF, WhatsApp,
//     credit/debit notes and bulk actions stay GATED in the UI — none of them
//     is implemented here. This module has ONE public write (createInvoiceDraft).
//
// egarsys's POST /api/invoices ran server-side derivations the Frappe mirror
// doctype does NOT have (the per-company invoice_number sequence, the
// rent/vat/total computation, the strict "dates are user-entered" rule). Every
// derivation is reproduced HERE and the finished snake_case payload is written
// straight to /api/resource via `frappeClient`. Field mapping camelCase(prisma)
// → snake_case(fieldname) follows lib/rentals/spec.json (model Invoice).

import { frappeClient } from '@/lib/api-client'

const DOCTYPE = 'Rental Invoice'

// ── shared value helpers (mirror lib/rentals/contract-write.ts) ────────────

/** Empty string / undefined → null (the mirror stored NULL, not ''). */
const orNull = (v: unknown): string | null => {
  if (v === undefined || v === null) return null
  const s = String(v)
  return s.trim() === '' ? null : s
}

/** Form "YYYY-MM-DD" → the mirror's naive datetime "YYYY-MM-DD 00:00:00"
 *  (midnight — matches the migrated rows + contract-write's toMirrorDate). */
export function toMirrorDate(v?: string | null): string | null {
  if (!v) return null
  const head = String(v).slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return `${head} 00:00:00`
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : `${d.toISOString().slice(0, 10)} 00:00:00`
}

/** UTC "now" as a naive mirror timestamp "YYYY-MM-DD HH:MM:SS" (created_at/updated_at). */
export function nowStamp(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

const numOr = (v: unknown, fallback: number): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

// New docs (autoname=prompt) need an explicit name; native rentals docs use an
// ri<base36> id (same idea as contract-write's mintContractName / rc<base36>).
export const mintInvoiceName = (): string =>
  'ri' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)

// ── per-company invoice_number sequence (mirrors egarsys) ──────────────────

export interface InvoiceSeqContext {
  /** company_id to stamp on new docs (the tenant site's own company). */
  companyId: string | null
  /** The next INV-00000001-style number in that company's sequence. */
  nextInvoiceNumber: string
}

/** Numeric part of an invoice number (INV-00000042 → 42; robust to any prefix). */
function lastNumericPart(v: unknown): number {
  const m = String(v ?? '').match(/(\d+)/g)
  return m ? parseInt(m[m.length - 1], 10) || 0 : 0
}

/** ONE query: derive the site's company_id (the one most invoices carry) and the
 *  next INV-xxxxxxxx in that company's sequence — egarsys's per-company counter
 *  (max numeric part of invoice_number for the company, +1). Invoice numbers are
 *  per-company & non-unique across tenants, so scope the max by company_id. */
export async function getInvoiceSeqContext(): Promise<InvoiceSeqContext> {
  const rows = await frappeClient.getList<{ company_id?: string | null; invoice_number?: string | null }>(
    DOCTYPE,
    { fields: ['company_id', 'invoice_number'], limit_page_length: 0 },
  )

  // Most-common company_id among existing invoices.
  const counts = new Map<string, number>()
  for (const r of rows) {
    const c = r.company_id || ''
    if (c) counts.set(c, (counts.get(c) || 0) + 1)
  }
  let companyId: string | null = null
  let best = -1
  for (const [c, n] of counts) if (n > best) { best = n; companyId = c }

  // Fall back to a Rental Contract / Rental Property company_id on an empty site.
  if (!companyId) {
    try {
      const cons = await frappeClient.getList<{ company_id?: string | null }>('Rental Contract', {
        fields: ['company_id'], limit_page_length: 1,
      })
      companyId = cons[0]?.company_id || null
    } catch { /* leave null */ }
  }
  if (!companyId) {
    try {
      const props = await frappeClient.getList<{ company_id?: string | null }>('Rental Property', {
        fields: ['company_id'], limit_page_length: 1,
      })
      companyId = props[0]?.company_id || null
    } catch { /* leave null */ }
  }

  // Max numeric part scoped to this company (fall back to ALL rows if none match,
  // so the site's sequence can never collide even with a null-company derivation).
  const scoped = rows.filter((r) => (r.company_id || null) === companyId)
  const pool = scoped.length > 0 ? scoped : rows
  let maxNum = 0
  for (const r of pool) maxNum = Math.max(maxNum, lastNumericPart(r.invoice_number))

  return { companyId, nextInvoiceNumber: `INV-${String(maxNum + 1).padStart(8, '0')}` }
}

// ── payload builder (camelCase form → snake mirror) ────────────────────────

/** The invoice-form fields this writer consumes (the subset egarsys's create
 *  flow sent to POST /api/invoices). All amounts/dates arrive as form strings. */
export interface InvoiceFormInput {
  contractId?: string
  installmentNo?: string
  totalInstallments?: string
  rentValue?: string
  vatAmount?: string
  servicesAmount?: string
  totalValue?: string
  annualRent?: string
  totalContractValue?: string
  securityDeposit?: string
  issueDate?: string
  supplyDate?: string
  dueDate?: string
  periodStart?: string
  periodEnd?: string
  paymentMethod?: string
  referenceNumber?: string
  bankName?: string
  iban?: string
  bankAccountNumber?: string
  tenantBankName?: string
  tenantIban?: string
  tenantBankAccountNumber?: string
  chequeNumber?: string
  customPaymentMethod?: string
  notes?: string
}

type MirrorPayload = Record<string, string | number | null>

/** CREATE a DRAFT Rental Invoice from the form. Returns the minted doc name and
 *  the allocated invoice number.
 *
 *  SAFETY — this is a DRAFT only:
 *    • status            = 'draft'
 *    • zatca_status      = 'draft'   (never 'not_submitted'/'reported'/'cleared')
 *    • zatca_document_type = 'invoice'
 *    • NO zatca_* payload columns are set (uuid/icv/qr/hash/signed-xml/errors/…),
 *      NO paid_date / paid_amount (recording a payment is a separate GATED action).
 *  Nothing here reaches ZATCA, WhatsApp, a PDF, or egarsys. */
export async function createInvoiceDraft(
  form: InvoiceFormInput,
  ctx: InvoiceSeqContext,
): Promise<{ name: string; invoiceNumber: string }> {
  const name = mintInvoiceName()
  const stamp = nowStamp()

  const payload: MirrorPayload = {
    name,
    invoice_number: ctx.nextInvoiceNumber,
    company_id: ctx.companyId,
    contract_id: orNull(form.contractId),
    installment_no: numOr(form.installmentNo, 1),
    total_installments: numOr(form.totalInstallments, 1),
    // Totals computed client-side (rent + 15% VAT + services) — see the invoice
    // form's auto-calc effect. Persisted verbatim as Floats.
    rent_value: numOr(form.rentValue, 0),
    vat_amount: numOr(form.vatAmount, 0),
    services_amount: numOr(form.servicesAmount, 0),
    total_value: numOr(form.totalValue, 0),
    annual_rent: numOr(form.annualRent, 0),
    total_contract_value: numOr(form.totalContractValue, 0),
    security_deposit: numOr(form.securityDeposit, 0),
    // Dates are strictly user-entered (blank + manual — never auto-defaulted to now).
    issue_date: toMirrorDate(form.issueDate),
    supply_date: toMirrorDate(form.supplyDate),
    due_date: toMirrorDate(form.dueDate),
    period_start: toMirrorDate(form.periodStart),
    period_end: toMirrorDate(form.periodEnd),
    // ── DRAFT status (forced — this record is never issued/paid here) ──
    status: 'draft',
    payment_method: orNull(form.paymentMethod),
    reference_number: orNull(form.referenceNumber),
    bank_name: orNull(form.bankName),
    iban: orNull(form.iban),
    bank_account_number: orNull(form.bankAccountNumber),
    tenant_bank_name: orNull(form.tenantBankName),
    tenant_iban: orNull(form.tenantIban),
    tenant_bank_account_number: orNull(form.tenantBankAccountNumber),
    cheque_number: orNull(form.chequeNumber),
    custom_payment_method: orNull(form.customPaymentMethod),
    notes: orNull(form.notes),
    // ── ZATCA-neutral required columns (NO payload / NO submission) ──
    zatca_document_type: 'invoice',
    zatca_status: 'draft',
    tax_category_code: 'S',
    fatora_status: 'not_synced',
    created_at: stamp,
    updated_at: stamp,
  }

  await frappeClient.post(DOCTYPE, payload)
  return { name, invoiceNumber: ctx.nextInvoiceNumber }
}
