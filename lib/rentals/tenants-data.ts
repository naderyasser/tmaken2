// Mirror-backed compatibility layer for the ported egarsys TENANTS (المستأجرون)
// section. Returns the SAME camelCase shapes tenants.tsx consumes (see egarsys
// src/app/api/tenant-profiles/route.ts + [id]/route.ts), but computed from the
// Frappe "Rental Tenant" / "Rental Tenant Delay Record" / "Rental Contract"
// mirror doctypes on the current tenant site. READ-ONLY — no writes, no Frappe
// docs created.
//
// Graceful degradation (per the port plan): most tamkeen contracts are NOT
// tenant-linked and the mirror may hold 0 Rental Tenant rows. Every read goes
// through safeList so a missing/forbidden doctype → [] and the section renders
// its empty state instead of throwing.
//
// TWO mandatory mirror-fidelity rules (proven on the dashboard/contracts port):
//   1. Frappe Float/Int can't store NULL → egarsys's null arrives as 0. Map
//      `x ? num : null` (0 → null) for money fields so a genuinely-unset value
//      isn't rendered as a real 0 (e.g. a 0 rent hides the amount line).
//   2. Naive mirror datetimes ("YYYY-MM-DD HH:MM:SS", no zone) are anchored to
//      UTC (append Z) so dates match egarsys's UTC server in any browser TZ.

import { frappeClient } from '@/lib/api-client'

// ── shared helpers (copied from lib/rentals/properties-data.ts) ──

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

/** Every read degrades gracefully — a missing/forbidden doctype returns []
 *  rather than blowing up the whole section (0 Rental Tenant rows → empty list). */
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

/** egarsys auto-expiry relabel — identical to its list/detail routes and to the
 *  sibling adapters: a date-past active/draft becomes 'expired' (never touching
 *  terminated / moved_out). */
function displayStatus(status: string | null | undefined, endStr: string | null | undefined, now: Date): string {
  const orig = (status as string) || 'active'
  const end = toDate(endStr)
  const isDateExpired = !!end && end < now && orig !== 'terminated' && orig !== 'moved_out'
  return isDateExpired && orig !== 'expired' ? 'expired' : orig
}

// ── field lists (mirror fieldnames from lib/rentals/spec.json) ──

const TENANT_FIELDS = [
  'name', 'name_val', 'party_type', 'national_id', 'vat_number', 'phone', 'email',
  'address', 'emergency_contact', 'company_name', 'cr_number', 'cr_date',
  'unified_number', 'org_type', 'representative_name', 'representative_id',
  'representative_mobile', 'representative_email', 'created_at', 'updated_at',
]
const TENANT_CONTRACT_FIELDS = [
  'name', 'contract_number', 'tenant_id', 'status', 'start_date', 'end_date', 'rent_amount', 'created_at',
]
const DELAY_FIELDS = [
  'name', 'tenant_id', 'contract_number', 'installment_no', 'due_date', 'resolved_at', 'delay_days', 'source',
]

// ── raw row types ──

type TenantRow = Record<string, unknown> & { name: string }
type ContractRow = Record<string, unknown> & { name: string; tenant_id?: string | null }
type DelayRow = Record<string, unknown> & { name: string; tenant_id?: string | null }

// ── public shapes (what the ported section reads — mirrors egarsys TenantProfile) ──

export interface TenantView {
  id: string
  name: string
  partyType: string | null
  nationalId: string | null
  vatNumber: string | null
  phone: string
  email: string | null
  address: string | null
  emergencyContact: string | null
  companyName: string | null
  crNumber: string | null
  crDate: string | null
  unifiedNumber: string | null
  orgType: string | null
  representativeName: string | null
  representativeId: string | null
  representativeMobile: string | null
  representativeEmail: string | null
  createdAt: string
  _count: { contracts: number; delayRecords: number }
}

export interface TenantContractView {
  id: string
  contractNumber: string
  status: string
  startDate: string
  endDate: string
  rentAmount: number
}

/** One permanent «تقييم العميل» ledger row — a delay never disappears once recorded. */
export interface TenantDelayRecordView {
  id: string
  contractNumber: string | null
  installmentNo: number
  dueDate: string
  resolvedAt: string | null
  delayDays: number
  source: string
}

/** Live late-payment summary (egarsys derives this from the installment engine;
 *  the mirror lacks per-installment amounts, so it is derived from the OPEN delay
 *  records — enough for the header's delay-days line; totalOverdue stays 0). */
export interface TenantLatePaymentView {
  isLate: boolean
  delayDays: number
  overdueCount: number
  totalOverdue: number
  oldestDueDate: string | null
}

export interface TenantDetailView extends TenantView {
  contracts: TenantContractView[]
  latePayment: TenantLatePaymentView
  delayHistory: TenantDelayRecordView[]
}

// ── mappers ──

function mapTenant(row: TenantRow, contractCount: number, delayCount: number): TenantView {
  return {
    id: row.name,
    name: (row.name_val as string) || '',
    partyType: (row.party_type as string) || null,
    nationalId: (row.national_id as string) || null,
    vatNumber: (row.vat_number as string) || null,
    phone: (row.phone as string) || '',
    email: (row.email as string) || null,
    address: (row.address as string) || null,
    emergencyContact: (row.emergency_contact as string) || null,
    companyName: (row.company_name as string) || null,
    crNumber: (row.cr_number as string) || null,
    crDate: row.cr_date ? isoDate(row.cr_date as string) : null,
    unifiedNumber: (row.unified_number as string) || null,
    orgType: (row.org_type as string) || null,
    representativeName: (row.representative_name as string) || null,
    representativeId: (row.representative_id as string) || null,
    representativeMobile: (row.representative_mobile as string) || null,
    representativeEmail: (row.representative_email as string) || null,
    createdAt: isoDate(row.created_at as string) || '',
    _count: { contracts: contractCount, delayRecords: delayCount },
  }
}

