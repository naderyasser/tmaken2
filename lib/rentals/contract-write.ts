// Write layer for the ported egarsys CONTRACTS section — the mirror-backed
// counterpart of the READ adapter in lib/rentals/contracts-data.ts.
//
// egarsys's contract writes went through Next API routes that ALSO ran business
// logic on the server (internalId minting, paymentFrequency derivation,
// totalContractValue computation, renewal snapshot copy, status transitions).
// The Frappe mirror doctype `Rental Contract` has NONE of that server logic, so
// every derivation egarsys did server-side is reproduced HERE and the finished
// snake_case payload is written straight to /api/resource via `frappeClient`.
//
// Field mapping camelCase(form) → snake_case(mirror) follows
// /root/meena-rentals-migration/out/schema-spec.json (model RentalContract).
// Scope: NOTHING here touches ZATCA / invoices / units — those stay out of scope.

import { frappeClient } from '@/lib/api-client'

const DOCTYPE = 'Rental Contract'

// ── date / value helpers ──────────────────────────────────────────────────

/** Empty string / undefined → null (egarsys stored NULL, not ''; Link fields need it). */
const orNull = (v: unknown): string | null => {
  if (v === undefined || v === null) return null
  const s = String(v)
  return s.trim() === '' ? null : s
}

/** Form "YYYY-MM-DD" → the mirror's naive datetime "YYYY-MM-DD 00:00:00"
 *  (midnight — matches egarsys's midnight-UTC lease dates and the migrated rows). */
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

/** installmentsPerYear → paymentFrequency, identical to egarsys's create/edit routes. */
export function derivePaymentFrequency(installmentsPerYear: number | string): string {
  const s = String(installmentsPerYear)
  if (s === '1' || s === 'annual') return 'annual'
  if (s === '2') return 'biannual'
  if (s === '12') return 'monthly'
  return 'quarterly'
}

/** totalContractValue from annual rent + tax over the lease months — the exact
 *  formula egarsys's POST /api/contracts computed server-side. null when it can't. */
export function computeTotalContractValue(
  rentAmount: number,
  taxRatePercent: number,
  startDate?: string | null,
  endDate?: string | null,
): number | null {
  if (!rentAmount || rentAmount <= 0 || !startDate || !endDate) return null
  const s = new Date(startDate)
  const e = new Date(endDate)
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return null
  let totalMonths = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
  if (e.getDate() > s.getDate()) totalMonths++
  if (totalMonths < 1) totalMonths = 1
  const taxPct = taxRatePercent / 100
  const baseTotal = Math.round(rentAmount * (totalMonths / 12))
  const taxAmount = Math.round(baseTotal * taxPct)
  return Math.round(baseTotal + taxAmount)
}

// New docs (autoname=prompt) need an explicit name; egarsys used cuids, native
// docs use an rc<base36> id. Same idea as lib/rentals/config.ts's newDocName().
export const mintContractName = (): string =>
  'rc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)

// ── per-company internal_id sequence (mirrors egarsys) ────────────────────

export interface ContractSeqContext {
  /** company_id to stamp on new docs (the tenant site's own company). */
  companyId: string | null
  /** max(existing internal_id for that company) + 1. */
  nextInternalId: number
}

/** ONE query: derive the site's company_id (the one most contracts carry) and the
 *  next الرقم الداخلي in that company's sequence — egarsys's per-company counter. */
export async function getContractSeqContext(): Promise<ContractSeqContext> {
  const rows = await frappeClient.getList<{ company_id?: string | null; internal_id?: number | null }>(
    DOCTYPE,
    { fields: ['company_id', 'internal_id'], limit_page_length: 0 },
  )
  const counts = new Map<string, number>()
  for (const r of rows) {
    const c = r.company_id || ''
    if (c) counts.set(c, (counts.get(c) || 0) + 1)
  }
  let companyId: string | null = null
  let best = -1
  for (const [c, n] of counts) if (n > best) { best = n; companyId = c }

  // Fall back to a Rental Property's company_id when the site has no contracts yet.
  if (!companyId) {
    try {
      const props = await frappeClient.getList<{ company_id?: string | null }>('Rental Property', {
        fields: ['company_id'], limit_page_length: 1,
      })
      companyId = props[0]?.company_id || null
    } catch { /* leave null */ }
  }

  let maxId = 0
  for (const r of rows) {
    if ((r.company_id || null) === companyId) maxId = Math.max(maxId, Number(r.internal_id) || 0)
  }
  return { companyId, nextInternalId: maxId + 1 }
}

