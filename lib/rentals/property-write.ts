// Write layer for the ported egarsys PROPERTIES section — the mirror-backed
// counterpart of the READ adapter in lib/rentals/properties-data.ts.
//
// egarsys's property writes went through Next API routes that ALSO ran business
// logic on the server (per-company internalId minting, inline owner creation from
// a typed name, title := titleAr, numeric coercion/defaults, owner-company scope
// checks). The Frappe mirror doctypes `Rental Property` / `Rental Owner` have NONE
// of that server logic, so every derivation egarsys did server-side is reproduced
// HERE and the finished snake_case payload is written straight to /api/resource
// via `frappeClient`.
//
// Field mapping camelCase(form) → snake_case(mirror) follows
// /root/meena-rentals-migration/out/schema-spec.json (models Property + Owner).
// Scope: ONLY `Rental Property` and `Rental Owner` are written here. Units, images
// (Rental Property Image), contracts, invoices and ZATCA stay OUT of scope — the
// property form's image/unit-generation/map affordances remain stubbed «قريباً».

import { frappeClient, frappeApiUrl } from '@/lib/api-client'
import type { FrappeFilter } from '@/lib/api-client'
import { csrfFetch } from '@/lib/csrf'

const DOCTYPE = 'Rental Property'
const OWNER_DOCTYPE = 'Rental Owner'
const IMAGE_DOCTYPE = 'Rental Property Image'
const UNIT_DOCTYPE = 'Rental Unit'

// ── date / value helpers (identical to lib/rentals/contract-write.ts) ─────────

/** Empty string / undefined → null (egarsys stored NULL, not ''; Link fields need it). */
const orNull = (v: unknown): string | null => {
  if (v === undefined || v === null) return null
  const s = String(v)
  return s.trim() === '' ? null : s
}

/** Form "YYYY-MM-DD" → the mirror's naive datetime "YYYY-MM-DD 00:00:00" (midnight —
 *  matches egarsys's midnight-UTC deed dates and the migrated rows). */
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

/** parseFloat-with-fallback (egarsys used parseFloat for area/rent/lat/long). */
const numOr = (v: unknown, fallback: number): number => {
  if (v === '' || v === undefined || v === null) return fallback
  const n = parseFloat(String(v))
  return Number.isFinite(n) ? n : fallback
}

/** parseInt-with-fallback (egarsys used parseInt for bedrooms/bathrooms/floor/year). */
const intOr = (v: unknown, fallback: number): number => {
  if (v === '' || v === undefined || v === null) return fallback
  const n = parseInt(String(v), 10)
  return Number.isFinite(n) ? n : fallback
}

/** A Float that egarsys stored as NULL when the form left it blank (lat/long). The
 *  mirror can't hold a NULL Float, but 0 must not read as a real coordinate, so we
 *  only send a number when the form actually provides one. */
const floatOrNull = (v: unknown): number | null => {
  if (v === '' || v === undefined || v === null) return null
  const n = parseFloat(String(v))
  return Number.isFinite(n) ? n : null
}

// New docs (autoname=prompt) need an explicit name; egarsys used cuids, native docs
// use an rp<base36> / ro<base36> id (same idea as lib/rentals/config.ts newDocName()).
export const mintPropertyName = (): string =>
  'rp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
export const mintOwnerName = (): string =>
  'ro' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)

// ── per-company internal_id sequence (mirrors egarsys) ────────────────────────

export interface PropertySeqContext {
  /** company_id to stamp on new docs (the tenant site's own company). */
  companyId: string | null
  /** max(existing internal_id for that company) + 1. */
  nextInternalId: number
}

/** ONE query: derive the site's company_id (the one most properties carry) and the
 *  next الرقم الداخلي in that company's sequence — egarsys's per-company counter
 *  (`max(internalId where companyId) + 1`). Falls back to a Rental Owner's company
 *  when the site has no properties yet. */
