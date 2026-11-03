'use client'

import { useEffect, useState } from 'react'

/**
 * Host-resolved tenant branding for client components, from /sales-brand
 * (clients.json + site_config, uncached server-side). Used by the inventory
 * shell for the tab title and by printed documents for their letterhead.
 */
export interface TenantInvoiceConfig {
    /** "parts" → print the client's «فاتورة قطع غيار» sheet instead of the
     *  default branded goods-receipt document. */
    format?: 'parts'
    soldToParty?: string
    shipToParty?: string
    vatPercent?: number
}

export interface TenantBrand {
    appName: string | null
    /** Business-activity line shown under the name on printed letterheads. */
    tagline: string | null
    logo: string | null
    primaryColor: string | null
    /** Per-tenant printed-invoice settings from clients.json (null when unset). */
    invoice: TenantInvoiceConfig | null
}

const EMPTY: TenantBrand = { appName: null, tagline: null, logo: null, primaryColor: null, invoice: null }
let cache: TenantBrand | null = null
let inflight: Promise<TenantBrand> | null = null

/**
 * Fetch the tenant brand once per page load. Resolves immediately from cache on
 * every call after the first. Exported so non-React code — the print engines in
 * particular — can brand a document without needing a hook.
 */
export function loadBrand(): Promise<TenantBrand> {
    if (cache) return Promise.resolve(cache)
    if (!inflight) {
        inflight = fetch('/sales-brand')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                cache = d
                    ? { appName: d.appName || null, tagline: d.tagline || null, logo: d.logo || null, primaryColor: d.primaryColor || null, invoice: d.invoice || null }
                    : EMPTY
                return cache
            })
            .catch(() => (cache = EMPTY))
    }
    return inflight
}

/** The cached brand, or null if nothing has fetched it yet on this page. */
export function getBrandSync(): TenantBrand | null {
    return cache
}

/**
 * Logo suitable for stamping on a printed document. Only a logo the operator
 * actually uploaded (served from /branding/) counts: add_client_config seeds
 * every tenant with the platform's own /logo.png, and printing THAT on a client's
 * invoice would brand their paperwork as the vendor's.
 */
export function printableLogo(brand: TenantBrand | null): string | null {
    const logo = brand?.logo || ''
    return logo.startsWith('/branding/') ? logo : null
}

export function useBrand(): TenantBrand {
    const [brand, setBrand] = useState<TenantBrand>(cache || EMPTY)
    useEffect(() => {
        if (cache) return
        let alive = true
        loadBrand().then((b) => { if (alive) setBrand(b) })
        return () => { alive = false }
    }, [])
    return brand
}