// ── property picker (existing Rental Property docs for the create form) ────

export interface LinkableProperty { id: string; title: string; titleAr: string | null }

export async function listLinkableProperties(): Promise<LinkableProperty[]> {
  const rows = await frappeClient.getList<{ name: string; title?: string | null; title_ar?: string | null }>(
    'Rental Property',
    { fields: ['name', 'title', 'title_ar'], order_by: 'title asc', limit_page_length: 0 },
  )
  return rows.map((r) => ({ id: r.name, title: r.title || r.name, titleAr: r.title_ar ?? null }))
}

/** Property (+owner) lookup used to auto-fill the create form when a property is picked. */
export async function getPropertyAutofill(propertyId: string): Promise<{
  propertyCity: string; propertyDistrict: string; propertyAddress: string
  lessorName: string; lessorNationalId: string; lessorPhone: string; lessorAddress: string
} | null> {
  const props = await frappeClient.getList<{ name: string; city?: string | null; district?: string | null; address?: string | null; owner_id?: string | null }>(
    'Rental Property',
    { fields: ['name', 'city', 'district', 'address', 'owner_id'], filters: [['Rental Property', 'name', '=', propertyId]], limit_page_length: 1 },
  )
  const p = props[0]
  if (!p) return null
  let owner: { name_val?: string | null; national_id?: string | null; phone?: string | null; address?: string | null } | undefined
  if (p.owner_id) {
    const owners = await frappeClient.getList<{ name: string; name_val?: string | null; national_id?: string | null; phone?: string | null; address?: string | null }>(
      'Rental Owner',
      { fields: ['name', 'name_val', 'national_id', 'phone', 'address'], filters: [['Rental Owner', 'name', '=', p.owner_id]], limit_page_length: 1 },
    )
    owner = owners[0]
  }
  return {
    propertyCity: p.city || '', propertyDistrict: p.district || '', propertyAddress: p.address || '',
    lessorName: owner?.name_val || '', lessorNationalId: owner?.national_id || '',
    lessorPhone: owner?.phone || '', lessorAddress: owner?.address || '',
  }
}

// ── unit occupancy (Rental Unit + Rental Contract Unit junction) ──────────
//
// egarsys captured which UNITS of the picked property a contract occupies via a
// multi-select, then — server-side, right after POST /api/contracts — it:
//   1. inserted a ContractUnit join row per selected unit,
//   2. flipped every selected unit's status → 'rented',
//   3. saved the typed electric-meter number on the FIRST selected unit.
// The Frappe mirror has the same `Rental Contract Unit` junction (a standalone
// doctype, istable=0, autoname=prompt; fields contract_id · unit_id · rent_amount)
// and `Rental Unit.electric_meter`, so those three side-effects are reproduced here.

const UNIT_DOCTYPE = 'Rental Unit'
const CONTRACT_UNIT_DOCTYPE = 'Rental Contract Unit'

// Junction docs are autoname=prompt too — mint an explicit rcu<base36> name.
export const mintContractUnitName = (): string =>
  'rcu' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)

export interface VacantUnit {
  id: string
  unitNumber: string
  floor: number | null
  electricMeter: string | null
  area: number | null
  rentPrice: number | null
}

/** Vacant Rental Unit rows for a property — feeds the create form's unit multi-select.
 *  egarsys offered only status='vacant' units so a rented unit can't be double-booked. */