export async function getPropertySeqContext(): Promise<PropertySeqContext> {
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

  if (!companyId) {
    try {
      const owners = await frappeClient.getList<{ company_id?: string | null }>(OWNER_DOCTYPE, {
        fields: ['company_id'], limit_page_length: 1,
      })
      companyId = owners[0]?.company_id || null
    } catch { /* leave null */ }
  }

  let maxId = 0
  for (const r of rows) {
    if ((r.company_id || null) === companyId) maxId = Math.max(maxId, Number(r.internal_id) || 0)
  }
  return { companyId, nextInternalId: maxId + 1 }
}

// ── owner picker + inline create (the owner equivalent of contracts' property picker) ──

export interface LinkableOwner {
  id: string
  name: string
  phone: string | null
  nationalId: string | null
  email: string | null
  address: string | null
  vatNumber: string | null
}

/** Existing Rental Owner docs for the property form's owner picker. */
export async function listLinkableOwners(): Promise<LinkableOwner[]> {
  const rows = await frappeClient.getList<{
    name: string; name_val?: string | null; phone?: string | null; national_id?: string | null
    email?: string | null; address?: string | null; vat_number?: string | null
  }>(OWNER_DOCTYPE, {
    fields: ['name', 'name_val', 'phone', 'national_id', 'email', 'address', 'vat_number'],
    order_by: 'name_val asc',
    limit_page_length: 0,
  })
  return rows.map((r) => ({
    id: r.name,
    name: r.name_val || r.name,
    phone: r.phone ?? null,
    nationalId: r.national_id ?? null,
    email: r.email ?? null,
    address: r.address ?? null,
    vatNumber: r.vat_number ?? null,
  }))
}

/** The owner-create fields (the inline «إضافة مالك جديد» block). */
export interface OwnerFormInput {
  name?: string
  nationalId?: string
  phone?: string
  email?: string
  address?: string
  vatNumber?: string
}

type MirrorPayload = Record<string, string | number | null>

/** CREATE a new Rental Owner (egarsys auto-created one from a typed name inside the
 *  property route). Returns the minted doc name — used straight as owner_id. */
export async function createOwnerDoc(form: OwnerFormInput, companyId: string | null): Promise<string> {
  const name = mintOwnerName()
  const stamp = nowStamp()
  const payload: MirrorPayload = {
    name,
    name_val: (form.name || '').trim(),
    national_id: orNull(form.nationalId),
    phone: (form.phone || '').trim(),   // egarsys default '' (mirror phone is optional)
    email: orNull(form.email),
    address: orNull(form.address),
    vat_number: orNull(form.vatNumber),
    company_id: companyId,
    user_id: null,
    created_at: stamp,
    updated_at: stamp,
  }
  await frappeClient.post(OWNER_DOCTYPE, payload)
  return name
}

// ── property payload builder (camelCase form → snake mirror) ──────────────────

/** The property-form fields this writer consumes. `titleAr` is the single title the
 *  form captures — egarsys writes it to BOTH title and title_ar. Owner is either a
 *  picked existing `ownerId` OR the inline-create owner* fields. */
export interface PropertyFormInput {
  titleAr?: string
  propertyType?: string
  status?: string
  description?: string
  address?: string
  city?: string
  district?: string
  latitude?: number | string | null
  longitude?: number | string | null
  googleMapsUrl?: string
  area?: number | string
  bedrooms?: number | string
  bathrooms?: number | string
  floor?: number | string
  yearBuilt?: number | string
  rentPrice?: number | string
  deedNumber?: string
  deedDate?: string
  shopNumber?: string
  // owner: an existing doc name, or the inline-create fields.
  ownerId?: string
  ownerName?: string
  ownerNationalId?: string
  ownerPhone?: string
  ownerEmail?: string
  ownerAddress?: string
  ownerVatNumber?: string
}

/** Resolve the owner Link for a property write: a picked existing owner wins; else an
 *  inline-typed name auto-creates a Rental Owner (egarsys's server behaviour). Returns
 *  null only when neither is provided (caller validates «اسم المالك مطلوب»). */
