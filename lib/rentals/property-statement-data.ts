// Mirror-backed assembly of the per-property كشف حساب عقار (statement) and
// سجل حركات العقار (ledger). Ported from egarsys src/lib/property-statement-data.ts
// + property-ledger-data.ts, but reading the Frappe "Rental *" mirror doctypes on
// the current tenant site instead of Prisma. READ-ONLY — no writes.
//
// The per-contract financial derivation reuses the SAME engine the dashboard /
// contracts / invoices ports use (components/rentals/egarsys/engine/property-statement),
// so every figure agrees with the rest of the app.

import { frappeClient } from '@/lib/api-client'
import type { FrappeFilter } from '@/lib/api-client'
import { computeContractStatement, collectedAmount } from '@/components/rentals/egarsys/engine/property-statement'
import type {
  StatementView, LedgerView, LedgerEntryView,
} from '@/components/rentals/egarsys/property-statement-html'
import { ContractStatusLabels } from '@/components/rentals/egarsys/types'

// ── small helpers (self-contained; mirror lib/rentals/properties-data.ts) ──

function toDate(v: string | null | undefined): Date | null {
  if (!v) return null
  const s = String(v).replace(' ', 'T')
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z')
  return isNaN(d.getTime()) ? null : d
}
function isoDate(v: string | null | undefined): string | null {
  const d = toDate(v)
  return d ? d.toISOString() : (v ? String(v) : null)
}
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0)
const round2 = (n: number): number => Math.round((n || 0) * 100) / 100

function parseJson(v: unknown): unknown {
  if (v == null) return null
  if (typeof v === 'string') { try { return JSON.parse(v) } catch { return null } }
  return v
}

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

const DEPARTED_STATUSES = new Set(['moved_out', 'expired', 'terminated'])

// ── raw row shapes ──
type Row = Record<string, unknown> & { name: string }

const CONTRACT_FIELDS = [
  'name', 'contract_number', 'ejar_contract_number', 'internal_id', 'tenant_id', 'tenant_name',
  'rental_property_id', 'unit_id', 'start_date', 'end_date', 'status', 'rent_amount',
  'payment_frequency', 'tax_rate', 'prepaid_settled', 'paid_previously_installments',
  'parent_contract_id',
]
const INVOICE_FIELDS = [
  'name', 'invoice_number', 'contract_id', 'installment_no', 'zatca_document_type', 'status',
  'total_value', 'vat_amount', 'paid_amount', 'issue_date', 'paid_date',
]
const TXN_FIELDS = ['name', 'property_id', 'type', 'amount', 'category', 'supplier_name', 'invoice_number', 'description', 'date']

// ── shared loader: property + owner + all its contracts (direct / legacy unit / join) + invoices ──

interface PropertyBundle {
  property: Row
  owner: { id: string; name: string | null; phone: string | null } | null
  unitCount: number
  contracts: Row[]
  invoicesByContract: Map<string, Row[]>
}

