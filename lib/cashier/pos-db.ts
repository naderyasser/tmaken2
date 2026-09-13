/**
 * Cashier offline-first storage — IndexedDB layer.
 *
 * Durable, write-through persistence for everything the till cannot afford to lose:
 * the active session snapshot, settings snapshot, current cart + in-progress payment
 * draft, the offline action queue, and (read caches) catalog/customers/invoices.
 *
 * Design notes:
 * - No dependencies; plain IndexedDB behind small promise helpers.
 * - Every helper is fail-soft: storage being unavailable (SSR, private mode, quota)
 *   degrades to "no persistence", never to a thrown error in the sale path.
 * - localStorage remains a read-fallback for the legacy keys (cashier_cart_state,
 *   cashier_offline_queue) so existing installs migrate transparently.
 */

import type { CartItem, CashierSession, CashierSettings, PaymentEntry } from "@/lib/cashier-api"

const DB_NAME = "cashier_pos"
const DB_VERSION = 2

// Object stores (v1 created all but `terminal`; v2 adds it — see the upgrade handler,
// which creates whatever is missing so an install at any version lands on the same shape)
export const STORES = {
  kv: "kv",               // key-value: cart, session, settings, payment_draft, meta
  queue: "queue",         // QueuedAction by id (uuid)
  catalog: "catalog",     // CatalogItem by item_code (offline browse/barcode)
  customers: "customers", // recent customers by name
  invoices: "invoices",   // recent + locally-created invoices by local_id
  terminal: "terminal",   // card-terminal transactions by clientRef (v2)
} as const

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null)
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORES.kv)) db.createObjectStore(STORES.kv)
        if (!db.objectStoreNames.contains(STORES.queue)) {
          const q = db.createObjectStore(STORES.queue, { keyPath: "id" })
          q.createIndex("status", "status")
          q.createIndex("createdAt", "createdAt")
        }
        if (!db.objectStoreNames.contains(STORES.catalog)) {
          db.createObjectStore(STORES.catalog, { keyPath: "item_code" })
        }
        if (!db.objectStoreNames.contains(STORES.customers)) {
          db.createObjectStore(STORES.customers, { keyPath: "name" })
        }
        if (!db.objectStoreNames.contains(STORES.invoices)) {
          const inv = db.createObjectStore(STORES.invoices, { keyPath: "local_id" })
          inv.createIndex("createdAt", "createdAt")
        }
        if (!db.objectStoreNames.contains(STORES.terminal)) {
          const term = db.createObjectStore(STORES.terminal, { keyPath: "clientRef" })
          term.createIndex("state", "state")
          term.createIndex("startedAt", "startedAt")
        }
      }
      req.onsuccess = () => {
        const db = req.result
        // a future version bump elsewhere shouldn't deadlock this tab
        db.onversionchange = () => { try { db.close() } catch { /* */ } ; dbPromise = null }
        resolve(db)
      }
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  const db = await openDb()
  if (!db) return null
  try {
    return await reqToPromise(fn(db.transaction(store, mode).objectStore(store)))
  } catch {
    return null
  }
}

// ── Generic helpers ──────────────────────────────────────────────────────────

export function idbGet<T = unknown>(store: string, key: IDBValidKey): Promise<T | null> {
  return withStore<T>(store, "readonly", (s) => s.get(key) as IDBRequest<T>)
}

export async function idbPut(store: string, value: unknown, key?: IDBValidKey): Promise<boolean> {
  const r = await withStore(store, "readwrite", (s) => (key !== undefined ? s.put(value, key) : s.put(value)))
  return r !== null
}

export async function idbDelete(store: string, key: IDBValidKey): Promise<void> {
  await withStore(store, "readwrite", (s) => s.delete(key))
}

export async function idbGetAll<T = unknown>(store: string): Promise<T[]> {
  const r = await withStore<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>)
  return r ?? []
}

export async function idbClear(store: string): Promise<void> {
  await withStore(store, "readwrite", (s) => s.clear())
}

export async function idbBulkPut(store: string, values: unknown[]): Promise<void> {
  const db = await openDb()
  if (!db || values.length === 0) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(store, "readwrite")
      const s = tx.objectStore(store)
      for (const v of values) s.put(v)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}

// ── Stable client IDs ────────────────────────────────────────────────────────

/** UUID v4 — stable client-side ID for offline-created records & idempotency keys. */
export function newClientId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
  } catch { /* */ }
  // RFC4122-ish fallback for very old engines
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// ── Typed snapshots (kv store) ───────────────────────────────────────────────

export interface PersistedCartState {
  items: CartItem[]
  customer: string
  customerName: string
  discount: number
  note: string
}

export interface PaymentDraft {
  open: boolean
  entries: PaymentEntry[]
  savedAt: string
}

const KV = {
  cart: "cart",
  session: "session",
  settings: "settings",
  paymentDraft: "payment_draft",
} as const

export async function saveCartDurable(cart: PersistedCartState | null): Promise<void> {
  if (cart && cart.items.length > 0) await idbPut(STORES.kv, cart, KV.cart)
  else await idbDelete(STORES.kv, KV.cart)
}

export async function loadCartDurable(): Promise<PersistedCartState | null> {
  const fromIdb = await idbGet<PersistedCartState>(STORES.kv, KV.cart)
  if (fromIdb?.items?.length) return fromIdb
  // legacy localStorage fallback (pre-IndexedDB installs migrate transparently)
  try {
    const raw = localStorage.getItem("cashier_cart_state")
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedCartState
      if (parsed?.items?.length) return parsed
    }
  } catch { /* */ }
  return null
}

export async function saveSessionSnapshot(session: CashierSession | null): Promise<void> {
  if (session) await idbPut(STORES.kv, session, KV.session)
  else await idbDelete(STORES.kv, KV.session)
}

export async function loadSessionSnapshot(): Promise<CashierSession | null> {
  return idbGet<CashierSession>(STORES.kv, KV.session)
}

export async function saveSettingsSnapshot(settings: CashierSettings | null): Promise<void> {
  if (settings) await idbPut(STORES.kv, settings, KV.settings)
}

export async function loadSettingsSnapshot(): Promise<CashierSettings | null> {
  return idbGet<CashierSettings>(STORES.kv, KV.settings)
}

export async function savePaymentDraft(draft: PaymentDraft | null): Promise<void> {
  if (draft && (draft.open || draft.entries.length > 0)) await idbPut(STORES.kv, draft, KV.paymentDraft)
  else await idbDelete(STORES.kv, KV.paymentDraft)
}

export async function loadPaymentDraft(): Promise<PaymentDraft | null> {
  return idbGet<PaymentDraft>(STORES.kv, KV.paymentDraft)
}
