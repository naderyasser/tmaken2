"use client"

/**
 * G12 — Hold / Park Transactions
 * Allows cashiers to pause a transaction and serve another customer,
 * then resume the held transaction later.
 */

import { useState, useEffect, useCallback } from "react"
import { Pause, Play, Trash2, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  getHeldTransactions,
  holdTransaction,
  resumeHeldTransaction,
  removeHeldTransaction,
  type HeldTransaction,
} from "@/lib/cashier-utils"
import { fmtCurrency } from "@/lib/cashier-utils"
import { useCashier } from "@/contexts/CashierContext"

export function HoldTransactions() {
  const { cart, clearCart, restoreCart } = useCashier()
  const [held, setHeld] = useState<HeldTransaction[]>([])
  const [open, setOpen] = useState(false)

  const refresh = useCallback(() => {
    setHeld(getHeldTransactions())
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleHold = useCallback(() => {
    if (cart.items.length === 0) return
    const label = cart.customerName !== "Walk-In Customer"
      ? cart.customerName
      : `${cart.items.length} items`
    holdTransaction(cart, label)
    clearCart()
    refresh()
  }, [cart, clearCart, refresh])

  const handleResume = useCallback((id: string) => {
    // If current cart has items, hold it first
    if (cart.items.length > 0) {
      const label = cart.customerName !== "Walk-In Customer"
        ? cart.customerName
        : `${cart.items.length} items`
      holdTransaction(cart, label)
    }
    const tx = resumeHeldTransaction(id)
    if (tx) {
      restoreCart(tx.cart as any)
    }
    refresh()
    setOpen(false)
  }, [cart, restoreCart, refresh])

  const handleRemove = useCallback((id: string) => {
    removeHeldTransaction(id)
    refresh()
  }, [refresh])

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleTimeString("en-SA", { hour: "2-digit", minute: "2-digit" })
  }

  const totalForHeld = (tx: HeldTransaction) => {
    return tx.cart.items.reduce((sum, i) => sum + i.rate * i.qty, 0)
  }

  return (
    <>
      {/* Hold current transaction button */}
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={handleHold}
        disabled={cart.items.length === 0}
        title="Hold current transaction (park)"
      >
        <Pause className="h-3.5 w-3.5" />
        Hold
      </Button>

      {/* View held transactions */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs relative"
            onClick={refresh}
          >
            <Play className="h-3.5 w-3.5" />
            Resume
            {held.length > 0 && (
              <Badge variant="destructive" className="text-[10px] h-4 px-1 ml-1">
                {held.length}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full sm:w-[380px] p-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="flex items-center gap-2">
              Held Transactions
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-80px)]">
            {held.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Pause className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">No held transactions</p>
              </div>
            ) : (
              <div className="divide-y">
                {held.map(tx => (
                  <div key={tx.id} className="px-4 py-3 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <p className="text-sm font-semibold">{tx.label || "Transaction"}</p>
                        <div className="flex items-center gap-1 text-[11px] text-gray-400">
                          <Clock className="h-3 w-3" />
                          {formatTime(tx.heldAt)}
                          <span className="ml-1">{tx.cart.items.length} items</span>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-blue-600">
                        {fmtCurrency(totalForHeld(tx))}
                      </p>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        className="flex-1 h-7 text-xs gap-1"
                        onClick={() => handleResume(tx.id)}
                      >
                        <Play className="h-3 w-3" /> Resume
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-red-500 hover:text-red-700"
                        onClick={() => handleRemove(tx.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  )
}