async function loadPropertyBundle(propertyId: string): Promise<PropertyBundle | null> {
  const propRows = await frappeClient.getList<Row>('Rental Property', {
    fields: [
      'name', 'internal_id', 'deed_number', 'shop_number', 'title', 'title_ar', 'property_type',
      'status', 'address', 'city', 'district', 'owner_id',
    ],
    filters: [['Rental Property', 'name', '=', propertyId]],
    limit_page_length: 1,
  })
  const property = propRows[0]
  if (!property) return null

  const [units, ownerRows] = await Promise.all([
    safeList<Row>('Rental Unit', {
      fields: ['name'],
      filters: [['Rental Unit', 'property_id', '=', propertyId]],
      limit_page_length: 0,
    }),
    property.owner_id
      ? safeList<{ name: string; name_val?: string | null; phone?: string | null }>('Rental Owner', {
          fields: ['name', 'name_val', 'phone'],
          filters: [['Rental Owner', 'name', '=', property.owner_id as string]],
          limit_page_length: 1,
        })
      : Promise.resolve([]),
  ])
  const unitNames = units.map((u) => u.name)

  // Contract union — direct link, legacy single unit_id, and the Rental Contract Unit join.
  const contractMap = new Map<string, Row>()
  const direct = await safeList<Row>('Rental Contract', {
    fields: CONTRACT_FIELDS,
    filters: [['Rental Contract', 'rental_property_id', '=', propertyId]],
    limit_page_length: 0,
  })
  for (const c of direct) contractMap.set(c.name, c)

  if (unitNames.length) {
    const byUnit = await safeList<Row>('Rental Contract', {
      fields: CONTRACT_FIELDS,
      filters: [['Rental Contract', 'unit_id', 'in', unitNames] as unknown as FrappeFilter],
      limit_page_length: 0,
    })
    for (const c of byUnit) contractMap.set(c.name, c)

    const joins = await safeList<{ contract_id?: string | null }>('Rental Contract Unit', {
      fields: ['contract_id', 'unit_id'],
      filters: [['Rental Contract Unit', 'unit_id', 'in', unitNames] as unknown as FrappeFilter],
      limit_page_length: 0,
    })
    const joinContractIds = Array.from(new Set(joins.map((j) => j.contract_id).filter(Boolean))) as string[]
    const missing = joinContractIds.filter((id) => !contractMap.has(id))
    if (missing.length) {
      const joinContracts = await safeList<Row>('Rental Contract', {
        fields: CONTRACT_FIELDS,
        filters: [['Rental Contract', 'name', 'in', missing] as unknown as FrappeFilter],
        limit_page_length: 0,
      })
      for (const c of joinContracts) contractMap.set(c.name, c)
    }
  }

  const contracts = Array.from(contractMap.values())
    .sort((a, b) => (toDate(a.start_date as string)?.getTime() ?? 0) - (toDate(b.start_date as string)?.getTime() ?? 0))

  // All invoices for these contracts, grouped by contract.
  const invoicesByContract = new Map<string, Row[]>()
  const contractIds = contracts.map((c) => c.name)
  if (contractIds.length) {
    const invoices = await safeList<Row>('Rental Invoice', {
      fields: INVOICE_FIELDS,
      filters: [['Rental Invoice', 'contract_id', 'in', contractIds] as unknown as FrappeFilter],
      limit_page_length: 0,
    })
    for (const inv of invoices) {
      const cid = (inv.contract_id as string) || ''
      if (!cid) continue
      const arr = invoicesByContract.get(cid) ?? []
      arr.push(inv)
      invoicesByContract.set(cid, arr)
    }
  }

  const ownerRow = ownerRows[0]
  const owner = ownerRow
    ? { id: ownerRow.name, name: ownerRow.name_val || null, phone: ownerRow.phone ?? null }
    : null

  return { property, owner, unitCount: unitNames.length, contracts, invoicesByContract }
}

// Engine input for one invoice (matches lib/rentals/contracts-data.ts toStatementInvoice).
function toStmtInvoice(inv: Row) {
  return {
    installmentNo: num(inv.installment_no),
    documentType: (inv.zatca_document_type as string) || 'invoice',
    status: (inv.status as string) ?? null,
    totalValue: num(inv.total_value),
    vatAmount: num(inv.vat_amount),
    paidAmount: inv.paid_amount ? num(inv.paid_amount) : null,
  }
}

