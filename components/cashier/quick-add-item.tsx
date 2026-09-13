"use client"

import { useState } from "react"
import { Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cashierApi, type CartItem } from "@/lib/cashier-api"

interface QuickAddItemProps {
  /** Pre-fill the search term / barcode the user tried */
  prefill?: string
  onAdd: (item: CartItem) => void
}

export function QuickAddItem({ prefill, onAdd }: QuickAddItemProps) {
  const [open, setOpen] = useState(false)
  const [itemName, setItemName] = useState("")
  const [rate, setRate] = useState("")
  const [barcode, setBarcode] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleOpen = () => {
    setItemName(prefill || "")
    setRate("")
    setBarcode(prefill || "")
    setError("")
    setOpen(true)
  }

  const handleSave = async () => {
    if (!itemName.trim()) {
      setError("Item name is required")
      return
    }
    setSaving(true)
    setError("")
    try {
      const result = await cashierApi.quickAddItem({
        item_name: itemName.trim(),
        rate: parseFloat(rate) || 0,
        barcode: barcode.trim() || undefined,
      })
      const it = result.item
      onAdd({
        item_code: it.item_code,
        item_name: it.item_name,
        qty: 1,
        rate: it.rate,
        amount: it.rate,
        discount_percentage: 0,
      })
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create item")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={handleOpen}
        >
          <Plus className="h-3.5 w-3.5" />
          New Item
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Quick Add Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label htmlFor="qa-name">Item Name *</Label>
            <Input
              id="qa-name"
              placeholder="e.g. New Product"
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="qa-rate">Price (SAR)</Label>
            <Input
              id="qa-rate"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={rate}
              onChange={e => setRate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="qa-barcode">Barcode (optional)</Label>
            <Input
              id="qa-barcode"
              placeholder="Scan or type barcode"
              value={barcode}
              onChange={e => setBarcode(e.target.value)}
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded px-2 py-1">{error}</p>
          )}
          <Button
            className="w-full"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Creating...
              </span>
            ) : (
              "Create & Add to Cart"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
