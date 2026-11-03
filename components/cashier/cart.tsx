"use client"

import { useState, useEffect, useRef } from "react"
import { Minus, Plus, Trash2, ShoppingCart, Percent, CreditCard, Banknote, PauseCircle, Undo2 } from "lucide-react"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { CartItem } from "@/lib/cashier-api"
import { fmtCurrency, setCashierCurrency, setCashierLocale } from "@/lib/cashier-utils"
import { useI18n } from "@/lib/i18n"

interface CartProps {
  items: CartItem[]
  customer: string
  customerName: string
  subtotal: number
  itemDiscountAmt: number
  cartDiscountAmt: number  // B3 fix
  taxAmount: number        // G2: tax visibility
  net: number
  cartDiscountPct: number  // B3 fix
  onCartDiscountChange: (pct: number) => void  // B3 fix
  onUpdateQty: (itemCode: string, qty: number) => void
  onRemove: (itemCode: string) => void
  /** Re-adds a just-removed line as-is (qty + discount) — powers the Undo bar. */
  onRestore?: (item: CartItem) => void
  onCheckout: () => void
  onQuickPay?: () => void
  onHold?: () => void
  onClearCart?: () => void
  checkoutDisabled?: boolean
  currency?: string        // G10: dynamic currency
  taxLabel?: string
}

