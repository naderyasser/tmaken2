// Mirror-backed compatibility layer for the ported egarsys CONTRACTS section.
// Returns the SAME camelCase shapes contracts.tsx consumes (see egarsys
// src/app/api/contracts/route.ts + [id]/route.ts + [id]/schedule/route.ts), but
// computed from the Frappe "Rental *" mirror doctypes on the current tenant site.
// READ-ONLY — no writes, no Frappe docs created.
//
// TWO mandatory mirror-fidelity rules (proven on the dashboard, applied here too):
//   1. Frappe Float can't store NULL → egarsys's null paidAmount arrives as 0. Map
//      `paid_amount ? num : null` (0 → null) when feeding the engine, so a paid
//      installment isn't mis-read as uncollected.
//   2. Naive mirror datetimes ("YYYY-MM-DD HH:MM:SS", no zone) must be anchored to
//      UTC (append Z) so counts/dates match egarsys's UTC server in any browser TZ.

import { frappeClient } from '@/lib/api-client'
import type { RentalContract, Invoice } from '@/components/rentals/egarsys/types'
import type { LifecycleContract } from '@/components/rentals/egarsys/engine/contract-lifecycle'
import {
  computeContractStatement,
  nextPaymentOf,
  isValidInvoice,
  type StatementInvoiceInput,
} from '@/components/rentals/egarsys/engine/property-statement'

// ── shared helpers (copied from lib/rentals/dashboard-data.ts) ──

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

/** snake_case → camelCase for every key (lessor_name → lessorName, rental_property_id
 *  → rentalPropertyId, …). Keeps the faithful port's direct camelCase field reads working. */
function camelizeKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    const ck = k.replace(/_([a-z0-9])/g, (_, c) => String(c).toUpperCase())
    out[ck] = v
  }
  return out
}

// ── field lists ──

const CONTRACT_LIST_FIELDS = [
  'name', 'internal_id', 'contract_number', 'ejar_contract_number', 'status', 'contract_type',
  'parent_contract_id',
  'rental_property_id', 'tenant_id', 'tenant_name', 'tenant_phone',
  'property_city', 'property_district', 'property_street', 'property_building_number',
  'property_postal_code', 'property_address', 'property_type', 'other_property_type',
  'start_date', 'end_date', 'rent_amount', 'security_deposit', 'tax_rate',
  'total_contract_value', 'installments_per_year', 'payment_frequency', 'notes', 'terms',
  'creation', 'prepaid_settled', 'paid_previously_installments',
]

const CONTRACT_DETAIL_FIELDS = [
  ...CONTRACT_LIST_FIELDS,
  'registered_calendar', 'sealing_location', 'sealing_date', 'vat_number', 'contract_attachment',
  'attachments_by_doc_type', 'prepaid_note', 'created_by_id', 'parent_contract_id', 'unit_id',
  'lessor_name', 'lessor_national_id', 'lessor_phone', 'lessor_address', 'lessor_national_address',
  'lessor_vat_registration_number', 'lessor_street', 'lessor_building_number', 'lessor_city',
  'lessor_district', 'lessor_postal_code', 'lessor_additional_number',
  'tenant_party_type', 'tenant_company_name', 'tenant_cr_number', 'tenant_unified_number',
  'tenant_national_id', 'tenant_vat_registration_number', 'tenant_email', 'tenant_national_address',
  'tenant_street', 'tenant_building_number', 'tenant_city', 'tenant_district', 'tenant_postal_code',
  'tenant_additional_number', 'tenant_representative_name', 'tenant_representative_mobile',
]

const INVOICE_FIELDS = [
  'name', 'invoice_number', 'contract_id', 'installment_no', 'total_installments',
  'total_value', 'vat_amount', 'paid_amount', 'paid_date', 'due_date', 'status',
  'payment_method', 'zatca_document_type',
]

// ── raw row types ──

type ContractRow = Record<string, unknown> & { name: string; status?: string }
type PropertyRow = { name: string; title?: string; title_ar?: string | null; city?: string | null; district?: string | null; deed_number?: string | null; deed_date?: string | null; owner_id?: string | null }
type OwnerRow = { name: string; name_val?: string | null; national_id?: string | null; phone?: string | null; address?: string | null }
type TenantRow = { name: string; name_val?: string | null; phone?: string | null; email?: string | null; national_id?: string | null; company_name?: string | null; cr_number?: string | null; unified_number?: string | null; address?: string | null; representative_name?: string | null; representative_mobile?: string | null }
type InvoiceRow = Record<string, unknown> & { name: string }

