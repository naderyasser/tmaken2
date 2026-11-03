"use client"

/**
 * Invoice History Page — Redesigned (Phase 2)
 * G8: Receipt re-print from history
 * Design: emerald/slate design system, IBM Plex Arabic
 */

import { useState, useEffect, useCallback } from "react"
import {
  History, Loader2, Search, Filter, ChevronRight, ChevronLeft,
  Printer, Eye, RefreshCw,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { SessionHeader } from "@/components/cashier/session-header"
import { ReceiptPreview } from "@/components/cashier/receipt-preview"
import { cashierApi } from "@/lib/cashier-api"
import { getLocalInvoices } from "@/lib/cashier/offline-catalog"
import type { POSInvoice } from "@/lib/cashier-api"
import { useCashier } from "@/contexts/CashierContext"
import { fmtCurrency } from "@/lib/cashier-utils"
import { useI18n } from "@/lib/i18n"

const PAGE_SIZE = 20

export default function HistoryPage() {
  const { t, dir } = useI18n()
  const { session, settings } = useCashier()
  const [invoices, setInvoices] = useState<POSInvoice[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState("")
  const [page, setPage] = useState(1)

  // G8: Selected invoice for receipt re-print
  const [selectedInvoice, setSelectedInvoice] = useState<POSInvoice | null>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { invoices: data } = await cashierApi.getSales({ limit: 500 })
      // prepend locally-queued sales (not on the server yet) so the cashier always
      // sees every sale they made — their LOCAL- number swaps for the real one after sync
      const local = await getLocalInvoices().catch(() => [])
      const queued = local.filter(r => r.queued).map(r => ({
        ...r.invoice,
        name: r.invoice.name,
        status: "Pending Sync",
      }))
      setInvoices([...queued, ...data])
    } catch {
      // network down → local cache: queued sales first, then reconciled snapshots
      const local = await getLocalInvoices().catch(() => [])
      if (local.length) {
        setInvoices(local.map(r => ({
          ...r.invoice,
          name: r.queued ? r.invoice.name : (r.server_name || r.invoice.name),
          status: r.queued ? "Pending Sync" : r.invoice.status,
        })))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Client-side filter
  const filtered = filter.trim()
    ? invoices.filter(inv =>
      inv.name.toLowerCase().includes(filter.toLowerCase()) ||
      inv.customer.toLowerCase().includes(filter.toLowerCase())
    )
    : invoices

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(page, totalPages)
  const paginated = filtered.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE)

  const handleFilterChange = (val: string) => {
    setFilter(val)
    setPage(1)
  }

  // G8: Open receipt for selected invoice
  const handleSelectInvoice = useCallback(async (inv: POSInvoice) => {
    setLoadingDetail(true)
    try {
      const result = await cashierApi.getInvoiceDetail(inv.name)
      setSelectedInvoice(result.invoice)
      setReceiptOpen(true)
    } catch {
      setSelectedInvoice(inv)
      setReceiptOpen(true)
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  const statusBadge = (status?: string) => {
    const s = status?.toLowerCase() ?? ""
    // Note: unicode escapes below match legacy Arabic status values
    // ("مدفوع" / "ملغي" / "مرتجع" / "مسودة" / "بانتظار المزامنة") still present
    // in server data or previously-cached local invoices.
    if (s === "paid" || s === "\u0645\u062F\u0641\u0648\u0639")
      return <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{t("cashier.status_paid")}</span>
    if (s === "cancelled" || s === "\u0645\u0644\u063A\u064A")
      return <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700">{t("cashier.status_cancelled")}</span>
    if (s === "return" || s === "\u0645\u0631\u062A\u062C\u0639")
      return <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{t("cashier.status_return")}</span>
    if (s === "draft" || s === "\u0645\u0633\u0648\u062F\u0629")
      return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{t("cashier.status_draft")}</span>
    if (s === "pending sync" || s === "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0632\u0627\u0645\u0646\u0629")
      return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-700">{t("cashier.pending_sync")}</span>
    return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{status ?? "—"}</span>
  }

  return (
    <div
      className="flex flex-col h-screen overflow-hidden bg-slate-50 [font-family:var(--font-arabic)]"
      dir={dir}
    >
      <SessionHeader />

      {/* ── Toolbar ── */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="flex items-center gap-2 text-slate-700">
          <History className="h-5 w-5 text-emerald-600" />
          <h1 className="font-bold text-base">{t("cashier.invoice_history")}</h1>
        </div>

        <div className="flex-1 flex items-center gap-2 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              className="h-8 text-sm pr-8 rounded-lg border-slate-200 bg-slate-50"
              placeholder={t("cashier.search_invoice_ph")}
              value={filter}
              onChange={e => handleFilterChange(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 ms-auto">
          <span className="text-xs text-slate-500 bg-slate-100 rounded-full px-2.5 py-1">
            {filtered.length} {t("cashier.invoices_unit")}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-slate-600"
            onClick={() => { load(); setPage(1) }}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        {loading && !invoices.length ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="text-sm text-slate-500">{t("cashier.loading_invoices")}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Filter className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">{t("cashier.no_matching_invoices")}</p>
            {filter && (
              <Button variant="ghost" size="sm" onClick={() => handleFilterChange("")}>
                {t("cashier.clear_filter")}
              </Button>
            )}
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Table wrapper */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-6 gap-0 bg-slate-50 border-b border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <span className="col-span-2">{t("cashier.invoice_customer")}</span>
                <span>{t("cashier.date")}</span>
                <span className="text-center">{t("cashier.payment_method")}</span>
                <span className="text-center">{t("cashier.total")}</span>
                <span className="text-center">{t("cashier.status")}</span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-slate-100">
                {paginated.map((inv, i) => {
                  const payMethod = inv.payments?.[0]?.mode_of_payment ?? "—"
                  return (
                    <div
                      key={inv.name}
                      className={`grid grid-cols-6 gap-0 items-center px-4 py-3 hover:bg-slate-50/80 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                        }`}
                    >
                      {/* Invoice # + customer */}
                      <div className="col-span-2">
                        <p className="text-sm font-bold text-slate-800">{inv.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {inv.customer_name ?? inv.customer}
                        </p>
                      </div>

                      {/* Date */}
                      <div>
                        <p className="text-xs text-slate-700">{inv.posting_date}</p>
                        {inv.posting_time && (
                          <p className="text-xs text-slate-400">{inv.posting_time.slice(0, 5)}</p>
                        )}
                      </div>

                      {/* Payment method */}
                      <div className="text-center">
                        <span className="text-xs font-semibold text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">
                          {payMethod}
                        </span>
                      </div>

                      {/* Grand total */}
                      <p className="text-sm font-black text-emerald-700 text-center">
                        {fmtCurrency(Number(inv.grand_total))}
                      </p>

                      {/* Status + actions */}
                      <div className="flex items-center justify-center gap-1.5">
                        {statusBadge(inv.status)}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-emerald-600"
                          title={t("cashier.view_receipt")}
                          disabled={loadingDetail}
                          onClick={() => handleSelectInvoice(inv)}
                        >
                          {loadingDetail && selectedInvoice?.name === inv.name
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-sky-600"
                          title={t("cashier.print")}
                          disabled={loadingDetail}
                          onClick={() => handleSelectInvoice(inv)}
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-2.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-slate-600 disabled:opacity-30"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                  {t("cashier.prev")}
                </Button>
                <span className="text-xs text-slate-500">
                  {t("cashier.page")} {safeCurrentPage} {t("cashier.of")} {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-slate-600 disabled:opacity-30"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  {t("cashier.next")}
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* G8: Receipt re-print sheet */}
      {selectedInvoice && (
        <Sheet open={receiptOpen} onOpenChange={setReceiptOpen}>
          <SheetContent side="right" className="w-full sm:w-[400px] overflow-y-auto">
            <SheetHeader className="pb-3">
              <SheetTitle className="flex items-center gap-2">
                {t("cashier.receipt")} — {selectedInvoice.name}
              </SheetTitle>
            </SheetHeader>
            <ReceiptPreview
              data={{
                invoiceNumber: selectedInvoice.name,
                date: selectedInvoice.posting_date,
                time: selectedInvoice.posting_time || "",
                cashierName: session?.user || "",
                company: selectedInvoice.company ?? settings?.company ?? "",
                customer: selectedInvoice.customer_name ?? selectedInvoice.customer ?? "Walk-In Customer",
                items: (selectedInvoice.items || []).map((it: { item_code: string; item_name?: string; qty: number; rate: number; amount?: number; discount_percentage?: number }) => ({
                  item_code: it.item_code,
                  item_name: it.item_name || it.item_code,
                  qty: it.qty,
                  rate: it.rate,
                  amount: it.amount ?? it.qty * it.rate,
                  discount_percentage: it.discount_percentage || 0,
                })),
                subtotal: Number(selectedInvoice.total ?? selectedInvoice.grand_total ?? 0),
                discount: Number(selectedInvoice.discount_amount ?? 0),
                taxAmount: Number(selectedInvoice.total_taxes_and_charges ?? 0),
                grandTotal: Number(selectedInvoice.grand_total ?? 0),
                payments: selectedInvoice.payments || [],
                changeAmount: Number(selectedInvoice.change_amount ?? 0),
              }}
              onClose={() => setReceiptOpen(false)}
            />
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
