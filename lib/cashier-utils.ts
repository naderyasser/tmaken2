/**
 * Cashier Module — Shared Utilities
 * Centralised currency formatting, validation, cart persistence, and offline queue.
 */

// ─────────────────────────────────────────────
// Currency Formatting  (G10 — dynamic currency)
// ─────────────────────────────────────────────

let _currency = "SAR"
let _locale = "ar-SA"

/** Call once when settings load to set the active currency globally */
export function setCashierCurrency(currency: string) {
  _currency = currency || "SAR"
}

export function setCashierLocale(locale: string) {
  _locale = locale || "ar-SA"
}

/** Format a number as currency using the active cashier currency */
export function fmtCurrency(amount: number): string {
  return amount.toLocaleString(_locale, { style: "currency", currency: _currency })
}

export function getCashierCurrency(): string {
  return _currency
}

// ─────────────────────────────────────────────
// Validation  (D5 — opening cash, etc.)
// ─────────────────────────────────────────────

/** Ensure a numeric string parses to a non-negative number. Returns the number or 0. */
export function parseNonNegative(value: string): number {
  const n = parseFloat(value)
  if (isNaN(n) || n < 0) return 0
  return n
}

// ─────────────────────────────────────────────
// Cart Persistence  (G5 — survive page refresh)
// ─────────────────────────────────────────────

const CART_KEY = "cashier_cart_state"
const HELD_KEY = "cashier_held_transactions"

export interface PersistedCart {
  items: Array<{
    item_code: string
    item_name?: string
    qty: number
    rate: number
    amount?: number
    warehouse?: string
    discount_percentage?: number
  }>
  customer: string
  customerName: string
  discount: number
  note: string
}

export function persistCart(cart: PersistedCart): void {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart))
  } catch {
    // Storage full or unavailable — ignore
  }
}

export function loadPersistedCart(): PersistedCart | null {
  try {
    const raw = localStorage.getItem(CART_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedCart
  } catch {
    return null
  }
}

export function clearPersistedCart(): void {
  try {
    localStorage.removeItem(CART_KEY)
  } catch {
    // ignore
  }
}

// ─────────────────────────────────────────────
// Hold / Park Transactions  (G12)
// ─────────────────────────────────────────────

export interface HeldTransaction {
  id: string
  cart: PersistedCart
  heldAt: string // ISO timestamp
  label?: string
}

export function getHeldTransactions(): HeldTransaction[] {
  try {
    const raw = localStorage.getItem(HELD_KEY)
    if (!raw) return []
    return JSON.parse(raw) as HeldTransaction[]
  } catch {
    return []
  }
}

export function holdTransaction(cart: PersistedCart, label?: string): HeldTransaction {
  const held: HeldTransaction = {
    id: `hold_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    cart,
    heldAt: new Date().toISOString(),
    label,
  }
  const all = getHeldTransactions()
  all.push(held)
  try {
    localStorage.setItem(HELD_KEY, JSON.stringify(all))
  } catch {
    // ignore
  }
  return held
}

export function resumeHeldTransaction(id: string): HeldTransaction | null {
  const all = getHeldTransactions()
  const idx = all.findIndex(h => h.id === id)
  if (idx < 0) return null
  const [removed] = all.splice(idx, 1)
  try {
    localStorage.setItem(HELD_KEY, JSON.stringify(all))
  } catch {
    // ignore
  }
  return removed
}

export function removeHeldTransaction(id: string): void {
  const all = getHeldTransactions()
  const filtered = all.filter(h => h.id !== id)
  try {
    localStorage.setItem(HELD_KEY, JSON.stringify(filtered))
  } catch {
    // ignore
  }
}

// ─────────────────────────────────────────────
// Offline Queue  (G4)
// ─────────────────────────────────────────────

const OFFLINE_QUEUE_KEY = "cashier_offline_queue"

export interface OfflineTransaction {
  id: string
  items: PersistedCart["items"]
  customer: string
  payments: Array<{ mode_of_payment: string; amount: number }>
  discount_amount: number
  createdAt: string
  synced: boolean
}

export function getOfflineQueue(): OfflineTransaction[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as OfflineTransaction[]
  } catch {
    return []
  }
}

export function addToOfflineQueue(tx: Omit<OfflineTransaction, "id" | "createdAt" | "synced">): OfflineTransaction {
  const entry: OfflineTransaction = {
    ...tx,
    id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    synced: false,
  }
  const queue = getOfflineQueue()
  queue.push(entry)
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // ignore
  }
  return entry
}

export function markOfflineSynced(id: string): void {
  const queue = getOfflineQueue()
  const item = queue.find(q => q.id === id)
  if (item) item.synced = true
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // ignore
  }
}

export function clearSyncedFromQueue(): void {
  const queue = getOfflineQueue().filter(q => !q.synced)
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // ignore
  }
}

// ─────────────────────────────────────────────
// ZATCA E-Invoice QR  (TLV encoding — ZATCA standard)
// ─────────────────────────────────────────────

/**
 * Encode a single TLV field.
 * Tag(1 byte) + Length(1 byte) + Value(UTF-8 bytes)
 */
function encodeTLV(tag: number, value: string): Uint8Array {
  const valueBytes = new TextEncoder().encode(value)
  const buf = new Uint8Array(2 + valueBytes.length)
  buf[0] = tag
  buf[1] = valueBytes.length
  buf.set(valueBytes, 2)
  return buf
}

/**
 * Generate a ZATCA-compliant Base64 TLV string for the e-invoice QR code.
 * Returns null if vatNumber is missing/empty.
 */
export function generateEInvoiceQR(data: {
  sellerName: string
  vatNumber: string
  timestamp: string     // ISO 8601
  totalWithVat: number
  vatAmount: number
}): string | null {
  if (!data.vatNumber) return null

  const parts: Uint8Array[] = [
    encodeTLV(1, data.sellerName),
    encodeTLV(2, data.vatNumber),
    encodeTLV(3, data.timestamp),
    encodeTLV(4, data.totalWithVat.toFixed(2)),
    encodeTLV(5, data.vatAmount.toFixed(2)),
  ]

  const totalLen = parts.reduce((s, p) => s + p.length, 0)
  const combined = new Uint8Array(totalLen)
  let offset = 0
  for (const part of parts) {
    combined.set(part, offset)
    offset += part.length
  }

  // Browser-safe btoa via charCode iteration
  return btoa(Array.from(combined, b => String.fromCharCode(b)).join(""))
}

// ─────────────────────────────────────────────