// ── invoice mapping (engine input + payment-history view) ──

/** Engine input for one invoice — applies the Float-NULL rule (0 → null). */
function toStatementInvoice(inv: InvoiceRow): StatementInvoiceInput {
  return {
    installmentNo: num(inv.installment_no),
    documentType: (inv.zatca_document_type as string) || 'invoice',
    status: (inv.status as string) ?? null,
    totalValue: num(inv.total_value),
    vatAmount: num(inv.vat_amount),
    paidAmount: inv.paid_amount ? num(inv.paid_amount) : null,
  }
}

/** Full invoice view for the detail dialog's payment-history table. */
function toInvoiceView(inv: InvoiceRow): Invoice {
  return {
    id: inv.name,
    invoiceNumber: (inv.invoice_number as string) || '—',
    installmentNo: num(inv.installment_no),
    totalInstallments: num(inv.total_installments),
    totalValue: num(inv.total_value),
    vatAmount: num(inv.vat_amount),
    paidAmount: inv.paid_amount ? num(inv.paid_amount) : null,
    dueDate: isoDate(inv.due_date as string) || '',
    status: (inv.status as string) || 'unpaid',
    paymentMethod: (inv.payment_method as string) || null,
    documentType: (inv.zatca_document_type as string) || 'invoice',
  }
}

// ── core mapping: one contract row → RentalContract (with engine-derived fields) ──

function mapContract(
  row: ContractRow,
  invoicesForContract: InvoiceRow[],
  propTitle: Map<string, string>,
  now: Date,
): RentalContract {
  const base = camelizeKeys(row) as Record<string, unknown>
  const start = toDate(row.start_date as string)
  const end = toDate(row.end_date as string)
  const orig = (row.status as string) || ''
  // Auto-expiry relabel — identical to egarsys's list/detail routes.
  const isDateExpired = !!end && end < now && orig !== 'terminated' && orig !== 'moved_out'
  const displayStatus = isDateExpired && orig !== 'expired' ? 'expired' : orig

  const stmtInvoices = invoicesForContract.map(toStatementInvoice)
  const stmt = computeContractStatement(
    {
      startDate: start ?? new Date(0),
      endDate: end ?? new Date(0),
      rentAmount: num(row.rent_amount),
      paymentFrequency: (row.payment_frequency as string) || 'annual',
      taxRate: row.tax_rate != null ? num(row.tax_rate) : null,
      prepaidSettled: !!num(row.prepaid_settled),
      paidPreviously: parseJsonField(row.paid_previously_installments),
    },
    stmtInvoices,
    now,
  )
  const nextPayment = start && end ? nextPaymentOf(stmt) : null
  const daysUntilExpiry = end ? Math.ceil((end.getTime() - now.getTime()) / 86_400_000) : undefined

  const rentalPropertyId = (row.rental_property_id as string) || null

  return {
    ...(base as object),
    id: row.name,
    contractNumber: (row.contract_number as string) || row.name,
    internalId: row.internal_id != null ? num(row.internal_id) : null,
    ejarContractNumber: (row.ejar_contract_number as string) || null,
    // «رقم عقد المنصة» display value — the Ejar number, falling back to the local
    // contract number when Ejar is empty. Display-only; the true Ejar value stays in
    // ejarContractNumber (badges / «رقم العقد في إيجار» must not show a non-Ejar number).
    platformContractNumber:
      (row.ejar_contract_number as string) || (row.contract_number as string) || row.name,
    status: displayStatus,
    contractType: (row.contract_type as string) || 'new',
    startDate: isoDate(row.start_date as string) || '',
    endDate: isoDate(row.end_date as string) || '',
    rentAmount: num(row.rent_amount),
    securityDeposit: num(row.security_deposit),
    taxRate: num(row.tax_rate),
    totalContractValue: row.total_contract_value != null ? num(row.total_contract_value) : null,
    installmentsPerYear: num(row.installments_per_year),
    paymentFrequency: (row.payment_frequency as string) || 'annual',
    tenantId: (row.tenant_id as string) || null,
    tenantName: (row.tenant_name as string) || null,
    tenantPhone: (row.tenant_phone as string) || null,
    propertyCity: (row.property_city as string) || null,
    rentalPropertyId,
    propertyTitle: (rentalPropertyId && propTitle.get(rentalPropertyId)) || undefined,
    prepaidSettled: !!num(row.prepaid_settled),
    paidPreviouslyInstallments: parseJsonField(row.paid_previously_installments),
    // engine-derived (live, never stored)
    daysUntilExpiry,
    outstandingTotal: stmt.outstandingTotal,
    hasOutstanding: stmt.hasOutstanding,
    overdueInstallmentNos: stmt.schedule
      .filter((r) => r.state === 'overdue' || r.state === 'invoiced_overdue' || (r.state === 'next' && stmt.nextDueState === 'due'))
      .map((r) => r.installmentNo),
    nextDueNo: stmt.nextDueNo,
    nextDueState: stmt.nextDueState,
    nextDueReason: stmt.nextDueReason,
    nextPaymentDate: nextPayment?.dueDateAD ?? null,
    nextPaymentDateAH: nextPayment?.dueDateAH ?? null,
    nextPaymentAmount: nextPayment?.amount ?? null,
  }
}