async function resolveOwnerId(form: PropertyFormInput, companyId: string | null): Promise<string | null> {
  if (form.ownerId && form.ownerId.trim() !== '') return form.ownerId
  if (form.ownerName && form.ownerName.trim() !== '') {
    return await createOwnerDoc({
      name: form.ownerName,
      nationalId: form.ownerNationalId,
      phone: form.ownerPhone,
      email: form.ownerEmail,
      address: form.ownerAddress,
      vatNumber: form.ownerVatNumber,
    }, companyId)
  }
  return null
}

/** CREATE a new Rental Property from the form (owner resolved/created first).
 *  Returns the minted doc name. Mirrors egarsys POST /api/properties exactly:
 *  internal_id = per-company max+1, title := titleAr, numeric defaults 0/null,
 *  units/images NOT generated (out of scope). */
export async function createPropertyDoc(form: PropertyFormInput, ctx: PropertySeqContext): Promise<string> {
  const ownerId = await resolveOwnerId(form, ctx.companyId)
  if (!ownerId) throw new Error('المالك مطلوب')

  const name = mintPropertyName()
  const stamp = nowStamp()
  const title = (form.titleAr || '').trim()

  const payload: MirrorPayload = {
    name,
    internal_id: ctx.nextInternalId,
    owner_id: ownerId,
    company_id: ctx.companyId,
    deed_number: orNull(form.deedNumber),
    deed_date: toMirrorDate(form.deedDate),
    shop_number: orNull(form.shopNumber),
    title,
    title_ar: orNull(form.titleAr),
    property_type: orNull(form.propertyType) || 'apartment',
    status: orNull(form.status) || 'available',
    description: orNull(form.description),
    address: form.address || '',
    city: form.city || '',
    district: orNull(form.district),
    latitude: floatOrNull(form.latitude),
    longitude: floatOrNull(form.longitude),
    google_maps_url: orNull(form.googleMapsUrl),
    area: numOr(form.area, 0),
    bedrooms: intOr(form.bedrooms, 0),
    bathrooms: intOr(form.bathrooms, 0),
    floor: form.floor === '' || form.floor === undefined || form.floor === null ? null : intOr(form.floor, 0),
    year_built: form.yearBuilt === '' || form.yearBuilt === undefined || form.yearBuilt === null ? null : intOr(form.yearBuilt, 0),
    rent_price: numOr(form.rentPrice, 0),
    total_units: 0,
    created_at: stamp,
    updated_at: stamp,
  }
  await frappeClient.post(DOCTYPE, payload)
  return name
}

/** EDIT an existing property. internal_id is fixed (assigned once at creation) and is
 *  NOT sent. total_units is owned by the units flow and is left untouched. Owner can be
 *  re-picked (existing) or inline-created; when neither is provided the existing owner
 *  link is preserved (owner_id omitted). Mirrors egarsys PUT /api/properties/[id]. */
export async function updatePropertyDoc(name: string, form: PropertyFormInput, companyId: string | null): Promise<void> {
  const ownerId = await resolveOwnerId(form, companyId)

  const payload: MirrorPayload = {
    title: (form.titleAr || '').trim(),
    title_ar: orNull(form.titleAr),
    property_type: orNull(form.propertyType) || 'apartment',
    status: orNull(form.status) || 'available',
    description: orNull(form.description),
    address: form.address || '',
    city: form.city || '',
    district: orNull(form.district),
    latitude: floatOrNull(form.latitude),
    longitude: floatOrNull(form.longitude),
    google_maps_url: orNull(form.googleMapsUrl),
    area: numOr(form.area, 0),
    bedrooms: intOr(form.bedrooms, 0),
    bathrooms: intOr(form.bathrooms, 0),
    deed_number: orNull(form.deedNumber),
    deed_date: toMirrorDate(form.deedDate),
    shop_number: orNull(form.shopNumber),
    updated_at: nowStamp(),
  }
  if (ownerId) payload.owner_id = ownerId

  await frappeClient.put(DOCTYPE, name, payload)
}

