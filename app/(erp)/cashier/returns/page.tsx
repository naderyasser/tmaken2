"use client"

/**
 * Returns Page
 * G1: Partial returns (select items/qty to return)
 * G3: Supervisor authorization required
 * G14: Return receipt shown after processing
 */

import { useState, useCallback, useRef } from "react"
import { Search, Loader2, ArrowLeftRight, Minus, Plus, ReceiptText } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SessionHeader } from "@/components/cashier/session-header"
import { ReceiptPreview } from "@/components/cashier/receipt-preview"
import { SupervisorAuth } from "@/components/cashier/supervisor-auth"
import { cashierApi } from "@/lib/cashier-api"
import type { POSInvoice, InvoiceForReturn, ReturnableItem } from "@/lib/cashier-api"
import { fmtCurrency } from "@/lib/cashier-utils"
import { useCashier } from "@/contexts/CashierContext"
import { useI18n } from "@/lib/i18n"

const RETURN_REASON_KEYS = [
  "cashier.reason_defective",
  "cashier.reason_wrong_item",
  "cashier.reason_changed_mind",
  "cashier.reason_duplicate",
  "cashier.reason_not_as_described",
  "cashier.reason_other",
]

interface ReturnRow extends ReturnableItem {
  return_qty: number
  selected: boolean
}