// ── property-title index (ONE query, no N+1) ──

async function loadPropertyTitles(): Promise<Map<string, string>> {
  const props = await frappeClient.getList<PropertyRow>('Rental Property', {
    fields: ['name', 'title', 'title_ar'],
    limit_page_length: 0,
  })
  const m = new Map<string, string>()
  for (const p of props) m.set(p.name, p.title || p.title_ar || '')
  return m
}

// ── invoice index by contract (ONE query for the list) ──

function groupInvoices(invoices: InvoiceRow[]): Map<string, InvoiceRow[]> {
  const byContract = new Map<string, InvoiceRow[]>()
  for (const inv of invoices) {
    const cid = inv.contract_id as string
    if (!cid) continue
    const arr = byContract.get(cid) ?? []
    arr.push(inv)
    byContract.set(cid, arr)
  }
  return byContract
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API — the compat surface the contracts section calls
// ═══════════════════════════════════════════════════════════════════════════

export interface ContractFilters {
  search?: string
  status?: string
  paymentFrequency?: string
  /** Which slice of the contract list to return:
   *   • 'main'  — exclude ENDED contracts (the «العقود» section)
   *   • 'ended' — ONLY ended contracts (the «أرشيف العقود» section)
   *   • 'all'   — everything (default; kept for callers like contracts-summary)  */
  mode?: 'main' | 'ended' | 'all'
}

/** Mirror statuses that mean a contract is ENDED outright (independent of supersession). */
const ENDED_CONTRACT_STATUSES = new Set(['terminated', 'moved_out', 'archived'])

/** The set of contract `name`s that are ENDED across the whole list. A contract is ended
 *  iff its RAW mirror status is terminated/moved_out/archived, OR it has been SUPERSEDED —
 *  i.e. another Rental Contract points at it via `parent_contract_id` (a tenant change /
 *  renewal spawned a successor). Uses raw status (not the date-expired relabel), because
 *  a plain date-past «expired» contract is NOT ended — only the three terminal states are. */
export function computeEndedContractNames(
  rows: Array<{ name: string; status?: unknown; parent_contract_id?: unknown }>,
): Set<string> {
  const superseded = new Set<string>()
  for (const r of rows) {
    const parent = r.parent_contract_id
    if (parent) superseded.add(String(parent))
  }
  const ended = new Set<string>()
  for (const r of rows) {
    if (ENDED_CONTRACT_STATUSES.has(String(r.status ?? '')) || superseded.has(r.name)) {
      ended.add(r.name)
    }
  }
  return ended
}

/** The contracts LIST — all Rental Contract rows, engine-enriched, filtered +
 *  sorted like egarsys (ascending الرقم الداخلي, createdAt tie-break). */
export async function getContractsList(filters: ContractFilters = {}): Promise<RentalContract[]> {
  const now = new Date()
  const [rows, propTitle, invoices] = await Promise.all([
    frappeClient.getList<ContractRow>('Rental Contract', { fields: CONTRACT_LIST_FIELDS, limit_page_length: 0 }),
    loadPropertyTitles(),
    frappeClient.getList<InvoiceRow>('Rental Invoice', { fields: INVOICE_FIELDS, limit_page_length: 0 }),
  ])
  const byContract = groupInvoices(invoices)

  let mapped = rows.map((r) => mapContract(r, byContract.get(r.name) ?? [], propTitle, now))

  // ── ended / main split (superseded set + terminal statuses, computed over ALL rows) ──
  const mode = filters.mode ?? 'all'
  if (mode !== 'all') {
    const endedNames = computeEndedContractNames(rows)
    mapped = mode === 'ended'
      ? mapped.filter((c) => endedNames.has(c.id))
      : mapped.filter((c) => !endedNames.has(c.id))
  }

  // ── status filter (mirrors the DB WHERE in egarsys's list route, pre-relabel) ──
  const status = filters.status
  if (status && status !== 'all') {
    // c.status is already relabeled (date-expired active/draft → 'expired'), so the
    // offered filters map directly onto it — the same set egarsys's DB WHERE returns.
    mapped = mapped.filter((c) => {
      const end = c.endDate ? new Date(c.endDate) : null
      if (status === 'active') return c.status === 'active' && (!end || end >= now)
      return c.status === status
    })
  }

  // ── payment frequency filter ──
  if (filters.paymentFrequency && filters.paymentFrequency !== 'all') {
    mapped = mapped.filter((c) => c.paymentFrequency === filters.paymentFrequency)
  }

  // ── search (contract no · platform no · tenant name/phone · city · property title · internalId) ──
  const s = (filters.search || '').trim().toLowerCase()
  if (s) {
    const numeric = /^\d+$/.test(s)
    mapped = mapped.filter((c) => {
      const hay = [
        c.contractNumber, c.ejarContractNumber, c.tenantName, c.tenantPhone,
        c.propertyCity, c.propertyTitle,
      ].filter(Boolean).map((v) => String(v).toLowerCase())
      if (hay.some((h) => h.includes(s))) return true
      if (numeric && c.internalId != null && String(c.internalId) === s) return true
      return false
    })
  }

  // ── default order: ascending internalId, createdAt tie-break ──
  mapped.sort((a, b) => {
    const ai = a.internalId ?? Number.MAX_SAFE_INTEGER
    const bi = b.internalId ?? Number.MAX_SAFE_INTEGER
    if (ai !== bi) return ai - bi
    return 0
  })

  return mapped
}

/** One contract's full detail doc — property (+owner), tenant relation, engine-derived. */
export async function getContractDetail(id: string): Promise<RentalContract | null> {
  const now = new Date()
  const [rows, invoices] = await Promise.all([
    frappeClient.getList<ContractRow>('Rental Contract', {
      fields: CONTRACT_DETAIL_FIELDS,
      filters: [['Rental Contract', 'name', '=', id]],
      limit_page_length: 1,
    }),
    frappeClient.getList<InvoiceRow>('Rental Invoice', {
      fields: INVOICE_FIELDS,
      filters: [['Rental Invoice', 'contract_id', '=', id]],
      limit_page_length: 0,
    }),
  ])
  const row = rows[0]
  if (!row) return null

  // Property + owner (+ deed) and tenant relation — parallel best-effort lookups.
  const propId = (row.rental_property_id as string) || ''
  const tenantId = (row.tenant_id as string) || ''
  const [propRows, tenantRows] = await Promise.all([
    propId
      ? frappeClient.getList<PropertyRow>('Rental Property', {
          fields: ['name', 'title', 'title_ar', 'city', 'district', 'deed_number', 'deed_date', 'owner_id'],
          filters: [['Rental Property', 'name', '=', propId]],
          limit_page_length: 1,
        })
      : Promise.resolve([] as PropertyRow[]),
    tenantId
      ? frappeClient.getList<TenantRow>('Rental Tenant', {
          fields: ['name', 'name_val', 'phone', 'email', 'national_id', 'company_name', 'cr_number', 'unified_number', 'address', 'representative_name', 'representative_mobile'],
          filters: [['Rental Tenant', 'name', '=', tenantId]],
          limit_page_length: 1,
        })
      : Promise.resolve([] as TenantRow[]),
  ])
  const prop = propRows[0]
  const tenant = tenantRows[0]

  let owner: OwnerRow | undefined
  if (prop?.owner_id) {
    const ownerRows = await frappeClient.getList<OwnerRow>('Rental Owner', {
      fields: ['name', 'name_val', 'national_id', 'phone', 'address'],
      filters: [['Rental Owner', 'name', '=', prop.owner_id]],
      limit_page_length: 1,
    })
    owner = ownerRows[0]
  }

  const propTitle = new Map<string, string>()
  if (prop) propTitle.set(prop.name, prop.title || prop.title_ar || '')

  const mapped = mapContract(row, invoices, propTitle, now)

  mapped.rentalProperty = prop
    ? {
        title: prop.title || undefined,
        titleAr: prop.title_ar ?? null,
        city: prop.city ?? null,
        district: prop.district ?? null,
        deedNumber: prop.deed_number ?? null,
        deedDate: prop.deed_date ? isoDate(prop.deed_date) : null,
        owner: owner
          ? { name: owner.name_val ?? null, nationalId: owner.national_id ?? null, phone: owner.phone ?? null, address: owner.address ?? null }
          : null,
      }
    : null
  mapped.tenant = tenant
    ? {
        name: tenant.name_val ?? undefined,
        phone: tenant.phone ?? undefined,
        email: tenant.email ?? undefined,
        nationalId: tenant.national_id ?? undefined,
        companyName: tenant.company_name ?? undefined,
        crNumber: tenant.cr_number ?? undefined,
        unifiedNumber: tenant.unified_number ?? undefined,
        address: tenant.address ?? undefined,
        representativeName: tenant.representative_name ?? undefined,
        representativeMobile: tenant.representative_mobile ?? undefined,
      }
    : null
  // The mirror has no ContractUnit join doctype — no per-unit chips to show.
  mapped.contractUnits = []
  return mapped
}

/** The classified installment schedule for ONE contract (feeds the detail dialog). */
export async function getContractSchedule(id: string): Promise<{
  success: boolean
  schedule: ReturnType<typeof computeContractStatement>['schedule']
  nextDueNo: number | null
  nextDueState: 'due' | 'upcoming' | null
  nextDueReason: 'fully_invoiced' | null
}> {
  const now = new Date()
  const [rows, invoices] = await Promise.all([
    frappeClient.getList<ContractRow>('Rental Contract', {
      fields: ['name', 'status', 'start_date', 'end_date', 'rent_amount', 'payment_frequency', 'tax_rate', 'prepaid_settled', 'paid_previously_installments'],
      filters: [['Rental Contract', 'name', '=', id]],
      limit_page_length: 1,
    }),
    frappeClient.getList<InvoiceRow>('Rental Invoice', {
      fields: INVOICE_FIELDS,
      filters: [['Rental Invoice', 'contract_id', '=', id]],
      limit_page_length: 0,
    }),
  ])
  const row = rows[0]
  if (!row) return { success: false, schedule: [], nextDueNo: null, nextDueState: null, nextDueReason: null }

  const stmt = computeContractStatement(
    {
      startDate: toDate(row.start_date as string) ?? new Date(0),
      endDate: toDate(row.end_date as string) ?? new Date(0),
      rentAmount: num(row.rent_amount),
      paymentFrequency: (row.payment_frequency as string) || 'annual',
      taxRate: row.tax_rate != null ? num(row.tax_rate) : null,
      prepaidSettled: !!num(row.prepaid_settled),
      paidPreviously: parseJsonField(row.paid_previously_installments),
    },
    invoices.map(toStatementInvoice),
    now,
  )
  return {
    success: true,
    schedule: stmt.schedule,
    nextDueNo: stmt.nextDueNo,
    nextDueState: stmt.nextDueState,
    nextDueReason: stmt.nextDueReason,
  }
}

/** The contract's VALID invoices (live billing system) — payment-history table. */
export async function getContractInvoices(contractId: string): Promise<Invoice[]> {
  const invoices = await frappeClient.getList<InvoiceRow>('Rental Invoice', {
    fields: INVOICE_FIELDS,
    filters: [['Rental Invoice', 'contract_id', '=', contractId]],
    limit_page_length: 0,
  })
  return invoices
    .map(toInvoiceView)
    .filter(isValidInvoice)
    .sort((a, b) => (a.installmentNo || 0) - (b.installmentNo || 0))
}

/** Every contract on THIS contract's property — feeds the حركة العقار timeline. */
export async function getContractsForProperty(propertyId: string): Promise<LifecycleContract[]> {
  const rows = await frappeClient.getList<ContractRow>('Rental Contract', {
    fields: ['name', 'contract_number', 'ejar_contract_number', 'internal_id', 'tenant_name', 'start_date', 'end_date', 'status'],
    filters: [['Rental Contract', 'rental_property_id', '=', propertyId]],
    limit_page_length: 0,
  })
  return rows.map((r) => ({
    id: r.name,
    contractNumber: (r.contract_number as string) || r.name,
    ejarContractNumber: (r.ejar_contract_number as string) || null,
    internalId: r.internal_id != null ? num(r.internal_id) : null,
    tenantName: (r.tenant_name as string) || null,
    startDate: isoDate(r.start_date as string) || '',
    endDate: isoDate(r.end_date as string) || '',
    status: (r.status as string) || 'active',
  }))
}
