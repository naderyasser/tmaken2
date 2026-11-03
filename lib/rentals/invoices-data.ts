// Mirror-backed compatibility layer for the ported egarsys INVOICES section.
// Returns the SAME camelCase shapes invoices.tsx consumes (see egarsys
// src/app/api/invoices/route.ts + [id]/route.ts — the `enriched` object), but
// computed from the Frappe "Rental Invoice" mirror doctype (+ Rental Contract for
// the contract/tenant/lessor snapshot, + Rental Property/Owner/Tenant relations)
// on the current tenant site. READ-ONLY — no writes, no Frappe docs created.
//
// TWO mandatory mirror-fidelity rules (proven on the dashboard/contracts, applied here):
//   1. Frappe Float can't store NULL → egarsys's null paidAmount arrives as 0. Map
//      `paid_amount ? num : null` (0 → null) so a paid installment isn't mis-read.
//   2. Naive mirror datetimes ("YYYY-MM-DD HH:MM:SS", no zone) must be anchored to
//      UTC (append Z) so counts/dates match egarsys's UTC server in any browser TZ.

import { frappeClient } from '@/lib/api-client'
import type { Invoice } from '@/components/rentals/egarsys/types'

// ── shared helpers (copied from lib/rentals/contracts-data.ts) ──

/** Frappe DateTime → Date (UTC-anchored; guards null/unparsable). */
function toDate(v: string | null | undefined): Date | null {
  if (!v) return null
  const s = String(v).replace(' ', 'T')
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z')
  return isNaN(d.getTime()) ? null : d
}

/** Normalise a mirror date to the ISO string the ported formatters/`new Date()` expect. */
function isoDate(v: string | null | undefined): string | null {
  const d = toDate(v)
  return d ? d.toISOString() : (v ? String(v) : null)
}

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0)

function parseJsonField(v: unknown): unknown {
  if (typeof v === 'string') {
    if (!v.trim()) return null
    try { return JSON.parse(v) } catch { return null }
  }
  return v
}

// ── field lists ──

const INVOICE_LIST_FIELDS = [
  'name', 'invoice_number', 'contract_id', 'installment_no', 'total_installments',
  'rent_value', 'vat_amount', 'services_amount', 'total_value', 'annual_rent',
  'total_contract_value', 'security_deposit',
  'issue_date', 'supply_date', 'due_date', 'period_start', 'period_end',
  'status', 'paid_date', 'paid_amount', 'payment_method', 'reference_number',
  'bank_name', 'iban', 'bank_account_number',
  'tenant_bank_name', 'tenant_iban', 'tenant_bank_account_number',
  'cheque_number', 'custom_payment_method', 'notes', 'invoice_attachment',
  'zatca_document_type', 'zatca_status', 'zatca_invoice_type', 'zatca_icv', 'zatca_qr',
  'zatca_errors', 'original_invoice_number', 'note_reason',
  'whatsapp_status', 'whatsapp_sent_at', 'creation',
]

const CONTRACT_JOIN_FIELDS = [
  'name', 'contract_number', 'ejar_contract_number', 'contract_type',
  'start_date', 'end_date', 'sealing_location', 'sealing_date', 'vat_number',
  'rent_amount', 'rental_property_id', 'tenant_id',
  'lessor_name', 'lessor_national_id', 'lessor_phone', 'lessor_address',
  'tenant_name', 'tenant_company_name', 'tenant_cr_number', 'tenant_unified_number',
  'tenant_national_id', 'tenant_phone', 'tenant_email',
]

// ── raw row types ──

type InvoiceRow = Record<string, unknown> & { name: string }
type ContractRow = Record<string, unknown> & { name: string }
type PropertyRow = { name: string; title?: string | null; title_ar?: string | null; address?: string | null; city?: string | null; district?: string | null; owner_id?: string | null }
type OwnerRow = { name: string; name_val?: string | null; national_id?: string | null; phone?: string | null; address?: string | null; iban?: string | null; bank_account?: string | null }
type TenantRow = { name: string; name_val?: string | null; phone?: string | null; email?: string | null; company_name?: string | null; cr_number?: string | null; unified_number?: string | null; national_id?: string | null }

interface JoinCtx {
  contracts: Map<string, ContractRow>
  properties: Map<string, PropertyRow>
  owners: Map<string, OwnerRow>
  tenants: Map<string, TenantRow>
}

const s = (v: unknown): string | null => (v == null || v === '' ? null : String(v))

// ── core mapping: one Rental Invoice row (+ joins) → the enriched Invoice shape ──