export async function listVacantUnitsForProperty(propertyId: string): Promise<VacantUnit[]> {
  if (!propertyId) return []
  const rows = await frappeClient.getList<{
    name: string; unit_number?: string | null; floor?: number | null
    electric_meter?: string | null; area?: number | null; rent_price?: number | null
  }>(UNIT_DOCTYPE, {
    fields: ['name', 'unit_number', 'floor', 'electric_meter', 'area', 'rent_price'],
    filters: [[UNIT_DOCTYPE, 'property_id', '=', propertyId], [UNIT_DOCTYPE, 'status', '=', 'vacant']],
    order_by: 'unit_number asc',
    limit_page_length: 0,
  })
  return rows.map((r) => ({
    id: r.name,
    unitNumber: r.unit_number || r.name,
    floor: r.floor ?? null,
    electricMeter: r.electric_meter ?? null,
    area: r.area ?? null,
    rentPrice: r.rent_price ?? null,
  }))
}

export interface ContractUnitRow { id: string; unitId: string; unitNumber: string; floor: number | null }

/** Existing Rental Contract Unit junctions for a contract, resolved to unit numbers —
 *  used to prefill the read-only «الوحدة المؤجرة» display in the EDIT form (egarsys did
 *  the same from the contract's `contractUnits`). */
export async function listContractUnits(contractId: string): Promise<ContractUnitRow[]> {
  if (!contractId) return []
  const links = await frappeClient.getList<{ name: string; unit_id?: string | null }>(CONTRACT_UNIT_DOCTYPE, {
    fields: ['name', 'unit_id'],
    filters: [[CONTRACT_UNIT_DOCTYPE, 'contract_id', '=', contractId]],
    limit_page_length: 0,
  })
  if (links.length === 0) return []
  const unitIds = links.map((l) => l.unit_id).filter(Boolean) as string[]
  const unitMap = new Map<string, { unit_number?: string | null; floor?: number | null }>()
  if (unitIds.length > 0) {
    const units = await frappeClient.getList<{ name: string; unit_number?: string | null; floor?: number | null }>(
      UNIT_DOCTYPE,
      { fields: ['name', 'unit_number', 'floor'], filters: [[UNIT_DOCTYPE, 'name', 'in', unitIds]], limit_page_length: 0 },
    )
    for (const u of units) unitMap.set(u.name, u)
  }
  return links.map((l) => {
    const u = l.unit_id ? unitMap.get(l.unit_id) : undefined
    return { id: l.name, unitId: l.unit_id || '', unitNumber: u?.unit_number || l.unit_id || '', floor: u?.floor ?? null }
  })
}

/** After a contract is created, wire up the chosen units (egarsys's POST side-effects):
 *   • create one Rental Contract Unit junction per unit (deduped by contract+unit),
 *   • flip each chosen unit's status → 'rented',
 *   • stamp the typed electric_meter on the FIRST chosen unit.
 *  Best-effort recompute of the property's own status (rented only when EVERY unit is
 *  rented) is attempted last so it can never block the occupancy writes. */
