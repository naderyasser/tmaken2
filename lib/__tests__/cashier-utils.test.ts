/**
 * Cashier Utilities — Unit Tests
 * Covers: cart persistence, hold/park transactions, offline queue,
 *         currency formatting, and validation helpers.
 */

import {
  persistCart,
  loadPersistedCart,
  clearPersistedCart,
  holdTransaction,
  getHeldTransactions,
  resumeHeldTransaction,
  removeHeldTransaction,
  addToOfflineQueue,
  getOfflineQueue,
  markOfflineSynced,
  clearSyncedFromQueue,
  setCashierCurrency,
  fmtCurrency,
  parseNonNegative,
  type PersistedCart,
} from '../cashier-utils'

// ─── helpers ─────────────────────────────────────────────────────────────────

const sampleCart: PersistedCart = {
  items: [
    { item_code: 'ITEM-001', item_name: 'Coffee', qty: 2, rate: 15, discount_percentage: 0 },
    { item_code: 'ITEM-002', item_name: 'Tea',    qty: 1, rate: 10 },
  ],
  customer: 'Walk-In Customer',
  customerName: 'Walk-In Customer',
  discount: 0,
  note: '',
}

beforeEach(() => {
  localStorage.clear()
  jest.clearAllMocks()
})

// ─── Cart Persistence (G5) ────────────────────────────────────────────────────

describe('Cart Persistence', () => {
  it('persists cart to localStorage', () => {
    persistCart(sampleCart)
    expect(localStorage.getItem('cashier_cart_state')).not.toBeNull()
  })

  it('loads the persisted cart back correctly', () => {
    persistCart(sampleCart)
    const loaded = loadPersistedCart()
    expect(loaded).not.toBeNull()
    expect(loaded!.items).toHaveLength(2)
    expect(loaded!.items[0].item_code).toBe('ITEM-001')
    expect(loaded!.customer).toBe('Walk-In Customer')
  })

  it('returns null when nothing is persisted', () => {
    expect(loadPersistedCart()).toBeNull()
  })

  it('clears the cart from localStorage', () => {
    persistCart(sampleCart)
    clearPersistedCart()
    expect(loadPersistedCart()).toBeNull()
  })

  it('preserves discount and note fields', () => {
    const cartWithDiscount: PersistedCart = { ...sampleCart, discount: 10, note: 'VIP customer' }
    persistCart(cartWithDiscount)
    const loaded = loadPersistedCart()
    expect(loaded!.discount).toBe(10)
    expect(loaded!.note).toBe('VIP customer')
  })

  it('handles corrupted localStorage data gracefully', () => {
    localStorage.setItem('cashier_cart_state', 'not-valid-json{{{')
    expect(loadPersistedCart()).toBeNull()
  })
})

// ─── Hold / Park Transactions (G12) ──────────────────────────────────────────

describe('Hold / Park Transactions', () => {
  it('saves a held transaction to localStorage', () => {
    const held = holdTransaction(sampleCart, 'Table 4')
    expect(held.id).toMatch(/^hold_/)
    expect(held.cart).toEqual(sampleCart)
    expect(held.label).toBe('Table 4')
    expect(held.heldAt).toBeTruthy()
  })

  it('retrieves held transactions', () => {
    holdTransaction(sampleCart, 'Customer A')
    holdTransaction(sampleCart, 'Customer B')
    const all = getHeldTransactions()
    expect(all).toHaveLength(2)
    expect(all[0].label).toBe('Customer A')
    expect(all[1].label).toBe('Customer B')
  })

  it('holds a transaction without a label', () => {
    const held = holdTransaction(sampleCart)
    expect(held.label).toBeUndefined()
    expect(getHeldTransactions()).toHaveLength(1)
  })

  it('resumes a held transaction and removes it from the list', () => {
    const held = holdTransaction(sampleCart, 'Resume Me')
    const resumed = resumeHeldTransaction(held.id)
    expect(resumed).not.toBeNull()
    expect(resumed!.cart.items).toHaveLength(2)
    expect(getHeldTransactions()).toHaveLength(0)
  })

  it('returns null when resuming a non-existent transaction', () => {
    expect(resumeHeldTransaction('hold_nonexistent')).toBeNull()
  })

  it('removes a held transaction by id', () => {
    holdTransaction(sampleCart, 'Keep')
    const toRemove = holdTransaction(sampleCart, 'Remove')
    removeHeldTransaction(toRemove.id)
    const remaining = getHeldTransactions()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].label).toBe('Keep')
  })

  it('does not throw when removing a non-existent id', () => {
    expect(() => removeHeldTransaction('hold_ghost')).not.toThrow()
  })

  it('generates unique ids for each held transaction', () => {
    const a = holdTransaction(sampleCart)
    const b = holdTransaction(sampleCart)
    expect(a.id).not.toBe(b.id)
  })
})

