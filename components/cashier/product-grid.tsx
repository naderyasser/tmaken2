"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Search, Package, ShieldAlert, X, Star } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cashierApi, type CatalogItem, type CartItem } from "@/lib/cashier-api"
import { cacheCatalogItems, searchCatalogCache, bumpItemPopularity, getTopSellers } from "@/lib/cashier/offline-catalog"
import { beepSuccess, beepError } from "@/lib/cashier/feedback"
import { useI18n } from "@/lib/i18n"
import { BarcodeScanner } from "./barcode-scanner"
import { QuickAddItem } from "./quick-add-item"
import { useCashier } from "@/contexts/CashierContext"
import { useAuth } from "@/lib/auth-context"
import { fmtCurrency } from "@/lib/cashier-utils"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

interface ProductGridProps {
  onAddItem: (item: CartItem) => void
  /** item_code → qty currently in the cart — drives the "in cart ×N" badge. */
  cartQty?: Record<string, number>
}

const PAGE_LIMIT = 40

// Color palette for letter placeholders — 10 vivid options
const PLACEHOLDER_COLORS = [
  "bg-violet-100 text-violet-600",
  "bg-sky-100 text-sky-600",
  "bg-emerald-100 text-emerald-600",
  "bg-amber-100 text-amber-600",
  "bg-rose-100 text-rose-600",
  "bg-orange-100 text-orange-600",
  "bg-indigo-100 text-indigo-600",
  "bg-pink-100 text-pink-600",
  "bg-teal-100 text-teal-600",
  "bg-lime-100 text-lime-600",
]