export async function saveContractUnitOccupancy(
  contractId: string,
  unitIds: string[],
  electricMeter?: string | null,
  propertyId?: string | null,
): Promise<void> {
  if (!contractId || !Array.isArray(unitIds) || unitIds.length === 0) return

  // 1. junctions — skip any that already link this contract to the same unit.
  const existing = await frappeClient.getList<{ name: string; unit_id?: string | null }>(CONTRACT_UNIT_DOCTYPE, {
    fields: ['name', 'unit_id'],
    filters: [[CONTRACT_UNIT_DOCTYPE, 'contract_id', '=', contractId]],
    limit_page_length: 0,
  })
  const already = new Set(existing.map((e) => e.unit_id).filter(Boolean))
  for (const uid of unitIds) {
    if (already.has(uid)) continue
    await frappeClient.post(CONTRACT_UNIT_DOCTYPE, {
      name: mintContractUnitName(),
      contract_id: contractId,
      unit_id: uid,
      rent_amount: null,
    })
  }

  // 2. flip units → rented (+ meter on the first unit, in the same PUT).
  const meter = (electricMeter || '').trim()
  for (const uid of unitIds) {
    const patch: MirrorPayload = { status: 'rented', updated_at: nowStamp() }
    if (meter !== '' && uid === unitIds[0]) patch.electric_meter = meter
    await frappeClient.put(UNIT_DOCTYPE, uid, patch)
  }

  // 3. recompute the property's status — a multi-unit property is only 'rented' once
  //    every one of its units is rented; otherwise it stays 'available' so the remaining
  //    vacant units can still be let (egarsys's exact rule). Best-effort, never fatal.
  if (propertyId) {
    try {
      const propUnits = await frappeClient.getList<{ name: string; status?: string | null }>(UNIT_DOCTYPE, {
        fields: ['name', 'status'],
        filters: [[UNIT_DOCTYPE, 'property_id', '=', propertyId]],
        limit_page_length: 0,
      })
      if (propUnits.length > 0) {
        const allRented = propUnits.every((u) => (u.status || '') === 'rented')
        await frappeClient.put('Rental Property', propertyId, {
          status: allRented ? 'rented' : 'available',
          updated_at: nowStamp(),
        })
      }
    } catch { /* leave property status unchanged */ }
  }
}

// ── payload builder (camelCase form → snake mirror) ───────────────────────

/** The contract-form fields this writer consumes (a subset of egarsys's CreateFormState). */
export interface ContractFormInput {
  rentalPropertyId?: string
  contractNumber?: string
  internalId?: string
  propertyType?: string
  otherPropertyType?: string
  propertyLocation?: string
  propertyStreet?: string
  propertyBuildingNumber?: string
  propertyCity?: string
  propertyDistrict?: string
  propertyPostalCode?: string
  propertyAddress?: string
  tenantId?: string
  contractType?: string
  registeredCalendar?: '' | 'hijri' | 'gregorian'
  ejarContractNumber?: string
  startDate?: string
  endDate?: string
  sealingLocation?: string
  sealingDate?: string
  vatNumber?: string
  rentAmount?: string
  installmentsPerYear?: string
  taxRate?: string
  securityDeposit?: string
  status?: string
  lessorName?: string
  lessorNationalId?: string
  lessorPhone?: string
  lessorVatRegistrationNumber?: string
  lessorAddress?: string
  lessorStreet?: string
  lessorBuildingNumber?: string
  lessorCity?: string
  lessorDistrict?: string
  lessorPostalCode?: string
  lessorAdditionalNumber?: string
  tenantPartyType?: string
  tenantName?: string
  tenantCompanyName?: string
  tenantCrNumber?: string
  tenantUnifiedNumber?: string
  tenantNationalId?: string
  tenantPhone?: string
  tenantEmail?: string
  tenantVatRegistrationNumber?: string
  tenantStreet?: string
  tenantBuildingNumber?: string
  tenantCity?: string
  tenantDistrict?: string
  tenantPostalCode?: string
  tenantAdditionalNumber?: string
  tenantRepresentativeName?: string
  tenantRepresentativeMobile?: string
  notes?: string
  terms?: string
}

type MirrorPayload = Record<string, string | number | null>

/** صفة الطرف gating — hidden identity fields are BLANKED (sent, not omitted) so a
 *  re-classified tenant can't keep stale CR/VAT/ID values (same rule as egarsys). */
function tenantIdentity(form: ContractFormInput): MirrorPayload {
  const t = form.tenantPartyType || ''
  const isOrg = t === 'establishment' || t === 'company'
  return {
    tenant_party_type: orNull(t),
    tenant_company_name: orNull(isOrg || t === 'government' ? form.tenantCompanyName : ''),
    tenant_cr_number: orNull(isOrg ? form.tenantCrNumber : ''),
    tenant_unified_number: orNull(isOrg ? form.tenantUnifiedNumber : ''),
    tenant_national_id: orNull(t === 'individual' ? form.tenantNationalId : ''),
    tenant_vat_registration_number: orNull(isOrg ? form.tenantVatRegistrationNumber : ''),
  }
}

