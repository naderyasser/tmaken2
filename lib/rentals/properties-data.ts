// Mirror-backed compatibility layer for the ported egarsys PROPERTIES section.
// Returns the SAME camelCase shapes properties.tsx consumes (see egarsys
// src/app/api/properties/route.ts + [id]/route.ts + the units/contracts/invoices
// endpoints), but computed from the Frappe "Rental *" mirror doctypes on the
// current tenant site. READ-ONLY — no writes, no Frappe docs created.
//
// TWO mandatory mirror-fidelity rules (proven on the dashboard/contracts port):
//   1. Frappe Float can't store NULL → egarsys's null arrives as 0. Map
//      `x ? num : null` (0 → null) for money/measurement/coordinate fields so a
//      genuinely-unset value isn't rendered as a real 0 (e.g. lat/long 0,0 must
//      NOT paint a map; a 0 rent_price must hide the rent line).
//   2. Naive mirror datetimes ("YYYY-MM-DD HH:MM:SS", no zone) are anchored to
//      UTC (append Z) so dates match egarsys's UTC server in any browser TZ.

import { frappeClient } from '@/lib/api-client'
import type { FrappeFilter } from '@/lib/api-client'
import { fileHref } from '@/lib/rentals/config'
import type { LifecycleContract } from '@/components/rentals/egarsys/engine/contract-lifecycle'

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

/** Enrichment lists must degrade gracefully — a missing/forbidden auxiliary
 *  doctype returns [] rather than blowing up the whole property list. */
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

/** egarsys auto-expiry relabel — identical to its list/detail routes and to
 *  contracts-data: a date-past active/draft becomes 'expired' (never touching
 *  terminated / moved_out). */
function displayStatus(status: string | null | undefined, endStr: string | null | undefined, now: Date): string {
  const orig = (status as string) || 'active'
  const end = toDate(endStr)
  const isDateExpired = !!end && end < now && orig !== 'terminated' && orig !== 'moved_out'
  return isDateExpired && orig !== 'expired' ? 'expired' : orig
}

// ── field lists ──

const PROPERTY_FIELDS = [
  'name', 'internal_id', 'deed_number', 'deed_date', 'shop_number', 'owner_id',
  'title', 'title_ar', 'property_type', 'status', 'description', 'address',
  'city', 'district', 'latitude', 'longitude', 'area', 'bedrooms', 'bathrooms',
  'floor', 'year_built', 'rent_price', 'total_units', 'created_at', 'updated_at',
]
const OWNER_FIELDS = ['name', 'name_val', 'phone', 'national_id', 'email', 'address', 'vat_number']
const UNIT_FIELDS = ['name', 'property_id', 'unit_number', 'unit_type', 'status', 'floor', 'area', 'rent_price', 'electric_meter', 'notes']
const PROPERTY_IMAGE_FIELDS = ['name', 'property_id', 'image', 'is_cover']
const CONTRACT_FIELDS = [
  'name', 'contract_number', 'ejar_contract_number', 'internal_id', 'tenant_id',
  'tenant_name', 'rent_amount', 'start_date', 'end_date', 'status', 'unit_id',
  'rental_property_id', 'created_at',
]
const UNIT_INVOICE_FIELDS = ['name', 'invoice_number', 'contract_id', 'installment_no', 'total_value', 'due_date', 'status', 'zatca_document_type']

// ── raw row types ──

type PropertyRow = Record<string, unknown> & { name: string }
type OwnerRow = { name: string; name_val?: string | null; phone?: string | null; national_id?: string | null; email?: string | null; address?: string | null; vat_number?: string | null }
type UnitRow = Record<string, unknown> & { name: string; property_id?: string | null }
type ImageRow = { name: string; property_id?: string | null; image?: string | null; is_cover?: number | boolean | null }
type ContractRow = Record<string, unknown> & { name: string }
type InvoiceRow = Record<string, unknown> & { name: string }

// ── public shapes (what the ported section reads) ──

export interface PropertyImageView { id: string; image: string; isCover: boolean }
export interface PropertyOwnerView {
  id: string; name: string; phone: string | null; nationalId: string | null
  email: string | null; address: string | null; vatNumber: string | null
}
export interface PropertyView {
  id: string
  internalId: number | null
  deedNumber: string | null
  deedDate: string | null
  shopNumber: string | null
  ownerId: string | null
  title: string
  titleAr: string | null
  propertyType: string
  status: string
  description: string | null
  address: string
  city: string
  district: string | null
  latitude: number | null
  longitude: number | null
  area: number | null
  bedrooms: number | null
  bathrooms: number | null
  floor: number | null
  yearBuilt: number | null
  rentPrice: number | null
  totalUnits: number
  owner: PropertyOwnerView | null
  ownerName: string | null
  images: PropertyImageView[]
  coverImage: string | null
  createdAt: string | null
}