function mapInvoice(inv: InvoiceRow, ctx: JoinCtx): Invoice {
  const contractId = (inv.contract_id as string) || ''
  const contract = ctx.contracts.get(contractId)
  const propId = contract ? (contract.rental_property_id as string) || '' : ''
  const property = propId ? ctx.properties.get(propId) : undefined
  const owner = property?.owner_id ? ctx.owners.get(property.owner_id) : undefined
  const tenantId = contract ? (contract.tenant_id as string) || '' : ''
  const tenant = tenantId ? ctx.tenants.get(tenantId) : undefined

  return {
    // ── invoice's own columns ──
    id: inv.name,
    invoiceNumber: (inv.invoice_number as string) || inv.name,
    contractId,
    installmentNo: num(inv.installment_no),
    totalInstallments: num(inv.total_installments),
    rentValue: num(inv.rent_value),
    vatAmount: num(inv.vat_amount),
    servicesAmount: num(inv.services_amount),
    totalValue: num(inv.total_value),
    annualRent: num(inv.annual_rent),
    totalContractValue: inv.total_contract_value != null ? num(inv.total_contract_value) : 0,
    securityDeposit: num(inv.security_deposit),
    issueDate: isoDate(inv.issue_date as string) || '',
    supplyDate: isoDate(inv.supply_date as string) || '',
    dueDate: isoDate(inv.due_date as string) || '',
    periodStart: isoDate(inv.period_start as string) || '',
    periodEnd: isoDate(inv.period_end as string) || '',
    status: (inv.status as string) || 'unpaid',
    // Float-NULL rule: 0 → null (never mis-read an uncollected invoice as paid 0).
    paidDate: isoDate(inv.paid_date as string),
    paidAmount: inv.paid_amount ? num(inv.paid_amount) : null,
    paymentMethod: s(inv.payment_method),
    referenceNumber: s(inv.reference_number),
    bankName: s(inv.bank_name),
    tenantBankName: s(inv.tenant_bank_name),
    tenantIban: s(inv.tenant_iban),
    tenantBankAccountNumber: s(inv.tenant_bank_account_number),
    chequeNumber: s(inv.cheque_number),
    customPaymentMethod: s(inv.custom_payment_method),
    notes: s(inv.notes),
    invoiceAttachment: s(inv.invoice_attachment),
    // ── ZATCA e-invoicing fields (drive the detail dialog badge/QR/errors) ──
    documentType: (inv.zatca_document_type as string) || 'invoice',
    zatcaStatus: s(inv.zatca_status),
    invoiceType: s(inv.zatca_invoice_type),
    icv: inv.zatca_icv != null ? num(inv.zatca_icv) : 0,
    zatcaQr: s(inv.zatca_qr),
    zatcaErrors: parseJsonField(inv.zatca_errors),
    originalInvoiceNumber: s(inv.original_invoice_number),
    noteReason: s(inv.note_reason),
    // ── WhatsApp delivery snapshot ──
    whatsappStatus: s(inv.whatsapp_status),
    whatsappSentAt: isoDate(inv.whatsapp_sent_at as string),
    // ── joined from the parent contract (snapshot first, relation fallback) ──
    contractNumber: contract ? (contract.contract_number as string) || contract.name : null,
    ejarContractNumber: contract ? s(contract.ejar_contract_number) : null,
    contractType: contract ? (contract.contract_type as string) || 'new' : null,
    startDate: contract ? isoDate(contract.start_date as string) : null,
    endDate: contract ? isoDate(contract.end_date as string) : null,
    sealingLocation: contract ? s(contract.sealing_location) : null,
    sealingDate: contract ? isoDate(contract.sealing_date as string) : null,
    vatNumber: contract ? s(contract.vat_number) : null,
    tenantName: (contract && s(contract.tenant_name)) || (tenant && s(tenant.name_val)) || null,
    tenantCompanyName: (contract && s(contract.tenant_company_name)) || (tenant && s(tenant.company_name)) || null,
    tenantCrNumber: (contract && s(contract.tenant_cr_number)) || (tenant && s(tenant.cr_number)) || null,
    tenantUnifiedNumber: (contract && s(contract.tenant_unified_number)) || (tenant && s(tenant.unified_number)) || null,
    tenantNationalId: (contract && s(contract.tenant_national_id)) || (tenant && s(tenant.national_id)) || null,
    tenantPhone: (contract && s(contract.tenant_phone)) || (tenant && s(tenant.phone)) || null,
    tenantEmail: (contract && s(contract.tenant_email)) || (tenant && s(tenant.email)) || null,
    lessorName: (contract && s(contract.lessor_name)) || (owner && s(owner.name_val)) || null,
    lessorNationalId: (contract && s(contract.lessor_national_id)) || (owner && s(owner.national_id)) || null,
    lessorPhone: (contract && s(contract.lessor_phone)) || (owner && s(owner.phone)) || null,
    lessorAddress: (contract && s(contract.lessor_address)) || (owner && s(owner.address)) || null,
    // ── property snapshot ──
    propertyTitle: property ? (s(property.title_ar) || s(property.title)) : null,
    propertyAddress: property ? s(property.address) : null,
    propertyCity: property ? s(property.city) : null,
    // ── owner bank fallbacks (invoice value wins, else the property owner's) ──
    iban: s(inv.iban) || (owner && s(owner.iban)) || null,
    bankAccountNumber: s(inv.bank_account_number) || (owner && s(owner.bank_account)) || null,
  }
}