/** Every tenant_* snapshot column derived from the form (name + صفة-الطرف-gated
 *  identity + contact). Shared by the create/edit snapshot AND the change-tenant
 *  override so a tenant swap can never leave a stale column behind. */
function tenantSnapshot(form: ContractFormInput): MirrorPayload {
  return {
    tenant_name: orNull(form.tenantName),
    ...tenantIdentity(form),
    tenant_phone: orNull(form.tenantPhone),
    tenant_email: orNull(form.tenantEmail),
    tenant_street: orNull(form.tenantStreet),
    tenant_building_number: orNull(form.tenantBuildingNumber),
    tenant_city: orNull(form.tenantCity),
    tenant_district: orNull(form.tenantDistrict),
    tenant_postal_code: orNull(form.tenantPostalCode),
    tenant_additional_number: orNull(form.tenantAdditionalNumber),
    tenant_representative_name: orNull(form.tenantRepresentativeName),
    tenant_representative_mobile: orNull(form.tenantRepresentativeMobile),
  }
}

/** Common lessor + tenant + property snapshot columns (shared by create & edit). */
function snapshotFields(form: ContractFormInput): MirrorPayload {
  return {
    property_type: orNull(form.propertyType) || 'other',
    other_property_type: orNull(form.otherPropertyType),
    property_location: orNull(form.propertyLocation),
    property_street: orNull(form.propertyStreet),
    property_building_number: orNull(form.propertyBuildingNumber),
    property_city: orNull(form.propertyCity),
    property_district: orNull(form.propertyDistrict),
    property_postal_code: orNull(form.propertyPostalCode),
    property_address: orNull(form.propertyAddress),
    contract_type: orNull(form.contractType) || 'new',
    registered_calendar:
      form.registeredCalendar === 'hijri' || form.registeredCalendar === 'gregorian'
        ? form.registeredCalendar
        : null,
    sealing_location: orNull(form.sealingLocation),
    sealing_date: toMirrorDate(form.sealingDate),
    vat_number: orNull(form.vatNumber),
    ejar_contract_number: orNull(form.ejarContractNumber),
    lessor_name: orNull(form.lessorName),
    lessor_national_id: orNull(form.lessorNationalId),
    lessor_phone: orNull(form.lessorPhone),
    lessor_vat_registration_number: orNull(form.lessorVatRegistrationNumber),
    lessor_address: orNull(form.lessorAddress),
    lessor_street: orNull(form.lessorStreet),
    lessor_building_number: orNull(form.lessorBuildingNumber),
    lessor_city: orNull(form.lessorCity),
    lessor_district: orNull(form.lessorDistrict),
    lessor_postal_code: orNull(form.lessorPostalCode),
    lessor_additional_number: orNull(form.lessorAdditionalNumber),
    ...tenantSnapshot(form),
  }
}

// ── public write API ──────────────────────────────────────────────────────

/** CREATE a new Rental Contract from the form. Returns the minted doc name. */
export async function createContractDoc(form: ContractFormInput, ctx: ContractSeqContext): Promise<string> {
  const name = mintContractName()
  const installments = numOr(form.installmentsPerYear, 4)
  const rent = numOr(form.rentAmount, 0)
  const taxRate = numOr(form.taxRate, 0)
  const stamp = nowStamp()

  const payload: MirrorPayload = {
    name,
    internal_id: ctx.nextInternalId,
    contract_number: orNull(form.contractNumber),
    company_id: ctx.companyId,
    rental_property_id: orNull(form.rentalPropertyId),
    tenant_id: orNull(form.tenantId),
    start_date: toMirrorDate(form.startDate),
    end_date: toMirrorDate(form.endDate),
    rent_amount: rent,
    security_deposit: numOr(form.securityDeposit, 0),
    installments_per_year: installments,
    payment_frequency: derivePaymentFrequency(installments),
    status: orNull(form.status) || 'active',
    notes: orNull(form.notes),
    terms: orNull(form.terms),
    parent_contract_id: null,
    total_contract_value: computeTotalContractValue(rent, taxRate, form.startDate, form.endDate),
    tax_rate: taxRate,
    prepaid_settled: 0,
    created_at: stamp,
    updated_at: stamp,
    ...snapshotFields(form),
  }
  await frappeClient.post(DOCTYPE, payload)
  return name
}