export interface UnitContractChip {
  contract: { id: string; contractNumber: string; endDate: string; tenantName: string | null; rentAmount: number; status: string }
}
export interface UnitView {
  id: string
  unitNumber: string
  status: string
  floor: number | null
  area: number | null
  rentPrice: number | null
  electricMeter: string | null
  notes: string | null
  contractUnits: UnitContractChip[]
}

/** Row shape for the detail dialog's «عقود الإيجار» table AND the
 *  ContractLifecycleTimeline (superset of LifecycleContract). */
export interface PropertyContractRow extends LifecycleContract {
  rentAmount: number
}

export interface UnitInvoiceRow { id: string; invoiceNumber: string; dueDate: string; totalValue: number; status: string }

export interface PropertyStatusCounts { available: number; rented: number; maintenance: number; inactive: number; total: number }

export interface PropertyFilters { search?: string; propertyType?: string; status?: string; city?: string }

// ── mappers ──

function mapOwner(o: OwnerRow | undefined): PropertyOwnerView | null {
  if (!o) return null
  return {
    id: o.name,
    name: o.name_val || '',
    phone: o.phone ?? null,
    nationalId: o.national_id ?? null,
    email: o.email ?? null,
    address: o.address ?? null,
    vatNumber: o.vat_number ?? null,
  }
}

function mapImages(rows: ImageRow[]): PropertyImageView[] {
  return rows
    .map((im) => ({ id: im.name, image: fileHref(im.image || '') || (im.image || ''), isCover: !!im.is_cover }))
    // egarsys orders images `isCover desc` so the cover leads the gallery.
    .sort((a, b) => Number(b.isCover) - Number(a.isCover))
}

function mapProperty(
  row: PropertyRow,
  ownerMap: Map<string, OwnerRow>,
  imagesMap: Map<string, ImageRow[]>,
  unitCountMap: Map<string, number>,
): PropertyView {
  const owner = mapOwner(row.owner_id ? ownerMap.get(row.owner_id as string) : undefined)
  const images = mapImages(imagesMap.get(row.name) ?? [])
  const cover = images.find((i) => i.isCover) || images[0]
  const liveUnitCount = unitCountMap.get(row.name) || 0
  return {
    id: row.name,
    internalId: floatOrNull(row.internal_id),
    deedNumber: (row.deed_number as string) || null,
    deedDate: row.deed_date ? isoDate(row.deed_date as string) : null,
    shopNumber: (row.shop_number as string) || null,
    ownerId: (row.owner_id as string) || null,
    title: (row.title as string) || '',
    titleAr: (row.title_ar as string) || null,
    propertyType: (row.property_type as string) || 'apartment',
    status: (row.status as string) || 'available',
    description: (row.description as string) || null,
    address: (row.address as string) || '',
    city: (row.city as string) || '',
    district: (row.district as string) || null,
    latitude: floatOrNull(row.latitude),
    longitude: floatOrNull(row.longitude),
    area: floatOrNull(row.area),
    bedrooms: floatOrNull(row.bedrooms),
    bathrooms: floatOrNull(row.bathrooms),
    floor: floatOrNull(row.floor),
    yearBuilt: floatOrNull(row.year_built),
    rentPrice: floatOrNull(row.rent_price),
    // egarsys: `p._count.units || p.totalUnits || 0` — live rows win, then stored.
    totalUnits: liveUnitCount || num(row.total_units) || 0,
    owner,
    ownerName: owner?.name ?? null,
    images,
    coverImage: cover?.image ?? null,
    createdAt: isoDate(row.created_at as string),
  }
}

function mapContractRow(row: ContractRow, now: Date): PropertyContractRow {
  return {
    id: row.name,
    contractNumber: (row.contract_number as string) || row.name,
    ejarContractNumber: (row.ejar_contract_number as string) || null,
    internalId: row.internal_id != null ? num(row.internal_id) : null,
    tenantName: (row.tenant_name as string) || null,
    rentAmount: num(row.rent_amount),
    startDate: isoDate(row.start_date as string) || '',
    endDate: isoDate(row.end_date as string) || '',
    status: displayStatus(row.status as string, row.end_date as string, now),
  }
}

// ── index builders (ONE query each, no N+1) ──

function groupImages(rows: ImageRow[]): Map<string, ImageRow[]> {
  const m = new Map<string, ImageRow[]>()
  for (const r of rows) {
    const pid = (r.property_id as string) || ''
    if (!pid) continue
    const arr = m.get(pid) ?? []
    arr.push(r)
    m.set(pid, arr)
  }
  return m
}

