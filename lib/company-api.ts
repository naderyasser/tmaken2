/**
 * Company API — setup wizard helpers
 * Routes through frappeApiUrl (dev proxy / prod direct — see api-client.ts).
 */

import { csrfFetch } from './csrf'
import { frappeApiUrl } from './api-client'

// ─── request helper (same pattern as api-client.ts) ─────────────────────────
const proxy = async (path: string, init: RequestInit = {}): Promise<Response> =>
    csrfFetch(frappeApiUrl(path), {
        ...init,
        credentials: 'include',
    })

// ─── types ───────────────────────────────────────────────────────────────────
export interface CompanyData {
    company_name: string
    abbr: string
    country: string
    default_currency: string
    chart_of_accounts?: string
    domain?: string
}

// ─── API functions ───────────────────────────────────────────────────────────

/** Returns true when at least one Company doc exists in ERPNext */
export async function checkCompanyExists(): Promise<boolean> {
    try {
        const res = await proxy(
            '/api/resource/Company?fields=["name"]&limit_page_length=1',
        )
        if (!res.ok) return false
        const json = await res.json()
        return Array.isArray(json.data) && json.data.length > 0
    } catch {
        return false          // network error → assume no company (will retry)
    }
}

// ─── Warehouse‑type bootstrap ────────────────────────────────────────────────
// ERPNext's Company.on_update → create_default_warehouses() expects Warehouse
// Type records.  On a fresh site they may not exist, causing a LinkValidation
// error.  We ensure they exist before creating a Company.

const REQUIRED_WAREHOUSE_TYPES = [
    'Transit',
    'Store',
    'Finished Goods',
    'Work In Progress',
    'Material Transfer',
    'Scrap',
]

/**
 * Ensures all required Warehouse Type docs exist.
 * Silently ignores duplicates (409) and any other errors — best effort.
 */
async function ensureWarehouseTypes(): Promise<void> {
    // Fetch existing types first
    const existing = new Set<string>()
    try {
        const listRes = await proxy(
            '/api/resource/Warehouse%20Type?fields=["name"]&limit_page_length=100',
        )
        if (listRes.ok) {
            const json = await listRes.json()
            for (const d of json.data ?? []) existing.add(d.name)
        }
    } catch {
        // ignore — we'll just try creating all of them
    }

    const missing = REQUIRED_WAREHOUSE_TYPES.filter(t => !existing.has(t))
    await Promise.allSettled(
        missing.map(name =>
            proxy('/api/resource/Warehouse%20Type', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            }),
        ),
    )
}

/** Create a Company doc. Returns the new company name. */
export async function createCompany(data: CompanyData): Promise<string> {
    // Pre‑step: make sure ERPNext has the Warehouse Types it needs
    await ensureWarehouseTypes()

    const res = await proxy('/api/resource/Company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            company_name: data.company_name,
            abbr: data.abbr,
            country: data.country,
            default_currency: data.default_currency,
            chart_of_accounts: data.chart_of_accounts || 'Standard',
            domain: data.domain || 'Distribution',
        }),
    })

    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const msg =
            err?.exc || err?.message || err?._server_messages || 'Failed to create company'
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    }

    const json = await res.json()
    const companyName = json.data?.name ?? json.data?.company_name ?? data.company_name

    // Post‑step: set Global Defaults & create a Fiscal Year (best effort)
    await setupGlobalDefaults(companyName, data.default_currency, data.country)
    await ensureFiscalYear(companyName)

    return companyName
}

// ─── Post‑creation helpers ───────────────────────────────────────────────────

/** Set the newly‑created company as the system default. */
async function setupGlobalDefaults(
    company: string,
    currency: string,
    country: string,
): Promise<void> {
    try {
        await proxy('/api/resource/Global%20Defaults/Global%20Defaults', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                default_company: company,
                default_currency: currency,
                country,
            }),
        })
    } catch {
        // non‑critical
    }
}

/** Creates a Fiscal Year that covers the current calendar year. */
async function ensureFiscalYear(company: string): Promise<void> {
    try {
        const year = new Date().getFullYear()
        await proxy('/api/resource/Fiscal%20Year', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                year: `${year}-${year + 1}`,
                year_start_date: `${year}-01-01`,
                year_end_date: `${year}-12-31`,
                companies: [{ company }],
            }),
        })
    } catch {
        // ignore — may already exist or non‑critical
    }
}

// ─── Country → Currency map (common countries) ──────────────────────────────
export const COUNTRY_CURRENCY: Record<string, string> = {
    'Saudi Arabia': 'SAR',
    'United Arab Emirates': 'AED',
    'Kuwait': 'KWD',
    'Qatar': 'QAR',
    'Bahrain': 'BHD',
    'Oman': 'OMR',
    'Egypt': 'EGP',
    'Jordan': 'JOD',
    'Lebanon': 'LBP',
    'Iraq': 'IQD',
    'Syria': 'SYP',
    'Yemen': 'YER',
    'Morocco': 'MAD',
    'Tunisia': 'TND',
    'Algeria': 'DZD',
    'Libya': 'LYD',
    'Sudan': 'SDG',
    'Palestine': 'ILS',
    'India': 'INR',
    'Pakistan': 'PKR',
    'Turkey': 'TRY',
    'United States': 'USD',
    'United Kingdom': 'GBP',
    'Germany': 'EUR',
    'France': 'EUR',
    'Canada': 'CAD',
    'Australia': 'AUD',
    'China': 'CNY',
    'Japan': 'JPY',
    'South Korea': 'KRW',
    'Malaysia': 'MYR',
    'Indonesia': 'IDR',
    'Philippines': 'PHP',
    'Brazil': 'BRL',
    'South Africa': 'ZAR',
    'Nigeria': 'NGN',
    'Bangladesh': 'BDT',
}

/** Sorted country names */
export const COUNTRIES = Object.keys(COUNTRY_CURRENCY).sort((a, b) =>
    a.localeCompare(b),
)

/** Arabic labels for countries */
export const COUNTRY_AR: Record<string, string> = {
    'Saudi Arabia': 'المملكة العربية السعودية',
    'United Arab Emirates': 'الإمارات العربية المتحدة',
    'Kuwait': 'الكويت',
    'Qatar': 'قطر',
    'Bahrain': 'البحرين',
    'Oman': 'عُمان',
    'Egypt': 'مصر',
    'Jordan': 'الأردن',
    'Lebanon': 'لبنان',
    'Iraq': 'العراق',
    'Syria': 'سوريا',
    'Yemen': 'اليمن',
    'Morocco': 'المغرب',
    'Tunisia': 'تونس',
    'Algeria': 'الجزائر',
    'Libya': 'ليبيا',
    'Sudan': 'السودان',
    'Palestine': 'فلسطين',
    'India': 'الهند',
    'Pakistan': 'باكستان',
    'Turkey': 'تركيا',
    'United States': 'الولايات المتحدة',
    'United Kingdom': 'المملكة المتحدة',
    'Germany': 'ألمانيا',
    'France': 'فرنسا',
    'Canada': 'كندا',
    'Australia': 'أستراليا',
    'China': 'الصين',
    'Japan': 'اليابان',
    'South Korea': 'كوريا الجنوبية',
    'Malaysia': 'ماليزيا',
    'Indonesia': 'إندونيسيا',
    'Philippines': 'الفلبين',
    'Brazil': 'البرازيل',
    'South Africa': 'جنوب أفريقيا',
    'Nigeria': 'نيجيريا',
    'Bangladesh': 'بنغلاديش',
}