function mapContract(row: ContractRow, now: Date): TenantContractView {
  return {
    id: row.name,
    contractNumber: (row.contract_number as string) || row.name,
    status: displayStatus(row.status as string, row.end_date as string, now),
    startDate: isoDate(row.start_date as string) || '',
    endDate: isoDate(row.end_date as string) || '',
    rentAmount: num(row.rent_amount),
  }
}

function mapDelay(row: DelayRow): TenantDelayRecordView {
  return {
    id: row.name,
    contractNumber: (row.contract_number as string) || null,
    installmentNo: num(row.installment_no),
    dueDate: isoDate(row.due_date as string) || '',
    resolvedAt: row.resolved_at ? isoDate(row.resolved_at as string) : null,
    delayDays: num(row.delay_days),
    source: (row.source as string) || '',
  }
}

// ── index builders (ONE query each, no N+1) ──

function countByTenant(rows: Array<{ tenant_id?: string | null }>): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rows) {
    const tid = (r.tenant_id as string) || ''
    if (!tid) continue
    m.set(tid, (m.get(tid) ?? 0) + 1)
  }
  return m
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API — the compat surface the tenants section calls
// ═══════════════════════════════════════════════════════════════════════════

/** The tenants LIST — all Rental Tenant rows, with contract + delay-record
 *  counts joined in TWO queries (no N+1), filtered/sorted like egarsys
 *  (newest first). Search matches name / phone / email / national_id. */
export async function getTenantsList(search?: string): Promise<TenantView[]> {
  const [tenants, contracts, delays] = await Promise.all([
    safeList<TenantRow>('Rental Tenant', { fields: TENANT_FIELDS, limit_page_length: 0 }),
    safeList<{ tenant_id?: string | null }>('Rental Contract', { fields: ['name', 'tenant_id'], limit_page_length: 0 }),
    safeList<{ tenant_id?: string | null }>('Rental Tenant Delay Record', { fields: ['name', 'tenant_id'], limit_page_length: 0 }),
  ])

  const contractCount = countByTenant(contracts)
  const delayCount = countByTenant(delays)

  let mapped = tenants.map((t) => mapTenant(t, contractCount.get(t.name) ?? 0, delayCount.get(t.name) ?? 0))

  // ── search (mirror the DB OR-contains in egarsys's list route) ──
  const s = (search || '').trim().toLowerCase()
  if (s) {
    mapped = mapped.filter((t) =>
      [t.name, t.phone, t.email, t.nationalId]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s)),
    )
  }

  // ── default order: newest first (egarsys `orderBy createdAt desc`) ──
  mapped.sort((a, b) => {
    const at = a.createdAt ? Date.parse(a.createdAt) : 0
    const bt = b.createdAt ? Date.parse(b.createdAt) : 0
    return bt - at
  })

  return mapped
}

/** One tenant's full doc + its contracts + its permanent delay-record ledger
 *  (the «تقييم العميل» rating). The live latePayment summary is derived from the
 *  OPEN delay records — the mirror lacks per-installment amounts, so totalOverdue
 *  stays 0 (the header guards its money chip on `> 0`). Returns null if unknown. */
export async function getTenantDetail(id: string): Promise<TenantDetailView | null> {
  const rows = await safeList<TenantRow>('Rental Tenant', {
    fields: TENANT_FIELDS,
    filters: [['Rental Tenant', 'name', '=', id]],
    limit_page_length: 1,
  })
  const row = rows[0]
  if (!row) return null

  const now = new Date()
  const [contractRows, delayRows] = await Promise.all([
    safeList<ContractRow>('Rental Contract', {
      fields: TENANT_CONTRACT_FIELDS,
      filters: [['Rental Contract', 'tenant_id', '=', id]],
      limit_page_length: 0,
    }),
    safeList<DelayRow>('Rental Tenant Delay Record', {
      fields: DELAY_FIELDS,
      filters: [['Rental Tenant Delay Record', 'tenant_id', '=', id]],
      limit_page_length: 0,
    }),
  ])

  // Contracts — newest first (egarsys `orderBy createdAt desc`).
  const contracts = contractRows
    .map((c) => ({ c, t: c.created_at ? Date.parse(isoDate(c.created_at as string) || '') || 0 : 0 }))
    .sort((a, b) => b.t - a.t)
    .map(({ c }) => mapContract(c, now))

  // Permanent rating ledger — open events first, then newest due (egarsys order).
  const delayHistory = delayRows
    .map(mapDelay)
    .sort(
      (a, b) => (a.resolvedAt ? 1 : 0) - (b.resolvedAt ? 1 : 0) || b.dueDate.localeCompare(a.dueDate),
    )

  // Live lateness — derived from the OPEN (unresolved) delay records.
  const openEvents = delayHistory.filter((r) => !r.resolvedAt)
  let oldestDue: string | null = null
  for (const r of openEvents) {
    if (r.dueDate && (!oldestDue || r.dueDate < oldestDue)) oldestDue = r.dueDate
  }
  const delayDays = oldestDue
    ? Math.max(0, Math.floor((now.getTime() - new Date(oldestDue).getTime()) / 86_400_000))
    : 0
  const latePayment: TenantLatePaymentView = {
    isLate: openEvents.length > 0 && delayDays > 0,
    delayDays,
    overdueCount: openEvents.length,
    totalOverdue: 0, // no per-installment amount in the mirror ledger (header guards `> 0`)
    oldestDueDate: oldestDue,
  }

  const base = mapTenant(row, contracts.length, delayHistory.length)
  return { ...base, contracts, latePayment, delayHistory }
}