export default function ReturnsPage() {
  const { t, dir } = useI18n()
  const { session, settings } = useCashier()
  const [invoiceSearch, setInvoiceSearch] = useState("")
  const [lookingUp, setLookingUp] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState("")
  const submittingRef = useRef(false)

  const [invoiceData, setInvoiceData] = useState<InvoiceForReturn | null>(null)
  const [returnRows, setReturnRows] = useState<ReturnRow[]>([])
  const [reason, setReason] = useState("")

  // G3: Supervisor auth — only required when returnTotal > threshold
  const [authOpen, setAuthOpen] = useState(false)
  const [authorized, setAuthorized] = useState(false)

  const authThreshold = settings?.return_auth_threshold ?? 200

  // G14: Return receipt
  const [returnInvoice, setReturnInvoice] = useState<POSInvoice | null>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)

  const handleLookup = useCallback(async () => {
    if (!invoiceSearch.trim()) return
    setLookingUp(true)
    setError("")
    setInvoiceData(null)
    setReturnRows([])
    setAuthorized(false)
    setReason("")
    try {
      const result = await cashierApi.getInvoiceForReturn(invoiceSearch.trim())
      setInvoiceData(result)
      const rows: ReturnRow[] = result.items.map(it => ({
        ...it,
        return_qty: it.returnable_qty,   // default: full returnable amount
        selected: it.returnable_qty > 0,
      }))
      setReturnRows(rows)
      if (rows.every(r => r.returnable_qty === 0)) {
        setError(t("cashier.all_items_returned"))
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("cashier.invoice_not_found"))
    } finally {
      setLookingUp(false)
    }
  }, [invoiceSearch])

  const toggleItem = (idx: number) => {
    setReturnRows(prev => prev.map((r, i) =>
      i === idx ? { ...r, selected: !r.selected } : r
    ))
  }

  const updateReturnQty = (idx: number, qty: number) => {
    setReturnRows(prev => prev.map((r, i) => {
      if (i !== idx) return r
      const clamped = Math.max(0, Math.min(qty, r.returnable_qty))
      return { ...r, return_qty: clamped, selected: clamped > 0 }
    }))
  }

  const handleReturn = useCallback(async () => {
    if (!invoiceData) return
    if (submittingRef.current) return // prevent double submit
    const toReturn = returnRows.filter(r => r.selected && r.return_qty > 0)
    if (toReturn.length === 0) {
      setError(t("cashier.select_one_item"))
      return
    }
    if (!reason) {
      setError(t("cashier.select_reason"))
      return
    }

    setProcessing(true)
    setError("")
    submittingRef.current = true
    try {
      const { invoice: retInv } = await cashierApi.processReturn({
        invoice_name: invoiceData.invoice.name,
        items: toReturn.map(r => ({ item_code: r.item_code, qty: r.return_qty })),
        reason,
      })
      setReturnInvoice(retInv)
      setReceiptOpen(true)
      setInvoiceData(null)
      setReturnRows([])
      setInvoiceSearch("")
      setAuthorized(false)
      setReason("")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("cashier.return_failed"))
    } finally {
      setProcessing(false)
      submittingRef.current = false
    }
  }, [invoiceData, returnRows, reason])

  const initiateReturn = () => {
    const needsAuth = !authorized && authThreshold > 0 && returnTotal > authThreshold
    if (needsAuth) {
      setAuthOpen(true)
    } else {
      handleReturn()
    }
  }

  const onSupervisorAuthorized = () => {
    setAuthorized(true)
    handleReturn()
  }

  const selectedCount = returnRows.filter(r => r.selected && r.return_qty > 0).length
  const returnTotal = returnRows
    .filter(r => r.selected && r.return_qty > 0)
    .reduce((sum, r) => {
      const taxRate = invoiceData?.invoice?.taxes_and_charges ? 0.15 : 0
      return sum + r.rate * r.return_qty * (1 + taxRate)
    }, 0)

  return (
    <div className="flex flex-col h-screen overflow-hidden" dir={dir}>
      <SessionHeader />
      <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
        <h1 className="text-xl font-bold mb-4 flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5" />
          {t("cashier.returns")}
          <span className="text-xs font-normal text-gray-400 mr-1">{t("cashier.returns_subtitle")}</span>
        </h1>

        {/* Invoice lookup */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              className="pr-8"
              placeholder={t("cashier.invoice_no_ph")}
              value={invoiceSearch}
              onChange={e => setInvoiceSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLookup()}
            />
          </div>
          <Button onClick={handleLookup} disabled={lookingUp || !invoiceSearch.trim()}>
            {lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : t("cashier.search")}
          </Button>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-4">
            {error}
          </p>
        )}

        {invoiceData && returnRows.length > 0 && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ReceiptText className="h-4 w-4" />
                {invoiceData.invoice.name}
              </CardTitle>
              <p className="text-sm text-gray-500">
                {invoiceData.invoice.customer}
                &ensp;&mdash;&ensp;
                {invoiceData.invoice.posting_date}
                &ensp;&mdash;&ensp;
                {t("cashier.original_total")}: {fmtCurrency(invoiceData.invoice.grand_total)}
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-gray-500 mb-2">
                {t("cashier.select_items_qty")}
              </p>
              <ScrollArea className="max-h-[280px]">
                <div className="space-y-2">
                  {returnRows.map((row, idx) => {
                    const alreadyReturned = row.already_returned > 0
                    const fullyReturned = row.returnable_qty === 0
                    return (
                      <div
                        key={row.item_code}
                        className={`flex items-center gap-3 p-2 rounded-lg border transition-colors ${fullyReturned
                            ? "bg-gray-50 border-gray-200 opacity-50"
                            : row.selected
                              ? "bg-red-50 border-red-200"
                              : "bg-gray-50 border-gray-200"
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={() => toggleItem(idx)}
                          disabled={fullyReturned}
                          className="rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{row.item_name}</p>
                          <p className="text-xs text-gray-400">
                            {fmtCurrency(row.rate)} × {row.qty} {t("cashier.purchased")}
                            {alreadyReturned && (
                              <span className="ml-1 text-amber-600">
                                &middot; {row.already_returned} {t("cashier.already_returned")}
                              </span>
                            )}
                          </p>
                        </div>
                        {fullyReturned ? (
                          <Badge variant="secondary" className="text-[10px] shrink-0">{t("cashier.returned_badge")}</Badge>
                        ) : (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`${t("cashier.quantity")} −`}
                              className="h-10 w-10 rounded-xl"
                              onClick={() => updateReturnQty(idx, row.return_qty - 1)}
                              disabled={!row.selected}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-8 text-center text-sm font-medium">{row.return_qty}</span>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`${t("cashier.quantity")} +`}
                              className="h-10 w-10 rounded-xl"
                              onClick={() => updateReturnQty(idx, row.return_qty + 1)}
                              disabled={!row.selected || row.return_qty >= row.returnable_qty}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <span className="text-xs text-gray-400">/ {row.returnable_qty}</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>

              <Separator className="my-3" />

              {/* Return reason */}
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-1">{t("cashier.return_reason")} <span className="text-red-500">*</span></p>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder={t("cashier.select_reason_ph")} />
                  </SelectTrigger>
                  <SelectContent>
                    {RETURN_REASON_KEYS.map(k => (
                      <SelectItem key={k} value={t(k)}>{t(k)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600">
                  {t("cashier.return")} {selectedCount} {t("cashier.items_unit")}
                </span>
                <span className="text-sm font-bold text-red-600">
                  {t("cashier.refund_amount")}: {fmtCurrency(returnTotal)}
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setInvoiceData(null)
                    setReturnRows([])
                    setReason("")
                  }}
                >
                  {t("cashier.cancel")}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={initiateReturn}
                  disabled={processing || selectedCount === 0 || !reason}
                >
                  {processing ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("cashier.processing")}
                    </span>
                  ) : (
                    t("cashier.process_return")
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!invoiceData && !lookingUp && (
          <p className="text-sm text-gray-500">
            {t("cashier.returns_hint")}
          </p>
        )}
      </div>

      {/* G3: Supervisor Auth Dialog */}
      <SupervisorAuth
        open={authOpen}
        onOpenChange={setAuthOpen}
        title={t("cashier.return_auth_title")}
        description={t("cashier.return_auth_desc")}
        onAuthorized={onSupervisorAuthorized}
      />

      {/* G14: Return Receipt */}
      {returnInvoice && (
        <Sheet open={receiptOpen} onOpenChange={setReceiptOpen}>
          <SheetContent side="right" className="w-full sm:w-[400px] overflow-y-auto">
            <SheetHeader className="pb-3">
              <SheetTitle className="flex items-center gap-2">
                {t("cashier.return_receipt")}
              </SheetTitle>
            </SheetHeader>
            <ReceiptPreview
              data={{
                invoiceNumber: returnInvoice.name,
                date: returnInvoice.posting_date,
                time: returnInvoice.posting_time || "",
                cashierName: session?.user || "",
                company: settings?.company || "",
                customer: returnInvoice.customer,
                items: (returnInvoice.items || []).map((it: any) => ({
                  item_code: it.item_code,
                  item_name: it.item_name || it.item_code,
                  qty: it.qty,
                  rate: it.rate,
                  amount: it.amount || it.qty * it.rate,
                  discount_percentage: it.discount_percentage || 0,
                })),
                subtotal: Number(returnInvoice.total ?? 0),
                discount: Number(returnInvoice.discount_amount ?? 0),
                taxAmount: Number(returnInvoice.total_taxes_and_charges ?? 0),
                grandTotal: Number(returnInvoice.grand_total ?? 0),
                payments: returnInvoice.payments || [],
                changeAmount: 0,
                isReturn: true,
              }}
              onClose={() => setReceiptOpen(false)}
            />
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