export function ProductGrid({ onAddItem, cartQty }: ProductGridProps) {
  const { t } = useI18n()
  const { settings } = useCashier()
  const { isCashierManager, isAdmin } = useAuth()  // G11: role check
  const trackStock = settings?.track_stock ?? false
  const [items, setItems] = useState<CatalogItem[]>([])
  const [allItems, setAllItems] = useState<CatalogItem[]>([])
  const [pendingOutOfStock, setPendingOutOfStock] = useState<{ cartItem: Parameters<typeof onAddItem>[0]; actualQty: number } | null>(null)
  const [search, setSearch] = useState("")
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  // (8) pinned best-sellers: client-side popularity from IndexedDB — zero backend
  const [topCodes, setTopCodes] = useState<string[]>([])
  // (13) hide out-of-stock filter — remembered across shifts
  const [hideOos, setHideOos] = useState(false)
  // (10) scan feedback pulse on the search field: 'ok' | 'err' | null
  const [scanPulse, setScanPulse] = useState<"ok" | "err" | null>(null)
  const pulse = (kind: "ok" | "err") => {
    setScanPulse(kind)
    setTimeout(() => setScanPulse(null), 700)
  }
  const [loading, setLoading] = useState(false)
  const [lastSearch, setLastSearch] = useState("")
  const searchTimer = useRef<NodeJS.Timeout | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // L1 fix: AbortController for request cancellation
  const abortRef = useRef<AbortController | null>(null)
  // cache-first coordination (see loadItems)
  const loadEpochRef = useRef(0)
  const networkSettledRef = useRef(false)

  // B4 fix: stable onAddItem ref so loadItems deps don't change every render
  const onAddItemRef = useRef(onAddItem)
  onAddItemRef.current = onAddItem

  const loadItems = useCallback(async (term: string) => {
    // L1: cancel any in-flight request
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    // OFFLINE-FIRST READS: render the local catalog cache IMMEDIATELY (prices included)
    // so the grid never blocks on the network; the server response — when it arrives —
    // replaces it and refreshes the cache. The epoch guard stops a slow cache read from
    // overwriting a faster network result.
    const epoch = ++loadEpochRef.current
    void searchCatalogCache(term).then(cached => {
      if (epoch !== loadEpochRef.current) return
      if (cached.items.length && !networkSettledRef.current) {
        setAllItems(cached.items)
        setItems(cached.items)
      }
    })
    networkSettledRef.current = false

    setLoading(true)
    try {
      const result = await cashierApi.getItems({
        search: term || undefined,
        limit: PAGE_LIMIT,
      }, abortRef.current.signal)
      const loaded = result.items ?? []
      networkSettledRef.current = true
      setAllItems(loaded)
      setItems(loaded)
      void cacheCatalogItems(loaded) // write-through for offline browse/barcode
      // If barcode match, auto-add to cart
      if (result.barcode_match && loaded.length === 1) {
        const it = loaded[0]
        onAddItemRef.current({
          item_code: it.item_code,
          item_name: it.item_name,
          qty: 1,
          rate: it.rate,
          amount: it.rate,
          discount_percentage: 0,
        })
        setSearch("")
        setLastSearch("")
        searchRef.current?.focus() // rapid scanning: ready for the next barcode
        beepSuccess(); pulse("ok") // (10) eyes-free confirmation
        void bumpItemPopularity(it.item_code).then(() => getTopSellers(8).then(setTopCodes))
        // L3 fix: Reload full catalog
        const full = await cashierApi.getItems({ limit: PAGE_LIMIT })
        const fullItems = full.items ?? []
        setAllItems(fullItems)
        setItems(fullItems)
        return
      }
      setLastSearch(term)
      // (10) distinct error cue for a scan that matched nothing
      if (loaded.length === 0 && /^\d{6,}$/.test(term.trim())) { beepError(); pulse("err") }
    } catch (e) {
      // Ignore abort errors
      if (e instanceof DOMException && e.name === "AbortError") return
      // Network down → serve the local catalog cache transparently (browse, search,
      // and exact-barcode auto-add all keep working at the till).
      try {
        const cached = await searchCatalogCache(term)
        if (cached.barcode_match && cached.items.length === 1) {
          const it = cached.items[0]
          onAddItemRef.current({
            item_code: it.item_code,
            item_name: it.item_name,
            qty: 1,
            rate: it.rate,
            amount: it.rate,
            discount_percentage: 0,
          })
          setSearch("")
          setLastSearch("")
          searchRef.current?.focus() // rapid scanning offline too
          beepSuccess(); pulse("ok")
          void bumpItemPopularity(it.item_code).then(() => getTopSellers(8).then(setTopCodes))
          const full = await searchCatalogCache("")
          setAllItems(full.items)
          setItems(full.items)
          return
        }
        setAllItems(cached.items)
        setItems(cached.items)
        setLastSearch(term)
      } catch {
        console.error("Failed to load items:", e)
      }
    } finally {
      setLoading(false)
    }
  }, []) // B4 fix: no onAddItem dependency — using ref instead

  useEffect(() => { loadItems("") }, [loadItems])

  useEffect(() => {
    // Default ON: a cashier cannot sell what is out of stock, so showing it just
    // buries the sellable items. Explicitly stored "0" means the user turned it off.
    try { setHideOos(localStorage.getItem("cashier_hide_oos") !== "0") } catch { setHideOos(true) }
    void getTopSellers(8).then(setTopCodes)
  }, [])
  const toggleHideOos = () => {
    setHideOos(v => {
      try { localStorage.setItem("cashier_hide_oos", v ? "0" : "1") } catch { /* */ }
      return !v
    })
  }

  // Filter by active group + the optional hide-out-of-stock display filter
  useEffect(() => {
    let next = activeGroup ? allItems.filter(i => i.item_group === activeGroup) : allItems
    if (hideOos && trackStock) next = next.filter(i => !(i.actual_qty != null && i.actual_qty <= 0))
    setItems(next)
  }, [activeGroup, allItems, hideOos, trackStock])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      loadItems(value)
    }, 200) // 200ms debounce
  }

  // L3 fix: barcode scan no longer sets search (which would trigger debounced search)
  const handleBarcodeScan = useCallback((barcode: string) => {
    setSearch(barcode)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    loadItems(barcode)
  }, [loadItems])

  const handleAddWithStockCheck = useCallback((item: CatalogItem) => {
    const cartItem: CartItem = {
      item_code: item.item_code,
      item_name: item.item_name,
      qty: 1,
      rate: item.rate,
      amount: item.rate,
      discount_percentage: 0,
    }

    if (trackStock && item.actual_qty != null && item.actual_qty <= 0) {
      setPendingOutOfStock({ cartItem, actualQty: item.actual_qty })
      return
    }

    onAddItem(cartItem)
    void bumpItemPopularity(item.item_code).then(() => getTopSellers(8).then(setTopCodes))
  }, [trackStock, onAddItem])

  // F2 = focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  // G11: only show QuickAddItem for managers/admins
  const canCreateItems = isCashierManager || isAdmin

  // Derive unique groups from loaded items
  const groups = Array.from(new Set(allItems.map(i => i.item_group).filter(Boolean))) as string[]

  // Count items per group for badges
  const groupCounts = allItems.reduce((acc, item) => {
    if (item.item_group) acc[item.item_group] = (acc[item.item_group] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Search bar */}
      <div className="p-3 pb-2 bg-white border-b sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              ref={searchRef}
              autoFocus
              data-cashier-search
              className={`ps-9 pe-10 h-11 text-sm bg-slate-50 border-slate-200 rounded-xl placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-emerald-400 transition-shadow ${
                scanPulse === "ok" ? "ring-2 ring-emerald-500 bg-emerald-50" : scanPulse === "err" ? "ring-2 ring-rose-500 bg-rose-50" : ""}`}
              placeholder={t("cashier.search_items")}
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              autoComplete="off"
            />
            {/* one-tap clear — returns focus so the next scan/type is immediate */}
            {search && (
              <button
                type="button"
                aria-label={t("cashier.clear")}
                title={t("cashier.clear")}
                className="absolute end-2 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-emerald-500"
                onClick={() => { handleSearchChange(""); searchRef.current?.focus() }}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <BarcodeScanner onScan={handleBarcodeScan} />
        </div>
      </div>

      {/* Item group filter tabs */}
      {!search && groups.length > 0 && (
        <div className="flex gap-1.5 px-3 py-2 bg-white border-b overflow-x-auto scrollbar-none shrink-0">
          {/* "All" tab */}
          <button
            onClick={() => setActiveGroup(null)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${!activeGroup
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
          >
            {t("cashier.all")}
            <span className={`text-[10px] rounded-full px-1.5 min-w-[18px] text-center ${!activeGroup ? "bg-white/30 text-white" : "bg-slate-300 text-slate-600"
              }`}>
              {allItems.length}
            </span>
          </button>
          {groups.map(g => (
            <button
              key={g}
              onClick={() => setActiveGroup(g === activeGroup ? null : g)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${activeGroup === g
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              {g}
              <span className={`text-[10px] rounded-full px-1.5 min-w-[18px] text-center ${activeGroup === g ? "bg-white/30 text-white" : "bg-slate-300 text-slate-600"
                }`}>
                {groupCounts[g] ?? 0}
              </span>
            </button>
          ))}
          {/* (13) display-only filter: hide items that can't be sold right now */}
          {trackStock && (
            <button
              onClick={toggleHideOos}
              aria-pressed={hideOos}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${hideOos
                ? "bg-rose-600 text-white border-rose-600"
                : "bg-white text-slate-600 border-slate-300 hover:border-rose-300"}`}
            >
              {t("cashier.hide_oos")}
            </button>
          )}

        </div>
      )}

      {/* Items grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* (8) pinned best-sellers — the cashier's own top items, learned client-side */}
        {!search && !activeGroup && topCodes.length > 0 && (() => {
          const tops = topCodes
            .map(code => allItems.find(i => i.item_code === code))
            .filter((i): i is CatalogItem => !!i)
            .filter(i => !(hideOos && trackStock && i.actual_qty != null && i.actual_qty <= 0))
            .slice(0, 8)
          if (tops.length === 0) return null
          return (
            <div className="mb-4">
              <p className="text-xs font-bold text-amber-600 mb-2 flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {t("cashier.best_sellers")}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3">
                {tops.map(item => (
                  <ProductCard
                    key={`top-${item.item_code}`}
                    item={item}
                    trackStock={trackStock}
                    inCartQty={cartQty?.[item.item_code] ?? 0}
                    onAdd={() => handleAddWithStockCheck(item)}
                  />
                ))}
              </div>
            </div>
          )
        })()}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-3">
            <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center">
              <Package className="h-8 w-8 opacity-40" />
            </div>
            <p className="text-sm font-medium">{t("cashier.no_products")}</p>
            {canCreateItems ? (
              <QuickAddItem prefill={lastSearch} onAdd={onAddItem} />
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>{t("cashier.managers_only")}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3">
            {items.map(item => (
              <ProductCard
                key={item.item_code}
                item={item}
                trackStock={trackStock}
                inCartQty={cartQty?.[item.item_code] ?? 0}
                onAdd={() => handleAddWithStockCheck(item)}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingOutOfStock}
        onOpenChange={(open) => !open && setPendingOutOfStock(null)}
        title="نفذ المخزون — البيع على أي حال؟"
        description={`هذا الصنف لديه ${pendingOutOfStock?.actualQty ?? 0} في المخزون. البيع سيجعل الرصيد سالباً.`}
        confirmLabel="بيع على أي حال"
        cancelLabel="إلغاء"
        variant="destructive"
        onConfirm={() => { if (pendingOutOfStock) { onAddItem(pendingOutOfStock.cartItem); setPendingOutOfStock(null) } }}
      />
    </div>
  )
}

function ProductCard({
  item,
  trackStock,
  inCartQty = 0,
  onAdd,
}: {
  item: CatalogItem
  trackStock: boolean
  /** qty of this item already in the cart — shows the ×N badge */
  inCartQty?: number
  onAdd: () => void
}) {
  const { t } = useI18n()
  const qty = item.actual_qty ?? null
  const outOfStock = trackStock && qty != null && qty <= 0
  const lowStock = trackStock && qty != null && qty > 0 && qty <= 5

  // Pick a vivid color based on first character of item name
  const colorClass = PLACEHOLDER_COLORS[item.item_name.charCodeAt(0) % PLACEHOLDER_COLORS.length]
  const initial = (item.item_name[0] || "؟").toUpperCase()

  return (
    <button
      onClick={onAdd}
      disabled={outOfStock}
      title={item.item_name /* full name on hover — the visible name clamps to 2 lines */}
      aria-label={`${item.item_name} — ${item.rate > 0 ? fmtCurrency(item.rate) : ""}${inCartQty ? ` (${t("cashier.in_cart")} ×${inCartQty})` : ""}`}
      className={`group relative bg-white rounded-xl border shadow-sm text-start flex flex-col overflow-hidden transition-all duration-150 w-full min-h-[150px]
        disabled:opacity-50 disabled:cursor-not-allowed
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1
        ${!outOfStock
          ? "hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.96] active:bg-emerald-50 cursor-pointer border-slate-200 hover:border-emerald-400"
          : "border-slate-300 grayscale opacity-60"
        }
        ${inCartQty > 0 ? "border-emerald-400 ring-1 ring-emerald-200" : ""}`}
    >
      {/* (13) unmistakable out-of-stock overlay */}
      {outOfStock && (
        <span className="absolute inset-x-0 top-8 z-10 mx-auto w-fit rounded-full bg-slate-800/90 text-white text-xs font-black px-3 py-1 shadow">
          {t("cashier.out_of_stock_full")}
        </span>
      )}
      {/* in-cart badge: instant confirmation of what's already added */}
      {inCartQty > 0 && (
        <span className="absolute top-1.5 start-1.5 z-10 min-w-[28px] h-7 px-1.5 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center shadow-md">
          ×{inCartQty}
        </span>
      )}
      {/* Image or colored letter placeholder */}
      {item.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image}
          alt={item.item_name}
          className="w-full h-24 object-cover bg-slate-100"
        />
      ) : (
        <div className={`w-full h-24 flex items-center justify-center text-4xl font-bold select-none ${colorClass}`}>
          {initial}
        </div>
      )}

      {/* Info */}
      <div className="px-2.5 py-2 flex flex-col gap-1 flex-1">
        <p className="text-xs font-semibold text-slate-800 line-clamp-2 leading-tight text-start min-h-[2.1em]">
          {item.item_name}
        </p>
        <div className="flex items-center justify-between mt-auto pt-1">
          <p className={`text-base font-extrabold tracking-tight ${outOfStock ? "text-slate-500" : "text-emerald-700"}`}>
            {item.rate > 0 ? fmtCurrency(item.rate) : "—"}
          </p>
          {trackStock && qty != null && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${outOfStock
                ? "bg-red-100 text-red-600"
                : lowStock
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}>
              {outOfStock ? t("cashier.out_of_stock") : lowStock ? `${t("cashier.last_left")} ${qty}` : t("cashier.in_stock")}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