/** DELETE the property doc. Frappe raises LinkExistsError when units/contracts still
 *  reference it — that message is thrown by frappeClient.delete and surfaced by the
 *  caller's toast (no crash, no cascade). */
export async function deletePropertyDoc(name: string): Promise<void> {
  await frappeClient.delete(DOCTYPE, name)
}

// ── image upload + gallery (Rental Property Image) ────────────────────────────
//
// egarsys uploaded to POST /api/upload (returns { urls }) then POSTed the URLs to
// /api/properties/[id]/images which created PropertyImage rows. The Frappe mirror
// equivalent is: upload each file via POST /api/method/upload_file (multipart →
// { message: { file_url } }) then create a `Rental Property Image` doc holding that
// file_url. Cover logic mirrors egarsys's images route exactly.

export const mintImageName = (): string =>
  'ri' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
export const mintUnitName = (): string =>
  'ru' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)

/** Upload ONE file to Frappe → its permanent file_url. Uses csrfFetch (the app's
 *  established upload path — it attaches the CSRF token & session cookie), public
 *  (is_private=0) so the gallery `<img>` renders same-origin without extra auth. */
export async function uploadFileToFrappe(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file, file.name)
  fd.append('is_private', '0')
  fd.append('folder', 'Home/Attachments')
  const res = await csrfFetch(frappeApiUrl('/api/method/upload_file'), {
    method: 'POST',
    credentials: 'include',
    body: fd,
  })
  if (!res.ok) {
    if (res.status === 413) throw new Error('حجم الملف كبير جداً')
    if (res.status === 403) throw new Error('غير مصرح برفع الصور')
    throw new Error(`فشل رفع الصورة (${res.status})`)
  }
  const data = await res.json().catch(() => ({} as Record<string, unknown>))
  const url = (data as { message?: { file_url?: string }; file_url?: string })?.message?.file_url
    || (data as { file_url?: string })?.file_url
  if (!url) throw new Error('لم يُعد رابط الملف بعد الرفع')
  return url
}

type ImgRow = { name: string; is_cover?: number | boolean | null; image?: string | null }

/** Existing image docs for a property, oldest-first (uploaded_at asc) — the order
 *  egarsys uses when promoting a new cover after a delete. */
async function listImageDocs(propertyId: string): Promise<ImgRow[]> {
  return frappeClient.getList<ImgRow>(IMAGE_DOCTYPE, {
    fields: ['name', 'image', 'is_cover'],
    filters: [[IMAGE_DOCTYPE, 'property_id', '=', propertyId] as unknown as FrappeFilter],
    order_by: 'uploaded_at asc',
    limit_page_length: 0,
  })
}

/** Upload N files and create their `Rental Property Image` docs. Mirrors egarsys's
 *  images POST cover rule: the first uploaded image becomes the cover ONLY when the
 *  property has no images yet; adding to an existing gallery never changes the cover.
 *  Returns the created doc count. */
export async function addPropertyImages(propertyId: string, files: File[]): Promise<number> {
  if (!files.length) return 0
  const existing = await listImageDocs(propertyId)
  const hasExisting = existing.length > 0
  let created = 0
  for (let i = 0; i < files.length; i++) {
    const url = await uploadFileToFrappe(files[i])
    await frappeClient.post(IMAGE_DOCTYPE, {
      name: mintImageName(),
      property_id: propertyId,
      image: url,
      is_cover: (!hasExisting && i === 0) ? 1 : 0,
      uploaded_at: nowStamp(),
    })
    created++
  }
  return created
}

