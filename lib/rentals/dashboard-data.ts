// Mirror-backed compatibility layer: returns the SAME shape egarsys's
// /api/dashboard route produces (see egarsys src/app/api/dashboard/route.ts),
// but computed from the Frappe "Rental *" mirror doctypes on the current tenant
// site. Property/contract/invoice counts and money totals are REAL; pieces the
// mirror cannot derive (the installment engine's next-payment schedule) return
// safe zeros rather than fabricated data.

import { frappeClient } from '@/lib/api-client'
import type { DashboardStats, RentalContract, PaymentScheduleRow } from '@/components/rentals/egarsys/types'
import {
  computeContractStatement,
  type StatementInvoiceInput,
} from '@/components/rentals/egarsys/engine/property-statement'

const APPROACHING_WINDOW_DAYS = 60
const CONTRACT_EXPIRY_WINDOW_DAYS = 60

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

type PropertyRow = { name: string; status?: string; title?: string; title_ar?: string | null }
type ContractRow = {
  name: string
  status?: string
  start_date?: string | null
  end_date?: string | null
  rent_amount?: number | null
  contract_number?: string | null
  tenant_name?: string | null
  rental_property_id?: string | null
  creation?: string | null
  payment_frequency?: string | null
  tax_rate?: number | null
  prepaid_settled?: number | boolean | null
  paid_previously_installments?: unknown
}
type InvoiceRow = {
  name: string
  invoice_number?: string | null
  total_value?: number | null
  vat_amount?: number | null
  paid_amount?: number | null
  paid_date?: string | null
  status?: string | null
  due_date?: string | null
  zatca_document_type?: string | null
  contract_id?: string | null
  installment_no?: number | null
}

/** Frappe JSON fields arrive as a string — parse defensively so the engine's
 *  paid-previously normalizer sees a real array (a bad value stays a no-op). */
function parseJsonField(v: unknown): unknown {
  if (typeof v === 'string') {
    if (!v.trim()) return null
    try { return JSON.parse(v) } catch { return null }
  }
  return v
}

/** Frappe DateTime → Date (guards null/unparsable; returns null when invalid). */
function toDate(v: string | null | undefined): Date | null {
  if (!v) return null
  // Mirror datetimes are naive "YYYY-MM-DD HH:MM:SS" (no zone). egarsys computes on a
  // UTC server; parsing these as the VIEWER's local time shifts installment due-dates
  // across the day boundary and inflates the overdue/due counts by a few. Anchor to UTC
  // (append Z) so the dashboard matches egarsys 1:1 regardless of the browser timezone.
  const s = String(v).replace(' ', 'T')
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z')
  return isNaN(d.getTime()) ? null : d
}

const num = (v: number | null | undefined): number => (typeof v === 'number' ? v : Number(v) || 0)
const round2 = (n: number): number => Math.round(n * 100) / 100

