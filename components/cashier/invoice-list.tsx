"use client"

import { Clock, ReceiptText } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { POSInvoice } from "@/lib/cashier-api"
import { fmtCurrency } from "@/lib/cashier-utils"

interface InvoiceListProps {
  invoices: POSInvoice[]
  onSelect?: (invoice: POSInvoice) => void
  loading?: boolean
}

export function InvoiceList({ invoices, onSelect, loading }: InvoiceListProps) {
  if (loading) {
    return (
      <div className="space-y-2 p-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    )
  }

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <ReceiptText className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">No invoices found</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="divide-y">
        {invoices.map(inv => (
          <button
            key={inv.name}
            className="w-full text-left px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            onClick={() => onSelect?.(inv)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{inv.name}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{inv.customer}</p>
                <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-0.5">
                  <Clock className="h-3 w-3" />
                  {formatDate(inv.posting_date, inv.posting_time)}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-gray-900">
                  {fmtCurrency(inv.grand_total ?? 0)}
                </p>
                <p className="text-[11px] text-gray-400">{inv.status ?? "Submitted"}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  )
}

function formatDate(date?: string, time?: string) {
  if (!date) return ""
  const d = new Date(`${date}T${time || "00:00:00"}`)
  return d.toLocaleString("en-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}