// ── build the join context with ONE query per related doctype (no N+1) ──

async function loadJoinCtx(): Promise<JoinCtx> {
  const [contracts, properties, owners, tenants] = await Promise.all([
    frappeClient.getList<ContractRow>('Rental Contract', { fields: CONTRACT_JOIN_FIELDS, limit_page_length: 0 }),
    frappeClient.getList<PropertyRow>('Rental Property', {
      fields: ['name', 'title', 'title_ar', 'address', 'city', 'district', 'owner_id'],
      limit_page_length: 0,
    }),
    frappeClient.getList<OwnerRow>('Rental Owner', {
      fields: ['name', 'name_val', 'national_id', 'phone', 'address', 'iban', 'bank_account'],
      limit_page_length: 0,
    }),
    frappeClient.getList<TenantRow>('Rental Tenant', {
      fields: ['name', 'name_val', 'phone', 'email', 'company_name', 'cr_number', 'unified_number', 'national_id'],
      limit_page_length: 0,
    }),
  ])
  return {
    contracts: new Map(contracts.map((c) => [c.name, c])),
    properties: new Map(properties.map((p) => [p.name, p])),
    owners: new Map(owners.map((o) => [o.name, o])),
    tenants: new Map(tenants.map((t) => [t.name, t])),
  }
}

/** Numeric part of an invoice number (INV-00000123 → 123) for desc ordering. */
function invNum(n: unknown): number {
  const m = String(n ?? '').match(/(\d+)/g)
  return m ? parseInt(m[m.length - 1], 10) || 0 : 0
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API — the compat surface the invoices section calls
// ═══════════════════════════════════════════════════════════════════════════

export interface InvoiceFilters {
  search?: string
  status?: string
  limit?: number
}

/** The invoices LIST — all Rental Invoice rows, contract/tenant/property-joined,
 *  filtered + ordered like egarsys (newest invoice number first). Returns the FULL
 *  enriched shape so the detail dialog reads straight from the selected row. */
export async function getInvoicesList(filters: InvoiceFilters = {}): Promise<Invoice[]> {
  const [rows, ctx] = await Promise.all([
    frappeClient.getList<InvoiceRow>('Rental Invoice', { fields: INVOICE_LIST_FIELDS, limit_page_length: 0 }),
    loadJoinCtx(),
  ])

  let mapped = rows.map((r) => mapInvoice(r, ctx))

  // ── status filter (exact, mirrors egarsys's DB WHERE) ──
  if (filters.status && filters.status !== 'all') {
    mapped = mapped.filter((inv) => inv.status === filters.status)
  }

  // ── search (invoice/contract/platform numbers · tenant name/company/phone · city) ──
  const q = (filters.search || '').trim().toLowerCase()
  if (q) {
    mapped = mapped.filter((inv) => {
      const hay = [
        inv.invoiceNumber, inv.contractNumber, inv.ejarContractNumber,
        inv.tenantName, inv.tenantCompanyName, inv.tenantPhone, inv.propertyCity,
      ].filter(Boolean).map((v) => String(v).toLowerCase())
      return hay.some((h) => h.includes(q))
    })
  }

  // ── default order: newest invoice number first ──
  mapped.sort((a, b) => invNum(b.invoiceNumber) - invNum(a.invoiceNumber))

  return mapped
}

/** One invoice's full enriched doc (deep-link / single fetch). */
export async function getInvoiceDetail(id: string): Promise<Invoice | null> {
  const [rows, ctx] = await Promise.all([
    frappeClient.getList<InvoiceRow>('Rental Invoice', {
      fields: INVOICE_LIST_FIELDS,
      filters: [['Rental Invoice', 'name', '=', id]],
      limit_page_length: 1,
    }),
    loadJoinCtx(),
  ])
  const row = rows[0]
  return row ? mapInvoice(row, ctx) : null
}