/** EDIT an existing contract. contract_number + property/unit link stay fixed (not sent). */
export async function updateContractDoc(name: string, form: ContractFormInput): Promise<void> {
  const installments = numOr(form.installmentsPerYear, 4)
  const rent = numOr(form.rentAmount, 0)
  const taxRate = numOr(form.taxRate, 0)

  const payload: MirrorPayload = {
    tenant_id: orNull(form.tenantId),
    start_date: toMirrorDate(form.startDate),
    end_date: toMirrorDate(form.endDate),
    rent_amount: rent,
    security_deposit: numOr(form.securityDeposit, 0),
    installments_per_year: installments,
    payment_frequency: derivePaymentFrequency(installments),
    status: orNull(form.status) || 'active',
    notes: orNull(form.notes),
    terms: orNull(form.terms),
    total_contract_value: computeTotalContractValue(rent, taxRate, form.startDate, form.endDate),
    tax_rate: taxRate,
    updated_at: nowStamp(),
    ...snapshotFields(form),
  }
  // Admin override of the internal number (blank → leave unchanged).
  if (form.internalId && form.internalId.trim() !== '') payload.internal_id = numOr(form.internalId, 0)

  await frappeClient.put(DOCTYPE, name, payload)
}

export interface RenewFormInput {
  startDate?: string
  endDate?: string
  rentAmount?: string
  securityDeposit?: string
  contractNumber?: string
  notes?: string
  terms?: string
}

/** Allocate a fresh globally-unique CNT-xxxxxxxx (past the largest existing one). */
async function nextAutoContractNumber(): Promise<string> {
  const rows = await frappeClient.getList<{ contract_number?: string | null }>(DOCTYPE, {
    fields: ['contract_number'],
    filters: [[DOCTYPE, 'contract_number', 'like', 'CNT-%']],
    order_by: 'contract_number desc',
    limit_page_length: 0,
  })
  let candidate = 1
  for (const r of rows) {
    const parsed = parseInt(String(r.contract_number || '').replace('CNT-', ''), 10)
    if (!isNaN(parsed) && parsed + 1 > candidate) candidate = parsed + 1
  }
  return `CNT-${String(candidate).padStart(8, '0')}`
}

/** RENEW: create a full copy of the parent with new period/rent/etc, status active,
 *  parent_contract_id = parent, internal_id carried over; then mark the parent
 *  pending_renewal — exactly the semantics of egarsys's renewal route. Returns new name. */
export async function renewContractDoc(parentName: string, form: RenewFormInput): Promise<string> {
  const parentRes = await frappeClient.get<Record<string, unknown>>(DOCTYPE, parentName)
  const parent = parentRes.data
  if (!parent) throw new Error('العقد الأصل غير موجود')

  // Copy every scalar snapshot column from the parent, drop Frappe/meta + fields we override.
  const DROP = new Set([
    'name', 'owner', 'creation', 'modified', 'modified_by', 'idx', 'docstatus',
    '_user_tags', '_comments', '_assign', '_liked_by', 'doctype',
    'contract_number', 'status', 'parent_contract_id', 'start_date', 'end_date',
    'rent_amount', 'security_deposit', 'notes', 'terms', 'created_at', 'updated_at',
  ])
  const copied: MirrorPayload = {}
  for (const [k, v] of Object.entries(parent)) {
    if (DROP.has(k)) continue
    if (v === undefined) continue
    copied[k] = v as string | number | null
  }

  const name = mintContractName()
  const stamp = nowStamp()
  const contractNumber = orNull(form.contractNumber) || (await nextAutoContractNumber())

  const payload: MirrorPayload = {
    ...copied,
    name,
    contract_number: contractNumber,
    status: 'active',
    parent_contract_id: parentName,
    start_date: toMirrorDate(form.startDate) || (parent.start_date as string) || null,
    end_date: toMirrorDate(form.endDate) || (parent.end_date as string) || null,
    rent_amount: form.rentAmount ? numOr(form.rentAmount, Number(parent.rent_amount) || 0) : (Number(parent.rent_amount) || 0),
    security_deposit: form.securityDeposit ? numOr(form.securityDeposit, Number(parent.security_deposit) || 0) : (Number(parent.security_deposit) || 0),
    notes: orNull(form.notes),
    terms: form.terms !== undefined ? orNull(form.terms) : ((parent.terms as string) ?? null),
    created_at: stamp,
    updated_at: stamp,
  }

  await frappeClient.post(DOCTYPE, payload)
  await frappeClient.put(DOCTYPE, parentName, { status: 'pending_renewal', updated_at: stamp })
  return name
}

