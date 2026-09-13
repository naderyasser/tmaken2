"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  useRef,
  type ReactNode,
} from "react"
import {
  cashierApi,
  type CartItem,
  type PaymentEntry,
  type CashierSession,
  type CashierSettings,
  type POSInvoice,
} from "@/lib/cashier-api"
import {
  setCashierCurrency,
  persistCart,
  clearPersistedCart,
  holdTransaction,
  type PersistedCart,
} from "@/lib/cashier-utils"
import {
  loadCartDurable,
  saveCartDurable,
  loadSessionSnapshot,
  saveSessionSnapshot,
  loadSettingsSnapshot,
  saveSettingsSnapshot,
  savePaymentDraft,
  newClientId,
  idbPut,
  STORES,
} from "@/lib/cashier/pos-db"
import {
  enqueueAction,
  getSyncSnapshot,
  installSyncTriggers,
  isNetworkError,
  kickSync,
  subscribeSync,
} from "@/lib/cashier/sync"

// ──────────────────────────────────────────────────────────────
// Cart State  (B3 fix — added SET_DISCOUNT; G5 — persistence)
// ──────────────────────────────────────────────────────────────

export interface CartState {
  items: CartItem[]
  customer: string
  customerName: string
  discount: number      // B3 fix: global cart-level discount (percentage)
  note: string
}

type CartAction =
  | { type: "ADD_ITEM"; item: CartItem }
  | { type: "REMOVE_ITEM"; item_code: string }
  | { type: "UPDATE_QTY"; item_code: string; qty: number }
  | { type: "UPDATE_DISCOUNT"; item_code: string; discount_percentage: number }
  | { type: "SET_CUSTOMER"; customer: string; customerName: string }
  | { type: "SET_NOTE"; note: string }
  | { type: "SET_CART_DISCOUNT"; discount: number }   // B3 fix: global discount action
  | { type: "RESTORE"; cart: CartState }               // G5: restore from persistence
  | { type: "CLEAR" }

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const idx = state.items.findIndex(i => i.item_code === action.item.item_code)
      if (idx >= 0) {
        const updated = [...state.items]
        updated[idx] = { ...updated[idx], qty: updated[idx].qty + action.item.qty }
        return { ...state, items: updated }
      }
      return { ...state, items: [...state.items, action.item] }
    }
    case "REMOVE_ITEM":
      return { ...state, items: state.items.filter(i => i.item_code !== action.item_code) }
    case "UPDATE_QTY": {
      if (action.qty <= 0)
        return { ...state, items: state.items.filter(i => i.item_code !== action.item_code) }
      return { ...state, items: state.items.map(i => i.item_code === action.item_code ? { ...i, qty: action.qty } : i) }
    }
    case "UPDATE_DISCOUNT":
      return { ...state, items: state.items.map(i => i.item_code === action.item_code ? { ...i, discount_percentage: action.discount_percentage } : i) }
    case "SET_CUSTOMER":
      return { ...state, customer: action.customer, customerName: action.customerName }
    case "SET_NOTE":
      return { ...state, note: action.note }
    case "SET_CART_DISCOUNT":
      return { ...state, discount: Math.max(0, Math.min(100, action.discount)) }
    case "RESTORE":
      return action.cart
    case "CLEAR":
      return { items: [], customer: "Walk-In Customer", customerName: "Walk-In Customer", discount: 0, note: "" }
    default:
      return state
  }
}

const initialCart: CartState = { items: [], customer: "Walk-In Customer", customerName: "Walk-In Customer", discount: 0, note: "" }

// ──────────────────────────────────────────────────────────────
// Context Value
// ──────────────────────────────────────────────────────────────

interface CashierContextValue {
  // Session
  session: CashierSession | null
  settings: CashierSettings | null
  isLoadingSession: boolean
  sessionError: string | null
  serverTimeOffset: number
  isOnline: boolean                                          // G4: connectivity status
  openSession: (openingCash?: number) => Promise<void>
  closeSession: (closingAmounts: Record<string, number>) => Promise<void>  // D4 fix: multi-payment
  refreshSession: () => Promise<void>

  // Cart
  cart: CartState
  addItem: (item: CartItem) => void
  removeItem: (itemCode: string) => void
  updateQty: (itemCode: string, qty: number) => void
  updateDiscount: (itemCode: string, pct: number) => void
  setCustomer: (customer: string, customerName: string) => void
  setNote: (note: string) => void
  setCartDiscount: (pct: number) => void                    // B3 fix
  clearCart: () => void
  restoreCart: (cart: CartState) => void                     // G12: resume held

  // Totals  (G2 — tax visible)
  subtotal: number
  totalItemDiscount: number
  cartDiscountAmount: number
  taxAmount: number
  grandTotal: number

