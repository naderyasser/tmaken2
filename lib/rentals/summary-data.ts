// Mirror-backed compatibility layer for the ported egarsys REPORT sections:
//   • مختصر العقارات (contracts-summary) reuses lib/rentals/contracts-data (getContractsList)
//   • جرد العقارات / كشف حساب العقار (property-statement) is served entirely from here.
//
// This module ports egarsys's server-side statement assembly (src/lib/
// property-statement-data.ts + contract-reference-data.ts + property-ledger-data.ts)
// to read the Frappe "Rental *" mirror doctypes instead of the Prisma DB, returning
// the EXACT same JSON shapes the section + its two dialogs + the printable-HTML
// builders consume. READ-ONLY — no writes, no Frappe docs created.
//
// TWO mandatory mirror-fidelity rules (proven on the dashboard/contracts port):
//   1. Frappe Float can't store NULL → egarsys's null paidAmount arrives as 0. Map
//      `paid_amount ? num : null` (0 → null) so a paid installment isn't mis-read.
//   2. Naive mirror datetimes ("YYYY-MM-DD HH:MM:SS", no zone) must be anchored to
//      UTC (append Z) so counts/dates match egarsys's UTC server in any browser TZ.
//
// The per-contract money math is NOT re-implemented — every figure flows through the
// already-ported engine computeContractStatement (single source of truth), exactly
// like egarsys's own lib does.

import { frappeClient } from '@/lib/api-client'
import type { FrappeFilter } from '@/lib/api-client'
import { ContractStatusLabels, type ContractStatusValue } from '@/components/rentals/egarsys/types'
import {
  computeContractStatement,
  collectedAmount,
  type StatementInvoiceInput,
} from '@/components/rentals/egarsys/engine/property-statement'
import type {
  StatementView,
  InventoryRowView,
  InventoryTotalsView,
  LedgerView,
  LedgerEntryView,
  ContractReferenceView,
  ReferenceJardRowView,
  InstallmentView,
} from '@/components/rentals/egarsys/property-statement-html'

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

/** Fidelity rule #1 — a Float/Int the mirror stores as 0-for-null → null (0 → null). */
const floatOrNull = (v: unknown): number | null => {
  const n = num(v)
  return n ? n : null
}