// ── change tenant (تغيير المستأجر) ────────────────────────────────────────
//
// «تغيير المستأجر» on an ACTIVE contract spawns a successor contract for the SAME
// property/unit with a NEW tenant, then retires the old one. The successor:
//   • KEEPS the old internal_id (same الرقم الداخلي slot — NOT max+1),
//   • sets parent_contract_id = old.name so the old contract is SUPERSEDED and
//     auto-drops into «أرشيف العقود» (the ended-set already treats a superseded
//     contract as ended), and
//   • is status='active' with the new tenant snapshot + new number/period/rent.
// The old contract is then flipped to status='moved_out' (status ONLY — the new
// contract now holds the property; unit links & Rental Unit/Property status are
// left untouched, since the property stays continuously occupied).

/** The fields the change-tenant form supplies — the new tenant snapshot + the new
 *  contract's number/period/rent. Everything else (property + unit links, lessor
 *  snapshot, contract meta, notes, terms) is copied from the old contract. */
export type ChangeTenantFormInput = Pick<ContractFormInput,
  | 'tenantId' | 'tenantPartyType' | 'tenantName' | 'tenantCompanyName' | 'tenantCrNumber'
  | 'tenantUnifiedNumber' | 'tenantNationalId' | 'tenantVatRegistrationNumber' | 'tenantPhone'
  | 'tenantEmail' | 'tenantStreet' | 'tenantBuildingNumber' | 'tenantCity' | 'tenantDistrict'
  | 'tenantPostalCode' | 'tenantAdditionalNumber' | 'tenantRepresentativeName' | 'tenantRepresentativeMobile'
  | 'contractNumber' | 'startDate' | 'endDate' | 'rentAmount' | 'securityDeposit'>

/** All tenant_* columns for the successor contract, rebuilt wholly from the form so
 *  none of the OLD tenant's identity/contact leaks through the copied doc. */
function tenantColumns(form: ContractFormInput): MirrorPayload {
  return {
    tenant_id: orNull(form.tenantId),
    ...tenantSnapshot(form),
    tenant_national_address: null,
  }
}

/** CHANGE TENANT: create a successor Rental Contract for the same property/unit with a
 *  new tenant (same internal_id, parent_contract_id = old.name, status active), copy the
 *  old contract's Rental Contract Unit junctions onto it, then set the OLD contract to
 *  status='moved_out' (status only). Returns the new contract's name. */