export function Cart({
  items,
  customer,
  customerName,
  subtotal,
  itemDiscountAmt,
  cartDiscountAmt,
  taxAmount,
  net,
  cartDiscountPct,
  onCartDiscountChange,
  onUpdateQty,
  onRemove,
  onRestore,
  onCheckout,
  onQuickPay,
  onHold,
  onClearCart,
  checkoutDisabled,
  currency,
  taxLabel,
}: CartProps) {
  const [showCartDiscount, setShowCartDiscount] = useState(false)
  const { t, lang } = useI18n()

  // Accidental-deletion guard: minus-to-zero asks first; EVERY removal offers Undo
  // (restores the exact line — qty and discount included) for 8 seconds.
  const [confirmRemove, setConfirmRemove] = useState<CartItem | null>(null)
  const [lastRemoved, setLastRemoved] = useState<CartItem | null>(null)
  useEffect(() => {
    if (!lastRemoved) return
    const id = setTimeout(() => setLastRemoved(null), 8000)
    return () => clearTimeout(id)
  }, [lastRemoved])

  const doRemove = (item: CartItem) => {
    onRemove(item.item_code)
    setLastRemoved(item)
    setConfirmRemove(null)
  }
  const guardedUpdateQty = (itemCode: string, qty: number) => {
    if (qty <= 0) {
      const item = items.find(i => i.item_code === itemCode)
      if (item) setConfirmRemove(item)
      return
    }
    onUpdateQty(itemCode, qty)
  }
  const guardedRemove = (itemCode: string) => {
    const item = items.find(i => i.item_code === itemCode)
    if (item) setConfirmRemove(item)
  }
  const undoRemove = () => {
    if (lastRemoved && onRestore) onRestore(lastRemoved)
    setLastRemoved(null)
  }

  // Sync currency to global fmtCurrency helper
  if (currency) setCashierCurrency(currency)
  setCashierLocale(lang === "ar" ? "ar-SA" : "en-US")

  if (items.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-slate-400 gap-4 p-6">
        <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center">
          <ShoppingCart className="h-10 w-10 opacity-40" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-500">{t("cashier.cart_empty")}</p>
          <p className="text-xs text-slate-400 mt-1">{t("cashier.cart_empty_hint")}</p>
        </div>
        {/* quick action: jump straight to search/scan (same as F2) */}
        <Button
          variant="outline"
          className="h-11 px-5 gap-2 rounded-xl text-sm font-semibold text-emerald-700 border-emerald-300 hover:bg-emerald-50"
          onClick={() => {
            const el = document.querySelector<HTMLInputElement>("[data-cashier-search]")
            el?.focus(); el?.select()
          }}
        >
          <ShoppingCart className="h-4 w-4" />
          {t("cashier.scan_or_search")}
          <kbd className="text-[10px] font-normal opacity-60 border border-emerald-200 px-1 rounded">F2</kbd>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Customer bar */}
      {customerName && (
        <div className="px-3 py-2 bg-emerald-50 border-b border-emerald-100 text-sm font-semibold text-emerald-800 flex items-center gap-2 shrink-0">
          <span className="truncate">{customerName}</span>
          <Badge variant="secondary" className="text-[10px] bg-emerald-200 text-emerald-800 border-0 ms-auto">
            {items.length}
          </Badge>
        </div>
      )}

      {/* Line items */}
      <ScrollArea className="flex-1">
        <div>
          {items.map((item, idx) => (
            <CartLineItem
              key={item.item_code}
              item={item}
              index={idx}
              onUpdateQty={guardedUpdateQty}
              onRemove={guardedRemove}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Undo bar — appears for 8s after any line removal */}
      {lastRemoved && (
        <div role="status" aria-live="polite" className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-white text-xs shrink-0">
          <span className="truncate flex-1">{t("cashier.item_removed")}: {lastRemoved.item_name ?? lastRemoved.item_code}</span>
          <Button size="sm" variant="secondary" className="h-6 px-2 text-xs gap-1" onClick={undoRemove}>
            <Undo2 className="h-3 w-3" />
            {t("cashier.undo")}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmRemove}
        onOpenChange={(o) => { if (!o) setConfirmRemove(null) }}
        title={t("cashier.remove_item_q")}
        description={`${confirmRemove?.item_name ?? confirmRemove?.item_code ?? ""}`}
        confirmLabel={t("cashier.remove")}
        cancelLabel={t("cashier.cancel")}
        variant="destructive"
        onConfirm={() => confirmRemove && doRemove(confirmRemove)}
      />

      {/* Totals — G2: now includes tax */}
      <div className="border-t bg-white p-3 space-y-1.5 text-sm shrink-0">
        <div className="flex justify-between text-slate-500">
          <span>{t("cashier.subtotal")}</span>
          <span>{fmtCurrency(subtotal)}</span>
        </div>
        {itemDiscountAmt > 0 && (
          <div className="flex justify-between text-rose-500">
            <span>{t("cashier.item_discounts")}</span>
            <span>-{fmtCurrency(itemDiscountAmt)}</span>
          </div>
        )}

        {/* B3 fix: cart-level discount */}
        <div className="flex items-center justify-between">
          <button
            className="flex items-center gap-1 text-slate-400 hover:text-emerald-600 transition-colors text-xs"
            onClick={() => setShowCartDiscount(!showCartDiscount)}
          >
            <Percent className="h-3 w-3" />
            {t("cashier.cart_discount")}
          </button>
          {cartDiscountAmt > 0 && (
            <span className="text-rose-500">-{fmtCurrency(cartDiscountAmt)}</span>
          )}
        </div>
        {showCartDiscount && (
          <div className="flex items-center gap-2 py-1">
            <Input
              type="number"
              min="0"
              max="100"
              step="1"
              className="h-7 w-20 text-xs text-right"
              value={cartDiscountPct || ""}
              placeholder="0"
              onChange={e => onCartDiscountChange(parseFloat(e.target.value) || 0)}
            />
            <span className="text-xs text-slate-400">%</span>
          </div>
        )}

        {/* G2: Tax line */}
        {taxAmount > 0 && (
          <div className="flex justify-between text-slate-500">
            <span>{taxLabel ?? t("cashier.vat")}</span>
            <span>{fmtCurrency(taxAmount)}</span>
          </div>
        )}

        {/* Grand Total — emerald prominent box */}
        <div className="!mt-3 rounded-xl bg-emerald-600 px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-emerald-100">{t("cashier.total")}</span>
          <span className="text-2xl font-black text-white tracking-tight">{fmtCurrency(net)}</span>
        </div>

        {/* Action grid */}
        <div className="!mt-3 space-y-2">
          {/* Primary: Pay */}
          {/* UX: Pay is THE primary action — tallest button on screen, carries the live
              total + item count so the cashier never hunts for either. */}
          <Button
            aria-label={`${t("cashier.pay")} ${fmtCurrency(net)}`}
            className="w-full h-14 text-lg font-extrabold gap-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-md focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2"
            onClick={onCheckout}
            disabled={checkoutDisabled}
          >
            <CreditCard className="h-5 w-5" />
            {t("cashier.pay")}
            <span className="font-black">{fmtCurrency(net)}</span>
            <span className="text-[11px] font-semibold bg-emerald-500/60 rounded-full px-2 py-0.5">{items.length}</span>
            <kbd className="ms-auto text-[10px] font-normal opacity-70 bg-emerald-500 px-1.5 py-0.5 rounded">F4</kbd>
          </Button>

          {/* Secondary row: Quick Pay Cash + Hold */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-10 text-sm font-semibold gap-1.5 border-emerald-400 text-emerald-700 hover:bg-emerald-50 rounded-xl"
              onClick={onQuickPay}
              disabled={checkoutDisabled}
            >
              <Banknote className="h-4 w-4" />
              {t("cashier.cash")}
              <kbd className="ms-auto text-[10px] font-normal opacity-60 border border-emerald-300 px-1 py-0 rounded">F8</kbd>
            </Button>
            <Button
              variant="outline"
              className="h-10 text-sm font-semibold gap-1.5 border-amber-400 text-amber-600 hover:bg-amber-50 rounded-xl"
              onClick={onHold}
              disabled={checkoutDisabled}
            >
              <PauseCircle className="h-4 w-4" />
              {t("cashier.hold")}
              <kbd className="ms-auto text-[10px] font-normal opacity-60 border border-amber-300 px-1 py-0 rounded">F6</kbd>
            </Button>
          </div>

          {/* Tertiary row: Discount + Clear Cart */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="ghost"
              className="h-9 text-xs font-medium gap-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl"
              onClick={() => setShowCartDiscount(!showCartDiscount)}
            >
              <Percent className="h-3.5 w-3.5" />
              {t("cashier.discount")}
            </Button>
            <Button
              variant="ghost"
              className="h-9 text-xs font-medium gap-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl"
              onClick={onClearCart}
              disabled={checkoutDisabled}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("cashier.cancel")}
              <kbd className="ms-auto text-[10px] font-normal opacity-50 border border-rose-200 px-1 py-0 rounded">F9</kbd>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// G6: Cart line item with direct quantity input and alternating row background
function CartLineItem({
  item,
  index,
  onUpdateQty,
  onRemove,
}: {
  item: CartItem
  index: number
  onUpdateQty: (itemCode: string, qty: number) => void
  onRemove: (itemCode: string) => void
}) {
  const { t } = useI18n()
  const lineTotal = item.qty * item.rate * (1 - (item.discount_percentage ?? 0) / 100)
  // UX: brief highlight whenever the line appears or its qty changes — instant
  // "it landed in the cart" feedback after a tap/scan.
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    setFlash(true)
    const id = setTimeout(() => setFlash(false), 550)
    return () => clearTimeout(id)
  }, [item.qty])
  const inputRef = useRef<HTMLInputElement>(null)
  const isEven = index % 2 === 0


  return (
    <div className={`flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 transition-colors duration-500 ${flash ? "bg-emerald-100" : isEven ? "bg-white" : "bg-slate-50/60"}`}>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-800 truncate">{item.item_name ?? item.item_code}</p>
        <p className="text-xs text-slate-400">{fmtCurrency(item.rate)} × {item.qty}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="icon"
          variant="ghost"
          aria-label={`${t("cashier.quantity")} −`}
          className="h-10 w-10 rounded-xl text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100"
          onClick={() => onUpdateQty(item.item_code, item.qty - 1)}
        >
          <Minus className="h-4 w-4" />
        </Button>
        {/* (9) qty: directly editable from the FIRST interaction (no press-to-edit),
            large touch target, decimals allowed for weighed items (step=any; the
            server's UOM validation still governs integer-only items). */}
        <Input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          aria-label={t("cashier.quantity")}
          className="w-16 h-10 text-center text-sm font-bold p-0 rounded-xl border-slate-200 focus-visible:ring-2 focus-visible:ring-emerald-500"
          value={item.qty}
          onFocus={e => e.currentTarget.select()}
          onChange={e => {
            const v = parseFloat(e.target.value)
            if (!Number.isNaN(v) && v > 0) onUpdateQty(item.item_code, v)
          }}
        />
        <Button
          size="icon"
          variant="ghost"
          aria-label={`${t("cashier.quantity")} +`}
          className="h-10 w-10 rounded-xl text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100"
          onClick={() => onUpdateQty(item.item_code, item.qty + 1)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs font-bold text-slate-700 w-16 text-right shrink-0">{fmtCurrency(lineTotal)}</p>
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 text-red-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg shrink-0"
        onClick={() => onRemove(item.item_code)}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  )
}