function stmtFor(c: Row, invoices: Row[], now: Date) {
  return computeContractStatement(
    {
      startDate: toDate(c.start_date as string) ?? new Date(0),
      endDate: toDate(c.end_date as string) ?? new Date(0),
      rentAmount: num(c.rent_amount),
      paymentFrequency: (c.payment_frequency as string) || 'annual',
      taxRate: c.tax_rate != null ? num(c.tax_rate) : null,
      prepaidSettled: !!num(c.prepaid_settled),
      paidPreviously: parseJson(c.paid_previously_installments),
    },
    invoices.map(toStmtInvoice),
    now,
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// كشف حساب عقار
// ═══════════════════════════════════════════════════════════════════════════

export async function getPropertyStatement(propertyId: string, now: Date = new Date()): Promise<StatementView | null> {
  const bundle = await loadPropertyBundle(propertyId)
  if (!bundle) return null
  const { property, owner, unitCount, contracts, invoicesByContract } = bundle

  const perContract = contracts.map((c) => ({ c, stmt: stmtFor(c, invoicesByContract.get(c.name) ?? [], now) }))

  const timeline = perContract.map(({ c, stmt }) => ({
    contractId: c.name,
    contractNumber: (c.contract_number as string) || c.name,
    internalId: c.internal_id != null ? num(c.internal_id) : 0,
    ejarContractNumber: (c.ejar_contract_number as string) || null,
    tenantName: (c.tenant_name as string) || null,
    startDate: isoDate(c.start_date as string) || '',
    endDate: isoDate(c.end_date as string) || '',
    status: (c.status as string) || 'active',
    statusLabelAr: ContractStatusLabels[(c.status as string) || 'active']?.ar ?? (c.status as string) ?? '',
    isDeparted: DEPARTED_STATUSES.has((c.status as string) || ''),
    invoiced: stmt.invoiced,
    collected: stmt.collected,
    dueToDate: stmt.dueToDate,
    outstanding: stmt.outstanding,
    overdueTotal: stmt.overdueTotal,
  }))

  const overdueUninvoiced = perContract.flatMap(({ c, stmt }) =>
    stmt.overdueUninvoiced.map((r) => ({
      contractId: c.name,
      contractNumber: (c.contract_number as string) || c.name,
      tenantName: (c.tenant_name as string) || null,
      installmentNo: r.installmentNo,
      dueDateAD: r.dueDateAD,
      dueDateAH: r.dueDateAH,
      amount: r.amount,
    })),
  )
  const debtTotal = round2(overdueUninvoiced.reduce((s, r) => s + r.amount, 0))

  // Financial summary aggregates over the full invoice set.
  const allInvoices = contracts.flatMap((c) => invoicesByContract.get(c.name) ?? [])
  const validInvoices = allInvoices.filter(
    (inv) => ((inv.zatca_document_type as string) || 'invoice') === 'invoice' && inv.status !== 'cancelled',
  )
  const creditNotes = allInvoices.filter((inv) => (inv.zatca_document_type as string) === 'credit_note')

  // Expenses for the property.
  const expenses = await safeList<Row>('Rental Transaction', {
    fields: ['amount', 'category'],
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
    totalRentsContracted: round2(perContract.reduce((s, x) => s + x.stmt.contractedRent, 0)),
    totalInvoiced: round2(validInvoices.reduce((s, inv) => s + num(inv.total_value), 0)),
    totalCollected: round2(timeline.reduce((s, t) => s + t.collected, 0)),
    totalCollectedBase: round2(perContract.reduce((s, x) => s + x.stmt.collectedBase, 0)),
    totalCollectedVat: round2(perContract.reduce((s, x) => s + x.stmt.collectedVat, 0)),
    totalVat: round2(validInvoices.reduce((s, inv) => s + num(inv.vat_amount), 0)),
    totalExpenses: round2(totalExpenses),
    expenseByCategory: Array.from(expenseByCatMap.entries())
      .map(([category, amount]) => ({ category, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount),
    creditNotesTotal: round2(creditNotes.reduce((s, inv) => s + num(inv.total_value), 0)),
  }

  return {
    property: {
      id: property.name,
      internalId: property.internal_id != null ? num(property.internal_id) : 0,
      deedNumber: (property.deed_number as string) || null,
      shopNumber: (property.shop_number as string) || null,
      title: (property.title as string) || '',
      titleAr: (property.title_ar as string) || null,
      propertyType: (property.property_type as string) || '',
      status: (property.status as string) || '',
      address: (property.address as string) || '',
      city: (property.city as string) || '',
      district: (property.district as string) || null,
      unitsCount: unitCount,
      owner,
    },
    timeline,
    overdueUninvoiced,
    debtTotal,
    summary,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// سجل حركات العقار (ledger)
// ═══════════════════════════════════════════════════════════════════════════

// One contract → its chronological ledger entries (ported from egarsys
// buildContractLedgerEntries — lifecycle events, invoices incl. cancelled-flagged,
// credit notes, payments per the shared collectedAmount convention).
function buildContractLedgerEntries(c: Row, invoices: Row[], now: Date): LedgerEntryView[] {
  const entries: LedgerEntryView[] = []
  const tenant = (c.tenant_name as string) || null
  const contractNumber = (c.contract_number as string) || c.name
  const isRenewal = !!c.parent_contract_id
  const status = (c.status as string) || ''

  const startIso = isoDate(c.start_date as string)
  if (startIso) {
    entries.push({
      date: startIso,
      type: 'contract',
      label: `${isRenewal ? 'تجديد عقد' : 'بداية عقد'} — المستأجر ${tenant || '—'}`,
      amount: 0,
      refs: { contractNumber, tenantName: tenant },
    })
  }
  const endIso = isoDate(c.end_date as string)
  const end = toDate(c.end_date as string)
  if (endIso) {
    if (status === 'moved_out') {
      entries.push({ date: endIso, type: 'contract', label: `خروج مستأجر — ${tenant || '—'}`, amount: 0, refs: { contractNumber, tenantName: tenant } })
    } else if (status === 'terminated') {
      entries.push({ date: endIso, type: 'contract', label: `إنهاء عقد — المستأجر ${tenant || '—'}`, amount: 0, refs: { contractNumber, tenantName: tenant } })
    } else if (end && end <= now) {
      entries.push({ date: endIso, type: 'contract', label: `نهاية عقد — المستأجر ${tenant || '—'}`, amount: 0, refs: { contractNumber, tenantName: tenant } })
    }
  }

  for (const inv of invoices) {
    const docType = (inv.zatca_document_type as string) || 'invoice'
    const invoiceNumber = (inv.invoice_number as string) || ''
    const installmentNo = num(inv.installment_no)
    const issueIso = isoDate(inv.issue_date as string)
    if (docType === 'invoice') {
      const cancelled = inv.status === 'cancelled'
      if (issueIso) {
        entries.push({
          date: issueIso,
          type: 'invoice',
          label: `فاتورة قسط ${installmentNo} — ${tenant || '—'}${cancelled ? ' (ملغاة)' : ''}`,
          amount: round2(num(inv.total_value)),
          vat: round2(num(inv.vat_amount)),
          cancelled,
          refs: { contractNumber, invoiceNumber, installmentNo, tenantName: tenant },
        })
      }
      const paid = collectedAmount({ status: inv.status as string, totalValue: num(inv.total_value), paidAmount: inv.paid_amount ? num(inv.paid_amount) : null })
      if (!cancelled && paid > 0) {
        const paidIso = isoDate(inv.paid_date as string) || issueIso
        if (paidIso) {
          entries.push({
            date: paidIso,
            type: 'payment',
            label: `سداد فاتورة ${invoiceNumber} — ${tenant || '—'}`,
            amount: round2(paid),
            refs: { contractNumber, invoiceNumber, installmentNo, tenantName: tenant },
          })
        }
      }
    } else if (docType === 'credit_note') {
      if (issueIso) {
        entries.push({
          date: issueIso,
          type: 'credit_note',
          label: `إشعار دائن ${invoiceNumber} — ${tenant || '—'}`,
          amount: -round2(num(inv.total_value)),
          refs: { contractNumber, invoiceNumber, installmentNo, tenantName: tenant },
        })
      }
    }
  }
  return entries
}

export async function getPropertyLedger(
  propertyId: string,
  opts: { from?: Date | null; to?: Date | null; now?: Date } = {},
): Promise<LedgerView | null> {
  const now = opts.now ?? new Date()
  const bundle = await loadPropertyBundle(propertyId)
  if (!bundle) return null
  const { property, owner, contracts, invoicesByContract } = bundle

  const entries: LedgerEntryView[] = []
  for (const c of contracts) {
    entries.push(...buildContractLedgerEntries(c, invoicesByContract.get(c.name) ?? [], now))
  }

  // Expenses (Rental Transaction, type=expense) for the property.
  const expenses = await safeList<Row>('Rental Transaction', {
    fields: TXN_FIELDS,
    filters: [
      ['Rental Transaction', 'property_id', '=', propertyId],
      ['Rental Transaction', 'type', '=', 'expense'],
    ],
    limit_page_length: 0,
  })
  for (const t of expenses) {
    const dIso = isoDate(t.date as string)
    if (!dIso) continue
    const cat = (t.category as string) || null
    const desc = (t.description as string) || ''
    entries.push({
      date: dIso,
      type: 'expense',
      label: `مصروف${cat ? ` — ${cat}` : ''}${desc ? ` — ${desc}` : ''}`,
      amount: -round2(num(t.amount)),
      refs: { category: cat, supplierName: (t.supplier_name as string) || null, voucherNumber: (t.invoice_number as string) || null },
    })
  }

  const { from, to } = opts
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

  return {
    property: {
      id: property.name,
      internalId: property.internal_id != null ? num(property.internal_id) : 0,
      deedNumber: (property.deed_number as string) || null,
      shopNumber: (property.shop_number as string) || null,
      title: (property.title_ar as string) || (property.title as string) || '',
      city: (property.city as string) || '',
      owner: owner ? { id: owner.id, name: owner.name } : null,
    },
    entries: filtered,
    summary,
  }
}