function countUnits(rows: UnitRow[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const u of rows) {
    const pid = (u.property_id as string) || ''
    if (!pid) continue
    m.set(pid, (m.get(pid) ?? 0) + 1)
  }
  return m
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API — the compat surface the properties section calls
// ═══════════════════════════════════════════════════════════════════════════

/** The properties LIST — all Rental Property rows, owner-joined + unit-counted +
 *  cover-imaged, filtered/sorted like egarsys (newest first). */
export async function getPropertiesList(filters: PropertyFilters = {}): Promise<PropertyView[]> {
  const [rows, owners, units, images] = await Promise.all([
    frappeClient.getList<PropertyRow>('Rental Property', { fields: PROPERTY_FIELDS, limit_page_length: 0 }),
    safeList<OwnerRow>('Rental Owner', { fields: OWNER_FIELDS, limit_page_length: 0 }),
    safeList<UnitRow>('Rental Unit', { fields: ['name', 'property_id'], limit_page_length: 0 }),
    safeList<ImageRow>('Rental Property Image', { fields: PROPERTY_IMAGE_FIELDS, limit_page_length: 0 }),
  ])

  const ownerMap = new Map<string, OwnerRow>(owners.map((o) => [o.name, o]))
  const imagesMap = groupImages(images)
  const unitCountMap = countUnits(units)

  let mapped = rows.map((r) => mapProperty(r, ownerMap, imagesMap, unitCountMap))

  // ── filters (mirror the DB WHERE in egarsys's list route) ──
  if (filters.propertyType) mapped = mapped.filter((p) => p.propertyType === filters.propertyType)
  if (filters.status) mapped = mapped.filter((p) => p.status === filters.status)
  if (filters.city) {
    const c = filters.city.toLowerCase()
    mapped = mapped.filter((p) => (p.city || '').toLowerCase().includes(c))
  }
  const s = (filters.search || '').trim().toLowerCase()
  if (s) {
    const numeric = /^\d+$/.test(s)
    mapped = mapped.filter((p) => {
      const hay = [p.title, p.titleAr, p.address, p.city, p.district, p.deedNumber, p.shopNumber]
        .filter(Boolean).map((v) => String(v).toLowerCase())
      if (hay.some((h) => h.includes(s))) return true
      if (numeric && p.internalId != null && String(p.internalId) === s) return true
      return false
    })
  }

  // ── default order: newest first (egarsys `orderBy createdAt desc`) ──
  mapped.sort((a, b) => {
    const at = a.createdAt ? Date.parse(a.createdAt) : 0
    const bt = b.createdAt ? Date.parse(b.createdAt) : 0
    if (bt !== at) return bt - at
    return (b.internalId ?? 0) - (a.internalId ?? 0)
  })

  return mapped
}

/** Filter-independent status tallies for the الفاضي / المؤجر widgets. */
export async function getPropertyStatusCounts(): Promise<PropertyStatusCounts> {
  const rows = await frappeClient.getList<{ status?: string }>('Rental Property', {
    fields: ['status'],
    limit_page_length: 0,
  })
  const counts: PropertyStatusCounts = { available: 0, rented: 0, maintenance: 0, inactive: 0, total: 0 }
  for (const r of rows) {
    counts.total++
    const st = (r.status as keyof PropertyStatusCounts) || 'available'
    if (st in counts && st !== 'total') counts[st]++
  }
  return counts
}

/** One property's full doc (owner + images + unit count) — used by the
 *  pendingFocus deep-link, which fetches fresh (the list may be filtered past it). */
export async function getPropertyDetail(id: string): Promise<PropertyView | null> {
  const rows = await frappeClient.getList<PropertyRow>('Rental Property', {
    fields: PROPERTY_FIELDS,
    filters: [['Rental Property', 'name', '=', id]],
    limit_page_length: 1,
  })
  const row = rows[0]
  if (!row) return null

  const [images, units] = await Promise.all([
    safeList<ImageRow>('Rental Property Image', {
      fields: PROPERTY_IMAGE_FIELDS,
      filters: [['Rental Property Image', 'property_id', '=', id]],
      limit_page_length: 0,
    }),
    safeList<UnitRow>('Rental Unit', {
      fields: ['name', 'property_id'],
      filters: [['Rental Unit', 'property_id', '=', id]],
      limit_page_length: 0,
    }),
  ])

  const ownerMap = new Map<string, OwnerRow>()
  if (row.owner_id) {
    const owners = await safeList<OwnerRow>('Rental Owner', {
      fields: OWNER_FIELDS,
      filters: [['Rental Owner', 'name', '=', row.owner_id as string]],
      limit_page_length: 1,
    })
    if (owners[0]) ownerMap.set(owners[0].name, owners[0])
  }

  return mapProperty(row, ownerMap, groupImages(images), countUnits(units))
}

/** The property's units (+ its active-contract chip via contract.unit_id). */
export async function getUnitsForProperty(propertyId: string): Promise<UnitView[]> {
  const now = new Date()
  const [units, contracts] = await Promise.all([
    frappeClient.getList<UnitRow>('Rental Unit', {
      fields: UNIT_FIELDS,
      filters: [['Rental Unit', 'property_id', '=', propertyId]],
      limit_page_length: 0,
    }),
    safeList<ContractRow>('Rental Contract', {
      fields: CONTRACT_FIELDS,
      filters: [['Rental Contract', 'rental_property_id', '=', propertyId]],
      limit_page_length: 0,
    }),
  ])

  // Index the property's active contracts by their linked unit (latest end wins).
  const activeByUnit = new Map<string, ContractRow>()
  for (const c of contracts) {
    const uid = (c.unit_id as string) || ''
    if (!uid) continue
    if (displayStatus(c.status as string, c.end_date as string, now) !== 'active') continue
    const prev = activeByUnit.get(uid)
    if (!prev || (toDate(c.end_date as string)?.getTime() ?? 0) > (toDate(prev.end_date as string)?.getTime() ?? 0)) {
      activeByUnit.set(uid, c)
    }
  }

  return units.map((u) => {
    const active = activeByUnit.get(u.name)
    const contractUnits: UnitContractChip[] = active
      ? [{
          contract: {
            id: active.name,
            contractNumber: (active.contract_number as string) || active.name,
            endDate: isoDate(active.end_date as string) || '',
            tenantName: (active.tenant_name as string) || null,
            rentAmount: num(active.rent_amount),
            status: displayStatus(active.status as string, active.end_date as string, now),
          },
        }]
      : []
    return {
      id: u.name,
      unitNumber: (u.unit_number as string) || '',
      status: (u.status as string) || 'vacant',
      floor: floatOrNull(u.floor),
      area: floatOrNull(u.area),
      rentPrice: floatOrNull(u.rent_price),
      electricMeter: (u.electric_meter as string) || null,
      notes: (u.notes as string) || null,
      contractUnits,
    }
  })
}

/** Every contract on a property — feeds the «عقود الإيجار» table AND the
 *  ContractLifecycleTimeline (سجل التأجير وفترات الشغور). */
export async function getPropertyContracts(propertyId: string): Promise<PropertyContractRow[]> {
  const now = new Date()
  const rows = await safeList<ContractRow>('Rental Contract', {
    fields: CONTRACT_FIELDS,
    filters: [['Rental Contract', 'rental_property_id', '=', propertyId]],
    limit_page_length: 0,
  })
  return rows
    .map((r) => mapContractRow(r, now))
    // newest first, matching egarsys's `orderBy createdAt desc` list order.
    .sort((a, b) => (b.internalId ?? 0) - (a.internalId ?? 0))
}

/** The contracts linked to a single unit (via contract.unit_id) — the unit
 *  sheet's سجل التأجير timeline. */
export async function getUnitContracts(unitId: string): Promise<PropertyContractRow[]> {
  const now = new Date()
  const rows = await safeList<ContractRow>('Rental Contract', {
    fields: CONTRACT_FIELDS,
    filters: [['Rental Contract', 'unit_id', '=', unitId]],
    limit_page_length: 0,
  })
  return rows
    .map((r) => mapContractRow(r, now))
    .sort((a, b) => (b.internalId ?? 0) - (a.internalId ?? 0))
}

/** Invoices tied to a unit (its contracts' invoices) — the unit sheet's
 *  «الفواتير المرتبطة» list. */
export async function getUnitInvoices(unitId: string): Promise<UnitInvoiceRow[]> {
  const contracts = await safeList<{ name: string }>('Rental Contract', {
    fields: ['name'],
    filters: [['Rental Contract', 'unit_id', '=', unitId]],
    limit_page_length: 0,
  })
  const ids = contracts.map((c) => c.name)
  if (ids.length === 0) return []

  const invoices = await safeList<InvoiceRow>('Rental Invoice', {
    fields: UNIT_INVOICE_FIELDS,
    filters: [['Rental Invoice', 'contract_id', 'in', ids] as unknown as FrappeFilter],
    limit_page_length: 0,
  })
  return invoices
    .map((inv) => ({
      id: inv.name,
      invoiceNumber: (inv.invoice_number as string) || '—',
      dueDate: isoDate(inv.due_date as string) || '',
      totalValue: num(inv.total_value),
      status: (inv.status as string) || 'unpaid',
    }))
    .sort((a, b) => (Date.parse(a.dueDate) || 0) - (Date.parse(b.dueDate) || 0))
}