export async function changeContractTenant(
  oldContractName: string,
  form: ChangeTenantFormInput,
): Promise<string> {
  const oldRes = await frappeClient.get<Record<string, unknown>>(DOCTYPE, oldContractName)
  const old = oldRes.data
  if (!old) throw new Error('العقد الأصل غير موجود')

  // Copy every scalar snapshot column from the old contract — property + unit links,
  // lessor snapshot, internal_id, company_id, contract meta (type/calendar/sealing/vat/
  // tax_rate/installments), notes & terms — dropping Frappe meta, the fields we override,
  // the OLD tenant identity (rebuilt from the form), and the OLD payment/prepaid state +
  // attachments + Ejar number (a new lease for a new tenant starts financially clean).
  const DROP = new Set([
    'name', 'owner', 'creation', 'modified', 'modified_by', 'idx', 'docstatus',
    '_user_tags', '_comments', '_assign', '_liked_by', 'doctype',
    'contract_number', 'ejar_contract_number', 'status', 'parent_contract_id',
    'start_date', 'end_date', 'rent_amount', 'security_deposit',
    'total_contract_value', 'created_at', 'updated_at', 'created_by_id',
    // OLD tenant identity — rebuilt wholly from the form via tenantColumns().
    'tenant_id', 'tenant_party_type', 'tenant_name', 'tenant_company_name', 'tenant_cr_number',
    'tenant_unified_number', 'tenant_national_id', 'tenant_vat_registration_number', 'tenant_phone',
    'tenant_email', 'tenant_national_address', 'tenant_street', 'tenant_building_number', 'tenant_city',
    'tenant_district', 'tenant_postal_code', 'tenant_additional_number', 'tenant_representative_name',
    'tenant_representative_mobile',
    // OLD payment-history / prepaid state + attachments — never inherited by the successor.
    'prepaid_settled', 'prepaid_note', 'prepaid_at', 'prepaid_by_id', 'paid_previously_installments',
    'contract_attachment', 'attachments_by_doc_type',
  ])
  const copied: MirrorPayload = {}
  for (const [k, v] of Object.entries(old)) {
    if (DROP.has(k) || v === undefined) continue
    copied[k] = v as string | number | null
  }

  const name = mintContractName()
  const stamp = nowStamp()
  const rent = numOr(form.rentAmount, 0)
  const taxRate = numOr(old.tax_rate, 0)

  const payload: MirrorPayload = {
    ...copied,
    name,
    internal_id: numOr(old.internal_id, 0), // SAME slot — carried over, NOT max+1
    parent_contract_id: oldContractName,    // old contract → superseded → «المنتهية»
    status: 'active',
    contract_number: orNull(form.contractNumber),
    start_date: toMirrorDate(form.startDate) || (old.start_date as string) || null,
    end_date: toMirrorDate(form.endDate) || (old.end_date as string) || null,
    rent_amount: rent,
    security_deposit: numOr(form.securityDeposit, Number(old.security_deposit) || 0),
    total_contract_value: computeTotalContractValue(rent, taxRate, form.startDate, form.endDate),
    prepaid_settled: 0,
    ...tenantColumns(form),
    created_at: stamp,
    updated_at: stamp,
  }
  await frappeClient.post(DOCTYPE, payload)

  // Copy the old contract's unit junctions onto the successor (same unit_ids) — the old
  // junctions are left in place (spec: the new contract holds the property; don't touch
  // the old contract's unit links).
  const oldUnits = await frappeClient.getList<{ name: string; unit_id?: string | null; rent_amount?: number | null }>(
    CONTRACT_UNIT_DOCTYPE,
    {
      fields: ['name', 'unit_id', 'rent_amount'],
      filters: [[CONTRACT_UNIT_DOCTYPE, 'contract_id', '=', oldContractName]],
      limit_page_length: 0,
    },
  )
  for (const u of oldUnits) {
    if (!u.unit_id) continue
    await frappeClient.post(CONTRACT_UNIT_DOCTYPE, {
      name: mintContractUnitName(),
      contract_id: name,
      unit_id: u.unit_id,
      rent_amount: u.rent_amount ?? null,
    })
  }

  // Retire the old contract — status ONLY (units/invoices/property untouched).
  await frappeClient.put(DOCTYPE, oldContractName, { status: 'moved_out', updated_at: stamp })
  return name
}

/** Terminate / move-out: status-only transition on the mirror (no unit side effects). */
export async function setContractStatus(name: string, status: string): Promise<void> {
  await frappeClient.put(DOCTYPE, name, { status, updated_at: nowStamp() })
}

/** DELETE the contract doc. */
export async function deleteContractDoc(name: string): Promise<void> {
  await frappeClient.delete(DOCTYPE, name)
}