  // Checkout
  completeSale: (payments: PaymentEntry[], discountAmount?: number) => Promise<{ invoice: POSInvoice }>

  // Offline sync queue
  offlineQueueCount: number          // pending + failed (back-compat name)
  syncPendingCount: number
  syncFailedCount: number
  isSyncing: boolean
  syncOfflineQueue: () => Promise<void>
}

// ──────────────────────────────────────────────────────────────
// Context & Provider
// ──────────────────────────────────────────────────────────────

const CashierContext = createContext<CashierContextValue | null>(null)

export function CashierProvider({ children }: { children: ReactNode }) {
  const [cart, dispatch] = useReducer(cartReducer, initialCart)

  // L4 fix: use useState instead of useReducer for simple scalars
  const [session, setSession] = useState<CashierSession | null>(null)
  const [settings, setSettings] = useState<CashierSettings | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [serverTimeOffset, setServerTimeOffset] = useState(0)
  const [isOnline, setIsOnline] = useState(true)
  const [syncState, setSyncState] = useState({ pending: 0, failed: 0, syncing: false })

  // Track whether we've restored the persisted cart
  const restoredRef = useRef(false)
  // Latest session/settings for non-reactive reads (error decisions in async flows)
  const sessionRef = useRef<CashierSession | null>(null)
  const settingsRef = useRef<CashierSettings | null>(null)
  useEffect(() => { sessionRef.current = session }, [session])
  useEffect(() => { settingsRef.current = settings }, [settings])

  // G4: online/offline detection
  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    setIsOnline(navigator.onLine)
    window.addEventListener("online", goOnline)
    window.addEventListener("offline", goOffline)
    return () => {
      window.removeEventListener("online", goOnline)
      window.removeEventListener("offline", goOffline)
    }
  }, [])

  // Durable persistence: cart write-through to IndexedDB (+ legacy localStorage) on
  // every change — a tab close / browser crash never loses the in-progress sale.
  useEffect(() => {
    if (!restoredRef.current) return // don't persist until after initial restore
    if (cart.items.length > 0) {
      persistCart(cart as PersistedCart)
      void saveCartDurable(cart)
    } else {
      clearPersistedCart()
      void saveCartDurable(null)
    }
  }, [cart])

  // Session + settings snapshots write-through so a relaunch can resume offline.
  useEffect(() => {
    if (!restoredRef.current) return
    void saveSessionSnapshot(session)
  }, [session])
  useEffect(() => {
    if (!restoredRef.current || !settings) return
    void saveSettingsSnapshot(settings)
  }, [settings])

  // Sync engine: install global triggers (reconnect / tab visible / boot migration)
  // and mirror the queue state into React for the status indicator.
  useEffect(() => {
    installSyncTriggers()
    let alive = true
    const refresh = () => {
      void getSyncSnapshot().then(snap => {
        if (alive) setSyncState({ pending: snap.pending, failed: snap.failed, syncing: snap.syncing })
      })
    }
    refresh()
    const unsub = subscribeSync(refresh)
    return () => { alive = false; unsub() }
  }, [])

  // L2 fix: handle getActiveSession and getSettings independently.
  // Offline-first: the server is the source of truth when REACHABLE — but a network
  // failure must never wipe the locally-restored snapshot (that would bounce the
  // cashier out of an in-progress shift just because the connection dropped).
  const refreshSession = useCallback(async () => {
    setIsLoadingSession(true)
    setSessionError(null)

    // Fetch session and settings independently so one failure doesn't mask the other
    let sessionFetchOk = false
    let activeSession: CashierSession | null = null
    let serverTime: string | undefined
    let cfg: CashierSettings | null = null
    const errors: string[] = []

    try {
      const result = await cashierApi.getActiveSession()
      activeSession = result.session
      serverTime = result.server_time
      sessionFetchOk = true
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Failed to load session")
    }

    try {
      cfg = await cashierApi.getSettings()
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Failed to load settings")
    }

    if (sessionFetchOk) {
      // server truth (including "no active session")
      setSession(activeSession)
    }
    // on failure: keep whatever we have (hydrated snapshot) — resume offline

    if (cfg) {
      setSettings(cfg)
      // G10: set global currency from settings
      setCashierCurrency(cfg.currency || "SAR")
    }

    // L6 improvement: compute offset accounting for approximate half-RTT
    if (serverTime) {
      const serverMs = new Date(serverTime.replace(" ", "T")).getTime()
      setServerTimeOffset(serverMs - Date.now())
    }

    if (errors.length > 0) {
      // surface a blocking error only when we ALSO have nothing local to work with —
      // with a hydrated snapshot the cashier keeps working and sync catches up later
      const haveLocal = !!(sessionFetchOk ? activeSession : sessionRef.current) || !!(cfg ?? settingsRef.current)
      if (!haveLocal) setSessionError(errors.join("; "))
    }

    setIsLoadingSession(false)
  }, [])

  // Boot: hydrate from durable storage FIRST (instant resume, works offline), then
  // revalidate against the server. Snapshot fills only gaps; server response wins.
  useEffect(() => {
    // Boot once. A second pass would park the cart the cashier is building right
    // now, since by then durable storage holds the live cart rather than a
    // leftover one.
    if (restoredRef.current) return
    let cancelled = false
    ;(async () => {
      try {
        const [savedCart, snapSession, snapSettings] = await Promise.all([
          loadCartDurable(),
          loadSessionSnapshot(),
          loadSettingsSnapshot(),
        ])
        if (cancelled) return
        // The sales screen always opens on an empty cart. A cart left behind by a
        // closed tab or a crash is parked as a held transaction instead of being
        // restored, so the sale is still recoverable from "الفواتير المعلّقة".
        if (savedCart?.items?.length) {
          holdTransaction(savedCart as PersistedCart, "استئناف تلقائي")
          clearPersistedCart()
          void saveCartDurable(null)
          // Drop the payment draft with it — otherwise it would surface later
          // against whatever cart the cashier builds next.
          void savePaymentDraft(null)
        }
        if (snapSettings) {
          setSettings(curr => curr ?? snapSettings)
          setCashierCurrency(snapSettings.currency || "SAR")
        }
        if (snapSession && snapSession.status === "Active") {
          setSession(curr => curr ?? snapSession)
        }
      } finally {
        restoredRef.current = true
        if (!cancelled) void refreshSession()
      }
    })()
    return () => { cancelled = true }
  }, [refreshSession])

  const openSession = useCallback(async (openingCash = 0) => {
    setIsLoadingSession(true)
    try {
      const { session: s } = await cashierApi.openSession(openingCash)
      setSession(s)
    } finally {
      setIsLoadingSession(false)
    }
  }, [])

  // D4 fix: accept multi-payment closing amounts instead of just cash.
  // Offline-safe: a network failure queues the close (FIFO — it only syncs after all
  // earlier queued sales) and closes the session locally so the cashier can finish
  // their shift; the named-session arg makes the eventual replay exact + idempotent.
  const closeSession = useCallback(async (closingAmounts: Record<string, number>) => {
    const sessionName = sessionRef.current?.name
    setIsLoadingSession(true)
    try {
      if (navigator.onLine) {
        try {
          const { session: s } = await cashierApi.closeSession(closingAmounts, sessionName)
          setSession(s)
          dispatch({ type: "CLEAR" })
          clearPersistedCart()
          void saveCartDurable(null)
          void savePaymentDraft(null)
          return
        } catch (e) {
          if (!isNetworkError(e)) throw e
        }
      }
      await enqueueAction("close_session", { closing_amounts: closingAmounts, session: sessionName })
      setSession(prev => (prev ? { ...prev, status: "Closed" } : prev))
      dispatch({ type: "CLEAR" })
      clearPersistedCart()
      void saveCartDurable(null)
      void savePaymentDraft(null)
    } finally {
      setIsLoadingSession(false)
    }
  }, [])

  // ── Totals  (G2 — include tax in totals) ──
  const subtotal = useMemo(
    () => cart.items.reduce((sum, i) => sum + i.rate * i.qty, 0),
    [cart.items]
  )

  const totalItemDiscount = useMemo(
    () => cart.items.reduce((sum, i) => {
      const disc = ((i.discount_percentage || 0) / 100) * i.rate * i.qty
      return sum + disc
    }, 0),
    [cart.items]
  )

  // B3 fix: apply cart-level discount
  const cartDiscountAmount = useMemo(
    () => (cart.discount / 100) * (subtotal - totalItemDiscount),
    [cart.discount, subtotal, totalItemDiscount]
  )

  const netBeforeTax = subtotal - totalItemDiscount - cartDiscountAmount

  // G2: compute estimated tax from configured tax rates in settings
  // The backend applies the actual tax; this is a display estimate
  const taxRate = useMemo(() => {
    const taxes = settings?.taxes || []
    if (taxes.length === 0) return 0
    return taxes.reduce((sum, tx) => sum + (tx.rate || 0), 0) / 100
  }, [settings?.taxes])
  const taxAmount = useMemo(() => netBeforeTax * taxRate, [netBeforeTax, taxRate])

  // D1 fix: grandTotal now includes tax so it matches what the backend will charge
  const grandTotal = netBeforeTax + taxAmount

  // ── Checkout — online-first with a transparent durable-queue fallback ──
  // Every sale (online too) carries a client UUID the backend enforces uniquely, so a
  // retry after a flap/timeout can never double-charge. A NETWORK failure silently
  // queues the sale and hands back a provisional receipt; a SERVER rejection is still
  // surfaced to the cashier exactly as before (cart kept).
  const clearAfterSale = useCallback(() => {
    dispatch({ type: "CLEAR" })
    clearPersistedCart()
    void saveCartDurable(null)
    void savePaymentDraft(null)
  }, [])

  const completeSale = useCallback(async (payments: PaymentEntry[], discountAmount = 0): Promise<{ invoice: POSInvoice }> => {
    const clientRef = newClientId()
    const saleArgs = {
      items: cart.items,
      customer: cart.customer || undefined,
      payments,
      discount_amount: discountAmount + cartDiscountAmount,
    }

    if (navigator.onLine) {
      try {
        const result = await cashierApi.createSale({ ...saleArgs, idempotency_key: clientRef })
        clearAfterSale()
        return result as { invoice: POSInvoice }
      } catch (e) {
        if (!isNetworkError(e)) throw e // server verdict — show it, keep the cart
        // network died mid-call → fall through to the queue (idempotency_key makes the
        // replay safe even if the server actually committed before the drop)
      }
    }

    const action = await enqueueAction("sale", saleArgs, clientRef)
    const provisional = {
      name: `LOCAL-${clientRef.slice(0, 8).toUpperCase()}`,
      customer: cart.customer,
      customer_name: cart.customerName,
      total: subtotal - totalItemDiscount,
      discount_amount: cartDiscountAmount + discountAmount,
      total_taxes_and_charges: taxAmount,
      grand_total: grandTotal,
      posting_date: new Date().toISOString().split("T")[0],
      posting_time: new Date().toTimeString().split(" ")[0],
      status: "Queued (Offline)",
      items: cart.items,
      payments,
    } as POSInvoice
    void idbPut(STORES.invoices, {
      local_id: clientRef,
      server_name: null,
      createdAt: action.createdAt,
      queued: true,
      invoice: provisional,
    })
    clearAfterSale()
    return { invoice: provisional }
  }, [cart, subtotal, totalItemDiscount, taxAmount, grandTotal, cartDiscountAmount, clearAfterSale])

  // Manual sync trigger (the engine also kicks itself on reconnect/visibility/backoff)
  const syncOfflineQueue = useCallback(async () => {
    await kickSync("manual")
  }, [])

  // ── Stable action callbacks (B4 fix — useCallback so children don't re-render) ──
  const addItem = useCallback((item: CartItem) => dispatch({ type: "ADD_ITEM", item }), [])
  const removeItem = useCallback((item_code: string) => dispatch({ type: "REMOVE_ITEM", item_code }), [])
  const updateQty = useCallback((item_code: string, qty: number) => dispatch({ type: "UPDATE_QTY", item_code, qty }), [])
  const updateDiscount = useCallback((item_code: string, discount_percentage: number) => dispatch({ type: "UPDATE_DISCOUNT", item_code, discount_percentage }), [])
  const setCustomer = useCallback((customer: string, customerName: string) => dispatch({ type: "SET_CUSTOMER", customer, customerName }), [])
  const setNote = useCallback((note: string) => dispatch({ type: "SET_NOTE", note }), [])
  const setCartDiscount = useCallback((discount: number) => dispatch({ type: "SET_CART_DISCOUNT", discount }), [])
  const clearCart = useCallback(() => { dispatch({ type: "CLEAR" }); clearPersistedCart() }, [])
  const restoreCart = useCallback((c: CartState) => dispatch({ type: "RESTORE", cart: c }), [])

  const value: CashierContextValue = {
    session,
    settings,
    isLoadingSession,
    sessionError,
    serverTimeOffset,
    isOnline,
    openSession,
    closeSession,
    refreshSession,

    cart,
    addItem,
    removeItem,
    updateQty,
    updateDiscount,
    setCustomer,
    setNote,
    setCartDiscount,
    clearCart,
    restoreCart,

    subtotal,
    totalItemDiscount,
    cartDiscountAmount,
    taxAmount,
    grandTotal,

    completeSale,

    offlineQueueCount: syncState.pending + syncState.failed,
    syncPendingCount: syncState.pending,
    syncFailedCount: syncState.failed,
    isSyncing: syncState.syncing,
    syncOfflineQueue,
  }

  return <CashierContext.Provider value={value}>{children}</CashierContext.Provider>
}

export function useCashier() {
  const ctx = useContext(CashierContext)
  if (!ctx) throw new Error("useCashier must be used within <CashierProvider>")
  return ctx
}