async function fetchAll<T>(doctype: string, fields: string[]): Promise<T[]> {
  return frappeClient.getList<T>(doctype, { fields, limit_page_length: 0 })
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date()
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 864e5)
  const twoMonthsFromNow = new Date(now.getTime() + APPROACHING_WINDOW_DAYS * 864e5)
  const contractExpiryWindow = new Date(now.getTime() + CONTRACT_EXPIRY_WINDOW_DAYS * 864e5)

  const [properties, contracts, invoices] = await Promise.all([
    fetchAll<PropertyRow>('Rental Property', ['name', 'status', 'title', 'title_ar']),
    fetchAll<ContractRow>('Rental Contract', [
      'name', 'status', 'start_date', 'end_date', 'rent_amount',
      'contract_number', 'tenant_name', 'rental_property_id', 'creation',
      'payment_frequency', 'tax_rate', 'prepaid_settled', 'paid_previously_installments',
    ]),
    fetchAll<InvoiceRow>('Rental Invoice', [
      'name', 'invoice_number', 'total_value', 'vat_amount', 'paid_amount',
      'paid_date', 'status', 'due_date', 'zatca_document_type', 'contract_id', 'installment_no',
    ]),
  ])

  // ── Properties ──
  let pTotal = 0, pAvailable = 0, pRented = 0, pMaintenance = 0
  const propTitle = new Map<string, string>()
  for (const p of properties) {
    pTotal++
    if (p.status === 'available') pAvailable++
    else if (p.status === 'rented') pRented++
    else if (p.status === 'maintenance') pMaintenance++
    propTitle.set(p.name, p.title_ar || p.title || '')
  }

  // ── Contracts (counts + lifecycle buckets, mirroring route.ts precedence) ──
  let cActive = 0, cDraft = 0, cExpired = 0, cExpiringSoon = 0
  let lcActive = 0, lcApproaching = 0, lcExpired = 0, lcPendingRenewal = 0
  let dueConsidered = 0
  for (const c of contracts) {
    const status = c.status || ''
    const end = toDate(c.end_date)
    if (status === 'active') cActive++
    if (status === 'draft') cDraft++
    if (status === 'expired') cExpired++
    if (status === 'active' && end && end >= now && end <= thirtyDaysFromNow) cExpiringSoon++

    if (status !== 'draft' && status !== 'terminated') dueConsidered++

    // Lifecycle: pendingRenewal > expired > approaching > active.
    if (status === 'pending_renewal') {
      lcPendingRenewal++
    } else if (
      status !== 'draft' && status !== 'terminated' && status !== 'moved_out' &&
      ((end && end < now) || status === 'expired')
    ) {
      lcExpired++
    } else if (status === 'active' && end && end >= now && end <= contractExpiryWindow) {
      lcApproaching++
    } else if (status === 'active' && end && end > contractExpiryWindow) {
      lcActive++
    }
  }

  // ── Invoices → issued totals, monthly revenue, settlement traffic-light ──
  const contractNumberById = new Map<string, string>()
  for (const c of contracts) if (c.rental_property_id !== undefined) contractNumberById.set(c.name, c.contract_number || '—')

  const monthlyRevenue: Array<{ year: number; month: number; label: string; due: number; collected: number }> = []
  const monthBucket = new Map<number, number>()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthBucket.set(d.getFullYear() * 12 + d.getMonth(), monthlyRevenue.length)
    monthlyRevenue.push({ year: d.getFullYear(), month: d.getMonth(), label: ARABIC_MONTHS[d.getMonth()], due: 0, collected: 0 })
  }

  let issuedTotal = 0, issuedVat = 0, issuedCount = 0
  let settledAmount = 0, safeFarAmount = 0, approachingAmount = 0, overdueAmount = 0, overdueInvoiceCount = 0
  const approachingInvoices: DashboardStats['approachingInvoices'] = []

  for (const inv of invoices) {
    const dt = inv.zatca_document_type
    if (dt === 'credit_note' || dt === 'debit_note') continue // corrections, not receivables
    if (inv.status === 'cancelled') continue
    issuedCount++
    const total = num(inv.total_value)
    const vat = num(inv.vat_amount)
    issuedTotal += total
    issuedVat += vat

    // Frappe Float columns can't hold NULL — egarsys's null paidAmount arrives here as 0.
    // Treat 0 as "unset" so a status=paid invoice collects its full total (egarsys never
    // records an explicit 0 partial payment). Without this, paid installments read as
    // uncollected and inflate the overdue count.
    const settled = inv.paid_amount ? num(inv.paid_amount) : inv.status === 'paid' ? total : 0

    const due = toDate(inv.due_date)
    if (due) {
      const dueIdx = monthBucket.get(due.getFullYear() * 12 + due.getMonth())
      if (dueIdx !== undefined) monthlyRevenue[dueIdx].due += total
    }
    const paid = toDate(inv.paid_date)
    if (settled > 0 && paid) {
      const colIdx = monthBucket.get(paid.getFullYear() * 12 + paid.getMonth())
      if (colIdx !== undefined) monthlyRevenue[colIdx].collected += settled
    }

    settledAmount += settled
    const remaining = Math.max(0, total - settled)
    if (remaining <= 0) continue
    if (due && due < now) {
      overdueAmount += remaining
      overdueInvoiceCount++
    } else if (due && due <= twoMonthsFromNow) {
      approachingAmount += remaining
      approachingInvoices.push({
        contractNumber: inv.contract_id ? contractNumberById.get(inv.contract_id) ?? '—' : '—',
        invoiceNumber: inv.invoice_number || '—',
        dueDate: inv.due_date || '',
        remaining,
      })
    } else {
      safeFarAmount += remaining
    }
  }

  const safeAmount = settledAmount + safeFarAmount
  const outstandingAmount = overdueAmount + approachingAmount + safeFarAmount
  approachingInvoices.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())

  // ── Installment engine: «دفعات مستحقة» + «المدفوعات القادمة والمتأخرة» ──
  // Mirrors egarsys src/app/api/dashboard/route.ts (~150-197). dueScope = every
  // Rental Contract NOT in (draft, terminated). Invoices are grouped by contract_id
  // once (no N+1), then computeContractStatement runs per contract with now=new Date().
  // Aggregation is identical to route.ts; the delay-ledger write (recordDelayObservations)
  // is intentionally NOT ported — this is pure display derivation, zero writes.
  const invoicesByContract = new Map<string, StatementInvoiceInput[]>()
  for (const inv of invoices) {
    if (!inv.contract_id) continue
    const arr = invoicesByContract.get(inv.contract_id) ?? []
    arr.push({
      installmentNo: num(inv.installment_no),
      documentType: inv.zatca_document_type || 'invoice',
      status: inv.status ?? null,
      totalValue: num(inv.total_value),
      vatAmount: num(inv.vat_amount),
      // Map 0 → null (Frappe Float can't store egarsys's null) so collectedAmount's
      // "paid → totalValue" fallback fires; egarsys never records an explicit 0 partial.
      paidAmount: inv.paid_amount ? num(inv.paid_amount) : null,
    })
    invoicesByContract.set(inv.contract_id, arr)
  }

  let paymentsDueCount = 0
  let paymentsDueAmount = 0
  const overdueSchedule: PaymentScheduleRow[] = []
  const upcomingSchedule: PaymentScheduleRow[] = []
  for (const c of contracts) {
    const status = c.status || ''
    if (status === 'draft' || status === 'terminated') continue
    const start = toDate(c.start_date)
    const end = toDate(c.end_date)
    if (!start || !end) continue // no schedule derivable without both endpoints
    const st = computeContractStatement(
      {
        startDate: start,
        endDate: end,
        rentAmount: num(c.rent_amount),
        paymentFrequency: c.payment_frequency || 'annual',
        taxRate: c.tax_rate ?? null,
        prepaidSettled: !!c.prepaid_settled,
        paidPreviously: parseJsonField(c.paid_previously_installments),
      },
      invoicesByContract.get(c.name) ?? [],
      now,
    )
    if (st.nextDueState === 'due') { paymentsDueCount++; paymentsDueAmount += st.outstandingTotal }
    const ident = { contractNumber: c.contract_number || c.name, tenantName: c.tenant_name || '—' }
    for (const r of st.overdueUninvoiced) {
      overdueSchedule.push({ ...ident, installmentNo: r.installmentNo, dueDate: r.dueDateAD, dueDateAH: r.dueDateAH, amount: r.amount })
    }
    if (st.nextDueState === 'upcoming' && st.nextDueNo != null) {
      const nx = st.schedule.find((s) => s.installmentNo === st.nextDueNo)
      if (nx) upcomingSchedule.push({ ...ident, installmentNo: nx.installmentNo, dueDate: nx.dueDateAD, dueDateAH: nx.dueDateAH, amount: nx.amount })
    }
  }
  overdueSchedule.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
  upcomingSchedule.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
  const overdueScheduleTotal = round2(overdueSchedule.reduce((s, r) => s + r.amount, 0))
  const upcomingScheduleTotal = round2(upcomingSchedule.reduce((s, r) => s + r.amount, 0))

  return {
    properties: { total: pTotal, available: pAvailable, rented: pRented, maintenance: pMaintenance },
    contracts: { active: cActive, expiringSoon: cExpiringSoon, expired: cExpired, draft: cDraft },
    contractLifecycle: {
      active: lcActive,
      approaching: lcApproaching,
      expired: lcExpired,
      pendingRenewal: lcPendingRenewal,
    },
    payments: { thisMonthTotal: 0, thisMonthCollected: 0, thisMonthCount: 0, overdueTotal: 0, overdueCount: 0 },
    paymentBreakdown: { paid: 0, dueInTwoMonths: 0, overdue: 0 },
    settlement: {
      safe: round2(safeAmount),
      approaching: round2(approachingAmount),
      overdue: round2(overdueAmount),
      outstanding: round2(outstandingAmount),
      overdueCount: overdueInvoiceCount,
    },
    // Installment-engine derived (ported from egarsys src/lib/property-statement).
    paymentsDue: { count: paymentsDueCount, amount: round2(paymentsDueAmount), considered: dueConsidered },
    paymentSchedule: {
      overdue: overdueSchedule.slice(0, 50),
      upcoming: upcomingSchedule.slice(0, 50),
      overdueCount: overdueSchedule.length,
      upcomingCount: upcomingSchedule.length,
      overdueTotal: overdueScheduleTotal,
      upcomingTotal: upcomingScheduleTotal,
    },
    approachingInvoices,
    issuedInvoices: {
      count: issuedCount,
      subtotal: round2(issuedTotal - issuedVat),
      tax: round2(issuedVat),
      total: round2(issuedTotal),
    },
    monthlyRevenue: monthlyRevenue.map((m) => ({
      year: m.year,
      month: m.month,
      label: m.label,
      due: round2(m.due),
      collected: round2(m.collected),
    })),
    unreadNotifications: 0,
    income: 0,
    expense: 0,
  }
}

export async function getRecentContracts(): Promise<RentalContract[]> {
  const [rows, props] = await Promise.all([
    frappeClient.getList<ContractRow>('Rental Contract', {
      fields: ['name', 'status', 'end_date', 'rent_amount', 'contract_number', 'tenant_name', 'rental_property_id'],
      order_by: 'creation desc',
      limit_page_length: 5,
    }),
    frappeClient.getList<PropertyRow>('Rental Property', { fields: ['name', 'title', 'title_ar'], limit_page_length: 0 }),
  ])
  const title = new Map<string, string>()
  for (const p of props) title.set(p.name, p.title_ar || p.title || '')

  return rows.map((c) => ({
    id: c.name,
    contractNumber: c.contract_number || c.name,
    status: c.status || 'active',
    endDate: c.end_date || '',
    rentAmount: num(c.rent_amount),
    tenantName: c.tenant_name || undefined,
    propertyTitle: (c.rental_property_id && title.get(c.rental_property_id)) || undefined,
    rentalProperty: c.rental_property_id
      ? { title: title.get(c.rental_property_id) || undefined, titleAr: title.get(c.rental_property_id) || null }
      : null,
  }))
}