/** Set one image as the cover — unsets every other cover first (egarsys PATCH). */
export async function setPropertyImageCover(propertyId: string, imageId: string): Promise<void> {
  const existing = await listImageDocs(propertyId)
  for (const im of existing) {
    if (im.name !== imageId && (im.is_cover === 1 || im.is_cover === true)) {
      await frappeClient.put(IMAGE_DOCTYPE, im.name, { is_cover: 0 })
    }
  }
  await frappeClient.put(IMAGE_DOCTYPE, imageId, { is_cover: 1 })
}

/** Delete an image doc; if it was the cover, promote the oldest remaining image
 *  (egarsys DELETE behaviour). */
export async function deletePropertyImage(propertyId: string, imageId: string): Promise<void> {
  const existing = await listImageDocs(propertyId)
  const target = existing.find((im) => im.name === imageId)
  await frappeClient.delete(IMAGE_DOCTYPE, imageId)
  const wasCover = !!target && (target.is_cover === 1 || target.is_cover === true)
  if (wasCover) {
    const next = existing.find((im) => im.name !== imageId)
    if (next) await frappeClient.put(IMAGE_DOCTYPE, next.name, { is_cover: 1 })
  }
}

// ── unit generation (عمارة / دور → N × Rental Unit) ───────────────────────────
//
// Ports egarsys src/lib/unit-utils.ts (generateUnits + generateUnitsFromFloors).
// A per-floor breakdown wins; else a flat total count. Units carry status='vacant'
// (egarsys's value; the read adapter defaults to it too). After creating them the
// property's total_units is set to the number generated.

export interface UnitGenInput {
  companyId: string | null
  propertyId: string
  /** flat total (وحدة ١ … وحدة N) — used only when floorUnits is empty. */
  unitCount?: number
  /** the global unit type for flat generation / floors without an explicit type. */
  unitType?: string
  /** per-floor breakdown; entries with count === 0 are ignored. Wins over unitCount. */
  floorUnits?: Array<{ floor: number; count: number; unitType?: string }>
  /** ground floor (floor 1) generated as محل when true and no per-floor type set. */
  groundFloorShops?: boolean
  /** optional area / rent stamped on every generated unit (egarsys unitArea/unitRentPrice). */
  area?: number | null
  rentPrice?: number | null
}

/** Create the generated `Rental Unit` docs + set total_units. Returns count created. */
export async function generatePropertyUnits(input: UnitGenInput): Promise<number> {
  const { companyId, propertyId } = input
  const stamp = nowStamp()
  const area = input.area ?? null
  const rentPrice = input.rentPrice ?? null
  type UnitPayload = Record<string, string | number | null>
  const docs: UnitPayload[] = []

  const floors = (input.floorUnits || []).filter((f) => f.count > 0)
  if (floors.length > 0) {
    const isSingleFloor = floors.length === 1
    for (const { floor, count, unitType: rowType } of floors) {
      const floorUnitType = rowType || (input.groundFloorShops && floor === 1 ? 'محل' : (input.unitType || null))
      for (let i = 0; i < count; i++) {
        const unitNumber = isSingleFloor ? String(i + 1) : String(floor * 100 + i + 1)
        docs.push({
          name: mintUnitName(), company_id: companyId, property_id: propertyId,
          unit_number: unitNumber, unit_type: floorUnitType || null, floor,
          area, rent_price: rentPrice, status: 'vacant', created_at: stamp, updated_at: stamp,
        })
      }
    }
  } else {
    const count = Number(input.unitCount) || 0
    if (count > 0 && count <= 500) {
      for (let i = 0; i < count; i++) {
        docs.push({
          name: mintUnitName(), company_id: companyId, property_id: propertyId,
          unit_number: String(1 + i), unit_type: input.unitType || null, floor: null,
          area, rent_price: rentPrice, status: 'vacant', created_at: stamp, updated_at: stamp,
        })
      }
    }
  }

  if (docs.length === 0) return 0
  for (const d of docs) await frappeClient.post(UNIT_DOCTYPE, d)
  await frappeClient.put(DOCTYPE, propertyId, { total_units: docs.length, updated_at: nowStamp() })
  return docs.length
}