function parseJsonField(v: unknown): unknown {
  if (typeof v === 'string') {
    if (!v.trim()) return null
    try { return JSON.parse(v) } catch { return null }
  }
  return v
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Auxiliary doctypes must degrade gracefully (missing/forbidden → []). */
async function safeList<T = Record<string, unknown>>(
  doctype: string,
  options: Parameters<typeof frappeClient.getList>[1],
): Promise<T[]> {
  try {
    return (await frappeClient.getList<T>(doctype, options)) as T[]
  } catch {
    return []
  }
}

// Terminal/departed statuses whose tenants surface an outstanding balance.
const DEPARTED_STATUSES = new Set(['moved_out', 'expired', 'terminated'])

// ── field lists ──

const CONTRACT_FIELDS = [
  'name', 'internal_id', 'contract_number', 'ejar_contract_number', 'tenant_name', 'tenant_id',
  'status', 'start_date', 'end_date', 'rent_amount', 'payment_frequency', 'tax_rate',
  'prepaid_settled', 'paid_previously_installments', 'rental_property_id', 'unit_id', 'parent_contract_id',
]
const PROPERTY_FIELDS = [
  'name', 'internal_id', 'deed_number', 'shop_number', 'title', 'title_ar',
  'property_type', 'status', 'address', 'city', 'district', 'owner_id',
]
const INVOICE_FIELDS = [
  'name', 'invoice_number', 'contract_id', 'installment_no', 'zatca_document_type', 'status',
  'total_value', 'vat_amount', 'paid_amount', 'issue_date', 'paid_date',
]
const TRANSACTION_FIELDS = ['date', 'amount', 'category', 'supplier_name', 'invoice_number', 'description', 'type', 'property_id', 'contract_id']

// ── raw row types ──

type ContractRow = Record<string, unknown> & { name: string }
type PropertyRow = Record<string, unknown> & { name: string }
type UnitRow = { name: string; property_id?: string | null }
type ContractUnitRow = { contract_id?: string | null; unit_id?: string | null }
type OwnerRow = { name: string; name_val?: string | null; phone?: string | null }
type TenantRow = { name: string; name_val?: string | null }
type InvoiceRow = Record<string, unknown> & { name: string }
type TransactionRow = Record<string, unknown>

// ── invoice → engine input (Float-NULL rule: 0 → null paidAmount) ──

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

/** Build the engine input for a contract row (matches contracts-data.ts). */
function contractStatementInput(c: ContractRow) {
  return {
    startDate: toDate(c.start_date as string) ?? new Date(0),
    endDate: toDate(c.end_date as string) ?? new Date(0),
    rentAmount: num(c.rent_amount),
    paymentFrequency: (c.payment_frequency as string) || 'annual',
    taxRate: floatOrNull(c.tax_rate),
    prepaidSettled: !!num(c.prepaid_settled),
    paidPreviously: parseJsonField(c.paid_previously_installments),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Core load — ONE bulk pull of every doctype the statement math needs (no N+1).
// Shared by all the assembly functions below.
// ═══════════════════════════════════════════════════════════════════════════

interface Core {
  contracts: ContractRow[]
  propertyMap: Map<string, PropertyRow>
  properties: PropertyRow[]
  unitToProperty: Map<string, string>
  unitsByProperty: Map<string, number>
  contractUnitsByContract: Map<string, string[]>
  invoicesByContract: Map<string, InvoiceRow[]>
  tenantMap: Map<string, string>
  ownerMap: Map<string, OwnerRow>
}

async function loadCore(): Promise<Core> {
  const [properties, units, contracts, contractUnits, invoices, owners, tenants] = await Promise.all([
    frappeClient.getList<PropertyRow>('Rental Property', { fields: PROPERTY_FIELDS, limit_page_length: 0 }),
    safeList<UnitRow>('Rental Unit', { fields: ['name', 'property_id'], limit_page_length: 0 }),
    frappeClient.getList<ContractRow>('Rental Contract', { fields: CONTRACT_FIELDS, limit_page_length: 0 }),
    safeList<ContractUnitRow>('Rental Contract Unit', { fields: ['contract_id', 'unit_id'], limit_page_length: 0 }),
    frappeClient.getList<InvoiceRow>('Rental Invoice', { fields: INVOICE_FIELDS, limit_page_length: 0 }),
    safeList<OwnerRow>('Rental Owner', { fields: ['name', 'name_val', 'phone'], limit_page_length: 0 }),
    safeList<TenantRow>('Rental Tenant', { fields: ['name', 'name_val'], limit_page_length: 0 }),
  ])

  const propertyMap = new Map(properties.map((p) => [p.name, p]))
  const unitToProperty = new Map<string, string>()
  const unitsByProperty = new Map<string, number>()
  for (const u of units) {
    const pid = (u.property_id as string) || ''
    if (!pid) continue
    unitToProperty.set(u.name, pid)
    unitsByProperty.set(pid, (unitsByProperty.get(pid) ?? 0) + 1)
  }
  const contractUnitsByContract = new Map<string, string[]>()
  for (const cu of contractUnits) {
    const cid = (cu.contract_id as string) || ''
    const uid = (cu.unit_id as string) || ''
    if (!cid || !uid) continue
    const arr = contractUnitsByContract.get(cid) ?? []
    arr.push(uid)
    contractUnitsByContract.set(cid, arr)
  }
  const invoicesByContract = new Map<string, InvoiceRow[]>()
  for (const inv of invoices) {
    const cid = (inv.contract_id as string) || ''
    if (!cid) continue
    const arr = invoicesByContract.get(cid) ?? []
    arr.push(inv)
    invoicesByContract.set(cid, arr)
  }
  const tenantMap = new Map(tenants.map((t) => [t.name, t.name_val || '']))
  const ownerMap = new Map(owners.map((o) => [o.name, o]))

  return { contracts, propertyMap, properties, unitToProperty, unitsByProperty, contractUnitsByContract, invoicesByContract, tenantMap, ownerMap }
}

/** Every property this contract belongs to (direct link, legacy unit, multi-unit join). */
function resolvePids(c: ContractRow, core: Core): Set<string> {
  const pids = new Set<string>()
  const direct = (c.rental_property_id as string) || ''
  if (direct) pids.add(direct)
  const unitId = (c.unit_id as string) || ''
  if (unitId && core.unitToProperty.has(unitId)) pids.add(core.unitToProperty.get(unitId)!)
  for (const uid of core.contractUnitsByContract.get(c.name) ?? []) {
    if (core.unitToProperty.has(uid)) pids.add(core.unitToProperty.get(uid)!)
  }
  return pids
}

function tenantOf(c: ContractRow, core: Core): string | null {
  return (c.tenant_name as string) || core.tenantMap.get((c.tenant_id as string) || '') || null
}

// ═══════════════════════════════════════════════════════════════════════════
// جرد (inventory) — one summary row per property (assemblePropertySummaries).
// ═══════════════════════════════════════════════════════════════════════════

export async function getPropertyStatementSummary(): Promise<{ properties: InventoryRowView[]; totals: InventoryTotalsView }> {
  const now = new Date()
  const core = await loadCore()

  type Agg = { contractsCount: number; debtTotal: number; invoiced: number; collected: number; currentTenant: string | null; currentTenantStart: number }
  const agg = new Map<string, Agg>()
  for (const p of core.properties) agg.set(p.name, { contractsCount: 0, debtTotal: 0, invoiced: 0, collected: 0, currentTenant: null, currentTenantStart: 0 })

  let activeAttached = 0
  for (const c of core.contracts) {
    const pids = resolvePids(c, core)
    if (!pids.size) continue // unlinked — surfaced separately via unlinked-count
    const status = (c.status as string) || 'active'
    if (status === 'active') activeAttached++

    const stmt = computeContractStatement(
      contractStatementInput(c),
      (core.invoicesByContract.get(c.name) ?? []).map(toStatementInvoice),
      now,
    )
    const tenant = tenantOf(c, core)
    const startMs = toDate(c.start_date as string)?.getTime() ?? 0

    for (const pid of pids) {
      const a = agg.get(pid)
      if (!a) continue
      a.contractsCount++
      a.debtTotal += stmt.overdueTotal
      a.invoiced += stmt.invoiced
      a.collected += stmt.collected
      if (status === 'active' && startMs >= a.currentTenantStart && tenant) {
        a.currentTenant = tenant
        a.currentTenantStart = startMs
      }
    }
  }

  const rows: InventoryRowView[] = core.properties
    .map((p) => {
      const a = agg.get(p.name)!
      return {
        id: p.name,
        internalId: num(p.internal_id),
        deedNumber: (p.deed_number as string) || null,
        shopNumber: (p.shop_number as string) || null,
        title: (p.title_ar as string) || (p.title as string) || '',
        city: (p.city as string) || '',
        currentTenant: a.currentTenant,
        contractsCount: a.contractsCount,
        debtTotal: round2(a.debtTotal),
        invoiced: round2(a.invoiced),
        collected: round2(a.collected),
      }
    })
    .sort((x, y) => (x.internalId || 0) - (y.internalId || 0))

  const totals: InventoryTotalsView = {
    properties: rows.length,
    contracts: rows.reduce((s, r) => s + r.contractsCount, 0),
    activeContracts: activeAttached,
    debtTotal: round2(rows.reduce((s, r) => s + r.debtTotal, 0)),
    invoiced: round2(rows.reduce((s, r) => s + r.invoiced, 0)),
    collected: round2(rows.reduce((s, r) => s + r.collected, 0)),
  }

  return { properties: rows, totals }
}

// ── unlinked-count (contracts with no property link at all) ──

export async function getUnlinkedContractsCount(): Promise<number> {
  const core = await loadCore()
  let count = 0
  for (const c of core.contracts) {
    const hasDirect = !!(c.rental_property_id as string)
    const hasUnit = !!(c.unit_id as string)
    const hasContractUnit = (core.contractUnitsByContract.get(c.name)?.length ?? 0) > 0
    if (!hasDirect && !hasUnit && !hasContractUnit) count++
  }
  return count
}

// ═══════════════════════════════════════════════════════════════════════════
// كشف حساب عقار (assemblePropertyStatement) — full statement for one property.
// ═══════════════════════════════════════════════════════════════════════════

export async function getPropertyStatement(propertyId: string): Promise<StatementView | null> {
  const now = new Date()
  const core = await loadCore()
  const property = core.propertyMap.get(propertyId)
  if (!property) return null

  const contracts = core.contracts
    .filter((c) => resolvePids(c, core).has(propertyId))
    .sort((a, b) => (toDate(a.start_date as string)?.getTime() ?? 0) - (toDate(b.start_date as string)?.getTime() ?? 0))

  const perContract = contracts.map((c) => ({
    c,
    invoices: core.invoicesByContract.get(c.name) ?? [],
    stmt: computeContractStatement(contractStatementInput(c), (core.invoicesByContract.get(c.name) ?? []).map(toStatementInvoice), now),
  }))

  const timeline = perContract.map(({ c, stmt }) => {
    const status = (c.status as string) || 'active'
    return {
      contractId: c.name,
      contractNumber: (c.contract_number as string) || c.name,
      internalId: num(c.internal_id),
      ejarContractNumber: (c.ejar_contract_number as string) || null,
      tenantName: tenantOf(c, core),
      startDate: isoDate(c.start_date as string) || '',
      endDate: isoDate(c.end_date as string) || '',
      status,
      statusLabelAr: ContractStatusLabels[status as ContractStatusValue]?.ar ?? status,
      isDeparted: DEPARTED_STATUSES.has(status),
      invoiced: stmt.invoiced,
      collected: stmt.collected,
      dueToDate: stmt.dueToDate,
      contractedRent: stmt.contractedRent,
      outstanding: stmt.outstanding,
      overdueTotal: stmt.overdueTotal,
    }
  })

  const overdueUninvoiced = perContract.flatMap(({ c, stmt }) =>
    stmt.overdueUninvoiced.map((r) => ({
      contractId: c.name,
      contractNumber: (c.contract_number as string) || c.name,
      tenantName: tenantOf(c, core),
      installmentNo: r.installmentNo,
      dueDateAD: r.dueDateAD,
      dueDateAH: r.dueDateAH,
      amount: r.amount,
    })),
  )
  const debtTotal = round2(overdueUninvoiced.reduce((s, r) => s + r.amount, 0))

  // Financial aggregates over the FULL valid-invoice scope (mirror of the SQL).
  const allInvoices = perContract.flatMap((x) => x.invoices)
  const validInvoices = allInvoices.filter((i) => ((i.zatca_document_type as string) || 'invoice') === 'invoice' && i.status !== 'cancelled')
  const creditNotes = allInvoices.filter((i) => (i.zatca_document_type as string) === 'credit_note')

  // Expenses recorded against this property.
  const expenses = await safeList<TransactionRow>('Rental Transaction', {
    fields: TRANSACTION_FIELDS,
    filters: [
      ['Rental Transaction', 'property_id', '=', propertyId],
      ['Rental Transaction', 'type', '=', 'expense'],
    ],
    limit_page_length: 0,
  })
  const expenseByCatMap = new Map<string, number>()
  let totalExpenses = 0
  for (const t of expenses) {
    const amt = num(t.amount)
    totalExpenses += amt
    const cat = (t.category as string) || 'غير مصنّف'
    expenseByCatMap.set(cat, (expenseByCatMap.get(cat) ?? 0) + amt)
  }

  const summary = {
    totalRentsContracted: round2(timeline.reduce((s, t) => s + t.contractedRent, 0)),
    totalInvoiced: round2(validInvoices.reduce((s, i) => s + num(i.total_value), 0)),
    totalCollected: round2(timeline.reduce((s, t) => s + t.collected, 0)),
    totalCollectedBase: round2(perContract.reduce((s, x) => s + x.stmt.collectedBase, 0)),
    totalCollectedVat: round2(perContract.reduce((s, x) => s + x.stmt.collectedVat, 0)),
    totalVat: round2(validInvoices.reduce((s, i) => s + num(i.vat_amount), 0)),
    totalExpenses: round2(totalExpenses),
    expenseByCategory: [...expenseByCatMap.entries()]
      .map(([category, amount]) => ({ category, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount),
    creditNotesTotal: round2(creditNotes.reduce((s, i) => s + num(i.total_value), 0)),
  }

  const owner = property.owner_id ? core.ownerMap.get(property.owner_id as string) : undefined

  return {
    property: {
      id: property.name,
      internalId: num(property.internal_id),
      deedNumber: (property.deed_number as string) || null,
      shopNumber: (property.shop_number as string) || null,
      title: (property.title as string) || '',
      titleAr: (property.title_ar as string) || null,
      propertyType: (property.property_type as string) || 'apartment',
      status: (property.status as string) || 'available',
      address: (property.address as string) || '',
      city: (property.city as string) || '',
      district: (property.district as string) || null,
      unitsCount: core.unitsByProperty.get(property.name) ?? 0,
      owner: owner ? { id: owner.name, name: owner.name_val ?? null, phone: owner.phone ?? null } : null,
    },
    timeline,
    overdueUninvoiced,
    debtTotal,
    summary,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// سجل حركات العقار (buildContractLedgerEntries + assemblePropertyLedger).
// ═══════════════════════════════════════════════════════════════════════════

/** Normalised contract shape the ledger builder needs (already UTC-anchored ISO dates). */
interface LedgerContract {
  contractNumber: string
  tenantName: string | null
  status: string
  startDate: string
  endDate: string
  isRenewal: boolean
  invoices: Array<{
    invoiceNumber: string
    documentType: string
    status: string | null
    totalValue: number
    vatAmount: number
    paidAmount: number | null
    issueDate: string
    paidDate: string | null
    installmentNo: number
  }>
}

function toLedgerContract(c: ContractRow, core: Core): LedgerContract {
  const invoices = (core.invoicesByContract.get(c.name) ?? []).map((inv) => ({
    invoiceNumber: (inv.invoice_number as string) || inv.name,
    documentType: (inv.zatca_document_type as string) || 'invoice',
    status: (inv.status as string) ?? null,
    totalValue: num(inv.total_value),
    vatAmount: num(inv.vat_amount),
    paidAmount: inv.paid_amount ? num(inv.paid_amount) : null,
    issueDate: isoDate(inv.issue_date as string) || isoDate(inv.paid_date as string) || new Date().toISOString(),
    paidDate: isoDate(inv.paid_date as string),
    installmentNo: num(inv.installment_no),
  }))
  return {
    contractNumber: (c.contract_number as string) || c.name,
    tenantName: tenantOf(c, core),
    status: (c.status as string) || 'active',
    startDate: isoDate(c.start_date as string) || '',
    endDate: isoDate(c.end_date as string) || '',
    isRenewal: !!(c.parent_contract_id as string),
    invoices,
  }
}

/** Port of egarsys property-ledger-data.ts buildContractLedgerEntries. */
function buildContractLedgerEntries(c: LedgerContract, now: Date): LedgerEntryView[] {
  const entries: LedgerEntryView[] = []
  const tenant = c.tenantName
  const isRenewal = c.isRenewal

  // 1) contract lifecycle events
  entries.push({
    date: new Date(c.startDate).toISOString(),
    type: 'contract',
    label: `${isRenewal ? 'تجديد عقد' : 'بداية عقد'} — المستأجر ${tenant || '—'}`,
    amount: 0,
    refs: { contractNumber: c.contractNumber, tenantName: tenant },
  })
  const end = new Date(c.endDate)
  if (c.status === 'moved_out') {
    entries.push({ date: end.toISOString(), type: 'contract', label: `خروج مستأجر — ${tenant || '—'}`, amount: 0, refs: { contractNumber: c.contractNumber, tenantName: tenant } })
  } else if (c.status === 'terminated') {
    entries.push({ date: end.toISOString(), type: 'contract', label: `إنهاء عقد — المستأجر ${tenant || '—'}`, amount: 0, refs: { contractNumber: c.contractNumber, tenantName: tenant } })
  } else if (end <= now) {
    entries.push({ date: end.toISOString(), type: 'contract', label: `نهاية عقد — المستأجر ${tenant || '—'}`, amount: 0, refs: { contractNumber: c.contractNumber, tenantName: tenant } })
  }

  // 2-4) invoices / credit notes / payments
  for (const inv of c.invoices) {
    const docType = inv.documentType || 'invoice'
    if (docType === 'invoice') {
      const cancelled = inv.status === 'cancelled'
      entries.push({
        date: new Date(inv.issueDate).toISOString(),
        type: 'invoice',
        label: `فاتورة قسط ${inv.installmentNo} — ${tenant || '—'}${cancelled ? ' (ملغاة)' : ''}`,
        amount: round2(inv.totalValue),
        vat: round2(inv.vatAmount ?? 0),
        cancelled,
        refs: { contractNumber: c.contractNumber, invoiceNumber: inv.invoiceNumber, installmentNo: inv.installmentNo, tenantName: tenant },
      })
      const paid = collectedAmount(inv)
      if (!cancelled && paid > 0) {
        entries.push({
          date: new Date(inv.paidDate ?? inv.issueDate).toISOString(),
          type: 'payment',
          label: `سداد فاتورة ${inv.invoiceNumber} — ${tenant || '—'}`,
          amount: round2(paid),
          refs: { contractNumber: c.contractNumber, invoiceNumber: inv.invoiceNumber, installmentNo: inv.installmentNo, tenantName: tenant },
        })
      }
    } else if (docType === 'credit_note') {
      entries.push({
        date: new Date(inv.issueDate).toISOString(),
        type: 'credit_note',
        label: `إشعار دائن ${inv.invoiceNumber} — ${tenant || '—'}`,
        amount: -round2(inv.totalValue),
        refs: { contractNumber: c.contractNumber, invoiceNumber: inv.invoiceNumber, installmentNo: inv.installmentNo, tenantName: tenant },
      })
    }
  }
  return entries
}

export async function getPropertyLedger(propertyId: string, opts?: { from?: Date | null; to?: Date | null }): Promise<LedgerView | null> {
  const now = new Date()
  const core = await loadCore()
  const property = core.propertyMap.get(propertyId)
  if (!property) return null
  const from = opts?.from ?? null
  const to = opts?.to ?? null

  const contracts = core.contracts
    .filter((c) => resolvePids(c, core).has(propertyId))
    .sort((a, b) => (toDate(a.start_date as string)?.getTime() ?? 0) - (toDate(b.start_date as string)?.getTime() ?? 0))

  const entries: LedgerEntryView[] = []
  for (const c of contracts) entries.push(...buildContractLedgerEntries(toLedgerContract(c, core), now))

  const expenses = await safeList<TransactionRow>('Rental Transaction', {
    fields: TRANSACTION_FIELDS,
    filters: [
      ['Rental Transaction', 'property_id', '=', propertyId],
      ['Rental Transaction', 'type', '=', 'expense'],
    ],
    limit_page_length: 0,
  })
  for (const t of expenses) {
    entries.push({
      date: isoDate(t.date as string) || new Date().toISOString(),
      type: 'expense',
      label: `مصروف${t.category ? ` — ${t.category}` : ''}${t.description ? ` — ${t.description}` : ''}`,
      amount: -round2(num(t.amount)),
      refs: { category: (t.category as string) ?? null, supplierName: (t.supplier_name as string) ?? null, voucherNumber: (t.invoice_number as string) ?? null },
    })
  }

  const filtered = entries.filter((e) => {
    const d = new Date(e.date)
    if (from && d < from) return false
    if (to && d > to) return false
    return true
  })
  filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const validInvoices = filtered.filter((e) => e.type === 'invoice' && !e.cancelled)
  const summary = {
    totalInvoiced: round2(validInvoices.reduce((s, e) => s + e.amount, 0)),
    totalVat: round2(validInvoices.reduce((s, e) => s + (e.vat ?? 0), 0)),
    totalCollected: round2(filtered.filter((e) => e.type === 'payment').reduce((s, e) => s + e.amount, 0)),
    totalExpenses: round2(-filtered.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0)),
    creditNotesTotal: round2(-filtered.filter((e) => e.type === 'credit_note').reduce((s, e) => s + e.amount, 0)),
    cancelledCount: filtered.filter((e) => e.type === 'invoice' && e.cancelled).length,
    net: 0,
  }
  summary.net = round2(summary.totalInvoiced - summary.totalExpenses)

  const owner = property.owner_id ? core.ownerMap.get(property.owner_id as string) : undefined
  return {
    property: {
      id: property.name,
      internalId: num(property.internal_id),
      deedNumber: (property.deed_number as string) || null,
      shopNumber: (property.shop_number as string) || null,
      title: (property.title_ar as string) || (property.title as string) || '',
      city: (property.city as string) || '',
      owner: owner ? { id: owner.name, name: owner.name_val ?? null } : null,
    },
    entries: filtered,
    summary,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// جرد بالعقود + كشف حساب العقد بالرقم الآلي (contract-reference-data.ts).
// Chains are grouped purely by (internalId) — persists across renewals/tenant swaps.
// ═══════════════════════════════════════════════════════════════════════════

function propertyBrief(pid: string, core: Core): { id: string; internalId: number; title: string } | null {
  const p = core.propertyMap.get(pid)
  if (!p) return null
  return { id: p.name, internalId: num(p.internal_id), title: (p.title_ar as string) || (p.title as string) || '' }
}

export async function getContractReferenceSummary(): Promise<{
  references: ReferenceJardRowView[]
  unnumbered: number
  totals: { references: number; generations: number; debtTotal: number; collected: number }
}> {
  const now = new Date()
  const core = await loadCore()

  const chains = new Map<number, ContractRow[]>()
  let unnumbered = 0
  const sorted = [...core.contracts].sort((a, b) => (toDate(a.start_date as string)?.getTime() ?? 0) - (toDate(b.start_date as string)?.getTime() ?? 0))
  for (const c of sorted) {
    const ref = num(c.internal_id)
    if (!ref || ref <= 0) { unnumbered++; continue }
    if (!chains.has(ref)) chains.set(ref, [])
    chains.get(ref)!.push(c)
  }

  const rows: ReferenceJardRowView[] = [...chains.entries()].map(([referenceNo, list]) => {
    let debtTotal = 0, collected = 0
    for (const c of list) {
      const stmt = computeContractStatement(contractStatementInput(c), (core.invoicesByContract.get(c.name) ?? []).map(toStatementInvoice), now)
      debtTotal += stmt.overdueTotal
      collected += stmt.collected
    }
    const current = [...list].reverse().find((c) => (c.status as string) === 'active') ?? list[list.length - 1]
    const propPid = list.map((c) => (c.rental_property_id as string) || '').find(Boolean) || ''
    return {
      referenceNo,
      generations: list.length,
      currentTenant: tenantOf(current, core),
      currentContractNumber: (current.ejar_contract_number as string) || (current.contract_number as string) || current.name,
      currentStatus: (current.status as string) || 'active',
      property: propPid ? propertyBrief(propPid, core) : null,
      debtTotal: round2(debtTotal),
      collected: round2(collected),
    }
  })

  return {
    references: rows,
    unnumbered,
    totals: {
      references: rows.length,
      generations: rows.reduce((s, r) => s + r.generations, 0),
      debtTotal: round2(rows.reduce((s, r) => s + r.debtTotal, 0)),
      collected: round2(rows.reduce((s, r) => s + r.collected, 0)),
    },
  }
}

export async function getContractReferenceStatement(referenceNo: number): Promise<ContractReferenceView | null> {
  if (!Number.isFinite(referenceNo) || referenceNo <= 0) return null
  const now = new Date()
  const core = await loadCore()

  const contracts = core.contracts
    .filter((c) => num(c.internal_id) === referenceNo)
    .sort((a, b) => (toDate(a.start_date as string)?.getTime() ?? 0) - (toDate(b.start_date as string)?.getTime() ?? 0))
  if (!contracts.length) return null

  const perContract = contracts.map((c) => ({
    c,
    stmt: computeContractStatement(contractStatementInput(c), (core.invoicesByContract.get(c.name) ?? []).map(toStatementInvoice), now),
  }))

  const succession = perContract.map(({ c, stmt }) => {
    const status = (c.status as string) || 'active'
    return {
      contractId: c.name,
      contractNumber: (c.contract_number as string) || c.name,
      ejarContractNumber: (c.ejar_contract_number as string) || null,
      tenantName: tenantOf(c, core),
      startDate: isoDate(c.start_date as string) || '',
      endDate: isoDate(c.end_date as string) || '',
      status,
      statusLabelAr: ContractStatusLabels[status as ContractStatusValue]?.ar ?? status,
      isDeparted: DEPARTED_STATUSES.has(status),
      isRenewal: !!(c.parent_contract_id as string),
      invoiced: stmt.invoiced,
      collected: stmt.collected,
      dueToDate: stmt.dueToDate,
      outstanding: stmt.outstanding,
      overdueTotal: stmt.overdueTotal,
      schedule: stmt.schedule as unknown as InstallmentView[],
      nextDueNo: stmt.nextDueNo,
    }
  })

  const overdueUninvoiced = perContract.flatMap(({ c, stmt }) =>
    stmt.overdueUninvoiced.map((r) => ({
      contractId: c.name,
      contractNumber: (c.contract_number as string) || c.name,
      tenantName: tenantOf(c, core),
      installmentNo: r.installmentNo,
      dueDateAD: r.dueDateAD,
      dueDateAH: r.dueDateAH,
      amount: r.amount,
    })),
  )
  const debtTotal = round2(overdueUninvoiced.reduce((s, r) => s + r.amount, 0))

  const entries: LedgerEntryView[] = []
  for (const c of contracts) entries.push(...buildContractLedgerEntries(toLedgerContract(c, core), now))

  // expenses recorded against any contract in the chain
  const chainIds = contracts.map((c) => c.name)
  const expenses = await safeList<TransactionRow>('Rental Transaction', {
    fields: TRANSACTION_FIELDS,
    filters: [
      ['Rental Transaction', 'contract_id', 'in', chainIds] as unknown as FrappeFilter,
      ['Rental Transaction', 'type', '=', 'expense'],
    ],
    limit_page_length: 0,
  })
  for (const t of expenses) {
    entries.push({
      date: isoDate(t.date as string) || new Date().toISOString(),
      type: 'expense',
      label: `مصروف${t.category ? ` — ${t.category}` : ''}${t.description ? ` — ${t.description}` : ''}`,
      amount: -round2(num(t.amount)),
      refs: { category: (t.category as string) ?? null, supplierName: (t.supplier_name as string) ?? null, voucherNumber: (t.invoice_number as string) ?? null },
    })
  }
  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const validInvoiceEntries = entries.filter((e) => e.type === 'invoice' && !e.cancelled)
  const summary = {
    totalInvoiced: round2(validInvoiceEntries.reduce((s, e) => s + e.amount, 0)),
    totalVat: round2(validInvoiceEntries.reduce((s, e) => s + (e.vat ?? 0), 0)),
    totalCollected: round2(succession.reduce((s, t) => s + t.collected, 0)),
    totalCollectedBase: round2(perContract.reduce((s, x) => s + x.stmt.collectedBase, 0)),
    totalCollectedVat: round2(perContract.reduce((s, x) => s + x.stmt.collectedVat, 0)),
    totalExpenses: round2(-entries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0)),
    creditNotesTotal: round2(-entries.filter((e) => e.type === 'credit_note').reduce((s, e) => s + e.amount, 0)),
    cancelledCount: entries.filter((e) => e.type === 'invoice' && e.cancelled).length,
    contractedRent: round2(perContract.reduce((s, x) => s + x.stmt.contractedTotal, 0)),
  }

  const current = [...contracts].reverse().find((c) => (c.status as string) === 'active') ?? contracts[contracts.length - 1]
  const curStatus = (current.status as string) || 'active'
  const propPid = contracts.map((c) => (c.rental_property_id as string) || '').find(Boolean) || ''

  return {
    referenceNo,
    current: {
      contractId: current.name,
      contractNumber: (current.contract_number as string) || current.name,
      tenantName: tenantOf(current, core),
      status: curStatus,
      statusLabelAr: ContractStatusLabels[curStatus as ContractStatusValue]?.ar ?? curStatus,
    },
    property: propPid ? propertyBrief(propPid, core) : null,
    succession,
    overdueUninvoiced,
    debtTotal,
    entries,
    summary,
  }
}
