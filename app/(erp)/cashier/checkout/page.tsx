"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Keyboard } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { SessionHeader } from "@/components/cashier/session-header"
import { ProductGrid } from "@/components/cashier/product-grid"
import { Cart } from "@/components/cashier/cart"
import { CustomerSelector } from "@/components/cashier/customer-selector"
import { PaymentPanel } from "@/components/cashier/payment-panel"
import { ReceiptPreview } from "@/components/cashier/receipt-preview"
import { HoldTransactions } from "@/components/cashier/hold-transactions"
import { useCashier } from "@/contexts/CashierContext"
import { useI18n } from "@/lib/i18n"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import type { PaymentEntry, POSInvoice } from "@/lib/cashier-api"
import { cashierApi } from "@/lib/cashier-api"
import { fmtCurrency, holdTransaction, type PersistedCart } from "@/lib/cashier-utils"
import { loadPaymentDraft, savePaymentDraft } from "@/lib/cashier/pos-db"
import { attachInvoiceToCharges, flagChargesOrphaned } from "@/lib/cashier/terminal/flow"
import { loadTerminalConfig, routesToTerminal } from "@/lib/cashier/terminal/config"
import { useToast } from "@/hooks/use-toast"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export default function CheckoutPage() {
  const router = useRouter()
  const { dir, t } = useI18n()
  const { toast } = useToast()
  const {
    session,
    settings,
    isLoadingSession,
    cart,
    subtotal,
    totalItemDiscount,
    cartDiscountAmount,
    taxAmount,
    grandTotal,
    addItem,
    removeItem,
    updateQty,
    setCustomer,
    setCartDiscount,
    clearCart,
    completeSale,
  } = useCashier()

  const [paymentOpen, setPaymentOpen] = useState(false)
  const [clearCartConfirmOpen, setClearCartConfirmOpen] = useState(false)
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>([])
  const [processing, setProcessing] = useState(false)
  const [receiptData, setReceiptData] = useState<POSInvoice | null>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [savedPayments, setSavedPayments] = useState<PaymentEntry[]>([])

  // B1 fix: Use a ref to always have the latest handleCompletePayment
  const completePaymentRef = useRef<() => Promise<void>>()

  // Session guard
  useEffect(() => {
    if (!isLoadingSession && session?.status !== "Active") {
      router.replace("/cashier")
    }
  }, [isLoadingSession, session, router])

  // Durable payment draft: an in-progress payment (sheet open, split entered) survives
  // a tab close / crash. Restored once the cart itself has been restored; persisted on
  // every change after that (a completed sale clears it via entries=[] + closed sheet).
  const draftRestoredRef = useRef(false)
  useEffect(() => {
    if (draftRestoredRef.current || cart.items.length === 0) return
    draftRestoredRef.current = true
    void loadPaymentDraft().then(d => {
      if (d && d.entries?.length) {
        setPaymentEntries(d.entries)
        if (d.open) setPaymentOpen(true)
      }
    })
  }, [cart.items.length])
  useEffect(() => {
    if (!draftRestoredRef.current) return // never clobber a stored draft before restore
    void savePaymentDraft(
      paymentOpen || paymentEntries.length > 0
        ? { open: paymentOpen, entries: paymentEntries, savedAt: new Date().toISOString() }
        : null,
    )
  }, [paymentOpen, paymentEntries])

  const handleCheckout = useCallback(() => {
    if (cart.items.length === 0) return
    setPaymentOpen(true)
  }, [cart.items.length])

  // D8 fix: prevent duplicate submissions with a ref
  const submittingRef = useRef(false)

  const handleCompletePayment = useCallback(async () => {
    if (submittingRef.current) return // D8: prevent double submit
    submittingRef.current = true
    setProcessing(true)
    // Card charges already settled on the terminal — the money is gone whether or not
    // the invoice posts, so both outcomes below have to account for them.
    const chargeRefs = paymentEntries
      .map(e => e.reference?.clientRef)
      .filter((r): r is string => !!r)
    try {
      const result = await completeSale(paymentEntries)
      // D6 fix: use backend invoice data for receipt, with client payments as fallback
      setReceiptData(result.invoice)
      setSavedPayments(result.invoice.payments ?? [...paymentEntries])
      // Bind each terminal charge to the invoice it paid for; until this runs they stay
      // flagged as open money in the till's terminal journal.
      void attachInvoiceToCharges(chargeRefs, String(result.invoice.name ?? ""))
      // L5: cart already cleared inside completeSale
      setPaymentEntries([])
      setPaymentOpen(false)
      setReceiptOpen(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Payment failed"
      // Card taken, invoice refused: the worst ordinary case. Park the charges for a
      // human rather than letting them vanish with the failed attempt.
      if (chargeRefs.length > 0) void flagChargesOrphaned(chargeRefs, msg)
      toast({ title: msg, variant: "destructive" })
    } finally {
      setProcessing(false)
      submittingRef.current = false
    }
  }, [completeSale, paymentEntries, toast])

  // B1 fix: keep ref always up to date
  useEffect(() => {
    completePaymentRef.current = handleCompletePayment
  }, [handleCompletePayment])

  // G7: Void invoice handler
  const handleVoid = useCallback(async () => {
    if (!receiptData?.name) return
    try {
      await cashierApi.voidInvoice(String(receiptData.name))
      toast({ title: t("cashier.void_ok") })
      setReceiptOpen(false)
      setReceiptData(null)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("cashier.void_failed")
      toast({ title: message, variant: "destructive" })
    }
  }, [receiptData, toast])

  // Hold current cart (parks it and clears the active cart)
  const handleHold = useCallback(() => {
    if (cart.items.length === 0) return
    holdTransaction(cart as unknown as PersistedCart)
    clearCart()
  }, [cart, clearCart])

  // Quick pay (F8)
  const handleQuickPay = useCallback(async () => {
    if (cart.items.length === 0 || submittingRef.current) return
    const defaultMop = (settings?.payment_methods ?? []).find(m => m.is_default)?.mode_of_payment
      || (settings?.payment_methods ?? [])[0]?.mode_of_payment
      || "Cash"
    // Quick-pay tenders the whole total on the default method with no dialog. If that
    // method runs through the card terminal, doing so would record a card payment that
    // was never charged — open the payment panel instead so the card is actually taken.
    if (routesToTerminal(defaultMop, loadTerminalConfig())) {
      setPaymentOpen(true)
      return
    }
    submittingRef.current = true
    const quickEntries: PaymentEntry[] = [{ mode_of_payment: defaultMop, amount: grandTotal }]
    setPaymentEntries(quickEntries)
    setSavedPayments(quickEntries)
    setProcessing(true)
    try {
      const result = await completeSale(quickEntries)
      setReceiptData(result.invoice)
      setSavedPayments(result.invoice.payments ?? quickEntries)
      setPaymentEntries([])
      setPaymentOpen(false)
      setReceiptOpen(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Payment failed"
      toast({ title: msg, variant: "destructive" })
    } finally {
      setProcessing(false)
      submittingRef.current = false
    }
  }, [cart.items.length, settings, grandTotal, completeSale, toast])

  // B7 fix: keyboard shortcuts that respect input focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const isInput = tag === "INPUT" || tag === "TEXTAREA"

      switch (e.key) {
        case "F2":
          // Always allow F2 (focus search) — handled by ProductGrid
          break
        case "F4":
          e.preventDefault()
          // B7 fix: don't open payment panel if typing in an input
          if (!isInput) handleCheckout()
          break
        case "F8":
          e.preventDefault()
          // B7 fix: don't quick-pay if typing
          if (!isInput) handleQuickPay()
          break
        case "F9":
          e.preventDefault()
          // B7 fix: don't clear cart if typing
          if (!isInput && cart.items.length > 0) {
            setClearCartConfirmOpen(true)
          }
          break
        case "F10":
          e.preventDefault()
          // B1 fix: use ref to get the latest handleCompletePayment
          if (paymentOpen) {
            completePaymentRef.current?.()
          }
          break
        case "Escape":
          if (receiptOpen) { setReceiptOpen(false); break }
          if (paymentOpen) { setPaymentOpen(false); break }
          break
        default:
          break
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [cart.items.length, paymentOpen, receiptOpen, handleQuickPay, handleCheckout, clearCart])

  if (isLoadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  const paymentMethods = (settings?.payment_methods ?? []).map(pm => ({
    mode_of_payment: pm.mode_of_payment,
    default: pm.is_default ? 1 : 0,
  }))

  return (
    <div dir={dir} className="flex flex-col h-screen overflow-hidden bg-slate-50 [font-family:var(--font-arabic)]">
      <SessionHeader />
      {/* connection + queue banners now render inside SessionHeader (all screens) */}

      {/* (11) responsive: side-by-side on POS/desktop, stacked grid-over-cart on
          tablets/small screens — targets stay touch-sized in both. */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Product area — 65% on wide, top half when stacked */}
        <div className="lg:flex-[65] flex-1 min-h-0 min-w-0 overflow-hidden">
          <ProductGrid
            onAddItem={addItem}
            cartQty={Object.fromEntries(cart.items.map(i => [i.item_code, i.qty]))}
          />
        </div>

        {/* Cart area — 35% on wide, bottom sheet-like panel when stacked */}
        <div className="lg:flex-[35] lg:min-w-[300px] lg:max-w-[440px] w-full h-[45vh] lg:h-auto flex flex-col bg-white border-t lg:border-t-0 border-s-0 lg:border-s border-slate-200 overflow-hidden shadow-[inset_4px_0_12px_rgba(0,0,0,0.04)]">
          <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2 shrink-0">
            <CustomerSelector
              value={cart.customer}
              displayName={cart.customerName}
              onChange={setCustomer}
            />
            {/* G12: Hold / Resume buttons */}
            <HoldTransactions />
          </div>

          <div className="flex-1 overflow-hidden">
            <Cart
              items={cart.items}
              customer={cart.customer}
              customerName={cart.customerName}
              subtotal={subtotal}
              itemDiscountAmt={totalItemDiscount}
              cartDiscountAmt={cartDiscountAmount}
              taxAmount={taxAmount}
              net={grandTotal}
              cartDiscountPct={cart.discount}
              onCartDiscountChange={setCartDiscount}
              onUpdateQty={updateQty}
              onRemove={removeItem}
              onRestore={addItem}
              onCheckout={handleCheckout}
              onQuickPay={handleQuickPay}
              onHold={handleHold}
              onClearCart={clearCart}
              checkoutDisabled={cart.items.length === 0}
              currency={settings?.currency || "SAR"}
              taxLabel={(settings?.taxes ?? []).length > 0
                ? (settings!.taxes).map(tx => `${tx.tax_name} (${tx.rate}%)`).join(' + ')
                : undefined}
            />
          </div>
        </div>
      </div>

      {/* Payment sheet */}
      <Sheet open={paymentOpen} onOpenChange={setPaymentOpen}>
        <SheetContent side="right" className="w-full sm:w-[440px] p-0 overflow-y-auto">
          <SheetHeader className="px-4 py-3 border-b bg-slate-50">
            <SheetTitle className="text-base font-bold text-slate-800">{t("cashier.complete_payment")}</SheetTitle>
          </SheetHeader>
          <PaymentPanel
            grandTotal={grandTotal}
            paymentMethods={paymentMethods}
            entries={paymentEntries}
            onChange={setPaymentEntries}
            onConfirm={handleCompletePayment}
            loading={processing}
            currency={settings?.currency || "SAR"}
            sessionId={session?.name}
            cashierName={session?.user}
          />
        </SheetContent>
      </Sheet>

      {/* Receipt sheet — G7: includes void action */}
      {receiptData && (
        <Sheet open={receiptOpen} onOpenChange={setReceiptOpen}>
          <SheetContent side="right" className="w-full sm:w-[400px] overflow-y-auto">
            <SheetHeader className="pb-3">
              <SheetTitle>{t("cashier.receipt")}</SheetTitle>
            </SheetHeader>
            <ReceiptPreview
              data={{
                invoiceNumber: String(receiptData.name ?? ""),
                date: String(receiptData.posting_date ?? new Date().toLocaleDateString("en-SA")),
                time: String(receiptData.posting_time ?? new Date().toLocaleTimeString("en-SA")),
                cashierName: String(session?.user ?? ""),
                company: String(receiptData.company ?? settings?.company ?? ""),
                customer: String(receiptData.customer_name ?? receiptData.customer ?? "Walk-In Customer"),
                items: (Array.isArray(receiptData.items) ? receiptData.items : []).map((it: any) => ({
                  item_code: String(it.item_code ?? ""),
                  item_name: String(it.item_name ?? it.item_code ?? ""),
                  qty: Number(it.qty ?? 0),
                  rate: Number(it.rate ?? 0),
                  amount: Number(it.amount ?? 0),
                  discount_percentage: Number(it.discount_percentage ?? 0),
                })),
                subtotal: Number(receiptData.total ?? 0),
                discount: Number(receiptData.discount_amount ?? 0),
                taxAmount: Number(receiptData.total_taxes_and_charges ?? 0),
                grandTotal: Number(receiptData.grand_total ?? 0),
                payments: savedPayments,
                changeAmount: Number(receiptData.change_amount ?? 0),
                qrCode: null,
                zatcaStatus: null,
                currency: settings?.currency || "SAR",
              }}
              onClose={() => setReceiptOpen(false)}
              invoiceName={String(receiptData.name ?? "")}
              showVoid
              onVoid={handleVoid}
            />
          </SheetContent>
        </Sheet>
      )}

      <ConfirmDialog
        open={clearCartConfirmOpen}
        onOpenChange={setClearCartConfirmOpen}
        title={t("cashier.clear_cart_q")}
        description={t("cashier.clear_cart_desc")}
        confirmLabel={t("cashier.clear")}
        cancelLabel={t("cashier.cancel")}
        variant="destructive"
        onConfirm={() => { clearCart(); setClearCartConfirmOpen(false) }}
      />

      {/* Shortcuts bar */}
      <TooltipProvider delayDuration={200}>
        <div className="h-7 bg-slate-950 text-slate-500 flex items-center gap-4 px-4 text-[10px] shrink-0 overflow-x-auto" aria-label="keyboard shortcuts">
          <Keyboard className="h-3 w-3 text-slate-500 shrink-0" />
          {[
            ["F2", t("cashier.search")],
            ["F4", t("cashier.pay")],
            ["F8", t("cashier.quick_cash")],
            ["F9", t("cashier.clear")],
            ["F10", t("cashier.confirm")],
            ["Esc", t("cashier.close")],
          ].map(([key, label]) => (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 cursor-default shrink-0">
                  <kbd className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[10px] font-mono">{key}</kbd>
                  <span className="hidden sm:inline">{label}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  )
}