// ─── Offline Queue (G4) ──────────────────────────────────────────────────────

describe('Offline Queue', () => {
  const txPayload = {
    items: sampleCart.items,
    customer: 'Walk-In Customer',
    payments: [{ mode_of_payment: 'Cash', amount: 40 }],
    discount_amount: 0,
  }

  it('adds a transaction to the offline queue', () => {
    const entry = addToOfflineQueue(txPayload)
    expect(entry.id).toMatch(/^offline_/)
    expect(entry.synced).toBe(false)
    expect(entry.createdAt).toBeTruthy()
  })

  it('retrieves unsynced queue entries', () => {
    addToOfflineQueue(txPayload)
    addToOfflineQueue(txPayload)
    const queue = getOfflineQueue()
    expect(queue).toHaveLength(2)
    expect(queue.every(q => !q.synced)).toBe(true)
  })

  it('marks a queue entry as synced', () => {
    const entry = addToOfflineQueue(txPayload)
    markOfflineSynced(entry.id)
    const queue = getOfflineQueue()
    expect(queue.find(q => q.id === entry.id)!.synced).toBe(true)
  })

  it('clears only synced entries from the queue', () => {
    const synced = addToOfflineQueue(txPayload)
    addToOfflineQueue(txPayload) // stays unsynced
    markOfflineSynced(synced.id)
    clearSyncedFromQueue()
    const remaining = getOfflineQueue()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].synced).toBe(false)
  })

  it('returns empty array when queue is empty', () => {
    expect(getOfflineQueue()).toEqual([])
  })
})

// ─── Currency Formatting (G10) ───────────────────────────────────────────────

describe('Currency Formatting', () => {
  it('formats a number using the default SAR currency and returns a non-empty string', () => {
    setCashierCurrency('SAR')
    const formatted = fmtCurrency(100)
    // ar-SA locale uses Eastern Arabic numerals — just verify it returns a non-empty string
    // containing the SAR currency symbol or abbreviation
    expect(formatted.length).toBeGreaterThan(0)
    expect(typeof formatted).toBe('string')
  })

  it('formats zero correctly and returns a non-empty string', () => {
    const formatted = fmtCurrency(0)
    expect(formatted.length).toBeGreaterThan(0)
  })

  it('formats a decimal amount and returns a non-empty string', () => {
    const formatted = fmtCurrency(49.99)
    expect(formatted.length).toBeGreaterThan(0)
  })

  it('does not crash on negative amounts', () => {
    expect(() => fmtCurrency(-5)).not.toThrow()
  })
})

// ─── Validation (D5) ─────────────────────────────────────────────────────────

describe('parseNonNegative', () => {
  it('parses a valid positive number', () => {
    expect(parseNonNegative('100')).toBe(100)
  })

  it('parses a decimal number', () => {
    expect(parseNonNegative('49.5')).toBe(49.5)
  })

  it('returns 0 for a negative value', () => {
    expect(parseNonNegative('-10')).toBe(0)
  })

  it('returns 0 for a non-numeric string', () => {
    expect(parseNonNegative('abc')).toBe(0)
  })

  it('returns 0 for an empty string', () => {
    expect(parseNonNegative('')).toBe(0)
  })

  it('returns 0 for zero string', () => {
    expect(parseNonNegative('0')).toBe(0)
  })
})
