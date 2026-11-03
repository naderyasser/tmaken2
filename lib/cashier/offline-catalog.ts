/**
 * Cashier offline read caches — catalog, customers, local invoice history.
 *
 * Strategy: ONLINE-FIRST everywhere. Successful server reads write through to
 * IndexedDB; when a read fails at the network level the UI falls back to these caches
 * transparently (browse, search, BARCODE scan, customer pick, history) so the till
 * keeps selling. Caches are never authoritative — the next successful fetch refreshes
 * them.
 */

import type { CatalogItem, POSInvoice } from "@/lib/cashier-api"
import { idbBulkPut, idbGet, idbGetAll, idbPut, STORES } from "@/lib/cashier/pos-db"

// ── catalog ──────────────────────────────────────────────────────────────────

export async function cacheCatalogItems(items: CatalogItem[]): Promise<void> {
  if (!items?.length) return
  await idbBulkPut(STORES.catalog, items.map(it => ({ ...it, _cachedAt: Date.now() })))
}

const norm = (s: string) => (s || "").toLowerCase().trim()

/** Offline catalog search mirroring the server's get_items contract:
 *  exact barcode match → single item + barcode_match (auto-add at the till);
 *  otherwise name/code substring; empty term → the whole cache (browse). */
export async function searchCatalogCache(
  term: string,
  limit = 200,
): Promise<{ items: CatalogItem[]; barcode_match: boolean }> {
  const all = await idbGetAll<CatalogItem & { barcodes?: string[] }>(STORES.catalog)
  const t = norm(term)
  if (t) {
    const byBarcode = all.filter(it => (it.barcodes || []).some(b => norm(b) === t))
    if (byBarcode.length === 1) return { items: byBarcode, barcode_match: true }
    const matches = all.filter(it =>
      norm(it.item_name).includes(t) || norm(it.item_code).includes(t))
    matches.sort((a, b) => (a.item_name || "").localeCompare(b.item_name || "", "ar"))
    return { items: matches.slice(0, limit), barcode_match: false }
  }
  all.sort((a, b) => (a.item_name || "").localeCompare(b.item_name || "", "ar"))
  return { items: all.slice(0, limit), barcode_match: false }
}

// ── customers ────────────────────────────────────────────────────────────────

export interface CachedCustomer {
  name: string
  customer_name: string
  mobile_no?: string | null
}

export async function cacheCustomers(rows: CachedCustomer[]): Promise<void> {
  if (!rows?.length) return
  await idbBulkPut(STORES.customers, rows.map(r => ({ ...r, _cachedAt: Date.now() })))
}

export async function searchCustomersCache(term: string, limit = 20): Promise<CachedCustomer[]> {
  const all = await idbGetAll<CachedCustomer>(STORES.customers)
  const t = norm(term)
  const matches = t
    ? all.filter(c =>
        norm(c.customer_name).includes(t) || norm(c.name).includes(t) || norm(c.mobile_no || "").includes(t))
    : all
  matches.sort((a, b) => (a.customer_name || "").localeCompare(b.customer_name || "", "ar"))
  return matches.slice(0, limit)
}

// ── local invoice history (queued + reconciled) ──────────────────────────────

export interface LocalInvoiceRecord {
  local_id: string
  server_name: string | null
  createdAt: string
  queued: boolean
  invoice: POSInvoice
}

/** Newest-first local invoice records. `queued` ones haven't reached the server yet —
 *  history prepends them (with their provisional LOCAL- number) so the cashier always
 *  sees every sale they made, connection or not. */
export async function getLocalInvoices(): Promise<LocalInvoiceRecord[]> {
  const all = await idbGetAll<LocalInvoiceRecord>(STORES.invoices)
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

// ── best-sellers (client-side popularity) ────────────────────────────────────
// Counted at the till (every add-to-cart bumps the item) and stored in the kv store —
// no backend involvement, works fully offline, and powers the pinned "best sellers"
// row so cashiers stop re-searching their top items.


const POPULARITY_KEY = "item_popularity"

export async function bumpItemPopularity(itemCode: string): Promise<void> {
  try {
    const map = (await idbGet<Record<string, number>>(STORES.kv, POPULARITY_KEY)) ?? {}
    map[itemCode] = (map[itemCode] ?? 0) + 1
    await idbPut(STORES.kv, map, POPULARITY_KEY)
  } catch { /* never block a sale on stats */ }
}

/** Top-N best-selling item codes (most-added first). */
export async function getTopSellers(limit = 8): Promise<string[]> {
  const map = (await idbGet<Record<string, number>>(STORES.kv, POPULARITY_KEY)) ?? {}
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([code]) => code)
}
