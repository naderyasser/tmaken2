// Write layer for the ported egarsys TENANTS (المستأجرون) section — the mirror-
// backed counterpart of the READ adapter in lib/rentals/tenants-data.ts.
//
// egarsys's tenant writes went through Next API routes (POST/PUT/DELETE
// /api/tenant-profiles) that did NOTHING but a null-coalesce + a صفة الطرف
// validation before handing the row to Prisma. The Frappe mirror doctype
// `Rental Tenant` has no such server route, so the same null-coalescing and the
// same party-type gating are reproduced HERE and the finished snake_case payload
// is written straight to /api/resource via `frappeClient`.
//
// Field mapping camelCase(form) → snake_case(mirror) follows
// /root/meena-rentals-migration/out/schema-spec.json (model TenantProfile):
//   name→name_val · nationalId→national_id · phone · email · address ·
//   emergencyContact→emergency_contact · partyType→party_type ·
//   companyName→company_name · crNumber→cr_number · vatNumber→vat_number.
//
// FIDELITY NOTE — egarsys's tenant FORM (and its POST/PUT routes) only ever touch
// those 10 columns. The other TenantProfile identity columns (cr_date,
// unified_number, org_type, representative_*) are NEVER written by egarsys's
// tenant form — they are populated only by the CONTRACT snapshot. So this writer
// deliberately leaves them untouched: on create they default empty, and on edit
// a Frappe partial-PUT preserves any migrated value (zero-data-loss — a صفة الطرف
// change never silently drops a migrated unified_number / representative on
// sites that DO carry tenant rows). NOTHING here touches ZATCA / invoices.

import { frappeClient } from '@/lib/api-client'

const DOCTYPE = 'Rental Tenant'

// Valid صفة الطرف values (kept local so this lib file stays self-contained, same
// as contract-write.ts hardcoding the party-type strings). Mirrors
// TENANT_PARTY_TYPE_VALUES in components/rentals/egarsys/types.ts.
const PARTY_TYPES = new Set(['individual', 'establishment', 'company', 'government'])

// ── helpers (same semantics as contract-write.ts) ─────────────────────────

/** Empty string / undefined → null (egarsys stored NULL, not ''; the mirror rows do too). */
const orNull = (v: unknown): string | null => {
  if (v === undefined || v === null) return null
  const s = String(v)
  return s.trim() === '' ? null : s.trim()
}

/** UTC "now" as a naive mirror timestamp "YYYY-MM-DD HH:MM:SS" (created_at/updated_at). */
export function nowStamp(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

// New docs (autoname=prompt) need an explicit name; egarsys used cuids, native
// docs use an rt<base36> id — same idea as contract-write.ts's mintContractName().
export const mintTenantName = (): string =>
  'rt' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)

// ── company context (mirrors contract-write's getContractSeqContext) ──────

export interface TenantCompanyContext {
  /** company_id to stamp on new docs (the tenant site's own company). */
  companyId: string | null
}

/** Derive the site's company_id: the one most existing Rental Tenant rows carry,
 *  falling back to a Rental Contract's company_id when the mirror holds 0 tenant
 *  rows (tamkeen's case) — the exact fallback the task calls for. */
export async function getTenantCompanyContext(): Promise<TenantCompanyContext> {
  const rows = await frappeClient.getList<{ company_id?: string | null }>(DOCTYPE, {
    fields: ['company_id'],
    limit_page_length: 0,
  })
  const counts = new Map<string, number>()
  for (const r of rows) {
    const c = r.company_id || ''
    if (c) counts.set(c, (counts.get(c) || 0) + 1)
  }
  let companyId: string | null = null
  let best = -1
  for (const [c, n] of counts) if (n > best) { best = n; companyId = c }

  // Fall back to a Rental Contract's company_id when the site has no tenants yet.
  if (!companyId) {
    try {
      const contracts = await frappeClient.getList<{ company_id?: string | null }>('Rental Contract', {
        fields: ['company_id'],
        limit_page_length: 1,
      })
      companyId = contracts[0]?.company_id || null
    } catch { /* leave null */ }
  }
  return { companyId }
}

// ── payload builder (camelCase form → snake mirror) ───────────────────────

/** The tenant-form fields this writer consumes (egarsys's TenantForm shape). */
export interface TenantFormInput {
  name: string
  partyType?: string
  nationalId?: string
  companyName?: string
  crNumber?: string
  vatNumber?: string
  phone: string
  email?: string
  address?: string
  emergencyContact?: string
}

type MirrorPayload = Record<string, string | number | null>

/** صفة الطرف gating (identical rule to egarsys's tenant form handleSubmit): the
 *  identity fields hidden by the selected party type are BLANKED (sent as null,
 *  not omitted) so a re-classified tenant can't keep stale CR/VAT/ID values.
 *   • individual  → national_id kept; company_name/cr_number/vat_number blanked
 *   • establishment/company → company_name/cr_number/vat_number kept; national_id blanked
 *   • government  → company_name kept (اسم الجهة); cr_number/vat_number/national_id blanked */
function tenantIdentity(form: TenantFormInput): MirrorPayload {
  const t = form.partyType || ''
  const isOrg = t === 'establishment' || t === 'company'
  return {
    party_type: PARTY_TYPES.has(t) ? t : null,
    national_id: orNull(t === 'individual' ? form.nationalId : ''),
    company_name: orNull(isOrg || t === 'government' ? form.companyName : ''),
    cr_number: orNull(isOrg ? form.crNumber : ''),
    vat_number: orNull(isOrg ? form.vatNumber : ''),
  }
}

/** Contact columns shared by create & edit. */
function contactFields(form: TenantFormInput): MirrorPayload {
  return {
    phone: orNull(form.phone) || '',
    email: orNull(form.email),
    address: orNull(form.address),
    emergency_contact: orNull(form.emergencyContact),
  }
}

// ── public write API ──────────────────────────────────────────────────────

/** CREATE a new Rental Tenant from the form. Returns the minted doc name. */
export async function createTenantDoc(form: TenantFormInput, ctx: TenantCompanyContext): Promise<string> {
  const name = mintTenantName()
  const stamp = nowStamp()
  const payload: MirrorPayload = {
    name,
    company_id: ctx.companyId,
    name_val: orNull(form.name) || '',
    ...tenantIdentity(form),
    ...contactFields(form),
    created_at: stamp,
    updated_at: stamp,
  }
  await frappeClient.post(DOCTYPE, payload)
  return name
}

/** EDIT an existing tenant. Partial-PUT: only the form's own columns are sent,
 *  so migrated-only fields (cr_date/unified_number/org_type/representative_*) are
 *  preserved (see the fidelity note above). */
export async function updateTenantDoc(name: string, form: TenantFormInput): Promise<void> {
  const payload: MirrorPayload = {
    name_val: orNull(form.name) || '',
    ...tenantIdentity(form),
    ...contactFields(form),
    updated_at: nowStamp(),
  }
  await frappeClient.put(DOCTYPE, name, payload)
}

/** DELETE the tenant doc. Frappe FK/link-guard errors surface as the thrown
 *  message (the client already parses _server_messages) for the caller's toast. */
export async function deleteTenantDoc(name: string): Promise<void> {
  await frappeClient.delete(DOCTYPE, name)
}
